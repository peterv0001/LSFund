import { pgTable, text, serial, integer, boolean, timestamp, decimal, date, pgEnum, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === ENUMS ===
export const rankEnum = pgEnum("rank", ['agent', 'builder', 'leader', 'director', 'partner']);
export const legEnum = pgEnum("leg", ['left', 'right']);
export const statusEnum = pgEnum("status", ['active', 'inactive', 'suspended']);
export const commissionTypeEnum = pgEnum("commission_type", ['personal_deal', 'binary_bonus', 'generation_override', 'course_sale', 'fast_start', 'leadership_pool', 'mac_primary', 'mac_sponsor_l1', 'mac_sponsor_l2', 'tfc', 'subscription_commission', 'subscription_residual']);
export const commissionStatusEnum = pgEnum("commission_status", ['pending', 'approved', 'paid', 'voided']);
export const dealStatusEnum = pgEnum("deal_status", ['pending', 'funded', 'rejected']);
export const payoutStatusEnum = pgEnum("payout_status", ['pending', 'processing', 'completed', 'failed']);
export const notificationTypeEnum = pgEnum("notification_type", ['deal_funded', 'commission_earned', 'rank_advanced', 'team_signup', 'payout_sent', 'announcement', 'system']);
export const resourceTypeEnum = pgEnum("resource_type", ['video', 'pdf', 'link', 'document']);
export const announcementTargetEnum = pgEnum("announcement_target", ['all', 'agents_only', 'builders_plus', 'leaders_plus', 'directors_plus', 'partners_only']);

// Lead status enum
export const leadStatusEnum = pgEnum("lead_status", ['new', 'contacted', 'warm', 'hot', 'qualified', 'submitted', 'closed_won', 'closed_lost', 'ai_followup']);
export const leadRequestStatusEnum = pgEnum("lead_request_status", ['pending', 'approved', 'denied', 'fulfilled']);

export const subscriptionTierEnum = pgEnum("subscription_tier", ['tier_1', 'tier_2', 'tier_3']);
export const subscriptionStatusEnum = pgEnum("subscription_status", ['active', 'paused', 'cancelled', 'expired']);
export const subscriptionBillingStatusEnum = pgEnum("subscription_billing_status", ['pending', 'active', 'past_due', 'failed', 'cancelled']);
export const holdbackStatusEnum = pgEnum("holdback_status", ['held', 'partially_released', 'released', 'clawed_back']);
export const fulfillmentTierLevelEnum = pgEnum("fulfillment_tier_level", ['tier_1', 'tier_2', 'tier_3', 'tier_4']);

// === TABLE DEFINITIONS ===

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  
  // Profile
  profileImageUrl: text("profile_image_url"),
  bio: text("bio"),
  
  // Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  country: text("country").default("US"),
  
  // Tree structure
  sponsorId: integer("sponsor_id"), // Who invited them (sponsor tree)
  placementId: integer("placement_id"), // Who they are directly under (binary tree)
  leg: legEnum("leg"), // Left or Right leg of placement parent
  
  // Referral
  referralCode: text("referral_code").unique(), // Human-readable code
  
  // Rank & Status
  currentRank: rankEnum("current_rank").default("agent").notNull(),
  highestRank: rankEnum("highest_rank").default("agent").notNull(), // Highest rank ever achieved
  qualifiedRank: rankEnum("qualified_rank").default("agent"), // Rank qualified for this period
  paidAsRank: rankEnum("paid_as_rank").default("agent"), // Rank paid as (may differ from qualified)
  status: statusEnum("status").default("active").notNull(),
  
  // Volume (denormalized for performance)
  personalVolume: decimal("personal_volume", { precision: 12, scale: 2 }).default("0"),
  leftLegVolume: decimal("left_leg_volume", { precision: 12, scale: 2 }).default("0"),
  rightLegVolume: decimal("right_leg_volume", { precision: 12, scale: 2 }).default("0"),
  carryoverLeft: decimal("carryover_left", { precision: 12, scale: 2 }).default("0"),
  carryoverRight: decimal("carryover_right", { precision: 12, scale: 2 }).default("0"),
  
  // Payment
  payoutMethod: text("payout_method").default("pending"), // 'stripe', 'paypal', 'bank', 'pending'
  payoutEmail: text("payout_email"),
  stripeAccountId: text("stripe_account_id"),
  bankAccountLast4: text("bank_account_last4"),
  
  // Notification preferences
  emailNotifications: boolean("email_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  emailPreferences: jsonb("email_preferences").default({ emailOnPaused: true, emailOnCancelled: true, emailOnReactivated: true, emailOnDealFunded: true, emailOnTeamSignup: true, emailOnCommissionEarned: true }),
  
  // Admin
  isAdmin: boolean("is_admin").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  
  // Password Reset
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),

  // Timestamps
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Prevent two agents from occupying the same parent+leg slot in the binary
  // tree. Partial index (WHERE placement_id/leg IS NOT NULL) leaves the root
  // and any sponsorless, unplaced agents unrestricted. This is the race guard:
  // concurrent signups resolving to the same slot can't both insert.
  placementLegUniqueIdx: uniqueIndex("agents_placement_leg_unique_idx")
    .on(table.placementId, table.leg)
    .where(sql`${table.placementId} IS NOT NULL AND ${table.leg} IS NOT NULL`),
}));

