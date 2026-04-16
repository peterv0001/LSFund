import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { Agent } from "@shared/schema";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { seedDatabase } from "./seed";
import { emailService } from "./email";

// Extend Express User type
declare global {
  namespace Express {
    interface User extends Agent {}
  }
}

const scryptAsync = promisify(scrypt);

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

  // ==================== AUTH ROUTES ====================

  // Sponsor search endpoint (public - for registration dropdown)
  app.get(api.auth.searchSponsors.path, async (req, res) => {
    try {
      const query = (req.query.q as string) || '';
      const results = await storage.searchAgentsForSponsor(query);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post(api.auth.register.path, async (req, res) => {
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
          emailService.sendTeamSignupEmail(sponsor.email, {
            firstName: sponsor.firstName,
            newMemberName: `${agent.firstName} ${agent.lastName}`,
          }).catch(console.error);
        }
      }
      
      req.login(agent, (err) => {
        if (err) throw err;
        res.status(201).json(agent);
      });
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout(() => {
      res.status(200).send();
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    res.json(req.user);
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
      
      res.json({ message: "Password changed successfully" });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Forgot password
  app.post(api.auth.forgotPassword.path, async (req, res) => {
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
  app.post(api.auth.resetPassword.path, async (req, res) => {
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

      res.json({ message: "Your password has been reset successfully. You can now sign in." });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== AGENT ROUTES ====================

  app.get(api.agents.get.path, requireAuth, async (req, res) => {
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  });

  app.get(api.agents.team.path, requireAuth, async (req, res) => {
    // @ts-ignore
    if (req.user!.id !== Number(req.params.id) && !req.user!.isAdmin) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const team = await storage.getTeamStructure(Number(req.params.id));
    res.json(team);
  });

  app.get(api.agents.upline.path, requireAuth, async (req, res) => {
    const upline = await storage.getUpline(Number(req.params.id));
    res.json(upline);
  });

  app.patch(api.agents.updateProfile.path, requireAuth, async (req, res) => {
    try {
      const input = api.agents.updateProfile.input.parse(req.body);
      // @ts-ignore
      const updated = await storage.updateAgent(req.user!.id, input);
      res.json(updated);
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
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update payout method" });
    }
  });

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
    const { default: fetch } = await import('node-fetch');
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
      
      emailService.sendDealFundedEmail(agent!.email, {
        firstName: agent!.firstName,
        merchantName: deal.merchantName,
        amount: Number(deal.loanAmount),
        commission: macImmediate,
      }).catch(console.error);
      
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
    
    const result = await storage.getAgentsPaginated(page, pageSize, { search, status, rank });
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
    // @ts-ignore
    await storage.voidCommission(Number(req.params.id), req.user!.id, reason);
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

  app.post("/api/subscriptions", requireAuth, async (req, res) => {
    try {
      // @ts-ignore
      const agentId = req.user!.id;
      const { merchantName, merchantEmail, tier, mcaPairedDealId } = req.body;
      
      const tierPrices: Record<string, number> = CONFIG.subscriptionTierPrices;
      const monthlyAmount = tierPrices[tier] || 199;
      
      const sub = await storage.createSubscription({
        agentId,
        merchantName,
        merchantEmail,
        tier,
        monthlyAmount: monthlyAmount.toString(),
        mcaPairedDealId: mcaPairedDealId || undefined,
      });
      
      res.status(201).json(sub);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // Admin subscription management
  app.get("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    const subs = await storage.getAllSubscriptions();
    res.json(subs);
  });

  app.patch("/api/admin/subscriptions/:id/status", requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const updated = await storage.updateSubscriptionStatus(Number(req.params.id), status);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Admin subscription commission calculation (monthly trigger)
  app.post("/api/admin/subscriptions/calculate-commissions", requireAdmin, async (req, res) => {
    try {
      const allSubs = await storage.getAllSubscriptions();
      const activeSubs = allSubs.filter(s => s.status === 'active');
      let processed = 0;
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
          await storage.createCommission({
            agentId: sub.agentId,
            type: commType,
            amount: commissionAmount.toFixed(2),
            periodDate,
            status: 'pending'
          });
          processed++;
        }
      }
      
      res.json({ message: "Subscription commissions calculated", processed, totalActive: activeSubs.length });
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
      // @ts-ignore
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'release',
        entityType: 'holdback',
        entityId: Number(req.params.id),
        description: `Released holdback #${req.params.id} — $${Number(released.totalAmount).toFixed(2)}`,
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
        // @ts-ignore
        await storage.voidCommission(result.commissionId, req.user!.id, `Clawback: ${reason}`);
      }
      
      // @ts-ignore
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'clawback',
        entityType: 'holdback',
        entityId: Number(req.params.id),
        description: `Applied ${percentage || 100}% clawback to holdback #${req.params.id}: ${reason || 'Default clawback'}`,
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
        // @ts-ignore
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: 'admin',
          action: 'release',
          entityType: 'holdback',
          entityId: id,
          description: `Status update: released holdback #${id}`,
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
        // @ts-ignore
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: 'admin',
          action: 'clawback',
          entityType: 'holdback',
          entityId: id,
          description: `Status update: clawback ${pct}% on holdback #${id} — ${rsn}`,
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
        // @ts-ignore
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: 'admin',
          action: 'release',
          entityType: 'holdback',
          entityId: holdback.id,
          description: `Batch release: released holdback #${holdback.id}`,
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
    // @ts-ignore
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
      // @ts-ignore
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
      // @ts-ignore
      const announcement = await storage.createAnnouncement({ ...input, createdById: req.user!.id });
      // @ts-ignore
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'create', entityType: 'announcement', entityId: announcement.id, description: `Created announcement: "${announcement.title}"`, details: { title: announcement.title } });
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
      // @ts-ignore
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'update', entityType: 'announcement', entityId: Number(req.params.id), description: `Updated announcement #${req.params.id}`, details: input });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  app.delete(api.admin.announcements.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteAnnouncement(Number(req.params.id));
    // @ts-ignore
    await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'delete', entityType: 'announcement', entityId: Number(req.params.id) });
    res.json({ success: true });
  });

  app.post(api.admin.announcements.publish.path, requireAdmin, async (req, res) => {
    await storage.updateAnnouncement(Number(req.params.id), { isPublished: true, publishAt: new Date() });
    // @ts-ignore
    await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'update', entityType: 'announcement', entityId: Number(req.params.id), details: { isPublished: true } });
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
      // @ts-ignore
      const resource = await storage.createResource({ ...input, createdById: req.user!.id });
      // @ts-ignore
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'create', entityType: 'resource', entityId: resource.id, description: `Created resource: "${resource.title}" (${resource.type})`, details: { title: resource.title, type: resource.type } });
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
      // @ts-ignore
      await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'update', entityType: 'resource', entityId: Number(req.params.id), details: input });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  app.delete(api.admin.resources.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteResource(Number(req.params.id));
    // @ts-ignore
    await storage.logActivity({ actorId: req.user!.id, actorType: 'admin', action: 'delete', entityType: 'resource', entityId: Number(req.params.id) });
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
    });
  });

  app.patch(api.admin.settings.update.path, requireAdmin, async (req, res) => {
    try {
      const { commissionRates, rankRequirements, binaryBonusCaps, companyInfo } = api.admin.settings.update.input.parse(req.body);

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

      // @ts-ignore
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'settings',
        entityId: 0,
        details: { commissionRates, rankRequirements, binaryBonusCaps, companyInfo },
      });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to save settings" });
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
    
    const result = await storage.getActivityLogs(page, pageSize, { search, startDate, endDate });
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

  // Seed Data (dev only)
  if (process.env.NODE_ENV !== "production") {
    await seedDatabase();
  }

  return httpServer;
}
