import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { Agent, AgentWithTeam, AgentInvitation, emailPreferencesSchema } from "@shared/schema";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { seedDatabase } from "./seed";
import { migrations, revertMigration, applyMigration, DUPLICATE_PLACEMENT_ERROR_PREFIX, findDuplicatePlacements, formatDuplicatePlacementReport } from "./migrations";
import { checkSchemaHealth } from "./schema-health";
import { CONFIG } from "./config";
import { computeMcaV2026, deriveMcaAcceleratorRates, fireSubscriptionV2026, type AgencyModel } from "./commissionEngine";
import {
  recalculateAgentGovernance,
  recalculateAllGovernance,
  qualifyDistributorTier,
  computeMembershipStatus,
  isBuyoutEligible,
  trailingMonthStart,
  type MembershipType,
  type ResidualStatus,
} from "./governance";
import { COMP_V2026 } from "./config";
import { emailService } from "./email";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { resolveExpiryWarningDays, EXPIRY_CHECK_INTERVAL_MS, getSchedulerStatus, getSchedulerConfigHealth, sendDueExpiryWarnings } from "./scheduler";
import { maybeNotifyAdminsAgentLostLastSubscription } from "./adminAlerts";
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

// Email verification (Task #509): generate a fresh raw token, persist only its
// sha256 hash on the agent, and send the verification email with a link to the
// frontend verify page. The raw token never touches the database.
async function issueEmailVerification(req: Request, agent: Agent): Promise<void> {
  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  await storage.updateAgent(agent.id, { emailVerificationToken: hashedToken });
  const base = process.env.APP_URL || `https://${req.get("host")}`;
  const verifyUrl = `${base}/verify-email?token=${rawToken}`;
  emailService
    .sendVerificationEmail(agent.email, { firstName: agent.firstName, verifyUrl })
    .catch(console.error);
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// GBR Waterfall Commission Config (legacy model) is the single source of truth
// in server/config.ts, imported above as CONFIG. The new 2026 model lives there
// too as COMP_V2026.

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

  const landingLeadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isTestEnv ? 0 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv,
    message: { message: "Too many submissions. Please try again later." },
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
      
      // Resolve the sponsor from an explicit sponsorId or a referral code.
      // If either field is supplied a referral was clearly intended, so a
      // missing or inactive sponsor must be an explicit error — never a silent
      // fall-through to a sponsorless, unplaced signup that loses the referral.
      const REFERRAL_UNAVAILABLE_MESSAGE =
        "This referral link is no longer valid because the sponsor's account is unavailable. You can sign up without a referral instead.";
      const hasReferralCode =
        typeof input.referralCode === 'string' && input.referralCode.trim() !== '';
      
      let sponsorId: number | undefined;
      
      if (input.sponsorId !== undefined) {
        const sponsor = await storage.getAgent(input.sponsorId);
        if (!sponsor || sponsor.status !== 'active') {
          return res.status(400).json({ message: REFERRAL_UNAVAILABLE_MESSAGE, code: 'REFERRAL_UNAVAILABLE' });
        }
        sponsorId = sponsor.id;
      } else if (hasReferralCode) {
        const sponsor = await storage.getAgentByReferralCode(input.referralCode!.trim());
        if (!sponsor || sponsor.status !== 'active') {
          return res.status(400).json({ message: REFERRAL_UNAVAILABLE_MESSAGE, code: 'REFERRAL_UNAVAILABLE' });
        }
        sponsorId = sponsor.id;
      }
      
      const hashedPassword = await hashPassword(input.password);
      
      // Strip any client-supplied tree/identity fields. The referral code is
      // only used above to look up the sponsor — it (and placement) must never
      // be written onto the new agent from the request body. The new agent
      // always gets a server-generated unique referral code and a
      // server-resolved placement.
      const {
        referralCode: _ignoredReferralCode,
        sponsorId: _ignoredSponsorId,
        placementId: _ignoredPlacementId,
        leg: _ignoredLeg,
        placementLeg,
        ...agentInput
      } = input;
      
      const agentData = {
        ...agentInput,
        password: hashedPassword,
        currentRank: 'agent' as const,
        status: 'active' as const,
        isAdmin: false,
        isSuperAdmin: false,
      };
      
      const agent = sponsorId
        ? await storage.createAgentWithPlacement(agentData, sponsorId, placementLeg || 'auto')
        : await storage.createAgent(agentData);
      
      // Create welcome notification
      await storage.createNotification({
        agentId: agent.id,
        type: 'system',
        title: 'Welcome to LeaderShield Funding!',
        message: 'Your account has been created. Please verify your email, then complete your profile to get started.',
        isRead: false,
        emailSent: false,
      });

      // If placement couldn't be auto-resolved, let the agent know an admin will
      // place them shortly instead of silently leaving them unplaced.
      if (agent.placementStatus === 'pending') {
        await storage.createNotification({
          agentId: agent.id,
          type: 'system',
          title: 'Placement in progress',
          message: "We're finalizing your position in the team structure. You'll be placed within 24 hours — you can start using the platform in the meantime.",
          isRead: false,
          emailSent: false,
        });
      }

      // Send verification + welcome emails (async, don't wait)
      await issueEmailVerification(req, agent);
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

  // Verify email (Task #509): confirm the address from the emailed link. The
  // link carries the raw token; we match its sha256 hash, then clear the token.
  app.get(api.auth.verifyEmail.path, passwordLimiter, async (req, res) => {
    try {
      const rawToken = String(req.params.token || "");
      if (!rawToken) {
        return res.status(400).json({ message: "This verification link is invalid." });
      }
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      const agent = await storage.getAgentByEmailVerificationToken(hashedToken);
      if (!agent) {
        return res.status(400).json({ message: "This verification link is invalid or has already been used." });
      }
      if (agent.emailVerifiedAt) {
        return res.json({ message: "Your email is already verified. You're all set!" });
      }
      await storage.updateAgent(agent.id, {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      });
      res.json({ message: "Your email has been verified. Welcome aboard!" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Resend the verification email to the signed-in agent (Task #509).
  app.post(api.auth.resendVerification.path, requireAuth, passwordLimiter, async (req, res) => {
    try {
      const agent = await storage.getAgent(req.user!.id);
      if (!agent) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (agent.emailVerifiedAt) {
        return res.status(400).json({ message: "Your email is already verified." });
      }
      await issueEmailVerification(req, agent);
      res.json({ message: "We've sent a fresh verification link to your email." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== TEAM INVITATIONS ====================
  // An authenticated agent invites a prospect by email. The placement slot is
  // NOT reserved here — it is resolved at acceptance via createAgentWithPlacement
  // under the inviter. Tokens are random and stored hashed (sha256); only the
  // raw token ever leaves the server, inside the email link.

  const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

  // Strip the (hashed) token before returning an invitation to a client.
  const sanitizeInvitation = (inv: AgentInvitation) => {
    const { token, ...rest } = inv;
    return rest;
  };

  function invitationAcceptUrl(req: Request, rawToken: string): string {
    const base = process.env.APP_URL || `https://${req.get('host')}`;
    return `${base}/invite/accept?token=${rawToken}`;
  }

  // Resolves the current state of an invitation for token-gated public routes.
  // Returns either an error message (with HTTP status) or the live invitation.
  async function resolveInvitationByRawToken(
    rawToken: string,
  ): Promise<{ error: string; inviterName?: string } | { invitation: AgentInvitation }> {
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");
    const invitation = await storage.getAgentInvitationByToken(hashedToken);

    if (!invitation) {
      return { error: "This invitation link is invalid." };
    }
    // Surface the sponsor's name on terminal states so an expired/used invite
    // still tells the prospect exactly who to ask for a fresh link.
    const inviter = await storage.getAgent(invitation.inviterId);
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : undefined;
    if (invitation.status === "cancelled") {
      return { error: "This invitation has been cancelled.", inviterName };
    }
    if (invitation.status === "accepted") {
      return { error: "This invitation has already been used.", inviterName };
    }
    if (invitation.status === "expired" || new Date() > invitation.expiresAt) {
      if (invitation.status !== "expired") {
        await storage.updateAgentInvitation(invitation.id, { status: "expired" });
      }
      const ask = inviterName ? `Ask ${inviterName} to send a new one.` : "Ask your sponsor to send a new one.";
      return { error: `This invitation has expired. ${ask}`, inviterName };
    }
    return { invitation };
  }

  // Create an invitation
  app.post(api.invitations.create.path, requireAuth, authLimiter, async (req, res) => {
    try {
      const input = api.invitations.create.input.parse(req.body);
      const inviter = await storage.getAgent(req.user!.id);

      if (!inviter || inviter.status !== "active") {
        return res.status(403).json({ message: "Your account is not active, so you can't send invitations right now." });
      }

      const email = input.email.toLowerCase();

      const existingAgent = await storage.getAgentByEmail(email);
      if (existingAgent) {
        return res.status(400).json({ message: "Someone with this email already has an account." });
      }

      // Avoid stacking duplicate pending invitations to the same prospect.
      const existingInvites = await storage.getAgentInvitationsByInviter(inviter.id);
      const duplicatePending = existingInvites.find(
        (inv) => inv.email === email && inv.status === "pending" && new Date() <= inv.expiresAt,
      );
      if (duplicatePending) {
        return res.status(400).json({ message: "You already have a pending invitation to this email." });
      }

      const rawToken = randomBytes(32).toString("hex");
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

      const invitation = await storage.createAgentInvitation({
        inviterId: inviter.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email,
        placementLeg: input.placementLeg,
        token: hashedToken,
        expiresAt,
      });

      emailService.sendTeamInvitationEmail(email, {
        inviterName: `${inviter.firstName} ${inviter.lastName}`,
        prospectName: input.firstName,
        acceptUrl: invitationAcceptUrl(req, rawToken),
      }).catch(console.error);

      res.status(201).json(sanitizeInvitation(invitation));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // List the authenticated agent's sent invitations
  app.get(api.invitations.list.path, requireAuth, async (req, res) => {
    const invitations = await storage.getAgentInvitationsByInviter(req.user!.id);
    // Lazily reflect expiry in the returned status without a write on the read path.
    const now = new Date();
    const result = invitations.map((inv) => {
      const view = inv.status === "pending" && now > inv.expiresAt
        ? { ...inv, status: "expired" as const }
        : inv;
      return sanitizeInvitation(view);
    });
    res.json(result);
  });

  // Resend a pending invitation (rotates token + expiry)
  app.post(api.invitations.resend.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid invitation id" });
      }

      const invitation = await storage.getAgentInvitation(id);
      if (!invitation || invitation.inviterId !== req.user!.id) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status === "accepted") {
        return res.status(400).json({ message: "This invitation has already been accepted." });
      }
      if (invitation.status === "cancelled") {
        return res.status(400).json({ message: "This invitation has been cancelled." });
      }

      const inviter = await storage.getAgent(req.user!.id);
      if (!inviter || inviter.status !== "active") {
        return res.status(403).json({ message: "Your account is not active, so you can't resend invitations right now." });
      }

      const rawToken = randomBytes(32).toString("hex");
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

      const updated = await storage.updateAgentInvitation(id, {
        token: hashedToken,
        expiresAt,
        status: "pending",
      });

      emailService.sendTeamInvitationEmail(invitation.email, {
        inviterName: `${inviter.firstName} ${inviter.lastName}`,
        prospectName: invitation.firstName,
        acceptUrl: invitationAcceptUrl(req, rawToken),
      }).catch(console.error);

      res.json(sanitizeInvitation(updated));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Cancel a pending invitation
  app.post(api.invitations.cancel.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid invitation id" });
      }

      const invitation = await storage.getAgentInvitation(id);
      if (!invitation || invitation.inviterId !== req.user!.id) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status === "accepted") {
        return res.status(400).json({ message: "This invitation has already been accepted and can't be cancelled." });
      }
      if (invitation.status === "cancelled") {
        return res.json(sanitizeInvitation(invitation));
      }

      const updated = await storage.updateAgentInvitation(id, { status: "cancelled" });
      res.json(sanitizeInvitation(updated));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public: look up an invitation by raw token (prefills the accept page)
  app.get(api.invitations.lookup.path, passwordLimiter, async (req, res) => {
    try {
      const rawToken = String(req.params.token || "");
      const resolved = await resolveInvitationByRawToken(rawToken);
      if ("error" in resolved) {
        return res.status(400).json({ message: resolved.error, inviterName: resolved.inviterName });
      }

      const { invitation } = resolved;
      const inviter = await storage.getAgent(invitation.inviterId);
      if (!inviter || inviter.status !== "active") {
        return res.status(400).json({ message: "The person who invited you is no longer active. Please contact support." });
      }

      res.json({
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        email: invitation.email,
        inviterName: `${inviter.firstName} ${inviter.lastName}`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public: accept an invitation, creating the agent under the inviter
  app.post(api.invitations.accept.path, authLimiter, async (req, res) => {
    try {
      const input = api.invitations.accept.input.parse(req.body);
      const resolved = await resolveInvitationByRawToken(input.token);
      if ("error" in resolved) {
        return res.status(400).json({ message: resolved.error });
      }

      const { invitation } = resolved;

      const inviter = await storage.getAgent(invitation.inviterId);
      if (!inviter || inviter.status !== "active") {
        return res.status(400).json({ message: "The person who invited you is no longer active. Please contact support." });
      }

      // Guard against an account being created for this email after the invite.
      const existingAgent = await storage.getAgentByEmail(invitation.email);
      if (existingAgent) {
        await storage.updateAgentInvitation(invitation.id, { status: "expired" });
        return res.status(400).json({ message: "An account with this email already exists. Please log in instead." });
      }

      const hashedPassword = await hashPassword(input.password);
      const strategy = (['left', 'right', 'auto'].includes(invitation.placementLeg)
        ? invitation.placementLeg
        : 'auto') as 'left' | 'right' | 'auto';

      const agent = await storage.createAgentWithPlacement(
        {
          email: invitation.email,
          password: hashedPassword,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          currentRank: 'agent' as const,
          status: 'active' as const,
          isAdmin: false,
          isSuperAdmin: false,
        },
        inviter.id,
        strategy,
      );

      await storage.updateAgentInvitation(invitation.id, {
        status: "accepted",
        acceptedAgentId: agent.id,
      });

      await storage.createNotification({
        agentId: agent.id,
        type: 'system',
        title: 'Welcome to LeaderShield Funding!',
        message: 'Your account has been created. Please verify your email, then complete your profile to get started.',
        isRead: false,
        emailSent: false,
      });

      if (agent.placementStatus === 'pending') {
        await storage.createNotification({
          agentId: agent.id,
          type: 'system',
          title: 'Placement in progress',
          message: "We're finalizing your position in the team structure. You'll be placed within 24 hours — you can start using the platform in the meantime.",
          isRead: false,
          emailSent: false,
        });
      }

      await issueEmailVerification(req, agent);
      emailService.sendWelcomeEmail(agent.email, agent.firstName).catch(console.error);

      await storage.createNotification({
        agentId: inviter.id,
        type: 'team_signup',
        title: 'New Team Member!',
        message: `${agent.firstName} ${agent.lastName} accepted your invitation and joined your team!`,
        isRead: false,
        emailSent: false,
      });
      const inviterPrefs = (inviter.emailPreferences as { emailOnTeamSignup?: boolean } | null) ?? {};
      if (inviterPrefs.emailOnTeamSignup !== false) {
        emailService.sendTeamSignupEmail(inviter.email, {
          firstName: inviter.firstName,
          newMemberName: `${agent.firstName} ${agent.lastName}`,
        }).catch(console.error);
      }

      req.login(agent, (err) => {
        if (err) throw err;
        res.status(200).json(sanitizeAgentSelf(agent));
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public landing-page lead capture (unauthenticated, for ad funnels)
  app.post(api.public.landingLead.path, landingLeadLimiter, async (req, res) => {
    try {
      const input = api.public.landingLead.input.parse(req.body);
      const { campaign, name, email, phone, company, industry, business, agent_ref, ...extra } = input;

      const enrichmentData: Record<string, unknown> = { campaign };
      for (const [key, value] of Object.entries(extra)) {
        if (value !== undefined && value !== null && value !== "") {
          enrichmentData[key] = value;
        }
      }

      // Resolve agent attribution from the shared link's referral code.
      // Only an exact, active referral-code match assigns the lead — a numeric
      // id or stale code falls through and the lead is saved unassigned.
      let assignedAgentId: number | null = null;
      if (agent_ref) {
        const ref = agent_ref.trim();
        if (ref) {
          const referrer = await storage.getAgentByReferralCodeStrict(ref);
          if (
            referrer &&
            referrer.referralCode &&
            referrer.referralCode.toUpperCase() === ref.toUpperCase() &&
            referrer.status === "active"
          ) {
            assignedAgentId = referrer.id;
            enrichmentData.agent_ref = referrer.referralCode;
          }
        }
      }

      const lead = await storage.createLead({
        contactName: name,
        contactEmail: email,
        contactPhone: phone ?? null,
        companyName: company ?? business ?? null,
        industry: industry ?? null,
        enrichmentData,
        source: `landing:${campaign}`,
        status: "new",
        assignedAgentId,
      });

      if (assignedAgentId) {
        await storage.updateLead(lead.id, { assignedAt: new Date() });
      }

      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Public advisor lookup: resolve a referral code to an advisor's first name
  // so shared landing pages can show a "shared by your advisor" banner.
  // Only exact, active referral-code matches resolve (no numeric-id enumeration).
  app.get(api.public.advisor.path, landingLeadLimiter, async (req, res) => {
    const code = String(req.params.code || "").trim();
    if (!code) return res.json({ found: false });
    const agent = await storage.getAgentByReferralCodeStrict(code);
    if (
      agent &&
      agent.referralCode &&
      agent.referralCode.toUpperCase() === code.toUpperCase() &&
      agent.status === "active"
    ) {
      return res.json({ found: true, name: agent.firstName });
    }
    res.json({ found: false });
  });

  // Public landing-page view tracking. Records a lightweight, privacy-safe
  // view event when a shared link (?ref=CODE) is opened. Only an exact, active
  // referral-code match credits the agent; anything else is silently dropped so
  // bad codes never create noise. No visitor PII (IP, cookie) is stored.
  app.post(api.public.landingView.path, landingLeadLimiter, async (req, res) => {
    try {
      const { ref, page } = api.public.landingView.input.parse(req.body);
      const code = ref.trim();
      if (code) {
        const agent = await storage.getAgentByReferralCodeStrict(code);
        if (
          agent &&
          agent.referralCode &&
          agent.referralCode.toUpperCase() === code.toUpperCase() &&
          agent.status === "active"
        ) {
          await storage.recordLandingPageView({ agentId: agent.id, page });
          return res.json({ recorded: true });
        }
      }
      res.json({ recorded: false });
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
    
    const baseUrl = process.env.APP_URL || 'https://leadershieldfunding.com';
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

  // Per-page traffic for the agent's shared landing pages (views + leads).
  app.get(api.agents.shareStats.path, requireAuth, async (req, res) => {
    const agent = await storage.getAgent(req.user!.id);
    const stats = await storage.getShareStats(req.user!.id, agent?.timezone ?? 'UTC');
    res.json(stats);
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

  // Onboarding checklist state for the signed-in agent (Task #509). Drives the
  // "Getting Started" card and the email-verification banner on the dashboard.
  app.get(api.agents.onboarding.path, requireAuth, async (req, res) => {
    try {
      const agentId = req.user!.id;
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const [module1Complete, deals, invites] = await Promise.all([
        storage.isModule1Complete(agentId),
        storage.getDealsByAgent(agentId),
        storage.getAgentInvitationsByInviter(agentId),
      ]);

      const profileComplete = Boolean(agent.firstName && agent.lastName && agent.phone);
      const emailVerified = Boolean(agent.emailVerifiedAt);
      const firstDealLogged = deals.length > 0;
      const firstInviteSent = invites.length > 0;

      const steps = [profileComplete, emailVerified, module1Complete, firstDealLogged, firstInviteSent];
      const completedCount = steps.filter(Boolean).length;
      const totalCount = steps.length;

      res.json({
        profileComplete,
        emailVerified,
        module1Complete,
        firstDealLogged,
        firstInviteSent,
        completedCount,
        totalCount,
        dismissed: Boolean(agent.onboardingDismissedAt),
        allComplete: completedCount === totalCount,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load onboarding status" });
    }
  });

  // Persist the agent's dismissal of the Getting Started card (Task #509).
  app.post(api.agents.dismissOnboarding.path, requireAuth, async (req, res) => {
    try {
      await storage.updateAgent(req.user!.id, { onboardingDismissedAt: new Date() });
      res.json({ message: "Onboarding checklist dismissed." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to dismiss onboarding checklist" });
    }
  });

  // ==================== DEAL ROUTES ====================

  // In-memory idempotency cache for deal creation.
  //
  // Each entry stores the Promise for an in-flight or recently-completed deal
  // creation keyed by "<agentId>:<X-Idempotency-Key>". Concurrent requests that
  // arrive with the same key while the first is still in-flight both await the
  // same Promise and receive the same Deal. Replay requests arriving within the
  // 60-second TTL window also receive the original result without hitting the
  // database again. If the creation promise rejects the entry is evicted so a
  // subsequent attempt can retry.
  type Deal = Awaited<ReturnType<typeof storage.createDeal>>;
  const dealIdempotencyCache = new Map<string, Promise<Deal>>();

  app.post(api.deals.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.deals.create.input.parse(req.body);
      // @ts-ignore
      const agentId = req.user!.id;

      // Gate revenue-generating actions behind email verification (Task #509).
      const actingAgent = await storage.getAgent(agentId);
      if (!actingAgent?.emailVerifiedAt) {
        return res.status(403).json({
          message: "Please verify your email before logging a deal. Check your inbox for the verification link or resend it from your dashboard.",
          code: "EMAIL_NOT_VERIFIED",
        });
      }

      // Server-side idempotency: if the client supplied X-Idempotency-Key, check
      // whether we already have a pending or recently-completed creation for this
      // (agent, key) pair. Both concurrent and retried requests receive the same
      // deal without inserting a duplicate row.
      const rawKey = req.headers["x-idempotency-key"];
      const idempotencyKey =
        typeof rawKey === "string" && rawKey.trim().length > 0
          ? rawKey.trim()
          : null;

      if (idempotencyKey) {
        const cacheKey = `${agentId}:${idempotencyKey}`;
        const cached = dealIdempotencyCache.get(cacheKey);
        if (cached) {
          // Return the result of the original (possibly still-in-flight) request.
          const deal = await cached;
          return res.status(201).json(deal);
        }
      }

      // Build the creation promise. Storing it BEFORE the first await means
      // any concurrent request that arrives while this one is in-flight will
      // find it in the cache and await the same Promise (Node.js is single-
      // threaded so there is no gap between cache.set and the first await).
      const creationPromise: Promise<Deal> = (async () => {
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

        return deal;
      })();

      if (idempotencyKey) {
        const cacheKey = `${agentId}:${idempotencyKey}`;
        dealIdempotencyCache.set(cacheKey, creationPromise);

        // Evict after 60 s so the Map doesn't grow without bound.
        const timer = setTimeout(
          () => dealIdempotencyCache.delete(cacheKey),
          60_000
        );
        // Don't prevent the process from exiting during tests.
        if (typeof timer === "object" && timer !== null && "unref" in timer) {
          (timer as ReturnType<typeof setTimeout> & { unref(): void }).unref();
        }

        // If creation fails, remove the entry so the client can retry.
        creationPromise.catch(() => dealIdempotencyCache.delete(cacheKey));
      }

      const deal = await creationPromise;
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

    // ====================================================================
    // v2026 MCA ENGINE (Compensation Manual) — NEW deals only
    // ====================================================================
    // Gross commission splits PMF 50% / Opening Agent Pool 32.5% /
    // Accelerator Pool 2.5% / LeaderShield EBITDA 15%. PMF and EBITDA are
    // company/funder allocations and create no agent commission. The opening
    // pool divides into producer + agency override (within the 32.5%, never
    // additive); the override flows up to 3 upline levels (80/15/5). The
    // opening agent's producer payout still runs through the 70/30 holdback +
    // clawback schedule. Accelerators and upline overrides pay immediately.
    if (deal.commissionModel === 'v2026') {
      // Per-record accelerators: subscription attachment (the agent has a
      // subscription paired to this deal) and repeat merchant (a prior funded
      // deal for the same merchant). Volume / product-penetration accelerators
      // depend on monthly aggregates and are sourced by the monthly recalc
      // task. The engine clamps the total to the +2.5% cap.
      const agentSubs = await storage.getSubscriptionsByAgent(agentId);
      const hasPairedSubscription = agentSubs.some((s) => s.mcaPairedDealId === deal.id);
      const dealMerchantEmail = deal.merchantEmail?.trim().toLowerCase() || null;
      const dealMerchantName = deal.merchantName.trim().toLowerCase();
      const agentDeals = await storage.getDealsByAgent(agentId);
      const isRepeatMerchant = agentDeals.some((d) => {
        if (d.id === deal.id || d.status !== 'funded') return false;
        const dEmail = d.merchantEmail?.trim().toLowerCase() || null;
        if (dealMerchantEmail && dEmail) return dEmail === dealMerchantEmail;
        return d.merchantName.trim().toLowerCase() === dealMerchantName;
      });

      const result = computeMcaV2026({
        gross: gbrAmount,
        agencyModel: (agent?.agencyModel ?? 'independent') as AgencyModel,
        acceleratorRates: deriveMcaAcceleratorRates({ hasPairedSubscription, isRepeatMerchant }),
      });

      // --- Opening Agent (producer) payout → 70/30 holdback ---
      const openingImmediate = result.producerAmount * CONFIG.holdback.immediateRelease;
      const openingDeferred = result.producerAmount * CONFIG.holdback.deferred;

      const { commission: openingComm, isNew: openingIsNew } = await storage.createCommission({
        agentId,
        type: 'mac_primary',
        amount: openingImmediate.toFixed(2),
        dealId: deal.id,
        periodDate,
        status: 'pending',
      });

      if (openingIsNew) {
        await storage.createHoldback({
          dealId: deal.id,
          agentId,
          commissionId: openingComm.id,
          totalAmount: openingDeferred.toFixed(2),
          releaseDate,
        });

        await storage.createNotification({
          agentId,
          type: 'deal_funded',
          title: 'Deal Funded!',
          message: `Your deal for ${deal.merchantName} ($${Number(deal.loanAmount).toLocaleString()}) has been funded. Opening Agent commission: $${openingImmediate.toFixed(2)} (+ $${openingDeferred.toFixed(2)} held for release).`,
          dealId: deal.id,
          isRead: false,
          emailSent: false,
        });

        const v2026AgentPrefs = (agent!.emailPreferences as { emailOnDealFunded?: boolean } | null) ?? {};
        if (v2026AgentPrefs.emailOnDealFunded !== false) {
          emailService.sendDealFundedEmail(agent!.email, {
            firstName: agent!.firstName,
            merchantName: deal.merchantName,
            amount: Number(deal.loanAmount),
            commission: openingImmediate,
          }).catch(console.error);
        }
      }

      // --- Performance accelerator (from the 2.5% pool) → opening agent, immediate ---
      if (result.acceleratorAmount > 0) {
        await storage.createCommission({
          agentId,
          type: 'fast_start',
          amount: result.acceleratorAmount.toFixed(2),
          dealId: deal.id,
          periodDate,
          status: 'pending',
        });
      }

      // --- Agency override → up to 3 upline levels (80/15/5), immediate ---
      if (result.overrideAmount > 0) {
        const upline = await storage.getUpline(agentId);
        const overrideTypes = ['mac_sponsor_l1', 'mac_sponsor_l2', 'generation_override'] as const;
        for (let i = 0; i < upline.length && i < result.overrideByLevel.length; i++) {
          const amount = result.overrideByLevel[i].amount;
          if (amount <= 0) continue;
          const sponsor = upline[i];
          const { isNew: overrideIsNew } = await storage.createCommission({
            agentId: sponsor.id,
            type: overrideTypes[i],
            amount: amount.toFixed(2),
            dealId: deal.id,
            sourceAgentId: agentId,
            periodDate,
            status: 'pending',
          });
          if (overrideIsNew) {
            await storage.createNotification({
              agentId: sponsor.id,
              type: 'commission_earned',
              title: 'Agency Override Earned!',
              message: `You earned a $${amount.toFixed(2)} L${i + 1} agency override from ${agent!.firstName} ${agent!.lastName}'s deal.`,
              isRead: false,
              emailSent: false,
            });
            const sponsorOverridePrefs = (sponsor.emailPreferences as { emailOnCommissionEarned?: boolean } | null) ?? {};
            if (sponsorOverridePrefs.emailOnCommissionEarned !== false) {
              emailService.sendCommissionEarnedEmail(sponsor.email, {
                firstName: sponsor.firstName,
                commissionType: `L${i + 1} Agency Override`,
                amount,
                description: `From ${agent!.firstName} ${agent!.lastName}'s deal (${deal.merchantName})`,
              }).catch(console.error);
            }
          }
        }
      }

      return;
    }

      // === GBR WATERFALL: MAC (Merchant Acquisition Compensation) ===
      // MAC = 30% of GBR, split: Primary 22%, Senior Sponsor L1 5%, Executive Sponsor L2 3%
      
      const macPrimaryAmount = gbrAmount * CONFIG.gbrWaterfall.macSplit.primaryAgent;
      const macImmediate = macPrimaryAmount * CONFIG.holdback.immediateRelease;
      const macDeferred = macPrimaryAmount * CONFIG.holdback.deferred;
      
      const { commission: macCommission, isNew: macIsNew } = await storage.createCommission({
        agentId,
        type: 'mac_primary',
        amount: macImmediate.toFixed(2),
        dealId: deal.id,
        periodDate,
        status: 'pending'
      });

      if (macIsNew) {
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
          
          const { commission: sponsorComm, isNew: sponsorIsNew } = await storage.createCommission({
            agentId: sponsor.id,
            type: sponsorConfig.type,
            amount: sponsorImmediate.toFixed(2),
            dealId: deal.id,
            sourceAgentId: agentId,
            periodDate,
            status: 'pending'
          });

          if (sponsorIsNew) {
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
        const { commission: tfcComm, isNew: tfcIsNew } = await storage.createCommission({
          agentId: fulfillmentAgentId,
          type: 'tfc',
          amount: tfcImmediate.toFixed(2),
          dealId: deal.id,
          sourceAgentId: agentId,
          periodDate,
          status: 'pending'
        });

        if (tfcIsNew) {
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
    const lostAllSubs = req.query.lostAllSubs === "true";
    
    const result = await storage.getAgentsPaginated(page, pageSize, { search, status, rank, sortBy, sortOrder, lostAllSubs });
    res.json({ ...result, page, pageSize });
  });

  // Admin onboarding cohort (Task #509): agents from the last 30 days with their
  // per-agent onboarding signals. Static path — must precede the :id route.
  app.get(api.admin.agents.onboarding.path, requireAdmin, async (req, res) => {
    try {
      const recent = await storage.getRecentSignupAgents(30);
      const now = Date.now();
      const rows = await Promise.all(recent.map(async (agent) => {
        const [module1Complete, deals, invites] = await Promise.all([
          storage.isModule1Complete(agent.id),
          storage.getDealsByAgent(agent.id),
          storage.getAgentInvitationsByInviter(agent.id),
        ]);
        const profileComplete = Boolean(agent.firstName && agent.lastName && agent.phone);
        const emailVerified = Boolean(agent.emailVerifiedAt);
        const steps = [profileComplete, emailVerified, module1Complete, deals.length > 0, invites.length > 0];
        const completed = steps.filter(Boolean).length;
        const createdAt = agent.createdAt ?? new Date();
        return {
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          createdAt: new Date(createdAt).toISOString(),
          daysSinceSignup: Math.floor((now - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000)),
          emailVerified,
          module1Complete,
          checklistPercent: Math.round((completed / steps.length) * 100),
          placementStatus: agent.placementStatus ?? 'placed',
        };
      }));
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load onboarding cohort" });
    }
  });

  // Unverified-account count for the admin nav badge (Task #509). Static path.
  app.get(api.admin.agents.unverifiedCount.path, requireAdmin, async (_req, res) => {
    try {
      const cnt = await storage.countUnverifiedAgents();
      res.json({ count: cnt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to count unverified agents" });
    }
  });

  // Pending-placement queue (Task #509). Static path — must precede :id route.
  app.get(api.admin.agents.pendingPlacement.path, requireAdmin, async (_req, res) => {
    try {
      const pending = await storage.getPendingPlacementAgents();
      res.json(pending);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load pending-placement agents" });
    }
  });

  app.get(api.admin.agents.get.path, requireAdmin, async (req, res) => {
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  });

  // Admin manually marks an agent's email verified (Task #509).
  app.post(api.admin.agents.verifyEmail.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const updated = await storage.updateAgent(id, {
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      });
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'agent',
        entityId: id,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} manually verified agent #${id}'s email`,
        details: {},
      });
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to verify agent email" });
    }
  });

  // Admin resends the verification email to an unverified agent (Task #509).
  app.post(api.admin.agents.resendVerification.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      if (agent.emailVerifiedAt) {
        return res.status(400).json({ message: "This agent's email is already verified." });
      }
      await issueEmailVerification(req, agent);
      res.json({ message: `Verification email resent to ${agent.email}.` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  // Admin assigns a binary-tree slot to a pending-placement agent (Task #509).
  app.post(api.admin.agents.resolvePlacement.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = api.admin.agents.resolvePlacement.input.parse(req.body);
      const agent = await storage.getAgent(id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      if (agent.placementStatus !== 'pending') {
        return res.status(400).json({ message: "This agent is already placed in the tree." });
      }

      const placementParent = await storage.getAgent(input.placementId);
      if (!placementParent) {
        return res.status(400).json({ message: "The chosen placement agent does not exist." });
      }

      // Reject a slot that is already taken to preserve binary-tree integrity.
      const taken = await storage.getAgentByPlacement(input.placementId, input.leg);
      if (taken) {
        return res.status(400).json({ message: `The ${input.leg} leg under that agent is already filled.` });
      }

      const updated = await storage.updateAgent(id, {
        placementId: input.placementId,
        leg: input.leg,
        placementStatus: 'placed',
      });
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'agent',
        entityId: id,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} placed agent #${id} on the ${input.leg} leg under agent #${input.placementId}`,
        details: { placementId: input.placementId, leg: input.leg },
      });
      await storage.createNotification({
        agentId: id,
        type: 'system',
        title: 'You\'ve been placed!',
        message: "Your position in the team structure has been finalized. Welcome to the team!",
        isRead: false,
        emailSent: false,
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to resolve placement" });
    }
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

  // ===== Governance (Task #473) =====
  // Network-wide monthly distributor-tier recalculation (manual trigger). The
  // static path is registered before the dynamic :id governance routes below.
  app.post(api.admin.agents.recalculateGovernance.path, requireAdmin, async (req, res) => {
    try {
      const summary = await recalculateAllGovernance(storage);
      // @ts-ignore
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'agent',
        entityId: 0,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} ran distributor-tier recalculation (${summary.changed}/${summary.processed} changed)`,
        details: summary,
      });
      res.json(summary);
    } catch (err) {
      console.error('[Governance] recalculation failed:', err);
      res.status(500).json({ message: "Failed to recalculate governance" });
    }
  });

  // Computed governance snapshot for one agent: qualified tier (from trailing
  // production), membership waiver status, and buyout-eligible subscriptions.
  app.get(api.admin.agents.governance.path, requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const agent = await storage.getAgent(id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const since = trailingMonthStart();
    const [fundedVolume, subscriptionRevenue, activeSubscriptions, collectedCommissionRevenue, subs] =
      await Promise.all([
        storage.getFundedVolumeSince(id, since),
        storage.getCollectedSubscriptionRevenue(id),
        storage.getActiveSubscriptionCount(id),
        storage.getCollectedCommissionRevenueSince(id, since),
        storage.getSubscriptionsByAgent(id),
      ]);

    const metrics = { fundedVolume, subscriptionRevenue, activeSubscriptions };
    const qualifiedTier = qualifyDistributorTier(metrics);
    const membership = computeMembershipStatus(
      agent.membershipType as MembershipType,
      collectedCommissionRevenue,
    );

    const now = Date.now();
    const buyoutEligibleSubscriptions = subs
      .filter((s) => s.status === 'active')
      .map((s) => {
        const monthsActive = Math.floor(
          (now - new Date(s.startDate).getTime()) / (30.44 * 24 * 60 * 60 * 1000),
        );
        return { id: s.id, merchantName: s.merchantName, tier: s.tier, monthsActive };
      })
      .filter((s) => isBuyoutEligible({
        tier: s.tier as any,
        monthsActive: s.monthsActive,
        residualStatus: agent.residualStatus as ResidualStatus,
      }));

    res.json({
      distributorTier: agent.distributorTier,
      qualifiedTier,
      metrics,
      membership,
      residualStatus: agent.residualStatus,
      membershipActive: agent.status === 'active',
      buyoutEligibleSubscriptions,
    });
  });

  // Set an agent's residual standing (good_standing / reduced / suspended).
  app.post(api.admin.agents.setResidualStatus.path, requireAdmin, async (req, res) => {
    try {
      const input = api.admin.agents.setResidualStatus.input.parse(req.body);
      const id = Number(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const updated = await storage.updateAgent(id, { residualStatus: input.status });
      // @ts-ignore
      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'agent',
        entityId: id,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} set residual standing of agent #${id} to "${input.status}"${input.reason ? ` (${input.reason})` : ''}`,
        details: { from: agent.residualStatus, to: input.status, reason: input.reason ?? null },
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update residual status" });
    }
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

      const lookupActorIds = Array.from(
        new Set(logs.filter(l => l.actorType === 'admin' || l.actorType === 'agent').map(l => l.actorId))
      );
      const actorMap: Record<number, string> = {};
      await Promise.all(
        lookupActorIds.map(async (aid) => {
          const actor = await storage.getAgent(aid);
          if (actor) actorMap[aid] = `${actor.firstName} ${actor.lastName}`;
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
            ? `Admin ${actorMap[actorId] ?? `#${actorId}`}`
            : actorType === 'agent'
              ? actorMap[actorId] ?? `#${actorId}`
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

      // Gate revenue-generating actions behind email verification (Task #509).
      const actingAgent = await storage.getAgent(agentId);
      if (!actingAgent?.emailVerifiedAt) {
        return res.status(403).json({
          message: "Please verify your email before creating a subscription. Check your inbox for the verification link or resend it from your dashboard.",
          code: "EMAIL_NOT_VERIFIED",
        });
      }

      const createSubSchema = z.object({
        merchantName: z.string().min(2),
        merchantEmail: z.string().email().optional().or(z.literal('')),
        tier: z.enum(['tier_1', 'tier_2', 'tier_3', 'tier_4']),
        startDate: z.string().optional().refine((val) => {
          if (!val) return true;
          const d = new Date(val);
          return !isNaN(d.getTime()) && d <= new Date();
        }, { message: 'Start date must be a valid date and not in the future' }),
        mcaPairedDealId: z.number().int().positive().optional(),
        paymentMethodId: z.string().optional(),
        isMemberPurchase: z.boolean().optional(),
      });

      const input = createSubSchema.parse(req.body);

      // Governance (Task #473): internal member purchases use discounted member
      // pricing and pay zero commission. There are no member Stripe price IDs
      // configured (only retail STRIPE_PRICE_TIER_*), so we must not run a member
      // purchase through external Stripe billing — that would charge the retail
      // price while the record stores the member price. Reject the combination
      // until dedicated member Stripe pricing exists.
      if (input.isMemberPurchase && input.paymentMethodId) {
        return res.status(400).json({
          message: 'Member-priced purchases cannot be billed through Stripe; omit the payment method for internal member pricing.',
        });
      }

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
      // Governance (Task #473): internal member purchases use the discounted
      // member price from the Manual and generate ZERO commission (handled below).
      const monthlyAmount = input.isMemberPurchase
        ? COMP_V2026.subscriptionPricing[input.tier].member
        : (tierPrices[input.tier] || 149);

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
        isMemberPurchase: input.isMemberPurchase ?? false,
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
          } else {
            // No Stripe price ID configured for this tier — billing was NOT started.
            // Log a warning so the money-leak is surfaced to admins immediately.
            console.warn(
              `[Billing] No Stripe price ID configured for tier "${input.tier}". ` +
              `Subscription #${sub.id} (merchant: "${input.merchantName}") was created ` +
              `but stripe.subscriptions.create was skipped — no money will be collected.`
            );
          }

          // Get card details from PaymentMethod
          const pm = await stripe.paymentMethods.retrieve(input.paymentMethodId);
          if (pm.card) {
            cardLast4 = pm.card.last4;
            cardBrand = pm.card.brand;
          }

          // Use 'no_price_id' billing status when the Stripe price is missing so
          // the subscription is clearly distinguishable from a normal pending one.
          const billingStatusToSet = stripePriceId ? 'pending' : 'no_price_id';

          // Update subscription with Stripe data
          await storage.updateSubscriptionBilling(sub.id, {
            stripeCustomerId: customer.id,
            stripeSubscriptionId: stripeSubscription?.id ?? null,
            stripePaymentMethodId: input.paymentMethodId,
            billingStatus: billingStatusToSet,
            cardLast4,
            cardBrand,
          });

          const updatedSub = await storage.getSubscription(sub.id);

          if (!stripePriceId) {
            // Activity log entry visible to admins in the audit trail
            storage.logActivity({
              actorId: agentId,
              actorType: 'agent',
              action: 'create',
              entityType: 'subscription',
              entityId: sub.id,
              description: `⚠️ Billing NOT started for ${input.tier} subscription #${sub.id} (merchant: "${input.merchantName}", $${monthlyAmount}/mo) — no Stripe price ID is configured for this tier. Admins must configure STRIPE_PRICE_${input.tier.toUpperCase()} and re-bill manually.`,
              details: { merchantName: input.merchantName, tier: input.tier, monthlyAmount, billingSkipped: true, reason: 'missing_stripe_price_id', mcaPairedDealId: verifiedPairedDealId ?? null },
              ipAddress: req.ip ?? null,
              userAgent: req.headers['user-agent'] ?? null,
            }).catch((err) => console.error('[ActivityLog] Failed to log billing-skipped warning:', err));

            // Notify all admin users so they can act immediately
            pool.query(`SELECT id FROM agents WHERE is_admin = true`)
              .then(({ rows: adminRows }) => {
                const notifPromises = adminRows.map((row: { id: number }) =>
                  storage.createNotification({
                    agentId: row.id,
                    type: 'system',
                    title: '⚠️ Billing not started — missing Stripe price ID',
                    message: `Subscription #${sub.id} for merchant "${input.merchantName}" (${input.tier}, $${monthlyAmount}/mo) was logged but billing was never started because no Stripe price ID is configured for tier "${input.tier}". Please set STRIPE_PRICE_${input.tier.toUpperCase()} and re-bill this customer.`,
                    isRead: false,
                    emailSent: false,
                  }).catch((err: any) => console.error('[Notification] Failed to notify admin:', err))
                );
                return Promise.all(notifPromises);
              })
              .catch((err: any) => console.error('[Notification] Failed to fetch admins for billing-skipped alert:', err));
          } else {
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
          }

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

      if (sub.commissionModel === 'v2026') {
        // v2026 subscription engine — pool×decay split into producer + agency
        // override (80/15/5 upline); internal member purchases pay nothing.
        const agentRecord = await storage.getAgent(agentId);
        if (agentRecord) {
          await fireSubscriptionV2026(storage, {
            sub,
            agent: {
              distributorTier: agentRecord.distributorTier,
              agencyModel: agentRecord.agencyModel as AgencyModel,
              residualStatus: agentRecord.residualStatus,
              membershipActive: agentRecord.status === 'active',
            },
            monthsSinceStart,
            periodDate: now.toISOString().split('T')[0],
            acceleratorRates: [],
          });
        }
      } else {
      let decayRate: number;
      if (monthsSinceStart < 3) decayRate = CONFIG.subscriptionDecay.months1to3;
      else if (monthsSinceStart < 6) decayRate = CONFIG.subscriptionDecay.months4to6;
      else if (monthsSinceStart < 9) decayRate = CONFIG.subscriptionDecay.months7to9;
      else if (monthsSinceStart < 12) decayRate = CONFIG.subscriptionDecay.months10to12;
      else decayRate = CONFIG.subscriptionDecay.postMonth12;

      const poolRate = CONFIG.subscriptionPools[input.tier] || 0.25;
      let commissionRate = poolRate * decayRate;
      if (verifiedPairedDealId && monthsSinceStart < 3) {
        commissionRate += CONFIG.mcaPairingBonus;
      }

      const commissionAmount = monthlyAmount * commissionRate;
      const commType = monthsSinceStart >= 12 ? 'subscription_residual' : 'subscription_commission';
      const periodDate = now.toISOString().split('T')[0];

      // Governance (Task #473): internal member purchases never pay commission.
      if (commissionAmount > 0 && !sub.isMemberPurchase) {
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
            const newEndDate = sub.endDate && new Date(sub.endDate).getTime() > Date.now()
              ? new Date(sub.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : undefined;
            emailService.sendSubscriptionReactivatedEmail(agent.email, { ...emailData, newEndDate })
              .catch((err) => console.error('[Email] Failed to send subscription reactivated email:', err));
          }
        }
      }

      // Alert admins if this self-service action caused the agent to lose their
      // last active subscription (paused or cancelled only — active is a reactivation).
      if (status !== 'active' && sub.status !== status) {
        const agentRecord = await storage.getAgent(agentId);
        if (agentRecord) {
          maybeNotifyAdminsAgentLostLastSubscription(
            agentRecord.id,
            `${agentRecord.firstName} ${agentRecord.lastName}`,
          ).catch((err) => console.error('[AdminAlert] last-sub alert error (self-service):', err));
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

      // paymentMethodId is optional: when omitted, the agent is retrying the
      // outstanding payment using the card already on file.
      const schema = z.object({ paymentMethodId: z.string().min(1).optional() });
      const parseResult = schema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0].message });
      }
      const { paymentMethodId: newPaymentMethodId } = parseResult.data;

      // Ensure subscription belongs to this agent
      const agentSubs = await storage.getSubscriptionsByAgent(agentId);
      const sub = agentSubs.find((s) => s.id === subId);
      if (!sub) {
        return res.status(404).json({ message: 'Subscription not found or access denied' });
      }

      if (!sub.stripeSubscriptionId || !sub.stripeCustomerId) {
        return res.status(400).json({ message: 'This subscription does not have an active Stripe billing setup' });
      }

      const isRetryWithExistingCard = !newPaymentMethodId;
      if (isRetryWithExistingCard && !sub.stripePaymentMethodId) {
        return res.status(400).json({ message: 'No card on file to retry with. Please enter a new card.' });
      }

      const stripe = await getUncachableStripeClient();

      // The payment method used to pay the invoice: the new one if provided,
      // otherwise the existing card on file.
      const paymentMethodId = newPaymentMethodId ?? sub.stripePaymentMethodId!;

      let cardLast4 = sub.cardLast4 ?? null;
      let cardBrand = sub.cardBrand ?? null;

      if (!isRetryWithExistingCard) {
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
        cardLast4 = pm.card?.last4 ?? null;
        cardBrand = pm.card?.brand ?? null;
      }

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
        description: isRetryWithExistingCard
          ? `Agent retried payment with card on file for subscription #${subId} (${sub.merchantName}); billing status: ${newBillingStatus ?? 'unchanged'}`
          : `Agent updated payment method for subscription #${subId} (${sub.merchantName}); billing status: ${newBillingStatus ?? 'unchanged'}`,
        details: { cardLast4, cardBrand, billingStatus: newBillingStatus ?? null, retryWithExistingCard: isRetryWithExistingCard },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      }).catch((err) => console.error('[ActivityLog] Failed to log payment method update:', err));

      // Send notification and email if a payment was attempted. We notify on all
      // three outcomes: success (active), still-pending (past_due — the invoice
      // resolved but did not pay), and hard failure (failed).
      if (newBillingStatus === 'active' || newBillingStatus === 'past_due' || newBillingStatus === 'failed') {
        const tierLabel = sub.tier.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

        let notifTitle: string;
        let notifMessage: string;
        if (newBillingStatus === 'active') {
          notifTitle = `Payment Successful: ${sub.merchantName}`;
          notifMessage = `Your outstanding payment for ${sub.merchantName} (${tierLabel}) has been processed successfully. Your subscription is now active.`;
        } else if (newBillingStatus === 'past_due') {
          notifTitle = `Payment Pending: ${sub.merchantName}`;
          notifMessage = `Your payment retry for ${sub.merchantName} (${tierLabel}) is still processing and hasn't cleared yet. No action is needed right now — we'll let you know once it's confirmed or if it fails.`;
        } else {
          notifTitle = `Payment Failed: ${sub.merchantName}`;
          notifMessage = `The payment retry for ${sub.merchantName} (${tierLabel}) has failed. Please update your payment method and try again.`;
        }

        storage.createNotification({
          agentId,
          type: 'system',
          title: notifTitle,
          message: notifMessage,
        }).catch((err) => console.error('[Notification] Failed to create payment retry notification:', err));

        storage.getAgent(agentId).then((agent) => {
          if (!agent) return;
          const prefs = (agent.emailPreferences as { emailOnPaymentRetrySuccess?: boolean; emailOnPaymentRetryPending?: boolean; emailOnPaymentRetryFailed?: boolean } | null) ?? {};
          const emailData = { firstName: agent.firstName, merchantName: sub.merchantName, tier: tierLabel };
          if (newBillingStatus === 'active' && prefs.emailOnPaymentRetrySuccess !== false) {
            emailService.sendPaymentRetrySuccessEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send payment retry success email:', err));
          } else if (newBillingStatus === 'past_due' && prefs.emailOnPaymentRetryPending !== false) {
            emailService.sendPaymentRetryPendingEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send payment retry pending email:', err));
          } else if (newBillingStatus === 'failed' && prefs.emailOnPaymentRetryFailed !== false) {
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

  app.get("/api/admin/subscriptions/due-for-warning", requireAdmin, async (req, res) => {
    try {
      const days = await resolveExpiryWarningDays();
      const due = await storage.getSubscriptionsDueForWarning(days);
      res.json({
        days,
        count: due.length,
        subscriptionIds: due.map((s) => s.id),
      });
    } catch (err) {
      console.error('[Admin] Failed to compute subscriptions due for warning:', err);
      res.status(500).json({ message: 'Failed to compute subscriptions due for warning' });
    }
  });

  // Runs the same warning flow the hourly scheduler uses for the subscriptions
  // currently in the warning window, on demand. After this runs, the matching
  // subscriptions have expiryWarningSentAt set, so the due-for-warning preview
  // count drops to 0.
  app.post("/api/admin/subscriptions/send-warnings", requireAdmin, async (_req, res) => {
    try {
      const result = await sendDueExpiryWarnings();
      res.json(result);
    } catch (err) {
      console.error('[Admin] Failed to send subscription expiry warnings:', err);
      res.status(500).json({ message: 'Failed to send subscription expiry warnings' });
    }
  });

  app.post("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const adminCreateSubSchema = z.object({
        agentId: z.number().int().positive(),
        merchantName: z.string().min(2),
        merchantEmail: z.string().email().optional().or(z.literal('')),
        tier: z.enum(['tier_1', 'tier_2', 'tier_3', 'tier_4']),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        // Governance (Task #473): internal member program — distributors buy at
        // member pricing, and these purchases generate ZERO commission.
        isMemberPurchase: z.boolean().optional(),
      });
      const parseResult = adminCreateSubSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: parseResult.error.errors[0].message });
      }
      const input = parseResult.data;
      const tierPrices: Record<string, number> = CONFIG.subscriptionTierPrices;
      // Member purchases use the discounted member price from the Manual.
      const monthlyAmount = input.isMemberPurchase
        ? COMP_V2026.subscriptionPricing[input.tier].member
        : (tierPrices[input.tier] || 149);
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
        isMemberPurchase: input.isMemberPurchase ?? false,
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
      const previous = await storage.getSubscription(subId);
      const previousEnd = previous?.endDate ? new Date(previous.endDate) : null;
      const updated = await storage.updateSubscriptionEndDate(subId, endDate);
      const actorId = req.user?.id;

      // Send a renewal/extension confirmation only when the end date is genuinely
      // pushed out: it must be in the future AND later than the prior end date (or
      // there was no prior end date). Skip when the date is cleared (null), set to
      // the past, or merely shortened, since those are not renewals.
      const isExtension = !!endDate
        && endDate.getTime() > Date.now()
        && (!previousEnd || endDate.getTime() > previousEnd.getTime());
      if (isExtension && endDate) {
        const agent = await storage.getAgent(updated.agentId);
        if (agent) {
          const newEndDate = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const tierLabel = updated.tier.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

          storage.createNotification({
            agentId: updated.agentId,
            type: 'system',
            title: `Subscription Renewed: ${updated.merchantName}`,
            message: `Your ${tierLabel} subscription for ${updated.merchantName} has been renewed through ${newEndDate}. Commission accrual continues.`,
          }).catch((err) => console.error('[Notification] Failed to create subscription renewal notification:', err));

          // Renewal is a positive subscription-continuation event, so it honors the
          // same opt-out as reactivation (emailOnReactivated). Absent/true => send.
          const prefs = (agent.emailPreferences as { emailOnReactivated?: boolean } | null) ?? {};
          if (prefs.emailOnReactivated !== false) {
            emailService.sendSubscriptionRenewedEmail(agent.email, {
              firstName: agent.firstName,
              merchantName: updated.merchantName,
              tier: tierLabel,
              newEndDate,
            }).catch((err) => console.error('[Email] Failed to send subscription renewed email:', err));
          }
        }
      }

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
      // Send a reactivation notice when a paused OR cancelled subscription is set active
      const isReactivation = status === 'active' && (existingSub?.status === 'paused' || existingSub?.status === 'cancelled');
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
            // Intentionally NOT gated behind any emailPreferences flag. Expiry is a
            // critical, time-sensitive account event (commission accrual has stopped
            // and the merchant must re-subscribe), so there is no opt-out: agents must
            // always be notified by email even if every other preference is disabled.
            emailService.sendSubscriptionExpiredEmail(agent.email, emailData)
              .catch((err) => console.error('[Email] Failed to send admin-triggered subscription expired email:', err));
          } else if (isReactivation && prefs.emailOnReactivated !== false) {
            const newEndDate = existingSub.endDate && new Date(existingSub.endDate).getTime() > Date.now()
              ? new Date(existingSub.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
              : undefined;
            emailService.sendSubscriptionReactivatedEmail(agent.email, { ...emailData, newEndDate })
              .catch((err) => console.error('[Email] Failed to send admin-triggered subscription reactivated email:', err));
          }
        }
      }

      // Alert admins if this status change caused the agent to lose their last
      // active subscription (paused/cancelled/expired can all trigger this).
      if (existingSub && existingSub.status !== status && status !== 'active') {
        const agent = await storage.getAgent(existingSub.agentId);
        if (agent) {
          maybeNotifyAdminsAgentLostLastSubscription(
            agent.id,
            `${agent.firstName} ${agent.lastName}`,
          ).catch((err) => console.error('[AdminAlert] last-sub alert error:', err));
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

        // v2026 subscription engine — NEW subscriptions only.
        if (sub.commissionModel === 'v2026') {
          const agent = await storage.getAgent(sub.agentId);
          if (!agent) { skipped++; continue; }
          const { producerAmount, commType, created } = await fireSubscriptionV2026(storage, {
            sub,
            agent: {
              distributorTier: agent.distributorTier,
              agencyModel: agent.agencyModel as AgencyModel,
              residualStatus: agent.residualStatus,
              membershipActive: agent.status === 'active',
            },
            monthsSinceStart,
            periodDate,
            acceleratorRates: [],
          });
          if (!created) { skipped++; continue; }
          processed++;

          const commissionTypeLabel = commType === 'subscription_residual' ? 'Subscription Residual' : 'Subscription Commission';
          await storage.createNotification({
            agentId: sub.agentId,
            type: 'commission_earned',
            title: `${commissionTypeLabel} Earned!`,
            message: `You earned a $${producerAmount.toFixed(2)} ${commissionTypeLabel} from ${sub.merchantName} (period: ${periodDate}).`,
            isRead: false,
            emailSent: false,
          });
          const commPrefsV2026 = (agent.emailPreferences as { emailOnCommissionEarned?: boolean } | null) ?? {};
          if (commPrefsV2026.emailOnCommissionEarned !== false) {
            emailService.sendCommissionEarnedEmail(agent.email, {
              firstName: agent.firstName,
              commissionType: commissionTypeLabel,
              amount: producerAmount,
              description: `From your subscription (period: ${periodDate})`,
            }).catch(console.error);
          }
          continue;
        }

        let decayRate: number;
        if (monthsSinceStart < 3) decayRate = CONFIG.subscriptionDecay.months1to3;
        else if (monthsSinceStart < 6) decayRate = CONFIG.subscriptionDecay.months4to6;
        else if (monthsSinceStart < 9) decayRate = CONFIG.subscriptionDecay.months7to9;
        else if (monthsSinceStart < 12) decayRate = CONFIG.subscriptionDecay.months10to12;
        else decayRate = CONFIG.subscriptionDecay.postMonth12;
        
        const poolRate = CONFIG.subscriptionPools[sub.tier] || 0.25;
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
      
      const totalActive = activeSubs.length;

      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'calculate',
        entityType: 'commission',
        entityId: req.user!.id,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} ran subscription commission calculation: ${processed} processed, ${skipped} skipped (already existed) of ${totalActive} active subscriptions`,
        details: { processed, skipped, totalActive },
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      }).catch((err) => console.error('[ActivityLog] Failed to log commission calculation run:', err));

      res.json({ message: "Subscription commissions calculated", processed, skipped, totalActive });
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
        name: "LeaderShield Funding",
        supportEmail: "support@leadershieldfunding.com",
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

  // System Info — read-only operational config (e.g. scheduler interval)
  app.get(api.admin.systemInfo.get.path, requireAdmin, async (_req, res) => {
    const { lastRunAt, nextRunAt } = getSchedulerStatus();
    const { intervalMs, intervalInvalid, rejectedIntervalValue, defaultIntervalMs } = getSchedulerConfigHealth();
    res.json({
      expiryCheckIntervalMs: intervalMs,
      expiryCheckIntervalInvalid: intervalInvalid,
      expiryCheckIntervalRejectedValue: rejectedIntervalValue,
      expiryCheckIntervalDefaultMs: defaultIntervalMs,
      expiryWarningDays: await resolveExpiryWarningDays(),
      nodeEnv: process.env.NODE_ENV ?? "development",
      schedulerLastRunAt: lastRunAt,
      schedulerNextRunAt: nextRunAt,
    });
  });

  // Webhook Status
  app.get(api.admin.webhookStatus.get.path, requireAdmin, async (req, res) => {
    try {
      const saved = await storage.getAllPlatformSettings();
      const secretStored = !!saved.stripe_webhook_secret;
      // Mirror the resolution logic in webhookHandlers.ts: env var takes priority,
      // then the DB-stored value. Only this combined boolean is sent to the client —
      // neither the env var nor the stored secret value is ever exposed.
      const secretConfigured = !!process.env.STRIPE_WEBHOOK_SECRET || secretStored;
      const endpointId = saved.stripe_webhook_endpoint_id as string | null ?? null;

      if (!endpointId) {
        return res.json({ secretStored, secretConfigured, endpointId: null, endpointUrl: null, endpointActive: null });
      }

      try {
        const stripe = await getUncachableStripeClient();
        const ep = await stripe.webhookEndpoints.retrieve(endpointId);
        return res.json({
          secretStored,
          secretConfigured,
          endpointId,
          endpointUrl: ep.url,
          endpointActive: ep.status === 'enabled',
        });
      } catch {
        return res.json({ secretStored, secretConfigured, endpointId, endpointUrl: null, endpointActive: false });
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

    const ACTION_GROUPS: Record<string, string[]> = {
      migration: ['run_migration', 'revert_migration'],
      subscription_lifecycle: ['cancel', 'pause', 'activate', 'suspend', 'reactivate'],
      financial: ['void', 'release', 'clawback'],
    };
    const actions = actionRaw && ACTION_GROUPS[actionRaw] ? ACTION_GROUPS[actionRaw] : undefined;
    const action = actions ? undefined : actionRaw;
    
    const result = await storage.getActivityLogs(page, pageSize, { search, startDate, endDate, entityType, action, actions, actorType });
    res.json({ ...result, page, pageSize });
  }

  app.get(api.admin.activityLog.list.path, requireAdmin, activityLogHandler);
  app.get('/api/admin/activity', requireAdmin, activityLogHandler);

  // Count recent auto-expiry failures (subscription errors) for the dashboard alert banner
  app.get(api.admin.activityLog.expiryFailures.path, requireAdmin, async (_req, res) => {
    const sinceDays = 7;
    const startDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const { total } = await storage.getActivityLogs(1, 1, {
      entityType: 'subscription',
      action: 'error',
      startDate,
    });
    res.json({ count: total, sinceDays });
  });

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

  // ============ ADMIN INVITATION MANAGEMENT (Task #509) ============

  // Network-wide invitation list, optionally filtered by status. Reflects
  // expiry lazily so a pending-but-past-due invite shows as expired.
  app.get(api.admin.invitations.list.path, requireAdmin, async (req, res) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const dateFromRaw = req.query.dateFrom as string | undefined;
      const dateToRaw = req.query.dateTo as string | undefined;
      const dateFrom = dateFromRaw ? new Date(dateFromRaw) : null;
      // Make dateTo inclusive of the whole calendar day.
      const dateTo = dateToRaw ? new Date(`${dateToRaw}T23:59:59.999Z`) : null;

      // Fetch ALL invitations and compute effective status in memory. Filtering
      // by status in the DB would miss pending-but-past-due rows (they are still
      // stored as 'pending' but should surface as 'expired'), so the status and
      // date-range filters are both applied after the effective status is known.
      const invitations = await storage.getAllAgentInvitations();
      const now = new Date();
      const inviterIds = Array.from(new Set(invitations.map((i) => i.inviterId)));
      const inviterMap: Record<number, string> = {};
      await Promise.all(inviterIds.map(async (id) => {
        const inviter = await storage.getAgent(id);
        if (inviter) inviterMap[id] = `${inviter.firstName} ${inviter.lastName}`;
      }));
      const rows = invitations
        .map((inv) => {
          const effectiveStatus = inv.status === 'pending' && now > inv.expiresAt ? 'expired' : inv.status;
          const createdAt = new Date(inv.createdAt ?? now);
          return {
            id: inv.id,
            inviterId: inv.inviterId,
            inviterName: inviterMap[inv.inviterId] ?? `#${inv.inviterId}`,
            firstName: inv.firstName,
            lastName: inv.lastName,
            email: inv.email,
            placementLeg: inv.placementLeg,
            status: effectiveStatus,
            expiresAt: new Date(inv.expiresAt).toISOString(),
            acceptedAgentId: inv.acceptedAgentId ?? null,
            createdAt: createdAt.toISOString(),
            _createdAt: createdAt,
          };
        })
        .filter((row) => {
          if (statusFilter && statusFilter !== 'all' && row.status !== statusFilter) return false;
          if (dateFrom && row._createdAt < dateFrom) return false;
          if (dateTo && row._createdAt > dateTo) return false;
          return true;
        })
        .map(({ _createdAt, ...row }) => row);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load invitations" });
    }
  });

  // Admin resends any pending/expired invitation (rotates token + expiry).
  app.post(api.admin.invitations.resend.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid invitation id" });
      }
      const invitation = await storage.getAgentInvitation(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.status === 'accepted') {
        return res.status(400).json({ message: "This invitation has already been accepted." });
      }
      const inviter = await storage.getAgent(invitation.inviterId);
      if (!inviter) {
        return res.status(400).json({ message: "The original inviter no longer exists." });
      }

      const rawToken = randomBytes(32).toString("hex");
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
      await storage.updateAgentInvitation(id, {
        token: hashedToken,
        expiresAt,
        status: "pending",
      });

      emailService.sendTeamInvitationEmail(invitation.email, {
        inviterName: `${inviter.firstName} ${inviter.lastName}`,
        prospectName: invitation.firstName,
        acceptUrl: invitationAcceptUrl(req, rawToken),
      }).catch(console.error);

      res.json({ message: `Invitation resent to ${invitation.email}.` });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to resend invitation" });
    }
  });

  // Admin cancels any pending invitation.
  app.post(api.admin.invitations.cancel.path, requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ message: "Invalid invitation id" });
      }
      const invitation = await storage.getAgentInvitation(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.status === 'accepted') {
        return res.status(400).json({ message: "This invitation has already been accepted and can't be cancelled." });
      }
      await storage.updateAgentInvitation(id, { status: "cancelled" });
      res.json({ message: "Invitation cancelled." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to cancel invitation" });
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

  // Admin: Report duplicate binary-tree placements that block migration 016
  // (the placement uniqueness index). Returns an empty list when there are no
  // conflicts so the panel can proactively warn admins before they click Apply.
  app.get("/api/admin/migrations/duplicate-placements", requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      const duplicates = await findDuplicatePlacements(client);
      res.json({
        duplicates,
        report: duplicates.length > 0 ? formatDuplicatePlacementReport(duplicates) : null,
      });
    } catch (err) {
      console.error("[migrations] failed to check duplicate placements", err);
      res.status(500).json({ message: "Failed to check duplicate placements" });
    } finally {
      client.release();
    }
  });

  // Admin: Relocate an agent whose placement slot conflicts with another agent.
  // Finds the next available open slot under the agent's current sponsor using
  // the existing placement-resolution logic and moves the agent there.
  app.post("/api/admin/agents/:id/relocate-placement", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid agent ID." });
      }

      const agent = await storage.getAgent(id);
      if (!agent) return res.status(404).json({ message: "Agent not found." });
      if (!agent.placementId || !agent.leg) {
        return res.status(400).json({ message: "Agent has no current placement to relocate." });
      }
      if (!agent.sponsorId) {
        return res.status(400).json({ message: "Cannot relocate the root agent — they have no sponsor." });
      }

      // Find an open slot in the binary tree under this agent's sponsor,
      // preferring auto (weaker-leg) placement. If the slot is taken by the
      // time we write (concurrent request), retry up to 8 times.
      const MAX_ATTEMPTS = 8;
      let updatedAgent;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const placement = await storage.findPlacement(agent.sponsorId, 'auto');

        // Make sure we're not putting the agent back in the same conflicting slot.
        if (placement.placementId === agent.placementId && placement.leg === agent.leg) {
          // The slot we found IS the conflicting one — that means all open slots
          // under the sponsor already start here; try the other leg.
          const otherLeg: 'left' | 'right' = placement.leg === 'left' ? 'right' : 'left';
          const taken = await storage.getAgentByPlacement(placement.placementId, otherLeg);
          if (!taken) {
            updatedAgent = await storage.updateAgent(id, {
              placementId: placement.placementId,
              leg: otherLeg,
              placementStatus: 'placed',
            });
            break;
          }
          // Both legs at this level are occupied — this should not happen in
          // practice but guard against it.
          return res.status(409).json({ message: "No open slot found under this agent's sponsor. Please resolve another conflict first or place them manually." });
        }

        // Verify the slot isn't already taken (race guard).
        const taken = await storage.getAgentByPlacement(placement.placementId, placement.leg);
        if (taken) continue; // slot stolen — retry

        updatedAgent = await storage.updateAgent(id, {
          placementId: placement.placementId,
          leg: placement.leg,
          placementStatus: 'placed',
        });
        break;
      }

      if (!updatedAgent) {
        return res.status(409).json({ message: "Could not find an open placement slot after several retries. Please try again." });
      }

      await storage.logActivity({
        actorId: req.user!.id,
        actorType: 'admin',
        action: 'update',
        entityType: 'agent',
        entityId: id,
        description: `Admin ${req.user!.firstName} ${req.user!.lastName} relocated agent #${id} to the ${updatedAgent.leg} leg under agent #${updatedAgent.placementId} to resolve a duplicate-placement conflict`,
        details: { placementId: updatedAgent.placementId, leg: updatedAgent.leg },
      });

      await storage.createNotification({
        agentId: id,
        type: 'system',
        title: 'Your team position was updated',
        message: 'An admin has moved your position in the team structure as part of routine maintenance. Nothing changes for you — you are still in good standing.',
        isRead: false,
        emailSent: false,
      });

      res.json(updatedAgent);
    } catch (err) {
      console.error("[relocate-placement]", err);
      res.status(500).json({ message: "Failed to relocate agent placement." });
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
        message.startsWith(`Migration "${name}" not found`) ||
        message.startsWith(DUPLICATE_PLACEMENT_ERROR_PREFIX);
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

  // Admin: Revert a target migration together with all later still-applied
  // migrations that block it. Reverts successors first (latest → earliest),
  // then the target itself, reporting the outcome of each step.
  app.post("/api/admin/migrations/:name/revert-chain", requireAdmin, async (req, res) => {
    const { name } = req.params;

    const migration = migrations.find((m) => m.name === name);
    if (!migration) {
      return res.status(400).json({ message: `Migration "${name}" not found` });
    }

    const appliedRows = await pool.query<{ name: string }>(
      `SELECT name FROM schema_migrations`
    );
    const appliedNames = new Set(appliedRows.rows.map((r) => r.name));

    if (!appliedNames.has(name)) {
      return res.status(400).json({ message: `Migration "${name}" has not been applied` });
    }

    // Build the chain: the target plus every later migration that is still
    // applied, then reverse so successors are reverted before the target.
    const migrationIndex = migrations.findIndex((m) => m.name === name);
    const chain = migrations
      .slice(migrationIndex)
      .filter((m) => appliedNames.has(m.name))
      .reverse();

    // Every migration in the chain must have a rollback, otherwise we cannot
    // safely revert the whole chain.
    const missingDown = chain.filter((m) => !m.down).map((m) => m.name);
    if (missingDown.length > 0) {
      const list = missingDown.map((n) => `"${n}"`).join(", ");
      const plural = missingDown.length > 1 ? "s" : "";
      const verb = missingDown.length > 1 ? "have" : "has";
      return res.status(400).json({
        message: `Cannot revert chain — the following migration${plural} ${verb} no rollback defined: ${list}`,
      });
    }

    const results: {
      name: string;
      status: "reverted" | "failed" | "skipped";
      message: string;
    }[] = [];
    let failed = false;

    for (const m of chain) {
      if (failed) {
        results.push({
          name: m.name,
          status: "skipped",
          message: "Skipped because an earlier step failed",
        });
        continue;
      }
      try {
        await revertMigration(m.name);
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: "admin",
          action: "revert_migration",
          entityType: "migration",
          entityId: 0,
          description: `Reverted migration: ${m.name} (chain revert of "${name}")`,
          details: { migration: m.name, chainTarget: name },
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        });
        results.push({
          name: m.name,
          status: "reverted",
          message: `Migration "${m.name}" reverted successfully`,
        });
      } catch (err: unknown) {
        console.error(`[migrations] chain revert step "${m.name}" failed`, err);
        failed = true;
        results.push({
          name: m.name,
          status: "failed",
          message: "Migration revert failed due to a server error",
        });
      }
    }

    const success = !failed;
    const failedStep = results.find((r) => r.status === "failed");
    res.json({
      success,
      results,
      ...(success
        ? {}
        : {
            message: `Migration chain revert stopped: "${failedStep?.name ?? name}" failed to revert.`,
          }),
    });
  });

  // Admin: Apply a target migration together with all earlier unapplied
  // migrations that block it. Applies predecessors first (earliest → latest),
  // then the target itself, reporting the outcome of each step.
  app.post("/api/admin/migrations/:name/apply-chain", requireAdmin, async (req, res) => {
    const { name } = req.params;

    const migration = migrations.find((m) => m.name === name);
    if (!migration) {
      return res.status(400).json({ message: `Migration "${name}" not found` });
    }

    const appliedRows = await pool.query<{ name: string }>(
      `SELECT name FROM schema_migrations`
    );
    const appliedNames = new Set(appliedRows.rows.map((r) => r.name));

    if (appliedNames.has(name)) {
      return res.status(400).json({ message: `Migration "${name}" has already been applied` });
    }

    // Build the chain: every earlier unapplied migration plus the target,
    // in order (earliest first so each can be applied in sequence).
    const migrationIndex = migrations.findIndex((m) => m.name === name);
    const chain = migrations
      .slice(0, migrationIndex + 1)
      .filter((m) => !appliedNames.has(m.name));

    const results: {
      name: string;
      status: "applied" | "failed" | "skipped";
      message: string;
    }[] = [];
    let failed = false;

    for (const m of chain) {
      if (failed) {
        results.push({
          name: m.name,
          status: "skipped",
          message: "Skipped because an earlier step failed",
        });
        continue;
      }
      try {
        await applyMigration(m.name);
        await storage.logActivity({
          actorId: req.user!.id,
          actorType: "admin",
          action: "run_migration",
          entityType: "migration",
          entityId: 0,
          description: `Applied migration: ${m.name} (chain apply of "${name}")`,
          details: { migration: m.name, chainTarget: name },
          ipAddress: req.ip ?? null,
          userAgent: req.headers["user-agent"] ?? null,
        });
        results.push({
          name: m.name,
          status: "applied",
          message: `Migration "${m.name}" applied successfully`,
        });
      } catch (err: unknown) {
        console.error(`[migrations] chain apply step "${m.name}" failed`, err);
        failed = true;
        results.push({
          name: m.name,
          status: "failed",
          message: "Migration apply failed due to a server error",
        });
      }
    }

    const success = !failed;
    const failedStep = results.find((r) => r.status === "failed");
    res.json({
      success,
      results,
      ...(success
        ? {}
        : {
            message: `Migration chain apply stopped: "${failedStep?.name ?? name}" failed to apply.`,
          }),
    });
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