export const dealProgramTypeEnum = pgEnum("deal_program_type", ['pmf_funding', 'iso_broker', 'iso_referral']);

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  
  // === BUSINESS INFORMATION ===
  merchantName: text("merchant_name").notNull(),
  merchantDba: text("merchant_dba"),
  merchantEmail: text("merchant_email"),
  merchantPhone: text("merchant_phone"),
  businessType: text("business_type"), // LLC, Corp, Sole Prop, Partnership
  ein: text("ein"), // Employer Identification Number (stored encrypted conceptually)
  businessStartDate: text("business_start_date"), // YYYY-MM
  industry: text("industry"),
  
  // === BUSINESS ADDRESS ===
  businessAddress: text("business_address"),
  businessCity: text("business_city"),
  businessState: text("business_state"), // 2-letter state code
  businessZip: text("business_zip"),
  
  // === OWNER INFORMATION ===
  ownerFirstName: text("owner_first_name"),
  ownerLastName: text("owner_last_name"),
  ownerEmail: text("owner_email"),
  ownerPhone: text("owner_phone"),
  ownerDob: text("owner_dob"), // YYYY-MM-DD
  ownerSsn: text("owner_ssn"), // Last 4 digits only stored for display; full SSN handled securely
  ownerOwnershipPct: integer("owner_ownership_pct"), // 0-100
  ownerAddress: text("owner_address"),
  ownerCity: text("owner_city"),
  ownerState: text("owner_state"),
  ownerZip: text("owner_zip"),
  
  // === FUNDING REQUEST ===
  requestedAmount: decimal("requested_amount", { precision: 12, scale: 2 }),
  useOfFunds: text("use_of_funds"), // Working capital, equipment, expansion, etc.
  
  // === FINANCIALS ===
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  companyRevenue: decimal("company_revenue", { precision: 10, scale: 2 }).notNull(),
  avgMonthlyRevenue: decimal("avg_monthly_revenue", { precision: 12, scale: 2 }),
  gbrAmount: decimal("gbr_amount", { precision: 12, scale: 2 }),
  
  // === PMF PROGRAM ===
  programType: dealProgramTypeEnum("program_type").default("pmf_funding"),
  
  // === DOCUMENTS (stored as JSON array of file metadata) ===
  // Each entry: { name, url, type: 'bank_statement' | 'tax_return' | 'voided_check' | 'other', uploadedAt }
  documents: jsonb("documents").default([]),
  
  // === STATE COMPLIANCE FLAGS ===
  isVaMerchant: boolean("is_va_merchant").default(false),
  isCaMerchant: boolean("is_ca_merchant").default(false),
  isUtMerchant: boolean("is_ut_merchant").default(false),
  stateDisclosureConfirmed: boolean("state_disclosure_confirmed").default(false),
  
  // === PMF SUBMISSION ===
  pmfSubmittedAt: timestamp("pmf_submitted_at"),
  pmfSubmissionId: text("pmf_submission_id"), // External ID from PMF when API is live
  pmfSubmissionStatus: text("pmf_submission_status").default("pending"), // pending, submitted, error
  
  // === CLOSING TEAM (hidden from agents) ===
  fulfillmentAgentId: integer("fulfillment_agent_id"),
  status: dealStatusEnum("status").default("pending").notNull(),
  
  notes: text("notes"),
  approvedById: integer("approved_by_id"),
  
  fundedAt: timestamp("funded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  
  type: commissionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  
  // Source tracking
  dealId: integer("deal_id"),
  subscriptionId: integer("subscription_id"), // For subscription-based commissions (enables idempotency)
  sourceAgentId: integer("source_agent_id"), // Who generated this commission (for overrides)
  
  // Period tracking
  periodDate: date("period_date").notNull(), // For weekly grouping
  periodWeekStart: timestamp("period_week_start"), // Explicit week start
  
  status: commissionStatusEnum("status").default("pending").notNull(),
  
  // Admin actions
  approvedById: integer("approved_by_id"),
  approvedAt: timestamp("approved_at"),
  voidedById: integer("voided_by_id"),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  
  // Payout tracking
  payoutId: integer("payout_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
}, (table) => ({
  // Prevent duplicate subscription commissions for the same agent+subscription+period+type.
  // Partial index (WHERE subscription_id IS NOT NULL) leaves non-subscription commission
  // types (deal-based, bonuses, etc.) unrestricted.
  subPeriodUniqueIdx: uniqueIndex("commissions_subscription_period_type_idx")
    .on(table.agentId, table.subscriptionId, table.periodDate, table.type)
    .where(sql`${table.subscriptionId} IS NOT NULL`),
  // Prevent duplicate deal-based commissions for the same agent+deal+type.
  // Partial index (WHERE deal_id IS NOT NULL) leaves non-deal commission
  // types (binary bonuses, subscription residuals, etc.) unrestricted. A deal's
  // waterfall awards each agent at most one commission of a given type, so
  // period_date is intentionally excluded from the key.
  dealTypeUniqueIdx: uniqueIndex("commissions_deal_type_idx")
    .on(table.agentId, table.dealId, table.type)
    .where(sql`${table.dealId} IS NOT NULL`),
}));

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: text("method").notNull(), // 'stripe', 'paypal', 'bank', 'check'
  status: payoutStatusEnum("status").default("pending").notNull(),
  
  // External reference
  externalId: text("external_id"), // Stripe transfer ID, etc.
  externalStatus: text("external_status"),
  
  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Admin
  processedById: integer("processed_by_id"),
  processedAt: timestamp("processed_at"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  
  // Related entities
  dealId: integer("deal_id"),
  commissionId: integer("commission_id"),
  announcementId: integer("announcement_id"),
  
  // Status
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  
  // Delivery
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  
  title: text("title").notNull(),
  content: text("content").notNull(),
  
  target: announcementTargetEnum("target").default("all").notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  priority: integer("priority").default(0).notNull(),
  
  publishAt: timestamp("publish_at"),
  expiresAt: timestamp("expires_at"),
  
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  
  title: text("title").notNull(),
  description: text("description"),
  type: resourceTypeEnum("type").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  
  category: text("category").default("general"), // 'training', 'marketing', 'compliance', 'general'
  sortOrder: integer("sort_order").default(0),
  
  isPublished: boolean("is_published").default(true).notNull(),
  
  createdById: integer("created_by_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === COURSE/TRAINING TABLES ===
export const courseModuleStatusEnum = pgEnum("course_module_status", ['not_started', 'in_progress', 'completed']);

export const courseModules = pgTable("course_modules", {
  id: serial("id").primaryKey(),
  
  moduleNumber: integer("module_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  
  videoUrl: text("video_url"), // YouTube embed URL
  durationSeconds: integer("duration_seconds"),
  slideCount: integer("slide_count").default(0),
  
  isPublished: boolean("is_published").default(true).notNull(),
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const courseProgress = pgTable("course_progress", {
  id: serial("id").primaryKey(),
  
  agentId: integer("agent_id").notNull(),
  moduleId: integer("module_id").notNull(),
  
  status: courseModuleStatusEnum("status").default("not_started").notNull(),
  currentSlide: integer("current_slide").default(1),
  completedSlides: integer("completed_slides").default(0),
  quizScore: integer("quiz_score"), // null = not taken, 0-100 = score
  
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agentModuleUnique: uniqueIndex("agent_module_unique").on(table.agentId, table.moduleId),
}));

export const rankQualifications = pgTable("rank_qualifications", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  rank: rankEnum("rank").notNull(),
  
  // Qualification metrics
  personalVolume: decimal("personal_volume", { precision: 12, scale: 2 }).notNull(),
  leftLegVolume: decimal("left_leg_volume", { precision: 12, scale: 2 }).notNull(),
  rightLegVolume: decimal("right_leg_volume", { precision: 12, scale: 2 }).notNull(),
  leftLegLeaders: integer("left_leg_leaders").default(0),
  rightLegLeaders: integer("right_leg_leaders").default(0),
  
  isQualified: boolean("is_qualified").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  
  actorId: integer("actor_id").notNull(), // Who performed the action
  actorType: text("actor_type").notNull(), // 'agent', 'admin', 'system'
  
  action: text("action").notNull(), // 'create', 'update', 'delete', 'approve', 'void', etc.
  entityType: text("entity_type").notNull(), // 'agent', 'deal', 'commission', 'payout'
  entityId: integer("entity_id").notNull(),
  
  description: text("description"), // Human-readable summary of the action
  details: jsonb("details"), // JSON with before/after or additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === SUBSCRIPTION TABLES ===

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  merchantName: text("merchant_name").notNull(),
  merchantEmail: text("merchant_email"),
  tier: subscriptionTierEnum("tier").notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 10, scale: 2 }).notNull(),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  mcaPairedDealId: integer("mca_paired_deal_id"),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  cancelledAt: timestamp("cancelled_at"),
  pausedAt: timestamp("paused_at"),
  reactivatedAt: timestamp("reactivated_at"),
  cancelledById: integer("cancelled_by_id"),
  pausedById: integer("paused_by_id"),
  reactivatedById: integer("reactivated_by_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  billingStatus: subscriptionBillingStatusEnum("billing_status"),
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
  lastChargedAt: timestamp("last_charged_at"),
  nextBillingDate: timestamp("next_billing_date"),
  expiryWarningSentAt: timestamp("expiry_warning_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === HOLDBACK & CLAWBACK TABLES ===

export const holdbacks = pgTable("holdbacks", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").notNull(),
  agentId: integer("agent_id").notNull(),
  commissionId: integer("commission_id"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  releasedAmount: decimal("released_amount", { precision: 10, scale: 2 }).default("0"),
  clawbackAmount: decimal("clawback_amount", { precision: 10, scale: 2 }).default("0"),
  status: holdbackStatusEnum("status").default("held").notNull(),
  releaseDate: timestamp("release_date"),
  clawbackDate: timestamp("clawback_date"),
  clawbackReason: text("clawback_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === FULFILLMENT TIER TABLES ===

export const fulfillmentTiers = pgTable("fulfillment_tiers", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  month: text("month").notNull(),
  tier: fulfillmentTierLevelEnum("tier").default("tier_1").notNull(),
  dealCount: integer("deal_count").default(0).notNull(),
  totalGbr: decimal("total_gbr", { precision: 12, scale: 2 }).default("0"),
  qualifiedAt: timestamp("qualified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  agentMonthUnique: uniqueIndex("agent_month_unique").on(table.agentId, table.month),
}));

// === LEADS TABLES ===

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  
  // Contact info
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  
  // Company info
  companyName: text("company_name"),
  companySize: text("company_size"), // '1-10', '11-50', '51-200', '201-500', '500+'
  industry: text("industry"),
  
  // Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  
  // Enrichment data (flexible JSON for any additional data)
  enrichmentData: jsonb("enrichment_data"),
  
  // Assignment
  assignedAgentId: integer("assigned_agent_id"),
  assignedAt: timestamp("assigned_at"),
  assignedById: integer("assigned_by_id"),
  
  // Status tracking
  status: leadStatusEnum("status").default("new").notNull(),
  statusUpdatedAt: timestamp("status_updated_at"),
  
  // AI follow-up
  aiFollowupRequested: boolean("ai_followup_requested").default(false),
  aiFollowupRequestedAt: timestamp("ai_followup_requested_at"),
  aiFollowupProcessed: boolean("ai_followup_processed").default(false),
  aiFollowupProcessedAt: timestamp("ai_followup_processed_at"),
  
  // Notes
  notes: text("notes"),
  
  // Source tracking
  source: text("source"), // 'excel_import', 'manual', etc.
  batchId: text("batch_id"), // For grouping imports
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const leadRequests = pgTable("lead_requests", {
  id: serial("id").primaryKey(),
  
  agentId: integer("agent_id").notNull(),
  
  // Request details
  requestedCount: integer("requested_count").notNull().default(10),
  preferredIndustry: text("preferred_industry"),
  preferredLocation: text("preferred_location"),
  notes: text("notes"),
  
  // Status
  status: leadRequestStatusEnum("status").default("pending").notNull(),
  
  // Admin response
  respondedById: integer("responded_by_id"),
  respondedAt: timestamp("responded_at"),
  responseNotes: text("response_notes"),
  leadsAssigned: integer("leads_assigned").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === PLATFORM SETTINGS ===

export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedById: integer("updated_by_id"),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;

export const adminExportTemplates = pgTable("admin_export_templates", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  name: text("name").notNull(),
  columns: text("columns").array().notNull(),
  isShared: boolean("is_shared").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdminExportTemplateSchema = createInsertSchema(adminExportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdminExportTemplate = typeof adminExportTemplates.$inferSelect;
export type InsertAdminExportTemplate = z.infer<typeof insertAdminExportTemplateSchema>;

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
  payouts: many(payouts),
  notifications: many(notifications),
  rankQualifications: many(rankQualifications),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  agent: one(agents, {
    fields: [deals.agentId],
    references: [agents.id],
  }),
  approvedBy: one(agents, {
    fields: [deals.approvedById],
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
  sourceAgent: one(agents, {
    fields: [commissions.sourceAgentId],
    references: [agents.id],
  }),
  payout: one(payouts, {
    fields: [commissions.payoutId],
    references: [payouts.id],
  }),
}));

export const payoutsRelations = relations(payouts, ({ one, many }) => ({
  agent: one(agents, {
    fields: [payouts.agentId],
    references: [agents.id],
  }),
  processedBy: one(agents, {
    fields: [payouts.processedById],
    references: [agents.id],
  }),
  commissions: many(commissions),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  agent: one(agents, {
    fields: [notifications.agentId],
    references: [agents.id],
  }),
  deal: one(deals, {
    fields: [notifications.dealId],
    references: [deals.id],
  }),
  commission: one(commissions, {
    fields: [notifications.commissionId],
    references: [commissions.id],
  }),
  announcement: one(announcements, {
    fields: [notifications.announcementId],
    references: [announcements.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  createdBy: one(agents, {
    fields: [announcements.createdById],
    references: [agents.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  createdBy: one(agents, {
    fields: [resources.createdById],
    references: [agents.id],
  }),
}));

export const courseModulesRelations = relations(courseModules, ({ many }) => ({
  progress: many(courseProgress),
}));

export const courseProgressRelations = relations(courseProgress, ({ one }) => ({
  agent: one(agents, {
    fields: [courseProgress.agentId],
    references: [agents.id],
  }),
  module: one(courseModules, {
    fields: [courseProgress.moduleId],
    references: [courseModules.id],
  }),
}));

export const rankQualificationsRelations = relations(rankQualifications, ({ one }) => ({
  agent: one(agents, {
    fields: [rankQualifications.agentId],
    references: [agents.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  assignedAgent: one(agents, {
    fields: [leads.assignedAgentId],
    references: [agents.id],
  }),
  assignedBy: one(agents, {
    fields: [leads.assignedById],
    references: [agents.id],
  }),
}));

export const leadRequestsRelations = relations(leadRequests, ({ one }) => ({
  agent: one(agents, {
    fields: [leadRequests.agentId],
    references: [agents.id],
  }),
  respondedBy: one(agents, {
    fields: [leadRequests.respondedById],
    references: [agents.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  agent: one(agents, {
    fields: [subscriptions.agentId],
    references: [agents.id],
  }),
  mcaPairedDeal: one(deals, {
    fields: [subscriptions.mcaPairedDealId],
    references: [deals.id],
  }),
}));

export const holdbacksRelations = relations(holdbacks, ({ one }) => ({
  deal: one(deals, {
    fields: [holdbacks.dealId],
    references: [deals.id],
  }),
  agent: one(agents, {
    fields: [holdbacks.agentId],
    references: [agents.id],
  }),
  commission: one(commissions, {
    fields: [holdbacks.commissionId],
    references: [commissions.id],
  }),
}));

export const fulfillmentTiersRelations = relations(fulfillmentTiers, ({ one }) => ({
  agent: one(agents, {
    fields: [fulfillmentTiers.agentId],
    references: [agents.id],
  }),
}));

// === ZOD SCHEMAS ===

export const insertAgentSchema = createInsertSchema(agents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastLoginAt: true,
  personalVolume: true,
  leftLegVolume: true,
  rightLegVolume: true,
  carryoverLeft: true,
  carryoverRight: true,
});

export const updateAgentProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  bio: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
});

export const updatePayoutMethodSchema = z.object({
  payoutMethod: z.enum(['stripe', 'paypal', 'bank', 'pending']),
  payoutEmail: z.string().email().optional(),
});

export const emailPreferencesSchema = z.object({
  emailOnPaused: z.boolean(),
  emailOnCancelled: z.boolean(),
  emailOnReactivated: z.boolean(),
  emailOnDealFunded: z.boolean().default(true),
  emailOnTeamSignup: z.boolean().default(true),
  emailOnCommissionEarned: z.boolean().default(true),
  emailOnPaymentRetrySuccess: z.boolean().default(true),
  emailOnPaymentRetryFailed: z.boolean().default(true),
});

export type EmailPreferences = z.infer<typeof emailPreferencesSchema>;

export const insertDealSchema = createInsertSchema(deals).omit({ 
  id: true, 
  agentId: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  companyRevenue: true,
  fundedAt: true,
  approvedById: true,
  fulfillmentAgentId: true,
  pmfSubmittedAt: true,
  pmfSubmissionId: true,
  pmfSubmissionStatus: true,
}).extend({
  loanAmount: z.coerce.number().min(1000, "Loan amount must be at least $1,000"),
  requestedAmount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(1000).optional(),
  ),
  avgMonthlyRevenue: z.coerce.number().min(0).optional(),
  gbrAmount: z.coerce.number().min(0).optional(),
  ownerOwnershipPct: z.coerce.number().min(0).max(100).optional(),
  ein: z.string().regex(/^\d{2}-\d{7}$/, "EIN format: XX-XXXXXXX").optional().or(z.literal('')),
  ownerSsn: z.string().regex(/^\d{4}$/, "Enter last 4 digits only").optional().or(z.literal('')),
  ownerDob: z.string().optional(),
  businessStartDate: z.string().optional(),
  documents: z.array(z.object({
    name: z.string(),
    url: z.string(),
    type: z.enum(['bank_statement', 'tax_return', 'voided_check', 'other']),
    uploadedAt: z.string(),
  })).optional(),
  stateDisclosureConfirmed: z.boolean().optional(),
});

export const insertCommissionSchema = createInsertSchema(commissions).omit({
  id: true,
  createdAt: true,
  paidAt: true,
  approvedAt: true,
  approvedById: true,
  voidedAt: true,
  voidedById: true,
  voidReason: true,
  payoutId: true,
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  processedAt: true,
  processedById: true,
  externalId: true,
  externalStatus: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
  emailSentAt: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
});

export const insertCourseModuleSchema = createInsertSchema(courseModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCourseProgressSchema = createInsertSchema(courseProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  assignedAt: true,
  statusUpdatedAt: true,
  aiFollowupRequestedAt: true,
  aiFollowupProcessedAt: true,
});

export const insertLeadRequestSchema = createInsertSchema(leadRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  respondedAt: true,
  respondedById: true,
  responseNotes: true,
  leadsAssigned: true,
});

export const updateLeadStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'warm', 'hot', 'qualified', 'submitted', 'closed_won', 'closed_lost', 'ai_followup']),
  notes: z.string().optional(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  pausedAt: true,
  reactivatedAt: true,
  reactivatedById: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  stripePaymentMethodId: true,
  billingStatus: true,
  cardLast4: true,
  cardBrand: true,
  lastChargedAt: true,
  nextBillingDate: true,
}).extend({
  monthlyAmount: z.coerce.number().min(0),
});

export const insertHoldbackSchema = createInsertSchema(holdbacks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  clawbackDate: true,
  clawbackReason: true,
});

export const insertFulfillmentTierSchema = createInsertSchema(fulfillmentTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// === EXPLICIT TYPES ===

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;

export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;

export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

export type CourseModule = typeof courseModules.$inferSelect;
export type InsertCourseModule = z.infer<typeof insertCourseModuleSchema>;

export type CourseProgress = typeof courseProgress.$inferSelect;
export type InsertCourseProgress = z.infer<typeof insertCourseProgressSchema>;

export type RankQualification = typeof rankQualifications.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type LeadRequest = typeof leadRequests.$inferSelect;
export type InsertLeadRequest = z.infer<typeof insertLeadRequestSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Holdback = typeof holdbacks.$inferSelect;
export type InsertHoldback = z.infer<typeof insertHoldbackSchema>;

export type FulfillmentTier = typeof fulfillmentTiers.$inferSelect;
export type InsertFulfillmentTier = z.infer<typeof insertFulfillmentTierSchema>;

// Request types
export type CreateDealRequest = InsertDeal;
export type CreateAgentRequest = InsertAgent & { referralCode?: string, placementLeg?: 'left' | 'right' | 'auto' };

// Response types
export type AgentWithTeam = Agent & {
  children?: AgentWithTeam[];
  volume?: { left: number, right: number };
  teamSize?: number;
};

export type AgentPublic = Pick<Agent, 'id' | 'firstName' | 'lastName' | 'currentRank' | 'profileImageUrl' | 'createdAt'>;

export type DashboardStats = {
  totalEarned: number;
  thisWeek: number;
  thisMonth: number;
  pending: number;
  teamSize: number;
  personalVolume: number;
  leftLegVolume: number;
  rightLegVolume: number;
  currentRank: string;
  nextRank: string | null;
  rankProgress: number;
};

export type AdminStats = {
  totalAgents: number;
  activeAgents: number;
  newAgentsThisWeek: number;
  totalDeals: number;
  dealsThisWeek: number;
  totalVolume: number;
  volumeThisWeek: number;
  totalCommissions: number;
  pendingCommissions: number;
  pendingPayouts: number;
};

// Commission config type
export type CommissionConfig = {
  personalCommission: Record<string, number>;
  binaryBonus: Record<string, { rate: number; max: number }>;
  generationOverride: Record<string, Record<number, number>>;
  rankRequirements: Record<string, {
    personalVolume: number;
    weakLegVolume: number;
    strongLegVolume?: number;
    qualifiedLegs?: { left: number; right: number };
  }>;
};
