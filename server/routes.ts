import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { Agent, AgentWithTeam, emailPreferencesSchema } from "@shared/schema";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { seedDatabase } from "./seed";
import { migrations, revertMigration, applyMigration } from "./migrations";
import { checkSchemaHealth } from "./schema-health";
import { emailService } from "./email";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import rateLimit from "express-rate-limit";

// Extend Express User type
declare global {
  namespace Express {
    interface User extends Agent {}
  }
}

const scryptAsync = promisify(scrypt);

// === AGENT SANITIZERS ===
// Returns own-agent profile: all fields except credentials and reset tokens.
function sanitizeAgentSelf(agent: Agent): Omit<Agent, 'password' | 'resetToken' | 'resetTokenExpiry'> {
  const { password, resetToken, resetTokenExpiry, ...safe } = agent;
  return safe;
}

// Returns a public-safe agent record for cross-user responses (upline/team).
// Strips all PII, payment data, credentials, and privilege flags.
type AgentPublicSafe = Pick<Agent,
  'id' | 'firstName' | 'lastName' | 'currentRank' | 'highestRank' | 'qualifiedRank' | 'paidAsRank' |
  'status' | 'profileImageUrl' | 'bio' | 'referralCode' | 'sponsorId' | 'placementId' | 'leg' |
  'personalVolume' | 'leftLegVolume' | 'rightLegVolume' | 'carryoverLeft' | 'carryoverRight' | 'createdAt'
>;

function sanitizeAgentPublic(agent: Agent): AgentPublicSafe {
  return {
    id: agent.id,
    firstName: agent.firstName,
    lastName: agent.lastName,
    currentRank: agent.currentRank,
    highestRank: agent.highestRank,
    qualifiedRank: agent.qualifiedRank,
    paidAsRank: agent.paidAsRank,
    status: agent.status,
    profileImageUrl: agent.profileImageUrl,
    bio: agent.bio,
    referralCode: agent.referralCode,
    sponsorId: agent.sponsorId,
    placementId: agent.placementId,
    leg: agent.leg,
    personalVolume: agent.personalVolume,
    leftLegVolume: agent.leftLegVolume,
    rightLegVolume: agent.rightLegVolume,
    carryoverLeft: agent.carryoverLeft,
    carryoverRight: agent.carryoverRight,
    createdAt: agent.createdAt,
  };
}

function sanitizeAgentWithTeam(node: AgentWithTeam): AgentWithTeam {
  const sanitized = sanitizeAgentPublic(node as Agent) as AgentWithTeam;
  sanitized.children = node.children?.map(sanitizeAgentWithTeam);
  sanitized.volume = node.volume;
  sanitized.teamSize = node.teamSize;
  return sanitized;
}

