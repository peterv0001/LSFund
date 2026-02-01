import { pgTable, text, serial, integer, boolean, timestamp, decimal, date, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === ENUMS ===
export const rankEnum = pgEnum("rank", ['agent', 'builder', 'leader', 'director', 'partner']);
export const legEnum = pgEnum("leg", ['left', 'right']);
export const statusEnum = pgEnum("status", ['active', 'inactive', 'suspended']);
export const commissionTypeEnum = pgEnum("commission_type", ['personal_deal', 'binary_bonus', 'generation_override', 'course_sale']);
export const commissionStatusEnum = pgEnum("commission_status", ['pending', 'approved', 'paid']);
export const dealStatusEnum = pgEnum("deal_status", ['pending', 'funded', 'rejected']);

// === TABLE DEFINITIONS ===

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  
  // Tree structure
  sponsorId: integer("sponsor_id"), // Who invited them
  placementId: integer("placement_id"), // Who they are directly under in tree
  leg: legEnum("leg"), // Left or Right leg of placement parent
  
  // Status
  currentRank: rankEnum("current_rank").default("agent").notNull(),
  status: statusEnum("status").default("active").notNull(),
  
  // Payment
  payoutEmail: text("payout_email"),
  stripeAccountId: text("stripe_account_id"),
  
  isAdmin: boolean("is_admin").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  
  merchantName: text("merchant_name").notNull(),
  loanAmount: decimal("loan_amount", { precision: 10, scale: 2 }).notNull(),
  companyRevenue: decimal("company_revenue", { precision: 10, scale: 2 }).notNull(), // 10% of loan
  status: dealStatusEnum("status").default("funded").notNull(),
  fundedAt: timestamp("funded_at").defaultNow().notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  
  type: commissionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  
  dealId: integer("deal_id"), // Optional link to deal
  
  periodDate: date("period_date").notNull(), // For weekly grouping
  status: commissionStatusEnum("status").default("pending").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
});

// === RELATIONS ===

export const agentsRelations = relations(agents, ({ one, many }) => ({
  sponsor: one(agents, {
    fields: [agents.sponsorId],
    references: [agents.id],
    relationName: "sponsorship",
  }),
  sponsored: many(agents, { relationName: "sponsorship" }),
  
  placement: one(agents, {
    fields: [agents.placementId],
    references: [agents.id],
    relationName: "placement",
  }),
  placedUnder: many(agents, { relationName: "placement" }),
  
  deals: many(deals),
  commissions: many(commissions),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  agent: one(agents, {
    fields: [deals.agentId],
    references: [agents.id],
  }),
  commissions: many(commissions),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  agent: one(agents, {
    fields: [commissions.agentId],
    references: [agents.id],
  }),
  deal: one(deals, {
    fields: [commissions.dealId],
    references: [deals.id],
  }),
}));

// === ZOD SCHEMAS ===

export const insertAgentSchema = createInsertSchema(agents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertDealSchema = createInsertSchema(deals).omit({ 
  id: true, 
  createdAt: true,
  status: true, // Default to funded for now as per prompt
  companyRevenue: true, // Calculated on backend
  fundedAt: true // Default to now
}).extend({
  loanAmount: z.coerce.number().min(0, "Amount must be positive"),
});

export const insertCommissionSchema = createInsertSchema(commissions).omit({
  id: true,
  createdAt: true,
  paidAt: true
});

// === EXPLICIT TYPES ===

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;

export type Commission = typeof commissions.$inferSelect;

// Request types
export type CreateDealRequest = InsertDeal;
export type CreateAgentRequest = InsertAgent & { referralCode?: string, placementLeg?: 'left' | 'right' | 'auto' };

// Response types
export type AgentWithTeam = Agent & {
  children?: AgentWithTeam[];
  volume?: { left: number, right: number };
};
