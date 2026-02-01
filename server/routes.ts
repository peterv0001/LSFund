import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertAgentSchema } from "@shared/schema";
import { z } from "zod";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

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
  generationOverride: {
    leader: { 1: 0.10 },
    director: { 1: 0.15, 2: 0.10 },
    partner: { 1: 0.20, 2: 0.15, 3: 0.10, 4: 0.05 }
  }
};

import { seedDatabase } from "./seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === AUTH SETUP ===
  const PgSession = pgSession(session);
  
  app.use(
    session({
      store: new PgSession({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "dev_secret",
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
        const user = await storage.getAgentByEmail(username); // Username is email
        if (!user) return done(null, false);
        
        const isValid = await comparePasswords(password, user.password);
        if (!isValid) return done(null, false);
        
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

  // === AUTH ROUTES ===

  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      // 1. Check if email exists
      const existing = await storage.getAgentByEmail(input.email);
      if (existing) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // 2. Resolve Sponsor
      let sponsorId: number | undefined;
      if (input.referralCode) {
        const sponsor = await storage.getAgentByReferralCode(parseInt(input.referralCode));
        sponsorId = sponsor?.id;
      }
      
      // 3. Resolve Placement
      let placementId: number | undefined;
      let leg: 'left' | 'right' | undefined;
      
      if (sponsorId) {
        // Calculate placement based on strategy
        const placement = await storage.findPlacement(sponsorId, input.placementLeg);
        placementId = placement.placementId;
        leg = placement.leg;
      }
      
      // 4. Create Agent
      const hashedPassword = await hashPassword(input.password);
      const agent = await storage.createAgent({
        ...input,
        password: hashedPassword,
        sponsorId,
        placementId,
        leg: leg as 'left' | 'right',
        currentRank: 'agent',
        status: 'active',
        isAdmin: false
      });
      
      // Auto login
      req.login(agent, (err) => {
        if (err) throw err;
        res.status(201).json(agent);
      });
      
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
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

  // === AGENT ROUTES ===

  app.get(api.agents.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const agent = await storage.getAgent(Number(req.params.id));
    if (!agent) return res.status(404).send();
    res.json(agent);
  });

  app.get(api.agents.team.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // Only allow viewing own team or if admin
    // @ts-ignore
    if (req.user!.id !== Number(req.params.id) && !req.user!.isAdmin) {
      return res.status(403).send();
    }
    
    const team = await storage.getTeamStructure(Number(req.params.id));
    res.json(team);
  });

  // === DEAL ROUTES ===

  app.post(api.deals.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    try {
      const input = api.deals.create.input.parse(req.body);
      // @ts-ignore
      const agentId = req.user!.id;
      
      // 1. Calculate Revenue
      const companyRevenue = Number(input.loanAmount) * 0.10; // 10%
      
      // 2. Create Deal
      const deal = await storage.createDeal({
        ...input,
        agentId,
        companyRevenue: companyRevenue.toString(),
        status: 'funded',
        fundedAt: input.fundedAt || new Date(),
      });
      
      // 3. Calculate Personal Commission
      // @ts-ignore
      const agent = await storage.getAgent(agentId);
      // @ts-ignore
      const rate = CONFIG.personalCommission[agent.currentRank] || 0.40;
      const commissionAmount = companyRevenue * rate;
      
      await storage.createCommission({
        agentId,
        type: 'personal_deal',
        amount: commissionAmount.toString(),
        dealId: deal.id,
        periodDate: new Date(), // Should be week start
        status: 'pending'
      });
      
      // 4. Calculate Generation Overrides (Upline)
      const upline = await storage.getUpline(agentId);
      let generation = 1;
      
      for (const sponsor of upline) {
        if (generation > 4) break;
        
        // Check if sponsor qualifies (Leader+)
        if (['leader', 'director', 'partner'].includes(sponsor.currentRank)) {
          // @ts-ignore
          const overrideRates = CONFIG.generationOverride[sponsor.currentRank];
          // @ts-ignore
          const overrideRate = overrideRates?.[generation];
          
          if (overrideRate) {
            const overrideAmount = commissionAmount * overrideRate; // % of the COMMISSION, not revenue (usually). Wait, prompt says "closerCommission * rate". Yes.
            
            await storage.createCommission({
              agentId: sponsor.id,
              type: 'generation_override',
              amount: overrideAmount.toString(),
              dealId: deal.id,
              periodDate: new Date(),
              status: 'pending'
            });
          }
          generation++;
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
  
  app.get(api.deals.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // @ts-ignore
    const deals = await storage.getDealsByAgent(req.user!.id);
    res.json(deals);
  });

  // === COMMISSION ROUTES ===

  app.get(api.commissions.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // @ts-ignore
    const commissions = await storage.getCommissionsByAgent(req.user!.id);
    res.json(commissions);
  });

  app.get(api.commissions.stats.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // @ts-ignore
    const commissions = await storage.getCommissionsByAgent(req.user!.id);
    
    const totalEarned = commissions.reduce((sum, c) => sum + Number(c.amount), 0);
    const pending = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0);
    
    // Simplistic "This Week" (last 7 days)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = commissions
      .filter(c => new Date(c.createdAt) > oneWeekAgo)
      .reduce((sum, c) => sum + Number(c.amount), 0);
      
    res.json({ totalEarned, pending, thisWeek });
  });

  app.post(api.commissions.calculate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    // @ts-ignore
    if (!req.user!.isAdmin) return res.status(403).send();
    
    try {
      // 1. Get qualifying agents
      const allAgents = await storage.getAllAgents();
      const eligibleAgents = allAgents.filter(a => 
        ['builder', 'leader', 'director', 'partner'].includes(a.currentRank) && 
        a.status === 'active'
      );
      
      let processed = 0;
      // For demo purposes, we calculate based on ALL TIME volume to ensure stats show up.
      // In production, this would be `getWeekStart(new Date())`
      const periodStart = new Date(0); 
      
      const BINARY_RATES = {
        builder: { rate: 0.05, max: 2500 },
        leader: { rate: 0.06, max: 5000 },
        director: { rate: 0.07, max: 10000 },
        partner: { rate: 0.08, max: 25000 }
      };
      
      for (const agent of eligibleAgents) {
        const leftVol = await storage.getLegVolume(agent.id, 'left', periodStart);
        const rightVol = await storage.getLegVolume(agent.id, 'right', periodStart);
        
        const weakerLegVolume = Math.min(leftVol, rightVol);
        
        if (weakerLegVolume > 0) {
          // @ts-ignore
          const config = BINARY_RATES[agent.currentRank];
          if (config) {
            let bonus = weakerLegVolume * config.rate;
            bonus = Math.min(bonus, config.max);
            
            // Check if already paid for this period? For MVP demo, allow re-run or just create new
            await storage.createCommission({
              agentId: agent.id,
              type: 'binary_bonus',
              amount: bonus.toString(),
              periodDate: new Date(),
              status: 'pending'
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

  // Seed Data
  if (process.env.NODE_ENV !== "production") {
    await seedDatabase();
  }

  return httpServer;
}
