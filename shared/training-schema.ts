import { pgTable, text, serial, integer, boolean, timestamp, decimal, pgEnum, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agents } from "./schema";

// === ENUMS ===
export const courseStatusEnum = pgEnum("course_status", ['not_started', 'in_progress', 'completed']);
export const leadTierEnum = pgEnum("lead_tier", ['starter', 'bronze', 'silver', 'gold', 'platinum']);

// === COURSE & TRAINING TABLES ===

export const courseModules = pgTable("course_modules", {
  id: serial("id").primaryKey(),
  
  moduleNumber: integer("module_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  
  // Video content
  videoUrl: text("video_url"), // Full module video
  durationSeconds: integer("duration_seconds"),
  
  // Slide count
  slideCount: integer("slide_count").default(0),
  
  // Order & status
  sortOrder: integer("sort_order").default(0),
  isPublished: boolean("is_published").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const courseSlides = pgTable("course_slides", {
  id: serial("id").primaryKey(),
  
  moduleId: integer("module_id").notNull().references(() => courseModules.id),
  slideNumber: integer("slide_number").notNull(),
  title: text("title").notNull(),
  
  // Content
  videoUrl: text("video_url"), // Individual slide video
  durationSeconds: integer("duration_seconds"),
  
  // Text content for reference
  content: text("content"), // Markdown content
  
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  moduleSlideIdx: uniqueIndex("module_slide_idx").on(table.moduleId, table.slideNumber),
}));

export const agentCourseProgress = pgTable("agent_course_progress", {
  id: serial("id").primaryKey(),
  
  agentId: integer("agent_id").notNull().references(() => agents.id),
  moduleId: integer("module_id").notNull().references(() => courseModules.id),
  
  status: courseStatusEnum("status").default("not_started").notNull(),
  
  // Progress tracking
  currentSlide: integer("current_slide").default(1),
  completedSlides: integer("completed_slides").default(0),
  
  // Time tracking
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  
  // Quiz (optional)
  quizScore: integer("quiz_score"),
  quizAttempts: integer("quiz_attempts").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agentModuleIdx: uniqueIndex("agent_module_idx").on(table.agentId, table.moduleId),
}));

// === LEAD SUBSCRIPTION TABLES ===

export const leadTiers = pgTable("lead_tiers", {
  id: serial("id").primaryKey(),
  
  name: leadTierEnum("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  
  leadsPerDay: integer("leads_per_day").notNull(),
  leadsPerMonth: integer("leads_per_month").notNull(),
  priceCents: integer("price_cents").notNull(), // 0 for starter
  
  // Stripe
  stripePriceId: text("stripe_price_id"),
  
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentLeadSubscriptions = pgTable("agent_lead_subscriptions", {
  id: serial("id").primaryKey(),
  
  agentId: integer("agent_id").notNull().references(() => agents.id),
  tierId: integer("tier_id").notNull().references(() => leadTiers.id),
  
  // Stripe
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  
  status: text("status").default("active").notNull(), // active, canceled, past_due, paused
  
  // Period
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  
  // Usage this period
  leadsUsedThisPeriod: integer("leads_used_this_period").default(0),
  leadsAllocatedToday: integer("leads_allocated_today").default(0),
  lastAllocationDate: timestamp("last_allocation_date"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leadPool = pgTable("lead_pool", {
  id: serial("id").primaryKey(),
  
  businessName: text("business_name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  
  industry: text("industry"),
  monthlyRevenueEstimate: integer("monthly_revenue_estimate"),
  city: text("city"),
  state: text("state"),
  
  source: text("source"), // Where lead came from
  
  isAssigned: boolean("is_assigned").default(false),
  
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const agentLeads = pgTable("agent_leads", {
  id: serial("id").primaryKey(),
  
  agentId: integer("agent_id").notNull().references(() => agents.id),
  leadId: integer("lead_id").notNull().references(() => leadPool.id),
  
  status: text("status").default("new").notNull(), // new, contacted, qualified, submitted, won, lost
  notes: text("notes"),
  
  lastContactAt: timestamp("last_contact_at"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leadCommissions = pgTable("lead_commissions", {
  id: serial("id").primaryKey(),
  
  sponsorId: integer("sponsor_id").notNull().references(() => agents.id),
  downlineId: integer("downline_id").notNull().references(() => agents.id),
  
  tierName: text("tier_name").notNull(),
  leadSpendCents: integer("lead_spend_cents").notNull(),
  commissionCents: integer("commission_cents").notNull(), // 10% of lead_spend
  
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  paidAt: timestamp("paid_at"),
  payoutId: integer("payout_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === RELATIONS ===

export const courseModulesRelations = relations(courseModules, ({ many }) => ({
  slides: many(courseSlides),
  agentProgress: many(agentCourseProgress),
}));

export const courseSlidesRelations = relations(courseSlides, ({ one }) => ({
  module: one(courseModules, {
    fields: [courseSlides.moduleId],
    references: [courseModules.id],
  }),
}));

export const agentCourseProgressRelations = relations(agentCourseProgress, ({ one }) => ({
  agent: one(agents, {
    fields: [agentCourseProgress.agentId],
    references: [agents.id],
  }),
  module: one(courseModules, {
    fields: [agentCourseProgress.moduleId],
    references: [courseModules.id],
  }),
}));

export const leadTiersRelations = relations(leadTiers, ({ many }) => ({
  subscriptions: many(agentLeadSubscriptions),
}));

export const agentLeadSubscriptionsRelations = relations(agentLeadSubscriptions, ({ one }) => ({
  agent: one(agents, {
    fields: [agentLeadSubscriptions.agentId],
    references: [agents.id],
  }),
  tier: one(leadTiers, {
    fields: [agentLeadSubscriptions.tierId],
    references: [leadTiers.id],
  }),
}));

// === ZOD SCHEMAS ===

export const updateCourseProgressSchema = z.object({
  moduleId: z.number(),
  slideNumber: z.number().optional(),
  completed: z.boolean().optional(),
});

export const updateLeadStatusSchema = z.object({
  leadId: z.number(),
  status: z.enum(['new', 'contacted', 'qualified', 'submitted', 'won', 'lost']),
  notes: z.string().optional(),
});

// === TYPES ===

export type CourseModule = typeof courseModules.$inferSelect;
export type CourseSlide = typeof courseSlides.$inferSelect;
export type AgentCourseProgress = typeof agentCourseProgress.$inferSelect;
export type LeadTier = typeof leadTiers.$inferSelect;
export type AgentLeadSubscription = typeof agentLeadSubscriptions.$inferSelect;
export type Lead = typeof leadPool.$inferSelect;
export type AgentLead = typeof agentLeads.$inferSelect;
export type LeadCommission = typeof leadCommissions.$inferSelect;

// Combined types for API responses
export type ModuleWithProgress = CourseModule & {
  progress?: AgentCourseProgress;
  slides?: CourseSlide[];
};

export type AgentLeadWithDetails = AgentLead & {
  lead: Lead;
};

export type TrainingDashboard = {
  totalModules: number;
  completedModules: number;
  inProgressModules: number;
  overallProgress: number; // percentage
  currentModule?: ModuleWithProgress;
  modules: ModuleWithProgress[];
};