// Destroy all PostgreSQL-backed sessions for a given user ID so that
// a password change or reset invalidates any stolen/concurrent sessions.
async function destroyAllUserSessions(userId: number): Promise<void> {
  await pool.query(
    `DELETE FROM session WHERE sess->'passport'->>'user' = $1::text`,
    [String(userId)]
  );
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// GBR Waterfall Commission Config (MCA Platform Compensation Policy)
const CONFIG = {
  gbrWaterfall: {
    mac: 0.30,
    macSplit: {
      primaryAgent: 0.22,
      seniorSponsor: 0.05,
      executiveSponsor: 0.03,
    },
    tfc: { min: 0.30, max: 0.40 },
    picf: { min: 0.25, max: 0.35 },
    rsr: 0.05,
  },
  fulfillmentTierRates: {
    tier_1: 0.30,
    tier_2: 0.33,
    tier_3: 0.36,
    tier_4: 0.40,
  } as Record<string, number>,
  holdback: {
    immediateRelease: 0.70,
    deferred: 0.30,
    deferralDays: 75,
  },
  clawback: {
    days0to30: 1.00,
    days31to90: 0.50,
    after90: 0.00,
  },
  subscriptionPools: {
    tier_1: 0.50,
    tier_2: 0.60,
    tier_3: 0.70,
  } as Record<string, number>,
  subscriptionDecay: {
    months1to3: 1.00,
    months4to6: 0.75,
    months7to9: 0.50,
    months10to12: 0.25,
    postMonth12: 0.10,
  },
  mcaPairingBonus: 0.05,
  subscriptionUplinesOverride: {
    l1Rate: 0.10, // L1 sponsor earns 10% of the subscription pool × decay
    l2Rate: 0.05, // L2 sponsor earns 5% of the subscription pool × decay
  },
  subscriptionTierPrices: {
    tier_1: 199,
    tier_2: 429,
    tier_3: 749,
  } as Record<string, number>,
  platformFee: {
    standard: 99,
    waivers: {
      level1: { threshold: 3000, reduction: 0.50 },
      level2: { threshold: 5000, reduction: 1.00 },
      level3: { threshold: 8500, reduction: 1.00, credit: 100 },
    },
  },
  residualProduction: {
    minRevenue: 3000,
    minMcaAndSub: { mca: 1, subscriptions: 1 },
    reductionAfterDays: 90,
    reductionPercent: 0.50,
    suspensionAfterMonths: 6,
  },
  binaryBonus: {
    builder: { rate: 0.05, max: 2500 },
    leader: { rate: 0.06, max: 5000 },
    director: { rate: 0.07, max: 10000 },
    partner: { rate: 0.08, max: 25000 },
  } as Record<string, { rate: number; max: number }>,
  rankRequirements: {
    builder: { personalVolume: 1000, weakLegVolume: 2500 },
    leader: { personalVolume: 2500, weakLegVolume: 10000 },
    director: { personalVolume: 5000, weakLegVolume: 25000 },
    partner: { personalVolume: 10000, weakLegVolume: 100000 },
  } as Record<string, { personalVolume: number; weakLegVolume: number }>,
  stripePriceIds: {
    tier_1: process.env.STRIPE_PRICE_TIER_1 ?? '',
    tier_2: process.env.STRIPE_PRICE_TIER_2 ?? '',
    tier_3: process.env.STRIPE_PRICE_TIER_3 ?? '',
  } as Record<string, string>,
};

// Middleware helpers
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // @ts-ignore
  if (!req.user?.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === AUTH SETUP ===
  const PgSession = pgSession(session);
  
  app.use(
    session({
      store: new PgSession({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "dev_secret_change_in_production",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getAgentByEmail(username);
        if (!user) return done(null, false, { message: "Invalid credentials" });
        
        if (user.status === 'suspended') {
          return done(null, false, { message: "Account suspended" });
        }
        
        const isValid = await comparePasswords(password, user.password);
        if (!isValid) return done(null, false, { message: "Invalid credentials" });
        
        // Update last login
        await storage.updateAgent(user.id, { lastLoginAt: new Date() });
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getAgent(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // ==================== RATE LIMITERS ====================
  // Disabled in test environment to avoid interfering with integration tests.
  const isTestEnv = process.env.NODE_ENV === "test";

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isTestEnv ? 0 : 20,  // 0 = unlimited in test
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
  });

  const passwordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isTestEnv ? 0 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv,
    message: { message: "Too many password reset attempts. Please try again in an hour." },
  });

  const sponsorSearchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isTestEnv ? 0 : 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv,
    message: { message: "Too many search requests. Please slow down." },
  });

  // ==================== AUTH ROUTES ====================

  // Sponsor search endpoint (public - for registration dropdown)
  app.get(api.auth.searchSponsors.path, sponsorSearchLimiter, async (req, res) => {
    try {
      const query = (req.query.q as string) || '';
      const results = await storage.searchAgentsForSponsor(query);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.auth.register.path, authLimiter, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      const existing = await storage.getAgentByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      let sponsorId: number | undefined;
      
      // First check if sponsorId was provided directly
      if (input.sponsorId) {
        const sponsor = await storage.getAgent(input.sponsorId);
        // Validate sponsor is active
        if (sponsor && sponsor.status === 'active') {
          sponsorId = sponsor.id;
        }
      }
      // Fall back to referral code if no sponsorId
      else if (input.referralCode) {
        const sponsor = await storage.getAgentByReferralCode(input.referralCode);
        // Validate sponsor is active
        if (sponsor && sponsor.status === 'active') {
          sponsorId = sponsor.id;
        }
      }
      
      let placementId: number | undefined;
      let leg: 'left' | 'right' | undefined;
      
      if (sponsorId) {
        const placement = await storage.findPlacement(sponsorId, input.placementLeg || 'auto');
        placementId = placement.placementId;
        leg = placement.leg;
      }
      
      const hashedPassword = await hashPassword(input.password);
      const agent = await storage.createAgent({
        ...input,
        password: hashedPassword,
        sponsorId,
        placementId,
        leg: leg as 'left' | 'right',
        currentRank: 'agent',
        status: 'active',
        isAdmin: false,
        isSuperAdmin: false,
      });
      
      // Create welcome notification
      await storage.createNotification({
        agentId: agent.id,
        type: 'system',
        title: 'Welcome to Leadershield Network!',
        message: 'Your account has been created. Start by completing your profile and exploring the platform.',
        isRead: false,
        emailSent: false,
      });
      
      // Send welcome email (async, don't wait)
      emailService.sendWelcomeEmail(agent.email, agent.firstName).catch(console.error);
      
      // Notify sponsor of new team member
      if (sponsorId) {
        const sponsor = await storage.getAgent(sponsorId);
        if (sponsor) {
          await storage.createNotification({
            agentId: sponsor.id,
            type: 'team_signup',
            title: 'New Team Member!',
            message: `${agent.firstName} ${agent.lastName} just joined your team!`,
            isRead: false,
            emailSent: false,
          });
          const sponsorPrefs = (sponsor.emailPreferences as { emailOnTeamSignup?: boolean } | null) ?? {};
          if (sponsorPrefs.emailOnTeamSignup !== false) {
            emailService.sendTeamSignupEmail(sponsor.email, {
              firstName: sponsor.firstName,
              newMemberName: `${agent.firstName} ${agent.lastName}`,
            }).catch(console.error);
          }
        }
      }
      
      req.login(agent, (err) => {
        if (err) throw err;
        res.status(201).json(sanitizeAgentSelf(agent));
      });
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, authLimiter, passport.authenticate("local"), (req, res) => {
    res.status(200).json(sanitizeAgentSelf(req.user as Agent));
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout(() => {
      res.status(200).send();
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    res.json(sanitizeAgentSelf(req.user as Agent));
  });

  app.post(api.auth.changePassword.path, requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = api.auth.changePassword.input.parse(req.body);
      // @ts-ignore
      const user = await storage.getAgent(req.user.id);
      
      if (!user || !(await comparePasswords(currentPassword, user.password))) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateAgent(user.id, { password: hashedPassword });

      // Invalidate all active sessions for this user (including stolen ones)
      await destroyAllUserSessions(user.id);

      res.json({ message: "Password changed successfully. Please sign in again." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Forgot password
  app.post(api.auth.forgotPassword.path, passwordLimiter, async (req, res) => {
    try {
      const { email } = api.auth.forgotPassword.input.parse(req.body);
      const agent = await storage.getAgentByEmail(email);

      if (agent) {
        const rawToken = randomBytes(32).toString("hex");
        const hashedToken = createHash("sha256").update(rawToken).digest("hex");
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await storage.setResetToken(agent.id, hashedToken, expiry);

        const resetUrl = `${process.env.APP_URL || `https://${req.get('host')}`}/reset-password?token=${rawToken}`;
        emailService.sendPasswordResetEmail(agent.email, {
          firstName: agent.firstName,
          resetUrl,
        }).catch(console.error);
      }

      res.json({ message: "If an account with that email exists, we've sent a password reset link." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset password
  app.post(api.auth.resetPassword.path, passwordLimiter, async (req, res) => {
    try {
      const { token, newPassword } = api.auth.resetPassword.input.parse(req.body);
      const hashedToken = createHash("sha256").update(token).digest("hex");
      const agent = await storage.getAgentByResetToken(hashedToken);

      if (!agent) {
        return res.status(400).json({ message: "Invalid or expired reset link." });
      }

      if (!agent.resetTokenExpiry || new Date() > agent.resetTokenExpiry) {
        await storage.clearResetToken(agent.id);
        return res.status(400).json({ message: "This reset link has expired. Please request a new one." });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateAgent(agent.id, { password: hashedPassword });
      await storage.clearResetToken(agent.id);

      // Invalidate all active sessions for this user (including stolen ones)
      await destroyAllUserSessions(agent.id);

      res.json({ message: "Your password has been reset successfully. You can now sign in." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== AGENT ROUTES ====================
  // Static GET routes must be registered before the dynamic GET /api/agents/:id
  // route, otherwise Express matches e.g. /api/agents/dashboard with id="dashboard"
  // and Number("dashboard") === NaN crashes the DB query.

  app.get(api.agents.dashboard.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const agentId = req.user!.id;
    const agent = await storage.getAgent(agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    
    const stats = await storage.getCommissionStats(agentId);
    const teamSize = await storage.getTeamSize(agentId);
    const recentDeals = await storage.getDealsByAgent(agentId);
    const recentCommissions = await storage.getCommissionsByAgent(agentId);
    
    const weekStart = getWeekStart();
    const leftVol = await storage.getLegVolume(agentId, 'left', weekStart);
    const rightVol = await storage.getLegVolume(agentId, 'right', weekStart);
    
    // Calculate rank progress
    const currentRankIndex = ['agent', 'builder', 'leader', 'director', 'partner'].indexOf(agent.currentRank);
    const nextRank = currentRankIndex < 4 ? ['agent', 'builder', 'leader', 'director', 'partner'][currentRankIndex + 1] : null;
    
    let rankProgress = 100;
    if (nextRank) {
      // @ts-ignore
      const requirements = CONFIG.rankRequirements[nextRank];
      if (requirements) {
        const weakLeg = Math.min(leftVol, rightVol);
        const pvProgress = Math.min(Number(agent.personalVolume) / requirements.personalVolume, 1);
        const tvProgress = Math.min(weakLeg / requirements.weakLegVolume, 1);
        rankProgress = Math.round(((pvProgress + tvProgress) / 2) * 100);
      }
    }
    
    const subscriptionRevenue = await storage.getActiveSubscriptionRevenue(agentId);
    let platformFeeStatus = {
      standardFee: CONFIG.platformFee.standard,
      currentFee: CONFIG.platformFee.standard,
      waiverLevel: 'none' as string,
      credit: 0,
      subscriptionRevenue,
    };
    if (subscriptionRevenue >= CONFIG.platformFee.waivers.level3.threshold) {
      platformFeeStatus = { ...platformFeeStatus, currentFee: 0, waiverLevel: 'level3', credit: CONFIG.platformFee.waivers.level3.credit };
    } else if (subscriptionRevenue >= CONFIG.platformFee.waivers.level2.threshold) {
      platformFeeStatus = { ...platformFeeStatus, currentFee: 0, waiverLevel: 'level2' };
    } else if (subscriptionRevenue >= CONFIG.platformFee.waivers.level1.threshold) {
      platformFeeStatus = { ...platformFeeStatus, currentFee: Math.round(CONFIG.platformFee.standard * 0.50), waiverLevel: 'level1' };
    }

    const holdbacksList = await storage.getHoldbacksByAgent(agentId);
    const totalHeld = holdbacksList.filter(h => h.status === 'held').reduce((s, h) => s + Number(h.totalAmount), 0);
    
    res.json({
      totalEarned: stats.totalEarned,
      thisWeek: stats.thisWeek,
      thisMonth: stats.thisMonth,
      pending: stats.pending,
      teamSize,
      personalVolume: Number(agent.personalVolume),
      leftLegVolume: leftVol,
      rightLegVolume: rightVol,
      currentRank: agent.currentRank,
      nextRank,
      rankProgress,
      recentDeals: recentDeals.slice(0, 5),
      recentCommissions: recentCommissions.slice(0, 5),
      platformFee: platformFeeStatus,
      totalHeldBack: totalHeld,
    });
  });

  app.get(api.agents.rankProgress.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const agent = await storage.getAgent(req.user!.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    
    const weekStart = getWeekStart();
    const leftVol = await storage.getLegVolume(agent.id, 'left', weekStart);
    const rightVol = await storage.getLegVolume(agent.id, 'right', weekStart);
    const weakLeg = Math.min(leftVol, rightVol);
    
    const currentRankIndex = ['agent', 'builder', 'leader', 'director', 'partner'].indexOf(agent.currentRank);
    const nextRank = currentRankIndex < 4 ? ['agent', 'builder', 'leader', 'director', 'partner'][currentRankIndex + 1] : null;
    
    // @ts-ignore
    const requirements = nextRank ? CONFIG.rankRequirements[nextRank] : null;
    
    const progress = requirements ? {
      personalVolume: { current: Number(agent.personalVolume), required: requirements.personalVolume },
      weakLegVolume: { current: weakLeg, required: requirements.weakLegVolume },
    } : null;
    
    const qualified = requirements 
      ? Number(agent.personalVolume) >= requirements.personalVolume && weakLeg >= requirements.weakLegVolume
      : true;
    
    res.json({
      currentRank: agent.currentRank,
      highestRank: agent.highestRank,
      nextRank,
      requirements,
      progress,
      qualified,
    });
  });

  // Get referral link
  app.get(api.agents.referralLink.path, requireAuth, async (req, res) => {
    const agent = await storage.getAgent(req.user!.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    
    // Generate code if missing
    let referralCode = agent.referralCode;
    if (!referralCode) {
      referralCode = `${agent.firstName[0]}${agent.lastName[0]}${Math.random().toString(36).substring(2, 6)}`.toUpperCase();
      await storage.updateAgent(agent.id, { referralCode });
    }
    
    const baseUrl = process.env.APP_URL || 'https://leadershield.com';
    const referralUrl = `${baseUrl}/join/${referralCode}`;
    
    res.json({ referralCode, referralUrl });
  });

  // Get referral stats
  app.get(api.agents.referralStats.path, requireAuth, async (req, res) => {
    const stats = await storage.getReferralStats(req.user!.id);
    res.json({
      ...stats,
      recentReferrals: stats.recentReferrals.map(r => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });

  // Dynamic routes after all static /api/agents/* routes
  app.get(api.agents.get.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const requestedId = Number(req.params.id);
    // @ts-ignore
    if (req.user!.id !== requestedId && !req.user!.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    const agent = await storage.getAgent(requestedId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(sanitizeAgentSelf(agent));
  });

  app.get(api.agents.team.path, requireAuth, async (req, res) => {
    // @ts-ignore
    if (req.user!.id !== Number(req.params.id) && !req.user!.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const team = await storage.getTeamStructure(Number(req.params.id));
    res.json(sanitizeAgentWithTeam(team));
  });

  app.get(api.agents.upline.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const requestedId = Number(req.params.id);
    // @ts-ignore
    if (req.user!.id !== requestedId && !req.user!.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    const upline = await storage.getUpline(requestedId);
    res.json(upline.map(sanitizeAgentPublic));
  });

  app.patch(api.agents.updateProfile.path, requireAuth, async (req, res) => {
    try {
      const input = api.agents.updateProfile.input.parse(req.body);
      // @ts-ignore
      const updated = await storage.updateAgent(req.user!.id, input);
      res.json(sanitizeAgentSelf(updated));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch(api.agents.updatePayoutMethod.path, requireAuth, async (req, res) => {
    try {
      const input = api.agents.updatePayoutMethod.input.parse(req.body);
      // @ts-ignore
      const updated = await storage.updateAgent(req.user!.id, input);
      res.json(sanitizeAgentSelf(updated));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update payout method" });
    }
  });

  app.patch(api.agents.updateNotificationPreferences.path, requireAuth, async (req, res) => {
    try {
      const prefs = emailPreferencesSchema.parse(req.body);
      // @ts-ignore
      const updated = await storage.updateAgent(req.user!.id, { emailPreferences: prefs });
      res.json(sanitizeAgentSelf(updated));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // ==================== DEAL ROUTES ====================

  app.post(api.deals.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.deals.create.input.parse(req.body);
      // @ts-ignore
      const agentId = req.user!.id;
      
      const companyRevenue = Number(input.loanAmount) * 0.10;
      const gbrAmount = input.gbrAmount ? Number(input.gbrAmount) : companyRevenue;
      
      // Detect state compliance flags from business state
      const businessState = (input.businessState || '').toUpperCase();
      const isVaMerchant = businessState === 'VA';
      const isCaMerchant = businessState === 'CA';
      const isUtMerchant = businessState === 'UT';

      // Deals start as 'pending' — closed by the closing team, not the submitting agent
      const deal = await storage.createDeal({
        ...input,
        agentId,
        loanAmount: input.loanAmount.toString(),
        companyRevenue: companyRevenue.toString(),
        gbrAmount: gbrAmount.toString(),
        avgMonthlyRevenue: input.avgMonthlyRevenue ? input.avgMonthlyRevenue.toString() : null,
        requestedAmount: input.requestedAmount ? input.requestedAmount.toString() : null,
        isVaMerchant,
        isCaMerchant,
        isUtMerchant,
        status: 'pending',
        pmfSubmissionStatus: 'pending',
        documents: input.documents || [],
      });
      
      // Stub PMF API submission (replace with real API call when endpoint is available)
      submitToPmf(deal, agentId).catch(err => 
        console.error(`PMF submission error for deal ${deal.id}:`, err)
      );
      
      const agent = await storage.getAgent(agentId);
      
      // Notify agent their deal was submitted (not funded yet — that happens when admin approves)
      await storage.createNotification({
        agentId,
        type: 'deal_funded',
        title: 'Deal Submitted to Closing Team',
        message: `Your MCA application for ${deal.merchantName} has been submitted. The closing team will review and update you on status.`,
        dealId: deal.id,
        isRead: false,
        emailSent: false,
      });

      res.status(201).json(deal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, errors: err.errors });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });

  // PMF stub submission function — replace with real API call when PMF provides endpoint
  async function submitToPmf(deal: any, agentId: number): Promise<void> {
    const PMF_API_URL = process.env.PMF_API_URL;
    const PMF_API_KEY = process.env.PMF_API_KEY;

    const payload = {
      merchantName: deal.merchantName,
      merchantDba: deal.merchantDba,
      merchantEmail: deal.merchantEmail,
      merchantPhone: deal.merchantPhone,
      businessType: deal.businessType,
      ein: deal.ein,
      businessStartDate: deal.businessStartDate,
      industry: deal.industry,
      businessAddress: deal.businessAddress,
      businessCity: deal.businessCity,
      businessState: deal.businessState,
      businessZip: deal.businessZip,
      ownerFirstName: deal.ownerFirstName,
      ownerLastName: deal.ownerLastName,
      ownerEmail: deal.ownerEmail,
      ownerPhone: deal.ownerPhone,
      ownerDob: deal.ownerDob,
      ownerOwnershipPct: deal.ownerOwnershipPct,
      ownerAddress: deal.ownerAddress,
      ownerCity: deal.ownerCity,
      ownerState: deal.ownerState,
      ownerZip: deal.ownerZip,
      requestedAmount: deal.requestedAmount,
      useOfFunds: deal.useOfFunds,
      avgMonthlyRevenue: deal.avgMonthlyRevenue,
      programType: deal.programType,
      documents: deal.documents,
      stateDisclosureConfirmed: deal.stateDisclosureConfirmed,
      // NOTE: Submitting agent identity is intentionally NOT included in the PMF payload
      // The closing agent identity is managed internally by the platform
    };

    if (!PMF_API_URL || !PMF_API_KEY) {
      // PMF API not yet configured — log and mark as submitted for internal tracking
      console.log(`[PMF STUB] Deal ${deal.id} submission queued. PMF_API_URL/PMF_API_KEY not set.`);
      console.log(`[PMF STUB] Payload:`, JSON.stringify(payload, null, 2));
      // Mark as submitted in DB
      await storage.updateDeal(deal.id, { pmfSubmissionStatus: 'submitted', pmfSubmittedAt: new Date() });
      return;
    }

    // Real PMF API call (activate when endpoint is configured)
    const response = await fetch(PMF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PMF_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[PMF] Submission failed: ${response.status} ${text}`);
      await storage.updateDeal(deal.id, { pmfSubmissionStatus: 'error' });
      return;
    }

    const result = await response.json() as any;
    await storage.updateDeal(deal.id, {
      pmfSubmissionStatus: 'submitted',
      pmfSubmittedAt: new Date(),
      pmfSubmissionId: result.id || result.submissionId || null,
    });
  }

  // Admin-only: when a deal is funded by PMF, trigger commissions waterfall
  async function triggerCommissionWaterfall(dealId: number): Promise<void> {
    const deal = await storage.getDeal(dealId);
    if (!deal) return;
    const agentId = deal.agentId;
    const gbrAmount = Number(deal.gbrAmount) || Number(deal.companyRevenue);
    const agent = await storage.getAgent(agentId);
    const periodDate = new Date().toISOString().split('T')[0];
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + CONFIG.holdback.deferralDays);
      
      // === GBR WATERFALL: MAC (Merchant Acquisition Compensation) ===
      // MAC = 30% of GBR, split: Primary 22%, Senior Sponsor L1 5%, Executive Sponsor L2 3%
      
      const macPrimaryAmount = gbrAmount * CONFIG.gbrWaterfall.macSplit.primaryAgent;
      const macImmediate = macPrimaryAmount * CONFIG.holdback.immediateRelease;
      const macDeferred = macPrimaryAmount * CONFIG.holdback.deferred;
      
      const macCommission = await storage.createCommission({
        agentId,
        type: 'mac_primary',
        amount: macImmediate.toFixed(2),
        dealId: deal.id,
        periodDate,
        status: 'pending'
      });
      
      await storage.createHoldback({
        dealId: deal.id,
        agentId,
        commissionId: macCommission.id,
        totalAmount: macDeferred.toFixed(2),
        releaseDate,
      });
      
      await storage.createNotification({
        agentId,
        type: 'deal_funded',
        title: 'Deal Funded!',
        message: `Your deal for ${deal.merchantName} ($${Number(deal.loanAmount).toLocaleString()}) has been funded. MAC: $${macImmediate.toFixed(2)} (+ $${macDeferred.toFixed(2)} held for release).`,
        dealId: deal.id,
        isRead: false,
        emailSent: false,
      });
      
      const agentPrefs = (agent!.emailPreferences as { emailOnDealFunded?: boolean } | null) ?? {};
      if (agentPrefs.emailOnDealFunded !== false) {
        emailService.sendDealFundedEmail(agent!.email, {
          firstName: agent!.firstName,
          merchantName: deal.merchantName,
          amount: Number(deal.loanAmount),
          commission: macImmediate,
        }).catch(console.error);
      }
      
      // === MAC SPONSOR OVERRIDES (3-level cap with compression) ===
      const upline = await storage.getUpline(agentId);
      let sponsorLevel = 0;
      const sponsorRates = [
        { type: 'mac_sponsor_l1' as const, rate: CONFIG.gbrWaterfall.macSplit.seniorSponsor },
        { type: 'mac_sponsor_l2' as const, rate: CONFIG.gbrWaterfall.macSplit.executiveSponsor },
      ];
      
      for (const sponsor of upline) {
        if (sponsorLevel >= 2) break;
        
        const isQualified = sponsor.status === 'active';
        
        if (isQualified) {
          const sponsorConfig = sponsorRates[sponsorLevel];
          const sponsorAmount = gbrAmount * sponsorConfig.rate;
          const sponsorImmediate = sponsorAmount * CONFIG.holdback.immediateRelease;
          const sponsorDeferred = sponsorAmount * CONFIG.holdback.deferred;
          
          const sponsorComm = await storage.createCommission({
            agentId: sponsor.id,
            type: sponsorConfig.type,
            amount: sponsorImmediate.toFixed(2),
            dealId: deal.id,
            sourceAgentId: agentId,
            periodDate,
            status: 'pending'
          });
          
          await storage.createHoldback({
            dealId: deal.id,
            agentId: sponsor.id,
            commissionId: sponsorComm.id,
            totalAmount: sponsorDeferred.toFixed(2),
            releaseDate,
          });
          
          await storage.createNotification({
            agentId: sponsor.id,
            type: 'commission_earned',
            title: 'Sponsor Override Earned!',
            message: `You earned a $${sponsorImmediate.toFixed(2)} L${sponsorLevel + 1} sponsor override from ${agent!.firstName} ${agent!.lastName}'s deal.`,
            isRead: false,
            emailSent: false,
          });
          const sponsorCommPrefs = (sponsor.emailPreferences as { emailOnCommissionEarned?: boolean } | null) ?? {};
          if (sponsorCommPrefs.emailOnCommissionEarned !== false) {
            emailService.sendCommissionEarnedEmail(sponsor.email, {
              firstName: sponsor.firstName,
              commissionType: `L${sponsorLevel + 1} Sponsor Override`,
              amount: sponsorImmediate,
              description: `From ${agent!.firstName} ${agent!.lastName}'s deal (${deal.merchantName})`,
            }).catch(console.error);
          }
          
          sponsorLevel++;
        }
      }
      
      // === GBR WATERFALL: TFC (Transaction Fulfillment Compensation) ===
      const fulfillmentAgentId = deal.fulfillmentAgentId || agentId;
      const tfcRate = await storage.getCurrentFulfillmentTierRate(fulfillmentAgentId);
      const tfcAmount = gbrAmount * tfcRate;
      const tfcImmediate = tfcAmount * CONFIG.holdback.immediateRelease;
      const tfcDeferred = tfcAmount * CONFIG.holdback.deferred;
      
      if (fulfillmentAgentId !== agentId || !deal.fulfillmentAgentId) {
        const tfcComm = await storage.createCommission({
          agentId: fulfillmentAgentId,
          type: 'tfc',
          amount: tfcImmediate.toFixed(2),
          dealId: deal.id,
          sourceAgentId: agentId,
          periodDate,
          status: 'pending'
        });
        
        await storage.createHoldback({
          dealId: deal.id,
          agentId: fulfillmentAgentId,
          commissionId: tfcComm.id,
          totalAmount: tfcDeferred.toFixed(2),
          releaseDate,
        });
        
        if (fulfillmentAgentId !== agentId) {
          await storage.createNotification({
            agentId: fulfillmentAgentId,
            type: 'commission_earned',
            title: 'Fulfillment Commission Earned!',
            message: `You earned a $${tfcImmediate.toFixed(2)} TFC from ${deal.merchantName} deal.`,
            isRead: false,
            emailSent: false,
          });
          const fulfillmentAgent = await storage.getAgent(fulfillmentAgentId);
          if (fulfillmentAgent) {
            const fulfillmentCommPrefs = (fulfillmentAgent.emailPreferences as { emailOnCommissionEarned?: boolean } | null) ?? {};
            if (fulfillmentCommPrefs.emailOnCommissionEarned !== false) {
              emailService.sendCommissionEarnedEmail(fulfillmentAgent.email, {
                firstName: fulfillmentAgent.firstName,
                commissionType: 'Transaction Fulfillment Compensation (TFC)',
                amount: tfcImmediate,
                description: `From ${deal.merchantName} deal`,
              }).catch(console.error);
            }
          }
        }
      }
  }

  app.get(api.deals.list.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const deals = await storage.getDealsByAgent(req.user!.id);
    res.json(deals);
  });

  app.get(api.deals.get.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const deals = await storage.getDealsByAgent(req.user!.id);
    const deal = deals.find(d => d.id === Number(req.params.id));
    if (!deal) return res.status(404).json({ message: "Deal not found" });
    res.json(deal);
  });

  // ==================== COMMISSION ROUTES ====================

  app.get(api.commissions.list.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const commissions = await storage.getCommissionsByAgent(req.user!.id);
    res.json(commissions);
  });

  app.get(api.commissions.stats.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const stats = await storage.getCommissionStats(req.user!.id);
    res.json(stats);
  });

  app.get(api.commissions.breakdown.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const stats = await storage.getCommissionStats(req.user!.id);
    res.json({
      personal: stats.byType['personal_deal'] || 0,
      binary: stats.byType['binary_bonus'] || 0,
      generation: stats.byType['generation_override'] || 0,
      course: stats.byType['course_sale'] || 0,
      other: (stats.byType['fast_start'] || 0) + (stats.byType['leadership_pool'] || 0),
    });
  });

  // ==================== PAYOUT ROUTES ====================

  app.get(api.payouts.list.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const payouts = await storage.getPayoutsByAgent(req.user!.id);
    res.json(payouts);
  });

  // ==================== NOTIFICATION ROUTES ====================

  app.get(api.notifications.list.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const notifications = await storage.getNotificationsByAgent(req.user!.id);
    res.json(notifications);
  });

  app.get(api.notifications.unreadCount.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const count = await storage.getUnreadNotificationCount(req.user!.id);
    res.json({ count });
  });

  app.post(api.notifications.markRead.path, requireAuth, async (req, res) => {
    await storage.markNotificationRead(Number(req.params.id));
    res.json({ success: true });
  });

  app.post(api.notifications.markAllRead.path, requireAuth, async (req, res) => {
    // @ts-ignore
    await storage.markAllNotificationsRead(req.user!.id);
    res.json({ success: true });
  });

  // ==================== ANNOUNCEMENT ROUTES ====================

  app.get(api.announcements.list.path, requireAuth, async (req, res) => {
    const announcements = await storage.getAnnouncements(false);
    res.json(announcements);
  });

  // ==================== RESOURCE ROUTES ====================

  app.get(api.resources.list.path, requireAuth, async (req, res) => {
    const resources = await storage.getResources(false);
    res.json(resources);
  });

  app.get(api.resources.byCategory.path, requireAuth, async (req, res) => {
    const category = Array.isArray(req.params.category) ? req.params.category[0] : req.params.category;
    const resources = await storage.getResourcesByCategory(category);
    res.json(resources);
  });

  // ==================== TRAINING ROUTES ====================

  // Get all published course modules
  app.get(api.training.modules.path, requireAuth, async (req, res) => {
    const modules = await storage.getCourseModules();
    res.json(modules);
  });

  // Get modules with agent's progress
  app.get(api.training.progress.path, requireAuth, async (req, res) => {
    const agentId = req.user!.id;
    const modules = await storage.getCourseModules();
    const progressList = await storage.getAgentCourseProgress(agentId);
    const stats = await storage.getAgentTrainingStats(agentId);
    
    // Merge modules with progress
    const modulesWithProgress = modules.map(module => {
      const progress = progressList.find(p => p.moduleId === module.id);
      return {
        ...module,
        progress: progress ? {
          moduleId: progress.moduleId,
          status: progress.status,
          currentSlide: progress.currentSlide ?? 1,
          completedSlides: progress.completedSlides ?? 0,
          quizScore: progress.quizScore,
        } : null,
      };
    });
    
    res.json({
      modules: modulesWithProgress,
      overallProgress: stats.overallProgress,
      completedModules: stats.completedModules,
      totalModules: stats.totalModules,
    });
  });

  // Update progress for a module
  app.post(api.training.updateProgress.path, requireAuth, async (req, res) => {
    const agentId = req.user!.id;
    const moduleId = parseInt(req.params.moduleId as string);
    
    const module = await storage.getCourseModuleById(moduleId);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }
    
    const { status, currentSlide, completedSlides, quizScore } = req.body;
    
    const updateData: any = {};
    if (status) updateData.status = status;
    if (currentSlide !== undefined) updateData.currentSlide = currentSlide;
    if (completedSlides !== undefined) updateData.completedSlides = completedSlides;
    if (quizScore !== undefined) updateData.quizScore = quizScore;
    if (status === 'completed') updateData.completedAt = new Date();
    
    const progress = await storage.upsertCourseProgress(agentId, moduleId, updateData);
    res.json(progress);
  });

  // ==================== LEADERBOARD ROUTES ====================

  app.get(api.leaderboards.topEarners.path, requireAuth, async (req, res) => {
    const earners = await storage.getTopEarners(10);
    res.json(earners);
  });

  app.get(api.leaderboards.topRecruiters.path, requireAuth, async (req, res) => {
    const recruiters = await storage.getTopRecruiters(10);
    res.json(recruiters);
  });

  app.get(api.leaderboards.rankAdvances.path, requireAuth, async (req, res) => {
    const advances = await storage.getRankAdvances(20);
    res.json(advances);
  });

  // ==================== ADMIN ROUTES ====================

  // Admin Dashboard
  app.get(api.admin.stats.path, requireAdmin, async (req, res) => {
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  // Admin Agent Management
  app.get(api.admin.agents.list.path, requireAdmin, async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const rank = req.query.rank as string | undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as string | undefined;
    
    const result = await storage.getAgentsPaginated(page, pageSize, { search, status, rank, sortBy, sortOrder });
    res.json({ ...result, page, pageSize });
  });

  app.get(api.admin.agents.get.path, requireAdmin, async (req, res) => {
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  });

  app.patch(api.admin.agents.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.agents.update.input.parse(req.body);
      const updated = await storage.updateAgent(Number(req.params.id), input);
      
      // Log activity
      // @ts-ignore
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'agent',
        entityId: Number(req.params.id),
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} updated agent #${req.params.id}`,
        details: input,
      });
      
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.post(api.admin.agents.suspend.path, requireAdmin, async (req, res) => {
    await storage.updateAgent(Number(req.params.id), { status: 'suspended' });
    
    // @ts-ignore
    await storage.logActivity({
      actorId: req.user!.id,
      actorType: 'admin',
      action: 'suspend',
      entityType: 'agent',
      entityId: Number(req.params.id),
      description: `Admin ${req.user!.firstName} ${req.user!.lastName} suspended agent #${req.params.id}`,
      details: { reason: req.body.reason },
    });
    
    res.json({ success: true });
  });

  app.post(api.admin.agents.activate.path, requireAdmin, async (req, res) => {
    await storage.updateAgent(Number(req.params.id), { status: 'active' });
    
    // @ts-ignore
    await storage.logActivity({
      actorId: req.user!.id,
      actorType: 'admin',
      action: 'activate',
      entityType: 'agent',
      entityId: Number(req.params.id),
      description: `Admin ${req.user!.firstName} ${req.user!.lastName} activated agent #${req.params.id}`,
    });
    
    res.json({ success: true });
  });

  app.post(api.admin.agents.impersonate.path, requireAdmin, async (req, res) => {
    res.status(501).json({ message: "Agent impersonation is not currently enabled on this platform. Contact your system administrator if you need this capability." });
  });

  // Admin Deal Management
  app.get(api.admin.deals.list.path, requireAdmin, async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const status = req.query.status as string | undefined;
    const agentId = req.query.agentId ? Number(req.query.agentId) : undefined;
    
    const result = await storage.getDealsPaginated(page, pageSize, { status, agentId });
    res.json({ ...result, page, pageSize });
  });

  app.patch(api.admin.deals.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.deals.update.input.parse(req.body);
      const updated = await storage.updateDeal(Number(req.params.id), {
        ...input,
        loanAmount: input.loanAmount?.toString(),
        gbrAmount: input.gbrAmount?.toString(),
        fulfillmentAgentId: input.fulfillmentAgentId,
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update deal" });
    }
  });

  // Admin: Approve deal — marks as funded, sets fundedAt, triggers commission waterfall
  app.post('/api/admin/deals/:id/approve', requireAdmin, async (req, res) => {
    try {
      const dealId = Number(req.params.id);
      const deal = await storage.getDeal(dealId);
      if (!deal) return res.status(404).json({ message: "Deal not found" });
      if (deal.status === 'funded') return res.status(400).json({ message: "Deal already funded" });
      
      await storage.updateDeal(dealId, { status: 'funded', fundedAt: new Date(), approvedById: req.user!.id });
      await triggerCommissionWaterfall(dealId);
      
      await storage.createNotification({
        agentId: deal.agentId,
        type: 'deal_funded',
        title: 'Deal Funded!',
        message: `Great news! Your MCA application for ${deal.merchantName} has been funded. Your commissions are now being processed.`,
        dealId: deal.id,
        isRead: false,
        emailSent: false,
      });

      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'approve',
        entityType: 'deal',
        entityId: dealId,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} approved deal #${dealId}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to approve deal" });
    }
  });

  // Admin: Reject deal
  app.post('/api/admin/deals/:id/reject', requireAdmin, async (req, res) => {
    try {
      const dealId = Number(req.params.id);
      const deal = await storage.getDeal(dealId);
      if (!deal) return res.status(404).json({ message: "Deal not found" });
      const { reason } = req.body;
      
      await storage.updateDeal(dealId, { status: 'rejected', notes: reason ? `Rejected: ${reason}` : deal.notes });
      
      await storage.createNotification({
        agentId: deal.agentId,
        type: 'deal_funded',
        title: 'Deal Update',
        message: `Your MCA application for ${deal.merchantName} was not approved${reason ? `: ${reason}` : '. Please contact support for details.'}.`,
        dealId: deal.id,
        isRead: false,
        emailSent: false,
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to reject deal" });
    }
  });

  // Admin Commission Management
  app.get(api.admin.commissions.list.path, requireAdmin, async (req, res) => {
    const allCommissions = await storage.getAllCommissions();
    res.json({ commissions: allCommissions, total: allCommissions.length, page: 1, pageSize: 100 });
  });

  app.get(api.admin.commissions.pending.path, requireAdmin, async (req, res) => {
    const pending = await storage.getPendingCommissions();
    res.json(pending);
  });

  app.post(api.admin.commissions.approve.path, requireAdmin, async (req, res) => {
    // @ts-ignore
    await storage.approveCommission(Number(req.params.id), req.user!.id);
    res.json({ success: true });
  });

  app.post(api.admin.commissions.approveAll.path, requireAdmin, async (req, res) => {
    // @ts-ignore
    const approved = await storage.approveAllPendingCommissions(req.user!.id);
    res.json({ approved });
  });

  app.post(api.admin.commissions.void.path, requireAdmin, async (req, res) => {
    const { reason } = api.admin.commissions.void.input.parse(req.body);
    const commissionId = Number(req.params.id);
    // @ts-ignore
    await storage.voidCommission(commissionId, req.user!.id, reason);
    await storage.logActivity({
      actorId: req.user!.id,
      actorType: 'admin',
      action: 'void',
      entityType: 'commission',
      entityId: commissionId,
      description: `Admin ${req.user!.firstName} ${req.user!.lastName} voided commission #${commissionId}: ${reason}`,
    });
    res.json({ success: true });
  });

  app.post(api.admin.commissions.calculate.path, requireAdmin, async (req, res) => {
    try {
      const allAgents = await storage.getAllAgents();
      const eligibleAgents = allAgents.filter(a => 
        ['builder', 'leader', 'director', 'partner'].includes(a.currentRank) && 
        a.status === 'active'
      );
      
      let processed = 0;
      const periodStart = getWeekStart();
      
      for (const agent of eligibleAgents) {
        const leftVol = await storage.getLegVolume(agent.id, 'left', periodStart);
        const rightVol = await storage.getLegVolume(agent.id, 'right', periodStart);
        const weakerLegVolume = Math.min(leftVol, rightVol);
        
        if (weakerLegVolume > 0) {
          const config = CONFIG.binaryBonus[agent.currentRank];
          if (config) {
            let bonus = weakerLegVolume * config.rate;
            bonus = Math.min(bonus, config.max);
            
            await storage.createCommission({
              agentId: agent.id,
              type: 'binary_bonus',
              amount: bonus.toString(),
              periodDate: new Date().toISOString().split('T')[0],
              status: 'pending'
            });
            
            await storage.createNotification({
              agentId: agent.id,
              type: 'commission_earned',
              title: 'Binary Bonus Earned!',
              message: `You earned a $${bonus.toFixed(2)} binary bonus this week.`,
              isRead: false,
              emailSent: false,
            });
            const binaryCommPrefs = (agent.emailPreferences as { emailOnCommissionEarned?: boolean } | null) ?? {};
            if (binaryCommPrefs.emailOnCommissionEarned !== false) {
              emailService.sendCommissionEarnedEmail(agent.email, {
                firstName: agent.firstName,
                commissionType: 'Binary Bonus',
                amount: bonus,
                description: 'Weekly binary bonus calculation',
              }).catch(console.error);
            }
            
            processed++;
          }
        }
      }
      
      res.json({ message: "Binary bonus calculation completed", processed });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Calculation failed" });
    }
  });

  // === SUBSCRIPTION ROUTES ===
  
  app.get("/api/subscriptions", requireAuth, async (req, res) => {
    // @ts-ignore
    const subs = await storage.getSubscriptionsByAgent(req.user!.id);
    res.json(subs);
  });

  app.get("/api/subscriptions/history", requireAuth, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
      const rawSubId = req.query.subscriptionId;
      let subscriptionIdParam: number | undefined;
      if (rawSubId !== undefined && rawSubId !== '') {
        const parsed = Number(rawSubId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          return res.status(400).json({ message: 'subscriptionId must be a positive integer' });
        }
        subscriptionIdParam = parsed;
      }

      const ALLOWED_ACTIONS = new Set(['create', 'pause', 'cancel', 'reactivate']);
      const rawAction = req.query.action;
      let actionParam: string | undefined;
      if (typeof rawAction === 'string' && rawAction) {
        if (!ALLOWED_ACTIONS.has(rawAction)) {
          return res.status(400).json({ message: `action must be one of: ${[...ALLOWED_ACTIONS].join(', ')}` });
        }
        actionParam = rawAction;
      }

      const rawSearch = req.query.search;
      const searchParam: string | undefined = typeof rawSearch === 'string' && rawSearch.trim() ? rawSearch.trim() : undefined;

      const agentSubs = await storage.getSubscriptionsByAgent(agentId);
      if (agentSubs.length === 0) {
        return res.json({ logs: [], total: 0, page, pageSize });
      }

      const subIds = agentSubs.map((s) => s.id);
      const subMap: Record<number, string> = {};
      for (const s of agentSubs) {
        subMap[s.id] = s.merchantName;
      }

      // If a specific subscriptionId is provided, verify it belongs to this agent
      let filteredEntityIds: number[] | undefined;
      let filteredEntityId: number | undefined;
      if (subscriptionIdParam) {
        if (!subIds.includes(subscriptionIdParam)) {
          return res.status(403).json({ message: 'Access denied to that subscription' });
        }
        filteredEntityId = subscriptionIdParam;
      } else {
        filteredEntityIds = subIds;
      }

      const { logs, total } = await storage.getActivityLogs(page, pageSize, {
        entityType: 'subscription',
        ...(filteredEntityId ? { entityId: filteredEntityId } : { entityIds: filteredEntityIds }),
        ...(actionParam ? { action: actionParam } : {}),
        ...(searchParam ? { search: searchParam } : {}),
      });

      const safeLog = logs.map(({ id, action, description, createdAt, actorType, entityId }) => ({
        id,
        action,
        description,
        createdAt,
        actorType,
        entityId,
        merchantName: entityId ? (subMap[entityId] ?? null) : null,
      }));

      res.json({ logs: safeLog, total, page, pageSize });
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch subscription history' });
    }
  });

  app.get("/api/subscriptions/:id/history", requireAuth, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const subId = Number(req.params.id);
      if (!subId || subId <= 0) {
        return res.status(400).json({ message: 'Invalid subscription ID' });
      }
      const agentSubs = await storage.getSubscriptionsByAgent(agentId);
      const sub = agentSubs.find((s) => s.id === subId);
      if (!sub) {
        return res.status(404).json({ message: 'Subscription not found or access denied' });
      }
      const { logs } = await storage.getActivityLogs(1, 100, { entityType: 'subscription', entityId: subId });

      const adminActorIds = Array.from(new Set(logs.filter(l => l.actorType === 'admin').map(l => l.actorId)));
      const adminMap: Record<number, string> = {};
      await Promise.all(
        adminActorIds.map(async (aid) => {
          const actor = await storage.getAgent(aid);
          if (actor) adminMap[aid] = `${actor.firstName} ${actor.lastName}`;
        })
      );

      const safeLog = logs.map(({ id, action, description, createdAt, actorType, actorId }) => ({
        id,
        action,
        description,
        createdAt,
        actorType,
        actorName: actorType === 'system'
          ? 'System'
          : actorType === 'admin'
            ? `Admin ${adminMap[actorId] ?? `#${actorId}`}`
            : null,
      }));
      res.json(safeLog);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch subscription history' });
    }
  });

  // Stripe publishable key endpoint
  app.get("/api/stripe/publishable-key", requireAuth, async (req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (err) {
      res.status(500).json({ message: "Failed to get Stripe publishable key" });
    }
  });

  app.post("/api/subscriptions", requireAuth, async (req, res) => {
    try {
      // @ts-ignore
      const agentId = req.user!.id;

      const createSubSchema = z.object({
        merchantName: z.string().min(2),
        merchantEmail: z.string().email().optional().or(z.literal('')),
        tier: z.enum(['tier_1', 'tier_2', 'tier_3']),
        startDate: z.string().optional().refine((val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime()) && d <= new Date();
        }, { message: 'Start date must be a valid date and not in the future' }),
        mcaPairedDealId: z.number().int().positive().optional(),
        paymentMethodId: z.string().optional(),
      });

      const input = createSubSchema.parse(req.body);

      // If a paired deal is provided, validate it exists, is funded, and belongs to this agent
      let verifiedPairedDealId: number | undefined;
      if (input.mcaPairedDealId) {
        const deal = await storage.getDeal(input.mcaPairedDealId);
        if (!deal) {
          return res.status(400).json({ message: 'Paired deal not found' });
        }
        if (deal.agentId !== agentId) {
          return res.status(403).json({ message: 'You can only pair subscriptions with your own deals' });
        }
        if (deal.status !== 'funded') {
          return res.status(400).json({ message: 'Only funded deals can be paired with a subscription' });
        }
        verifiedPairedDealId = deal.id;
      }

      const tierPrices: Record<string, number> = CONFIG.subscriptionTierPrices;
      const monthlyAmount = tierPrices[input.tier] || 199;

      const startDate = input.startDate ? new Date(input.startDate) : new Date();

      // Create subscription record first
      const sub = await storage.createSubscription({
        agentId,
        merchantName: input.merchantName,
        merchantEmail: input.merchantEmail || undefined,
        tier: input.tier,
        monthlyAmount: monthlyAmount.toString(),
        mcaPairedDealId: verifiedPairedDealId,
        startDate,
      });

      // If paymentMethodId provided, create Stripe customer, subscription, and billing data
      if (input.paymentMethodId) {
        try {
          const stripe = await getUncachableStripeClient();

          // Create Stripe Customer
          const customer = await stripe.customers.create({
            name: input.merchantName,
            email: input.merchantEmail || undefined,
            payment_method: input.paymentMethodId,
            invoice_settings: { default_payment_method: input.paymentMethodId },
            metadata: { subscriptionId: sub.id.toString(), agentId: agentId.toString() },
          });

          // Look up the Stripe price for this tier
          const stripePriceId = CONFIG.stripePriceIds[input.tier];

          let stripeSubscription: any = null;
          let cardLast4: string | null = null;
          let cardBrand: string | null = null;

          if (stripePriceId) {
            // Create Stripe Subscription (starts billing immediately)
            stripeSubscription = await stripe.subscriptions.create({
              customer: customer.id,
              items: [{ price: stripePriceId }],
              default_payment_method: input.paymentMethodId,
              metadata: { subscriptionId: sub.id.toString(), agentId: agentId.toString() },
              expand: ['latest_invoice.payment_intent'],
            });
          }

          // Get card details from PaymentMethod
          const pm = await stripe.paymentMethods.retrieve(input.paymentMethodId);
          if (pm.card) {
            cardLast4 = pm.card.last4;
            cardBrand = pm.card.brand;
          }

          // Update subscription with Stripe data
          await storage.updateSubscriptionBilling(sub.id, {
            stripeCustomerId: customer.id,
            stripeSubscriptionId: stripeSubscription?.id ?? null,
            stripePaymentMethodId: input.paymentMethodId,
            billingStatus: 'pending',
            cardLast4,
            cardBrand,
          });

          const updatedSub = await storage.getSubscription(sub.id);

          storage.logActivity({
            actorId: agentId,
            actorType: 'agent',
            action: 'create',
            entityType: 'subscription',
            entityId: sub.id,
            description: `Logged new ${input.tier} subscription for merchant "${input.merchantName}" ($${monthlyAmount}/mo) with Stripe billing`,
            details: { merchantName: input.merchantName, tier: input.tier, monthlyAmount, mcaPairedDealId: verifiedPairedDealId ?? null },
            ipAddress: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
          }).catch((err) => console.error('[ActivityLog] Failed to log subscription creation:', err));

          return res.status(201).json(updatedSub ?? sub);
        } catch (stripeErr: any) {
          console.error('[Stripe] Failed to create Stripe billing:', stripeErr.message);
          // Subscription was created, just billing failed - return with warning
          return res.status(201).json({ ...sub, _stripeWarning: stripeErr.message });
        }
      }

      // No Stripe payment method provided — create subscription without billing
      // Commissions fire immediately (legacy behavior for subscriptions without card)
      const now = new Date();
      const monthsSinceStart = Math.floor(
        (now.getTime() - startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
      );
      let decayRate: number;
      if (monthsSinceStart < 3) decayRate = CONFIG.subscriptionDecay.months1to3;
      else if (monthsSinceStart < 6) decayRate = CONFIG.subscriptionDecay.months4to6;
      else if (monthsSinceStart < 9) decayRate = CONFIG.subscriptionDecay.months7to9;
      else if (monthsSinceStart < 12) decayRate = CONFIG.subscriptionDecay.months10to12;
      else decayRate = CONFIG.subscriptionDecay.postMonth12;

      const poolRate = CONFIG.subscriptionPools[input.tier] || 0.50;
      let commissionRate = poolRate * decayRate;
      if (verifiedPairedDealId && monthsSinceStart < 3) {
        commissionRate += CONFIG.mcaPairingBonus;
      }

      const commissionAmount = monthlyAmount * commissionRate;
      const commType = monthsSinceStart >= 12 ? 'subscription_residual' : 'subscription_commission';
      const periodDate = now.toISOString().split('T')[0];

      if (commissionAmount > 0) {
        await storage.createCommission({
          agentId,
          type: commType,
          amount: commissionAmount.toFixed(2),
          periodDate,
          status: 'pending',
        });

        const upline = await storage.getUpline(agentId);
        const uplineRates = [
          CONFIG.subscriptionUplinesOverride.l1Rate,
          CONFIG.subscriptionUplinesOverride.l2Rate,
        ];
        for (let i = 0; i < upline.length && i < uplineRates.length; i++) {
          const sponsor = upline[i];
          const uplineAmount = monthlyAmount * poolRate * uplineRates[i] * decayRate;
          if (uplineAmount > 0) {
            await storage.createCommission({
              agentId: sponsor.id,
              type: 'subscription_residual',
              amount: uplineAmount.toFixed(2),
              periodDate,
              sourceAgentId: agentId,
              status: 'pending',
            });
          }
        }
      }
      
      storage.logActivity({
        actorId: agentId,
        actorType: 'agent',
        action: 'create',
        entityType: 'subscription',
        entityId: sub.id,
        description: `Logged new ${input.tier} subscription for merchant "${input.merchantName}" ($${monthlyAmount}/mo)`,
        details: {
          merchantName: input.merchantName,
          tier: input.tier,
          monthlyAmount,
          mcaPairedDealId: verifiedPairedDealId ?? null,
        },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      }).catch((err) => console.error('[ActivityLog] Failed to log subscription creation:', err));

      res.status(201).json(sub);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // Agent self-service subscription status update
  app.patch("/api/subscriptions/:id/status", requireAuth, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const subId = Number(req.params.id);

      if (!subId || subId <= 0) {
        return res.status(400).json({ message: 'Invalid subscription ID' });
      }

      const updateStatusSchema = z.object({
        status: z.enum(['paused', 'cancelled', 'active']),
      });
      const { status } = updateStatusSchema.parse(req.body);

      const existing = await storage.getSubscriptionsByAgent(agentId);
      const sub = existing.find((s) => s.id === subId);
      if (!sub) {
        return res.status(404).json({ message: 'Subscription not found or you do not have permission to update it' });
      }

      if (sub.status === 'cancelled') {
        return res.status(400).json({ message: 'Cannot update a cancelled subscription' });
      }
      if (sub.status === 'expired') {
        return res.status(400).json({ message: 'Cannot update an expired subscription' });
      }
      if (status === 'active' && sub.status !== 'paused') {
        return res.status(400).json({ message: 'Only paused subscriptions can be reactivated' });
      }

      const updated = await storage.updateSubscriptionStatus(subId, status, agentId);

      {
        const agent = await storage.getAgent(agentId);
        const effectiveDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        const notificationTitle = status === 'paused'
          ? `Subscription Paused: ${sub.merchantName}`
          : status === 'cancelled'
          ? `Subscription Cancelled: ${sub.merchantName}`
          : `Subscription Reactivated: ${sub.merchantName}`;
        const notificationMessage = status === 'paused'
          ? `Your ${tierLabel} subscription for ${sub.merchantName} has been paused as of ${effectiveDate}. Commission accrual is on hold until reactivated.`
          : status === 'cancelled'
          ? `Your ${tierLabel} subscription for ${sub.merchantName} has been cancelled as of ${effectiveDate}.`
          : `Your ${tierLabel} subscription for ${sub.merchantName} has been reactivated as of ${effectiveDate}. Commission accrual has resumed.`;

        storage.createNotification({
          agentId,
          type: 'system',
          title: notificationTitle,
          message: notificationMessage,
        }).catch((err) => console.error('[Notification] Failed to create subscription status notification:', err));

        if (agent) {
          const emailData = {
            firstName: agent.firstName,
            merchantName: sub.merchantName,
            tier: tierLabel,
            effectiveDate,
          };
          const prefs = (agent.emailPreferences as { emailOnPaused?: boolean; emailOnCancelled?: boolean; emailOnReactivated?: boolean } | null) ?? {};
          if (status === 'paused' && prefs.emailOnPaused !== false) {
            emailService.sendSubscriptionPausedEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send subscription paused email:', err));
          } else if (status === 'cancelled' && prefs.emailOnCancelled !== false) {
            emailService.sendSubscriptionCancelledEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send subscription cancelled email:', err));
          } else if (status === 'active' && prefs.emailOnReactivated !== false) {
            emailService.sendSubscriptionReactivatedEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send subscription reactivated email:', err));
          }
        }
      }

      // Log subscription status change to activity log
      const actionLabel = status === 'paused' ? 'pause' : status === 'cancelled' ? 'cancel' : 'reactivate';
      storage.logActivity({
        actorId: agentId,
        actorType: 'agent',
        action: actionLabel,
        entityType: 'subscription',
        entityId: subId,
        description: `Agent ${actionLabel === 'cancel' ? 'cancelled' : actionLabel + 'd'} subscription #${subId} for merchant "${sub.merchantName}"`,
        details: { previousStatus: sub.status, newStatus: status, merchantName: sub.merchantName, tier: sub.tier },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      }).catch((err) => console.error('[ActivityLog] Failed to log subscription status change:', err));

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: 'Failed to update subscription' });
    }
  });

  // Agent update card / retry payment
  app.patch("/api/subscriptions/:id/payment-method", requireAuth, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const subId = Number(req.params.id);
      if (!subId || subId <= 0) {
        return res.status(400).json({ message: 'Invalid subscription ID' });
      }

      const schema = z.object({ paymentMethodId: z.string().min(1) });
      const parseResult = schema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0].message });
      }
      const { paymentMethodId } = parseResult.data;

      // Ensure subscription belongs to this agent
      const agentSubs = await storage.getSubscriptionsByAgent(agentId);
      const sub = agentSubs.find((s) => s.id === subId);
      if (!sub) {
        return res.status(404).json({ message: 'Subscription not found or access denied' });
      }

      if (!sub.stripeSubscriptionId || !sub.stripeCustomerId) {
        return res.status(400).json({ message: 'This subscription does not have an active Stripe billing setup' });
      }

      const stripe = await getUncachableStripeClient();

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, { customer: sub.stripeCustomerId });

      // Set as default on customer and subscription
      await stripe.customers.update(sub.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        default_payment_method: paymentMethodId,
      });

      // Retrieve payment method details for local storage
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      const cardLast4 = pm.card?.last4 ?? null;
      const cardBrand = pm.card?.brand ?? null;

      // Pay the latest open invoice if one exists
      let newBillingStatus: 'active' | 'past_due' | 'failed' | undefined;
      let declineCode: string | null = null;
      try {
        const invoices = await stripe.invoices.list({
          subscription: sub.stripeSubscriptionId,
          status: 'open',
          limit: 1,
        });
        if (invoices.data.length > 0) {
          const paid = await stripe.invoices.pay(invoices.data[0].id, {
            payment_method: paymentMethodId,
          });
          newBillingStatus = paid.status === 'paid' ? 'active' : 'past_due';
        }
      } catch (invoiceErr: unknown) {
        // Invoice pay failure — card still attached, status remains past_due/failed
        const invoiceMsg = invoiceErr instanceof Error ? invoiceErr.message : String(invoiceErr);
        console.warn('[PaymentRetry] Invoice payment failed after card update:', invoiceMsg);
        // Extract Stripe decline_code if present
        if (invoiceErr && typeof invoiceErr === 'object' && 'decline_code' in invoiceErr) {
          declineCode = (invoiceErr as { decline_code?: string }).decline_code ?? null;
        }
        newBillingStatus = 'failed';
      }

      const updated = await storage.updateSubscriptionBilling(subId, {
        stripePaymentMethodId: paymentMethodId,
        cardLast4,
        cardBrand,
        ...(newBillingStatus ? { billingStatus: newBillingStatus } : {}),
      });

      storage.logActivity({
        actorId: agentId,
        actorType: 'agent',
        action: 'update',
        entityType: 'subscription',
        entityId: subId,
        description: `Agent updated payment method for subscription #${subId} (${sub.merchantName}); billing status: ${newBillingStatus ?? 'unchanged'}`,
        details: { cardLast4, cardBrand, billingStatus: newBillingStatus ?? null },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      }).catch((err) => console.error('[ActivityLog] Failed to log payment method update:', err));

      // Send notification and email if a payment was attempted
      if (newBillingStatus === 'active' || newBillingStatus === 'failed') {
        const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        const isSuccess = newBillingStatus === 'active';

        const notifTitle = isSuccess
          ? `Payment Successful: ${sub.merchantName}`
          : `Payment Failed: ${sub.merchantName}`;
        const notifMessage = isSuccess
          ? `Your outstanding payment for ${sub.merchantName} (${tierLabel}) has been processed successfully. Your subscription is now active.`
          : `The payment retry for ${sub.merchantName} (${tierLabel}) has failed. Please update your payment method and try again.`;

        storage.createNotification({
          agentId,
          type: 'system',
          title: notifTitle,
          message: notifMessage,
        }).catch((err) => console.error('[Notification] Failed to create payment retry notification:', err));

        storage.getAgent(agentId).then((agent) => {
          if (!agent) return;
          const prefs = (agent.emailPreferences as { emailOnPaymentRetrySuccess?: boolean; emailOnPaymentRetryFailed?: boolean } | null) ?? {};
          const emailData = { firstName: agent.firstName, merchantName: sub.merchantName, tier: tierLabel };
          if (isSuccess && prefs.emailOnPaymentRetrySuccess !== false) {
            emailService.sendPaymentRetrySuccessEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send payment retry success email:', err));
          } else if (!isSuccess && prefs.emailOnPaymentRetryFailed !== false) {
            emailService.sendPaymentRetryFailedEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send payment retry failed email:', err));
          }
        }).catch((err) => console.error('[Email] Failed to fetch agent for payment retry email:', err));
      }

      res.json({ ...updated, declineCode });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update payment method';
      console.error('[PaymentMethod] Update failed:', err);
      res.status(500).json({ message });
    }
  });

  // Admin subscription management
  app.get("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    const subs = await storage.getAllSubscriptions();
    res.json(subs);
  });

  app.post("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const adminCreateSubSchema = z.object({
        agentId: z.number().int().positive(),
        merchantName: z.string().min(2),
        merchantEmail: z.string().email().optional().or(z.literal('')),
        tier: z.enum(['tier_1', 'tier_2', 'tier_3']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      });
      const parseResult = adminCreateSubSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0].message });
      }
      const input = parseResult.data;
      const tierPrices: Record<string, number> = CONFIG.subscriptionTierPrices;
      const monthlyAmount = tierPrices[input.tier] || 199;
      const startDate = input.startDate ? new Date(input.startDate) : new Date();
      const endDate = input.endDate ? new Date(input.endDate) : undefined;
      const sub = await storage.createSubscription({
        agentId: input.agentId,
        merchantName: input.merchantName,
        merchantEmail: input.merchantEmail || undefined,
        tier: input.tier,
        monthlyAmount: monthlyAmount.toString(),
        startDate,
        endDate,
      });
      const actorId = req.user?.id;
      if (actorId) {
        storage.logActivity({
          actorId,
          actorType: 'admin',
          action: 'create',
          entityType: 'subscription',
          entityId: sub.id,
          description: `Admin ${req.user!.firstName} ${req.user!.lastName} created subscription #${sub.id} for merchant "${sub.merchantName}" (agent #${input.agentId}, tier: ${input.tier})`,
          details: { merchantName: sub.merchantName, tier: input.tier, endDate: endDate ?? null },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        }).catch((err) => console.error('[ActivityLog] Failed to log admin subscription create:', err));
      }
      res.status(201).json(sub);
    } catch (err) {
      console.error('[Admin] Failed to create subscription:', err);
      res.status(500).json({ message: 'Failed to create subscription' });
    }
  });

  app.patch("/api/admin/subscriptions/:id/end-date", requireAdmin, async (req, res) => {
    try {
      const subId = Number(req.params.id);
      const endDateSchema = z.object({ endDate: z.string().nullable() });
      const parseResult = endDateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0].message });
      }
      const endDate = parseResult.data.endDate ? new Date(parseResult.data.endDate) : null;
      const updated = await storage.updateSubscriptionEndDate(subId, endDate);
      const actorId = req.user?.id;
      if (actorId) {
        storage.logActivity({
          actorId,
          actorType: 'admin',
          action: 'update',
          entityType: 'subscription',
          entityId: updated.id,
          description: `Admin ${req.user!.firstName} ${req.user!.lastName} ${endDate ? `set end date to ${endDate.toISOString().split('T')[0]}` : 'cleared the end date'} for subscription #${updated.id}`,
          details: { endDate: endDate ?? null },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        }).catch((err) => console.error('[ActivityLog] Failed to log admin subscription end-date update:', err));
      }
      res.json(updated);
    } catch (err) {
      console.error('[Admin] Failed to update subscription end date:', err);
      res.status(500).json({ message: 'Failed to update subscription end date' });
    }
  });

  // Admin retry payment with existing payment method on file
  app.post("/api/admin/subscriptions/:id/retry-payment", requireAdmin, async (req, res) => {
    try {
      const subId = Number(req.params.id);
      if (!subId || subId <= 0) {
        return res.status(400).json({ message: 'Invalid subscription ID' });
      }

      const allSubs = await storage.getAllSubscriptions();
      const sub = allSubs.find((s) => s.id === subId);
      if (!sub) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      if (!sub.stripeSubscriptionId || !sub.stripeCustomerId) {
        return res.status(400).json({ message: 'This subscription does not have an active Stripe billing setup' });
      }

      const stripe = await getUncachableStripeClient();

      // Find the latest open invoice and pay it
      const invoices = await stripe.invoices.list({
        subscription: sub.stripeSubscriptionId,
        status: 'open',
        limit: 1,
      });

      if (invoices.data.length === 0) {
        return res.status(400).json({ message: 'No open invoice found to retry for this subscription' });
      }

      let newBillingStatus: 'active' | 'past_due' | 'failed';
      let invoiceFailureMsg: string | null = null;
      try {
        const paid = await stripe.invoices.pay(invoices.data[0].id);
        newBillingStatus = paid.status === 'paid' ? 'active' : 'past_due';
      } catch (invoiceErr: unknown) {
        invoiceFailureMsg = invoiceErr instanceof Error ? invoiceErr.message : 'Payment failed';
        console.warn('[AdminRetry] Invoice payment failed:', invoiceFailureMsg);
        newBillingStatus = 'failed';
      }

      const updated = await storage.updateSubscriptionBilling(subId, { billingStatus: newBillingStatus });

      storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'subscription',
        entityId: subId,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} retried payment for subscription #${subId} (${sub.merchantName}); result: ${newBillingStatus}`,
        details: { billingStatus: newBillingStatus },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      }).catch((err) => console.error('[ActivityLog] Failed to log admin payment retry:', err));

      // Notify the agent about the payment retry result
      const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const isSuccess = newBillingStatus === 'active';
      const notifTitle = isSuccess
        ? `Payment Successful: ${sub.merchantName}`
        : `Payment Failed: ${sub.merchantName}`;
      const notifMessage = isSuccess
        ? `Your outstanding payment for ${sub.merchantName} (${tierLabel}) has been processed successfully. Your subscription is now active.`
        : `The payment retry for ${sub.merchantName} (${tierLabel}) has failed. Please update your payment method and try again.`;

      storage.createNotification({
        agentId: sub.agentId,
        type: 'system',
        title: notifTitle,
        message: notifMessage,
      }).catch((err) => console.error('[Notification] Failed to create admin payment retry notification:', err));

      storage.getAgent(sub.agentId).then((agent) => {
        if (!agent) return;
        const prefs = (agent.emailPreferences as { emailOnPaymentRetrySuccess?: boolean; emailOnPaymentRetryFailed?: boolean } | null) ?? {};
        const emailData = { firstName: agent.firstName, merchantName: sub.merchantName, tier: tierLabel };
        if (isSuccess && prefs.emailOnPaymentRetrySuccess !== false) {
          emailService.sendPaymentRetrySuccessEmail(agent.email, emailData)
            .catch((err) => console.error('[Email] Failed to send payment retry success email:', err));
        } else if (!isSuccess && prefs.emailOnPaymentRetryFailed !== false) {
          emailService.sendPaymentRetryFailedEmail(agent.email, emailData)
            .catch((err) => console.error('[Email] Failed to send payment retry failed email:', err));
        }
      }).catch((err) => console.error('[Email] Failed to fetch agent for admin payment retry email:', err));

      if (invoiceFailureMsg) {
        return res.status(402).json({ message: invoiceFailureMsg, subscription: updated });
      }

      res.json(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to retry payment';
      console.error('[AdminRetry] Failed:', err);
      res.status(500).json({ message });
    }
  });

  app.patch("/api/admin/subscriptions/:id/status", requireAdmin, async (req, res) => {
    try {
      const subId = Number(req.params.id);
      const adminStatusSchema = z.object({ status: z.enum(['active', 'paused', 'cancelled', 'expired']) });
      const parseResult = adminStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0].message });
      }
      const { status } = parseResult.data;
      const actorId = req.user?.id;

      // Fetch current subscription to record previous state
      const allSubs = await storage.getAllSubscriptions();
      const existingSub = allSubs.find((s) => s.id === subId);

      const updated = await storage.updateSubscriptionStatus(subId, status, actorId);

      // Notify the agent by email and in-app notification
      // Only notify on genuine status transitions (skip if status is unchanged)
      // Only send reactivation notice when subscription was previously paused
      const isReactivation = status === 'active' && existingSub?.status === 'paused';
      if (existingSub && existingSub.status !== status && (status === 'paused' || status === 'cancelled' || status === 'expired' || isReactivation)) {
        const agent = await storage.getAgent(existingSub.agentId);
        if (agent) {
          const effectiveDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const tierLabel = existingSub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

          const notificationTitle = status === 'paused'
            ? `Subscription Paused: ${existingSub.merchantName}`
            : status === 'cancelled'
            ? `Subscription Cancelled: ${existingSub.merchantName}`
            : status === 'expired'
            ? `Subscription Expired: ${existingSub.merchantName}`
            : `Subscription Reactivated: ${existingSub.merchantName}`;
          const notificationMessage = status === 'paused'
            ? `Your ${tierLabel} subscription for ${existingSub.merchantName} has been paused as of ${effectiveDate}. Commission accrual is on hold until reactivated.`
            : status === 'cancelled'
            ? `Your ${tierLabel} subscription for ${existingSub.merchantName} has been cancelled as of ${effectiveDate}.`
            : status === 'expired'
            ? `Your ${tierLabel} subscription for ${existingSub.merchantName} has expired as of ${effectiveDate}. Commission accrual has stopped.`
            : `Your ${tierLabel} subscription for ${existingSub.merchantName} has been reactivated as of ${effectiveDate}. Commission accrual has resumed.`;
          // isReactivation is guaranteed true here if status === 'active' (enforced by outer condition)

          storage.createNotification({
            agentId: existingSub.agentId,
            type: 'system',
            title: notificationTitle,
            message: notificationMessage,
          }).catch((err) => console.error('[Notification] Failed to create admin subscription status notification:', err));

          const emailData = {
            firstName: agent.firstName,
            merchantName: existingSub.merchantName,
            tier: tierLabel,
            effectiveDate,
          };
          const prefs = (agent.emailPreferences as { emailOnPaused?: boolean; emailOnCancelled?: boolean; emailOnReactivated?: boolean } | null) ?? {};
          if (status === 'paused' && prefs.emailOnPaused !== false) {
            emailService.sendSubscriptionPausedEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send admin-triggered subscription paused email:', err));
          } else if (status === 'cancelled' && prefs.emailOnCancelled !== false) {
            emailService.sendSubscriptionCancelledEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send admin-triggered subscription cancelled email:', err));
          } else if (status === 'expired') {
            emailService.sendSubscriptionExpiredEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send admin-triggered subscription expired email:', err));
          } else if (isReactivation && prefs.emailOnReactivated !== false) {
            emailService.sendSubscriptionReactivatedEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send admin-triggered subscription reactivated email:', err));
          }
        }
      }

      // Log status change to activity log (all status transitions)
      if (actorId) {
        const action = status === 'paused' ? 'pause' : status === 'cancelled' ? 'cancel' : status === 'active' ? 'reactivate' : 'update';
        const actionLabel = status === 'paused' ? 'paused' : status === 'cancelled' ? 'cancelled' : status === 'active' ? 'reactivated' : 'updated';
        storage.logActivity({
          actorId,
          actorType: 'admin',
          action,
          entityType: 'subscription',
          entityId: updated.id,
          description: `Admin ${req.user!.firstName} ${req.user!.lastName} ${actionLabel} subscription #${updated.id}${existingSub ? ` for merchant "${existingSub.merchantName}"` : ''} (tier: ${updated.tier})`,
          details: {
            previousStatus: existingSub?.status ?? null,
            newStatus: status,
            merchantName: existingSub?.merchantName ?? null,
            tier: existingSub?.tier ?? null,
          },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        }).catch((err) => console.error('[ActivityLog] Failed to log admin subscription status update:', err));
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Admin subscription activity/history
  app.get("/api/admin/subscriptions/:id/activity", requireAdmin, async (req, res) => {
    try {
      const subId = Number(req.params.id);
      const [{ logs }, sub] = await Promise.all([
        storage.getActivityLogs(1, 100, { entityType: 'subscription', entityId: subId }),
        storage.getSubscriptionById(subId),
      ]);

      type ActivityEntryResponse = {
        id: number;
        actorId: number | null;
        actorType: string;
        actorName: string;
        action: string;
        entityType: string;
        entityId: number | null;
        description: string | null;
        createdAt: string;
      };

      const actorIds = [...new Set(logs.map((l) => l.actorId).filter((id): id is number => id != null))];
      const actorMap: Record<number, { firstName: string; lastName: string } | undefined> = {};
      await Promise.all(
        actorIds.map(async (aid) => {
          const agent = await storage.getAgent(aid);
          if (agent) actorMap[aid] = { firstName: agent.firstName, lastName: agent.lastName };
        })
      );

      type ActivityEntryResponse = {
        id: number;
        actorId: number | null;
        actorType: string;
        actorName: string;
        action: string;
        entityType: string;
        entityId: number | null;
        description: string | null;
        createdAt: string;
      };

      const enriched: ActivityEntryResponse[] = logs.map((l) => {
        const name = l.actorType === 'system'
          ? 'System'
          : l.actorId && actorMap[l.actorId]
            ? `${actorMap[l.actorId]!.firstName} ${actorMap[l.actorId]!.lastName}`
            : l.actorId ? `#${l.actorId}` : 'System';
        return {
          id: l.id,
          actorId: l.actorId,
          actorType: l.actorType,
          actorName: l.actorType === 'admin' ? `Admin ${name}` : name,
          action: l.action,
          entityType: l.entityType,
          entityId: l.entityId,
          description: l.description,
          createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : String(l.createdAt),
        };
      });

      // Synthesize a reactivation entry from subscription fields when no activity log entry exists.
      // This covers subscriptions reactivated before activity logging was introduced.
      const hasReactivateLog = logs.some((l) => l.action === 'reactivate');
      if (!hasReactivateLog && sub?.reactivatedAt) {
        const reactivatorName = sub.reactivatedBy
          ? `${sub.reactivatedBy.firstName} ${sub.reactivatedBy.lastName}`
          : sub.reactivatedById ? `#${sub.reactivatedById}` : 'System';
        const reactivatorType = sub.reactivatedBy?.isAdmin ? 'admin' : sub.reactivatedById ? 'agent' : 'system';
        enriched.push({
          id: -1,
          actorId: sub.reactivatedById ?? null,
          actorType: reactivatorType,
          actorName: reactivatorType === 'admin' ? `Admin ${reactivatorName}` : reactivatorName,
          action: 'reactivate',
          entityType: 'subscription',
          entityId: subId,
          description: `Subscription #${subId} reactivated`,
          createdAt: sub.reactivatedAt.toISOString(),
        });
      }

      // Sort descending by timestamp (most recent first) — consistent with activity log default ordering.
      enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch subscription activity" });
    }
  });

  // Admin subscription commission calculation (monthly trigger)
  app.post("/api/admin/subscriptions/calculate-commissions", requireAdmin, async (req, res) => {
    try {
      const allSubs = await storage.getAllSubscriptions();
      // Gate commissions: only subscriptions that are status=active AND billingStatus=active (or null for legacy)
      const activeSubs = allSubs.filter(s =>
        s.status === 'active' && (s.billingStatus === 'active' || s.billingStatus === null)
      );
      let processed = 0;
      let skipped = 0;
      const periodDate = new Date().toISOString().split('T')[0];
      const now = new Date();
      
      for (const sub of activeSubs) {
        const startDate = new Date(sub.startDate);
        const monthsSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
        
        let decayRate: number;
        if (monthsSinceStart < 3) decayRate = CONFIG.subscriptionDecay.months1to3;
        else if (monthsSinceStart < 6) decayRate = CONFIG.subscriptionDecay.months4to6;
        else if (monthsSinceStart < 9) decayRate = CONFIG.subscriptionDecay.months7to9;
        else if (monthsSinceStart < 12) decayRate = CONFIG.subscriptionDecay.months10to12;
        else decayRate = CONFIG.subscriptionDecay.postMonth12;
        
        const poolRate = CONFIG.subscriptionPools[sub.tier] || 0.50;
        let commissionRate = poolRate * decayRate;
        
        if (sub.mcaPairedDealId && monthsSinceStart < 3) {
          commissionRate += CONFIG.mcaPairingBonus;
        }
        
        const commissionAmount = Number(sub.monthlyAmount) * commissionRate;
        const commType = monthsSinceStart >= 12 ? 'subscription_residual' : 'subscription_commission';
        
        if (commissionAmount > 0) {
          const existing = await storage.findSubscriptionCommission(sub.agentId, sub.id, periodDate, commType);
          if (existing) { skipped++; continue; }
          await storage.createCommission({
            agentId: sub.agentId,
            subscriptionId: sub.id,
            type: commType,
            amount: commissionAmount.toFixed(2),
            periodDate,
            status: 'pending'
          });
          processed++;

          const commissionTypeLabel = commType === 'subscription_residual' ? 'Subscription Residual' : 'Subscription Commission';
          const agent = await storage.getAgent(sub.agentId);
          if (agent) {
            await storage.createNotification({
              agentId: sub.agentId,
              type: 'commission_earned',
              title: `${commissionTypeLabel} Earned!`,
              message: `You earned a $${commissionAmount.toFixed(2)} ${commissionTypeLabel} from ${sub.merchantName} (period: ${periodDate}).`,
              isRead: false,
              emailSent: false,
            });
            const commPrefs = (agent.emailPreferences as { emailOnCommissionEarned?: boolean } | null) ?? {};
            if (commPrefs.emailOnCommissionEarned !== false) {
              emailService.sendCommissionEarnedEmail(agent.email, {
                firstName: agent.firstName,
                commissionType: commissionTypeLabel,
                amount: commissionAmount,
                description: `From your subscription (period: ${periodDate})`,
              }).catch(console.error);
            }
          }
        }
      }
      
      res.json({ message: "Subscription commissions calculated", processed, skipped, totalActive: activeSubs.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Subscription commission calculation failed" });
    }
  });

  // === HOLDBACK MANAGEMENT ROUTES ===
  
  app.get("/api/admin/holdbacks", requireAdmin, async (req, res) => {
    const allHoldbacks = await storage.getAllHoldbacks();
    res.json(allHoldbacks);
  });

  app.get("/api/admin/holdbacks/pending", requireAdmin, async (req, res) => {
    const pending = await storage.getPendingHoldbacks();
    res.json(pending);
  });

  app.post("/api/admin/holdbacks/:id/release", requireAdmin, async (req, res) => {
    try {
      const released = await storage.releaseHoldback(Number(req.params.id));
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'release',
        entityType: 'holdback',
        entityId: Number(req.params.id),
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} released holdback #${req.params.id} — $${Number(released.totalAmount).toFixed(2)}`,
        details: { releasedAmount: released.totalAmount, status: released.status },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });
      res.json(released);
    } catch (err) {
      res.status(500).json({ message: "Failed to release holdback" });
    }
  });

  app.post("/api/admin/holdbacks/:id/clawback", requireAdmin, async (req, res) => {
    try {
      const { reason, percentage } = req.body;
      const result = await storage.applyClawback(Number(req.params.id), reason || "Default clawback", percentage || 100);
      
      if (result.commissionId) {
        await storage.voidCommission(result.commissionId, req.user!.id, `Clawback: ${reason}`);
      }
      
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'clawback',
        entityType: 'holdback',
        entityId: Number(req.params.id),
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} applied ${percentage || 100}% clawback to holdback #${req.params.id}: ${reason || 'Default clawback'}`,
        details: { reason: reason || 'Default clawback', percentage: percentage || 100, clawbackAmount: result.clawbackAmount },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      });
      
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to apply clawback" });
    }
  });

  // PATCH endpoint for holdback status updates (release or clawback via status field)
  app.patch("/api/admin/holdbacks/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, reason, percentage } = req.body as { status: string; reason?: string; percentage?: number };
      if (status === 'released') {
        const result = await storage.releaseHoldback(id);
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: 'admin',
          action: 'release',
          entityType: 'holdback',
          entityId: id,
          description: `Admin ${req.user!.firstName} ${req.user!.lastName} released holdback #${id}`,
          details: { status: 'released' },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        });
        return res.json(result);
      }
      if (status === 'clawed_back') {
        const pct = percentage ?? 100;
        const rsn = reason ?? 'Admin clawback';
        const result = await storage.applyClawback(id, rsn, pct);
        if (result.commissionId) {
          await storage.voidCommission(result.commissionId, req.user!.id, `Clawback: ${rsn}`);
        }
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: 'admin',
          action: 'clawback',
          entityType: 'holdback',
          entityId: id,
          description: `Admin ${req.user!.firstName} ${req.user!.lastName} applied ${pct}% clawback on holdback #${id} — ${rsn}`,
          details: { status: 'clawed_back', reason: rsn, percentage: pct },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        });
        return res.json(result);
      }
      res.status(400).json({ message: "Invalid status. Use 'released' or 'clawed_back'." });
    } catch (err) {
      res.status(500).json({ message: "Failed to update holdback status" });
    }
  });

  app.post("/api/admin/holdbacks/release-eligible", requireAdmin, async (req, res) => {
    try {
      const eligible = await storage.getReleasableHoldbacks();
      let released = 0;
      for (const holdback of eligible) {
        await storage.releaseHoldback(holdback.id);
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: 'admin',
          action: 'release',
          entityType: 'holdback',
          entityId: holdback.id,
          description: `Admin ${req.user!.firstName} ${req.user!.lastName} batch released holdback #${holdback.id}`,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        });
        released++;
      }
      res.json({ message: `Released ${released} holdbacks`, released });
    } catch (err) {
      res.status(500).json({ message: "Failed to release holdbacks" });
    }
  });

  // Agent holdback view
  app.get("/api/holdbacks", requireAuth, async (req, res) => {
    const agentHoldbacks = await storage.getHoldbacksByAgent(req.user!.id);
    res.json(agentHoldbacks);
  });

  // === COMMISSION CONFIG ROUTE ===
  app.get("/api/commission-config", requireAuth, async (req, res) => {
    res.json({
      gbrWaterfall: CONFIG.gbrWaterfall,
      fulfillmentTierRates: CONFIG.fulfillmentTierRates,
      holdback: CONFIG.holdback,
      clawback: CONFIG.clawback,
      subscriptionPools: CONFIG.subscriptionPools,
      subscriptionDecay: CONFIG.subscriptionDecay,
      subscriptionTierPrices: CONFIG.subscriptionTierPrices,
      platformFee: CONFIG.platformFee,
      binaryBonus: CONFIG.binaryBonus,
      rankRequirements: CONFIG.rankRequirements,
    });
  });

  // Admin Payout Management
  app.get(api.admin.payouts.list.path, requireAdmin, async (req, res) => {
    const payouts = await storage.getAllPayouts();
    res.json({ payouts, total: payouts.length, page: 1, pageSize: 100 });
  });

  app.get(api.admin.payouts.preview.path, requireAdmin, async (req, res) => {
    const periodStart = getWeekStart(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const periodEnd = getWeekStart();
    
    const preview = await storage.getPayoutPreview(periodStart, periodEnd);
    res.json(preview);
  });

  app.post(api.admin.payouts.create.path, requireAdmin, async (req, res) => {
    try {
      const { periodStart, periodEnd, agentIds } = api.admin.payouts.create.input.parse(req.body);
      
      const preview = await storage.getPayoutPreview(new Date(periodStart), new Date(periodEnd));
      let created = 0;
      let totalAmount = 0;
      
      for (const agentData of preview.agents) {
        if (agentIds && !agentIds.includes(agentData.agentId)) continue;
        if (agentData.amount <= 0) continue;
        
        const agent = await storage.getAgent(agentData.agentId);
        
        await storage.createPayout({
          agentId: agentData.agentId,
          amount: agentData.amount.toString(),
          method: agent?.payoutMethod || 'pending',
          status: 'pending',
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
        });
        
        created++;
        totalAmount += agentData.amount;
      }
      
      res.json({ created, totalAmount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create payouts" });
    }
  });

  app.post(api.admin.payouts.process.path, requireAdmin, async (req, res) => {
    try {
      await storage.processPayout(Number(req.params.id), req.user!.id);
      res.json({ success: true });
    } catch (err: any) {
      if (err.message === "Payout not found") return res.status(404).json({ message: "Payout not found" });
      res.status(500).json({ message: "Failed to process payout" });
    }
  });

  app.post(api.admin.payouts.markPaid.path, requireAdmin, async (req, res) => {
    const { externalId, notes } = api.admin.payouts.markPaid.input.parse(req.body);
    await storage.markPayoutComplete(Number(req.params.id), externalId);
    res.json({ success: true });
  });

  // Admin Announcement Management
  app.get(api.admin.announcements.list.path, requireAdmin, async (req, res) => {
    const announcements = await storage.getAnnouncements(true);
    res.json(announcements);
  });

  app.post(api.admin.announcements.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.announcements.create.input.parse(req.body);
      const announcement = await storage.createAnnouncement({
        ...input,
        target: input.target ?? 'all',
        isPinned: input.isPinned ?? false,
        isPublished: input.isPublished ?? false,
        priority: input.priority ?? 0,
        publishAt: input.publishAt ?? null,
        expiresAt: input.expiresAt ?? null,
        createdById: req.user!.id,
      });
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'create', entityType: 'announcement', entityId: announcement.id, description: `Admin ${req.user!.firstName} ${req.user!.lastName} created announcement: "${announcement.title}"`, details: { title: announcement.title } });
      res.status(201).json(announcement);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  app.patch(api.admin.announcements.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.announcements.update.input.parse(req.body);
      const updated = await storage.updateAnnouncement(Number(req.params.id), input);
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'update', entityType: 'announcement', entityId: Number(req.params.id), description: `Admin ${req.user!.firstName} ${req.user!.lastName} updated announcement #${req.params.id}`, details: input });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  app.delete(api.admin.announcements.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteAnnouncement(Number(req.params.id));
    await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'delete', entityType: 'announcement', entityId: Number(req.params.id), description: `Admin ${req.user!.firstName} ${req.user!.lastName} deleted announcement #${req.params.id}` });
    res.json({ success: true });
  });

  app.post(api.admin.announcements.publish.path, requireAdmin, async (req, res) => {
    await storage.updateAnnouncement(Number(req.params.id), { isPublished: true, publishAt: new Date() });
    await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'update', entityType: 'announcement', entityId: Number(req.params.id), description: `Admin ${req.user!.firstName} ${req.user!.lastName} published announcement #${req.params.id}`, details: { isPublished: true } });
    res.json({ success: true });
  });

  // Admin Resource Management
  app.get(api.admin.resources.list.path, requireAdmin, async (req, res) => {
    const resources = await storage.getResources(true);
    res.json(resources);
  });

  app.post(api.admin.resources.create.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.resources.create.input.parse(req.body);
      const resource = await storage.createResource({
        ...input,
        isPublished: input.isPublished ?? false,
        description: input.description ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        category: input.category ?? null,
        sortOrder: input.sortOrder ?? null,
        createdById: req.user!.id,
      });
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'create', entityType: 'resource', entityId: resource.id, description: `Admin ${req.user!.firstName} ${req.user!.lastName} created resource: "${resource.title}" (${resource.type})`, details: { title: resource.title, type: resource.type } });
      res.status(201).json(resource);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to create resource" });
    }
  });

  app.patch(api.admin.resources.update.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.resources.update.input.parse(req.body);
      const updated = await storage.updateResource(Number(req.params.id), input);
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'update', entityType: 'resource', entityId: Number(req.params.id), description: `Admin ${req.user!.firstName} ${req.user!.lastName} updated resource #${req.params.id}`, details: input });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  app.delete(api.admin.resources.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteResource(Number(req.params.id));
    await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'delete', entityType: 'resource', entityId: Number(req.params.id), description: `Admin ${req.user!.firstName} ${req.user!.lastName} deleted resource #${req.params.id}` });
    res.json({ success: true });
  });

  // Admin Settings
  app.get(api.admin.settings.get.path, requireAdmin, async (req, res) => {
    const saved = await storage.getAllPlatformSettings();
    res.json({
      commissionRates: saved.commissionRates ?? CONFIG.gbrWaterfall,
      rankRequirements: saved.rankRequirements ?? CONFIG.rankRequirements,
      binaryBonusCaps: saved.binaryBonusCaps ?? CONFIG.binaryBonus,
      companyInfo: saved.companyInfo ?? {
        name: "Leadershield Network",
        supportEmail: "support@leadershield.com",
      },
      expiryWarningDays: saved.expiryWarningDays ?? 7,
    });
  });

  app.patch(api.admin.settings.update.path, requireAdmin, async (req, res) => {
    try {
      const { commissionRates, rankRequirements, binaryBonusCaps, companyInfo, expiryWarningDays } = api.admin.settings.update.input.parse(req.body);

      // Persist each provided key to the DB
      if (commissionRates !== undefined) {
        await storage.savePlatformSetting('commissionRates', commissionRates, req.user!.id);
      }
      if (rankRequirements !== undefined) {
        await storage.savePlatformSetting('rankRequirements', rankRequirements, req.user!.id);
        Object.assign(CONFIG.rankRequirements, rankRequirements);
      }
      if (binaryBonusCaps !== undefined) {
        await storage.savePlatformSetting('binaryBonusCaps', binaryBonusCaps, req.user!.id);
        Object.assign(CONFIG.binaryBonus, binaryBonusCaps);
      }
      if (companyInfo !== undefined) {
        await storage.savePlatformSetting('companyInfo', companyInfo, req.user!.id);
      }
      if (expiryWarningDays !== undefined) {
        await storage.savePlatformSetting('expiryWarningDays', expiryWarningDays, req.user!.id);
      }

      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'settings',
        entityId: 0,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} updated platform settings`,
        details: { commissionRates, rankRequirements, binaryBonusCaps, companyInfo, expiryWarningDays },
      });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // Webhook Status
  app.get(api.admin.webhookStatus.get.path, requireAdmin, async (req, res) => {
    try {
      const saved = await storage.getAllPlatformSettings();
      const secretStored = !!saved.stripe_webhook_secret;
      const endpointId = saved.stripe_webhook_endpoint_id as string | null ?? null;

      if (!endpointId) {
        return res.json({ secretStored, endpointId: null, endpointUrl: null, endpointActive: null });
      }

      try {
        const stripe = await getUncachableStripeClient();
        const ep = await stripe.webhookEndpoints.retrieve(endpointId);
        return res.json({
          secretStored,
          endpointId,
          endpointUrl: ep.url,
          endpointActive: ep.status === 'enabled',
        });
      } catch {
        return res.json({ secretStored, endpointId, endpointUrl: null, endpointActive: false });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to retrieve webhook status" });
    }
  });

  // Test Webhook — verifies endpoint is registered on Stripe AND that our own listener URL responds
  app.post(api.admin.testWebhook.post.path, requireAdmin, async (req, res) => {
    try {
      const saved = await storage.getAllPlatformSettings();
      const endpointId = saved.stripe_webhook_endpoint_id as string | null ?? null;
      const secretStored = !!saved.stripe_webhook_secret;

      if (!endpointId || !secretStored) {
        return res.json({ success: false, message: "Webhook is not fully configured (missing secret or endpoint ID). Restart the app to reinitialize." });
      }

      const stripe = await getUncachableStripeClient();

      let endpointUrl: string;
      try {
        const ep = await stripe.webhookEndpoints.retrieve(endpointId);
        if (ep.status !== 'enabled') {
          return res.json({ success: false, message: `Stripe has a record of the endpoint (${endpointId}) but its status is "${ep.status}", not enabled. Restart the app to reinitialize.` });
        }
        endpointUrl = ep.url;
      } catch {
        return res.json({ success: false, message: "The stored Stripe endpoint ID is no longer valid. Restart the app to reinitialize." });
      }

      // Perform a live connectivity check: send a POST with no payload to our own webhook URL.
      // The handler will return 400 (missing signature), confirming the endpoint is up and accepting connections.
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const probe = await fetch(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        // 400 = listener is live and rejected the invalid signature — this is the expected response
        // 404 means the path doesn't exist (misconfigured endpoint URL), 5xx means server error
        if (probe.status === 400) {
          return res.json({ success: true, message: `Webhook endpoint ${endpointId} is active on Stripe and the listener is reachable at ${endpointUrl}.` });
        }
        if (probe.status === 404) {
          return res.json({ success: false, message: `Webhook listener path not found (HTTP 404) at ${endpointUrl}. The endpoint URL may be misconfigured.` });
        }
        if (probe.status >= 500) {
          return res.json({ success: false, message: `Endpoint responded with a server error (HTTP ${probe.status}). Check your server logs.` });
        }
        // Any other response (200, 401, etc.) is unexpected but the URL is reachable
        return res.json({ success: false, message: `Webhook listener responded with an unexpected status (HTTP ${probe.status}) at ${endpointUrl}. Expected HTTP 400 from signature validation.` });
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') {
          return res.json({ success: false, message: `Connectivity check timed out — the endpoint URL (${endpointUrl}) did not respond within 5 seconds.` });
        }
        return res.json({ success: false, message: `Could not reach the webhook URL (${endpointUrl}): ${fetchErr?.message ?? 'network error'}.` });
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  // Manually set the Stripe webhook signing secret (recovery path if auto-setup fails)
  app.post(api.admin.webhookSecret.update.path, requireAdmin, async (req, res) => {
    try {
      const { secret } = api.admin.webhookSecret.update.input.parse(req.body);

      await storage.savePlatformSetting('stripe_webhook_secret', secret, req.user!.id);

      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'settings',
        entityId: 0,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} manually updated the Stripe webhook secret`,
      });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to save webhook secret" });
    }
  });

  // Admin Activity Log — accessible at both /api/admin/activity-log and /api/admin/activity
  async function activityLogHandler(req: Request, res: Response) {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
    const search = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim()
      : undefined;
    const startDate = typeof req.query.startDate === 'string' && req.query.startDate
      ? new Date(req.query.startDate)
      : undefined;
    const endDate = typeof req.query.endDate === 'string' && req.query.endDate
      ? new Date(req.query.endDate)
      : undefined;
    const entityType = typeof req.query.entityType === 'string' && req.query.entityType.trim()
      ? req.query.entityType.trim()
      : undefined;
    const actionRaw = typeof req.query.action === 'string' && req.query.action.trim()
      ? req.query.action.trim()
      : undefined;
    const actorType = typeof req.query.actorType === 'string' && req.query.actorType.trim()
      ? req.query.actorType.trim()
      : undefined;

    const action = actionRaw === 'migration' ? undefined : actionRaw;
    const actions = actionRaw === 'migration' ? ['run_migration', 'revert_migration'] : undefined;
    
    const result = await storage.getActivityLogs(page, pageSize, { search, startDate, endDate, entityType, action, actions, actorType });
    res.json({ ...result, page, pageSize });
  }

  app.get(api.admin.activityLog.list.path, requireAdmin, activityLogHandler);
  app.get('/api/admin/activity', requireAdmin, activityLogHandler);

  // ==================== LEADS MANAGEMENT ====================

  // Admin: Get all leads
  app.get(api.admin.leads.list.path, requireAdmin, async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
    const status = req.query.status as string | undefined;
    const unassigned = req.query.unassigned === 'true';
    const agentId = req.query.agentId ? Number(req.query.agentId) : undefined;
    
    const result = await storage.getAllLeads(page, pageSize, { status, unassigned, assignedAgentId: agentId });
    res.json({ ...result, page, pageSize });
  });

  // Admin: Get lead stats
  app.get(api.admin.leads.stats.path, requireAdmin, async (req, res) => {
    const stats = await storage.getLeadStats();
    res.json(stats);
  });

  // Admin: Upload leads (bulk import)
  app.post(api.admin.leads.upload.path, requireAdmin, async (req, res) => {
    try {
      const { leads: leadsData, batchId } = api.admin.leads.upload.input.parse(req.body);
      const generatedBatchId = batchId || `batch_${Date.now()}`;
      
      const createdLeads = await storage.createLeadsBulk(
        leadsData.map(lead => ({
          ...lead,
          batchId: generatedBatchId,
          status: 'new' as const,
        }))
      );
      
      res.status(201).json({ created: createdLeads.length, batchId: generatedBatchId });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to upload leads" });
    }
  });

  // Admin: Assign leads to agent
  app.post(api.admin.leads.assign.path, requireAdmin, async (req, res) => {
    try {
      const { leadIds, agentId } = api.admin.leads.assign.input.parse(req.body);
      
      const assigned = await storage.assignLeadsToAgent(leadIds, agentId, req.user!.id);
      
      res.json({ assigned: assigned.length });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to assign leads" });
    }
  });

  // Admin: Get unassigned leads
  app.get(api.admin.leads.unassigned.path, requireAdmin, async (req, res) => {
    const leads = await storage.getUnassignedLeads();
    res.json(leads);
  });

  // Admin: Get AI followup queue
  app.get(api.admin.leads.aiQueue.path, requireAdmin, async (req, res) => {
    const queue = await storage.getAIFollowupQueue();
    res.json(queue);
  });

  // Admin: Mark lead as AI processed
  app.post(api.admin.leads.markAIProcessed.path, requireAdmin, async (req, res) => {
    const lead = await storage.markAIFollowupProcessed(Number(req.params.id));
    res.json({ success: true, lead });
  });

  // Admin: Get all lead requests
  app.get(api.admin.leadRequests.list.path, requireAdmin, async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
    
    const result = await storage.getAllLeadRequests(page, pageSize);
    res.json({ ...result, page, pageSize });
  });

  // Admin: Get pending lead requests
  app.get(api.admin.leadRequests.pending.path, requireAdmin, async (req, res) => {
    const pending = await storage.getPendingLeadRequests();
    res.json(pending);
  });

  // Admin: Respond to lead request
  app.post(api.admin.leadRequests.respond.path, requireAdmin, async (req, res) => {
    try {
      const { status, responseNotes, leadsAssigned } = api.admin.leadRequests.respond.input.parse(req.body);
      
      await storage.respondToLeadRequest(
        Number(req.params.id),
        req.user!.id,
        status,
        responseNotes,
        leadsAssigned
      );
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to respond to request" });
    }
  });

  // ==================== AGENT LEADS ====================

  // Agent: Get my assigned leads
  app.get(api.leads.list.path, requireAuth, async (req, res) => {
    const leads = await storage.getLeadsByAgent(req.user!.id);
    res.json(leads);
  });

  // Agent: Update lead status
  app.patch(api.leads.updateStatus.path, requireAuth, async (req, res) => {
    try {
      const { status, notes } = api.leads.updateStatus.input.parse(req.body);
      const leadId = Number(req.params.id);
      
      // Verify agent owns this lead
      const lead = await storage.getLead(leadId);
      if (!lead || lead.assignedAgentId !== req.user!.id) {
        return res.status(403).json({ message: "Lead not assigned to you" });
      }
      
      const updated = await storage.updateLeadStatus(leadId, status, notes);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update lead status" });
    }
  });

  // Agent: Request AI followup for a lead
  app.post(api.leads.requestAIFollowup.path, requireAuth, async (req, res) => {
    const leadId = Number(req.params.id);
    
    // Verify agent owns this lead
    const lead = await storage.getLead(leadId);
    if (!lead || lead.assignedAgentId !== req.user!.id) {
      return res.status(403).json({ message: "Lead not assigned to you" });
    }
    
    const updated = await storage.requestAIFollowup(leadId);
    res.json(updated);
  });

  // Agent: Request more leads
  app.post(api.leads.requestMore.path, requireAuth, async (req, res) => {
    try {
      const input = api.leads.requestMore.input.parse(req.body);
      
      const request = await storage.createLeadRequest({
        agentId: req.user!.id,
        requestedCount: input.requestedCount,
        preferredIndustry: input.preferredIndustry || null,
        preferredLocation: input.preferredLocation || null,
        notes: input.notes || null,
        status: 'pending',
      });
      
      res.status(201).json(request);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to submit lead request" });
    }
  });

  // Agent: Get my lead requests
  app.get(api.leads.myRequests.path, requireAuth, async (req, res) => {
    const requests = await storage.getLeadRequestsByAgent(req.user!.id);
    res.json(requests);
  });

  // Admin: Export Templates CRUD
  app.get(api.exportTemplates.list.path, requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getExportTemplatesForAdmin(req.user!.id);
      res.json(templates);
    } catch (err) {
      console.error("[export-templates] list error:", err);
      res.status(500).json({ message: "Failed to fetch export templates" });
    }
  });

  app.post(api.exportTemplates.create.path, requireAdmin, async (req, res) => {
    const parsed = z.object({
      name: z.string().min(1),
      columns: z.array(z.string()).min(1),
      isShared: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    try {
      const template = await storage.createExportTemplate({
        adminId: req.user!.id,
        name: parsed.data.name,
        columns: parsed.data.columns,
        isShared: parsed.data.isShared ?? false,
      });
      res.status(201).json(template);
    } catch (err) {
      console.error("[export-templates] create error:", err);
      res.status(500).json({ message: "Failed to create export template" });
    }
  });

  app.patch(api.exportTemplates.update.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid template id" });
    const existing = await storage.getExportTemplate(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    if (existing.adminId !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
    const parsed = z.object({
      name: z.string().min(1).optional(),
      columns: z.array(z.string()).min(1).optional(),
      isShared: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    try {
      const updated = await storage.updateExportTemplate(id, parsed.data);
      res.json(updated);
    } catch (err) {
      console.error("[export-templates] update error:", err);
      res.status(500).json({ message: "Failed to update export template" });
    }
  });

  app.delete(api.exportTemplates.delete.path, requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid template id" });
    const existing = await storage.getExportTemplate(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    if (existing.adminId !== req.user!.id) return res.status(403).json({ message: "Forbidden" });
    try {
      await storage.deleteExportTemplate(id);
      res.json({ success: true });
    } catch (err) {
      console.error("[export-templates] delete error:", err);
      res.status(500).json({ message: "Failed to delete export template" });
    }
  });

  // Admin: List migrations with applied status
  app.get("/api/admin/migrations", requireAdmin, async (req, res) => {
    try {
      const result = await pool.query<{ name: string; applied_at: string }>(
        `SELECT name, applied_at FROM schema_migrations ORDER BY applied_at ASC`
      );
      const appliedMap = new Map(result.rows.map((r) => [r.name, r.applied_at]));
      const list = migrations.map((m) => ({
        name: m.name,
        hasDown: !!m.down,
        appliedAt: appliedMap.get(m.name) ?? null,
      }));
      res.json(list);
    } catch {
      res.status(500).json({ message: "Failed to fetch migrations" });
    }
  });

  // Admin: Apply a pending migration
  app.post("/api/admin/migrations/:name/apply", requireAdmin, async (req, res) => {
    const { name } = req.params;

    const migration = migrations.find((m) => m.name === name);
    if (!migration) {
      return res.status(400).json({ message: `Migration "${name}" not found` });
    }
    const appliedResult = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`,
      [name]
    );
    if (appliedResult.rows[0].exists) {
      return res.status(400).json({ message: `Migration "${name}" has already been applied` });
    }

    // Check ordering: all earlier migrations in the list must be applied first
    const migrationIndex = migrations.findIndex((m) => m.name === name);
    const earlierMigrations = migrations.slice(0, migrationIndex);
    const unappliedEarlier: string[] = [];
    for (const earlier of earlierMigrations) {
      const earlierResult = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`,
        [earlier.name]
      );
      if (!earlierResult.rows[0].exists) {
        unappliedEarlier.push(earlier.name);
      }
    }
    if (unappliedEarlier.length > 0) {
      const list = unappliedEarlier.map((n) => `"${n}"`).join(", ");
      const plural = unappliedEarlier.length > 1 ? "s" : "";
      return res.status(400).json({
        message: `Cannot apply "${name}" — the following earlier migration${plural} must be applied first: ${list}`,
      });
    }

    try {
      await applyMigration(name);
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: "admin",
        action: "run_migration",
        entityType: "migration",
        entityId: 0,
        description: `Applied migration: ${name}`,
        details: { migration: name },
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });
      res.json({ message: `Migration "${name}" applied successfully` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      // Known validation errors from applyMigration — return 400 with the original message
      const isValidationError =
        message.startsWith(`Migration "${name}" has already been applied`) ||
        message.startsWith(`Cannot apply "${name}"`) ||
        message.startsWith(`Migration "${name}" not found`);
      if (isValidationError) {
        return res.status(400).json({ message });
      }
      console.error(`[migrations] apply "${name}" failed`, err);
      res.status(500).json({ message: "Migration apply failed due to a server error" });
    }
  });

  // Admin: Revert a migration
  app.post("/api/admin/migrations/:name/revert", requireAdmin, async (req, res) => {
    const { name } = req.params;

    // Pre-validate before running to avoid relying on string-matching of thrown errors
    const migration = migrations.find((m) => m.name === name);
    if (!migration) {
      return res.status(400).json({ message: `Migration "${name}" not found` });
    }
    if (!migration.down) {
      return res.status(400).json({ message: `Migration "${name}" does not have a down function` });
    }
    const appliedResult = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`,
      [name]
    );
    if (!appliedResult.rows[0].exists) {
      return res.status(400).json({ message: `Migration "${name}" has not been applied` });
    }

    // Block revert if any later migrations in the list are still applied
    const migrationIndex = migrations.findIndex((m) => m.name === name);
    const laterMigrations = migrations.slice(migrationIndex + 1);
    const appliedLater: string[] = [];
    for (const later of laterMigrations) {
      const laterResult = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS exists`,
        [later.name]
      );
      if (laterResult.rows[0].exists) {
        appliedLater.push(later.name);
      }
    }
    if (appliedLater.length > 0) {
      const list = appliedLater.map((n) => `"${n}"`).join(", ");
      const plural = appliedLater.length > 1 ? "s" : "";
      return res.status(400).json({
        message: `Cannot revert "${name}" — the following later migration${plural} must be reverted first: ${list}`,
      });
    }

    try {
      await revertMigration(name);
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: "admin",
        action: "revert_migration",
        entityType: "migration",
        entityId: 0,
        description: `Reverted migration: ${name}`,
        details: { migration: name },
        ipAddress: req.ip ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });
      res.json({ message: `Migration "${name}" reverted successfully` });
    } catch (err: unknown) {
      console.error(`[migrations] revert "${name}" failed`, err);
      res.status(500).json({ message: "Migration revert failed due to a server error" });
    }
  });

  app.get("/api/admin/health/schema", requireAdmin, async (_req, res) => {
    try {
      const result = await checkSchemaHealth();
      const status = result.healthy ? 200 : 503;
      res.status(status).json(result);
    } catch (err) {
      console.error("[schema-health] endpoint error:", err);
      res.status(500).json({ message: "Failed to check schema health" });
    }
  });

  // Seed Data (dev only)
  if (process.env.NODE_ENV !== "production") {
    await seedDatabase();
  }

  return httpServer;
}
