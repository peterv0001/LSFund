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
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { seedDatabase } from "./seed";

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

// Commission Config
const CONFIG = {
  personalCommission: {
    agent: 0.40,
    builder: 0.45,
    leader: 0.50,
    director: 0.55,
    partner: 0.60
  },
  binaryBonus: {
    builder: { rate: 0.05, max: 2500 },
    leader: { rate: 0.06, max: 5000 },
    director: { rate: 0.07, max: 10000 },
    partner: { rate: 0.08, max: 25000 }
  },
  generationOverride: {
    leader: { 1: 0.10 },
    director: { 1: 0.15, 2: 0.10 },
    partner: { 1: 0.20, 2: 0.15, 3: 0.10, 4: 0.05 }
  },
  rankRequirements: {
    builder: { personalVolume: 1000, weakLegVolume: 2500 },
    leader: { personalVolume: 2500, weakLegVolume: 10000 },
    director: { personalVolume: 5000, weakLegVolume: 25000 },
    partner: { personalVolume: 10000, weakLegVolume: 100000 }
  }
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
        title: 'Welcome to PSL Capital!',
        message: 'Your account has been created. Start by completing your profile and exploring the platform.',
        isRead: false,
        emailSent: false,
      });
      
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

  // ==================== DEAL ROUTES ====================

  app.post(api.deals.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.deals.create.input.parse(req.body);
      // @ts-ignore
      const agentId = req.user!.id;
      
      const companyRevenue = Number(input.loanAmount) * 0.10;
      
      const deal = await storage.createDeal({
        ...input,
        agentId,
        loanAmount: input.loanAmount.toString(),
        companyRevenue: companyRevenue.toString(),
        status: 'funded',
        fundedAt: input.fundedAt || new Date(),
      });
      
      // Calculate personal commission
      const agent = await storage.getAgent(agentId);
      // @ts-ignore
      const rate = CONFIG.personalCommission[agent!.currentRank] || 0.40;
      const commissionAmount = companyRevenue * rate;
      
      await storage.createCommission({
        agentId,
        type: 'personal_deal',
        amount: commissionAmount.toString(),
        dealId: deal.id,
        periodDate: new Date().toISOString().split('T')[0],
        status: 'pending'
      });
      
      // Create notification
      await storage.createNotification({
        agentId,
        type: 'deal_funded',
        title: 'Deal Funded!',
        message: `Your deal for ${deal.merchantName} ($${Number(deal.loanAmount).toLocaleString()}) has been funded. You earned $${commissionAmount.toFixed(2)} in commission.`,
        dealId: deal.id,
        isRead: false,
        emailSent: false,
      });
      
      // Calculate generation overrides for upline
      const upline = await storage.getUpline(agentId);
      let generation = 0;
      
      for (const sponsor of upline) {
        if (generation >= 4) break;
        
        if (['leader', 'director', 'partner'].includes(sponsor.currentRank)) {
          generation++;
          // @ts-ignore
          const overrideRates = CONFIG.generationOverride[sponsor.currentRank];
          // @ts-ignore
          const overrideRate = overrideRates?.[generation];
          
          if (overrideRate) {
            const overrideAmount = commissionAmount * overrideRate;
            
            await storage.createCommission({
              agentId: sponsor.id,
              type: 'generation_override',
              amount: overrideAmount.toString(),
              dealId: deal.id,
              sourceAgentId: agentId,
              periodDate: new Date().toISOString().split('T')[0],
              status: 'pending'
            });
            
            await storage.createNotification({
              agentId: sponsor.id,
              type: 'commission_earned',
              title: 'Override Earned!',
              message: `You earned a $${overrideAmount.toFixed(2)} generation override from ${agent!.firstName} ${agent!.lastName}'s deal.`,
              isRead: false,
              emailSent: false,
            });
          }
        }
      }

      res.status(201).json(deal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error(err);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });
  
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
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Failed to update deal" });
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
          // @ts-ignore
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
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  app.delete(api.admin.announcements.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteAnnouncement(Number(req.params.id));
    res.json({ success: true });
  });

  app.post(api.admin.announcements.publish.path, requireAdmin, async (req, res) => {
    await storage.updateAnnouncement(Number(req.params.id), { isPublished: true, publishAt: new Date() });
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
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  app.delete(api.admin.resources.delete.path, requireAdmin, async (req, res) => {
    await storage.deleteResource(Number(req.params.id));
    res.json({ success: true });
  });

  // Admin Settings
  app.get(api.admin.settings.get.path, requireAdmin, async (req, res) => {
    res.json({
      commissionRates: CONFIG.personalCommission,
      rankRequirements: CONFIG.rankRequirements,
      binaryBonusCaps: CONFIG.binaryBonus,
      companyInfo: {
        name: "PSL Capital",
        supportEmail: "support@pslcapital.com",
      },
    });
  });

  // Admin Activity Log
  app.get(api.admin.activityLog.list.path, requireAdmin, async (req, res) => {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 50;
    
    const result = await storage.getActivityLogs(page, pageSize);
    res.json({ ...result, page, pageSize });
  });

  // Seed Data (dev only)
  if (process.env.NODE_ENV !== "production") {
    await seedDatabase();
  }

  return httpServer;
}
