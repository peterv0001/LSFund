import { db } from "./db";
import { 
  agents, deals, commissions, payouts, notifications, announcements, resources, rankQualifications, activityLog,
  courseModules, courseProgress, leads, leadRequests, subscriptions, holdbacks, fulfillmentTiers, platformSettings,
  type Agent, type InsertAgent, type Deal, type Commission, type AgentWithTeam, type Payout, type Notification, type Announcement, type Resource,
  type CourseModule, type InsertCourseModule, type CourseProgress, type InsertCourseProgress,
  type Lead, type InsertLead, type LeadRequest, type InsertLeadRequest,
  type Subscription, type Holdback, type FulfillmentTier
} from "@shared/schema";
import { eq, ne, sql, and, desc, asc, gte, lte, like, or, inArray, isNull, count, sum, SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

// Helper to get start of current week (Monday)
function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to get start of current month
function getMonthStart(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export class DatabaseStorage {
  // ==================== AGENTS ====================

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async getAgentByEmail(email: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.email, email.toLowerCase()));
    return agent;
  }
  
  async getAgentByReferralCode(code: string): Promise<Agent | undefined> {
    // Try numeric ID first, then referral code
    const numericId = parseInt(code);
    if (!isNaN(numericId)) {
      return this.getAgent(numericId);
    }
    const [agent] = await db.select().from(agents).where(eq(agents.referralCode, code));
    return agent;
  }

  async getReferralStats(agentId: number): Promise<{
    totalReferrals: number;
    thisMonthReferrals: number;
    activeReferrals: number;
    recentReferrals: { id: number; firstName: string; lastName: string; createdAt: Date }[];
  }> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Get all direct referrals (sponsored by this agent)
    const referrals = await db.select().from(agents)
      .where(eq(agents.sponsorId, agentId))
      .orderBy(desc(agents.createdAt));

    const totalReferrals = referrals.length;
    const thisMonthReferrals = referrals.filter(r => r.createdAt >= monthStart).length;
    const activeReferrals = referrals.filter(r => r.status === 'active').length;
    const recentReferrals = referrals.slice(0, 5).map(r => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      createdAt: r.createdAt,
    }));

    return { totalReferrals, thisMonthReferrals, activeReferrals, recentReferrals };
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    // Generate referral code if not provided
    const referralCode = agent.referralCode || this.generateReferralCode(agent.firstName, agent.lastName);
    
    const [newAgent] = await db.insert(agents).values({
      ...agent,
      email: agent.email.toLowerCase(),
      referralCode,
    }).returning();
    return newAgent;
  }

  private generateReferralCode(firstName: string, lastName: string): string {
    const prefix = (firstName[0] + lastName[0]).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${random}`;
  }
  
  async updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
    const [updated] = await db.update(agents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async updateAgentRank(id: number, rank: Agent['currentRank']): Promise<Agent> {
    const agent = await this.getAgent(id);
    const highestRank = this.compareRanks(rank, agent?.highestRank || 'agent') > 0 ? rank : agent?.highestRank;
    
    const [updated] = await db.update(agents)
      .set({ currentRank: rank, highestRank, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  private compareRanks(a: string, b: string): number {
    const order = ['agent', 'builder', 'leader', 'director', 'partner'];
    return order.indexOf(a) - order.indexOf(b);
  }

  async getAllAgents(): Promise<Agent[]> {
    return await db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async getAgentsPaginated(page: number = 1, pageSize: number = 20, filters?: {
    search?: string;
    status?: string;
    rank?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ agents: (Agent & { totalSubscriptionCount: number; activeSubscriptionCount: number })[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    let conditions: any[] = [];
    
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(or(
        like(agents.firstName, searchTerm),
        like(agents.lastName, searchTerm),
        like(agents.email, searchTerm)
      ));
    }
    
    if (filters?.status) {
      conditions.push(eq(agents.status, filters.status as any));
    }
    
    if (filters?.rank) {
      conditions.push(eq(agents.currentRank, filters.rank as any));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(agents)
      .where(whereClause);

    const sortBySubCount = filters?.sortBy === 'subscriptionCount';
    const sortDesc = filters?.sortOrder !== 'asc';

    const subCountExpr = sql<number>`(SELECT COUNT(*) FROM subscriptions WHERE subscriptions.agent_id = agents.id)`;

    const orderExpr = sortBySubCount
      ? (sortDesc ? desc(subCountExpr) : asc(subCountExpr))
      : (sortDesc ? desc(agents.createdAt) : asc(agents.createdAt));

    const results = await db
      .select()
      .from(agents)
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(pageSize)
      .offset(offset);

    const agentIds = results.map(a => a.id);
    let subCountMap: Record<number, number> = {};
    let activeSubCountMap: Record<number, number> = {};
    if (agentIds.length > 0) {
      const subCounts = await db
        .select({ agentId: subscriptions.agentId, cnt: count() })
        .from(subscriptions)
        .where(inArray(subscriptions.agentId, agentIds))
        .groupBy(subscriptions.agentId);
      for (const row of subCounts) {
        subCountMap[row.agentId] = row.cnt;
      }
      const activeSubCounts = await db
        .select({ agentId: subscriptions.agentId, cnt: count() })
        .from(subscriptions)
        .where(and(inArray(subscriptions.agentId, agentIds), eq(subscriptions.status, 'active')))
        .groupBy(subscriptions.agentId);
      for (const row of activeSubCounts) {
        activeSubCountMap[row.agentId] = row.cnt;
      }
    }

    const agentsWithCount = results.map(a => ({
      ...a,
      totalSubscriptionCount: subCountMap[a.id] ?? 0,
      activeSubscriptionCount: activeSubCountMap[a.id] ?? 0,
    }));

    return { agents: agentsWithCount, total: totalResult.count };
  }

  async getTeamSize(agentId: number): Promise<number> {
    // Count all agents in the downline (placement tree)
    const countDescendants = async (id: number): Promise<number> => {
      const children = await db.select().from(agents).where(eq(agents.placementId, id));
      let total = children.length;
      for (const child of children) {
        total += await countDescendants(child.id);
      }
      return total;
    };
    return countDescendants(agentId);
  }

  async getDirectRecruits(agentId: number): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.sponsorId, agentId));
  }

  async setResetToken(agentId: number, token: string, expiry: Date): Promise<void> {
    await db.update(agents)
      .set({ resetToken: token, resetTokenExpiry: expiry, updatedAt: new Date() })
      .where(eq(agents.id, agentId));
  }

  async getAgentByResetToken(token: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.resetToken, token));
    return agent;
  }

  async clearResetToken(agentId: number): Promise<void> {
    await db.update(agents)
      .set({ resetToken: null, resetTokenExpiry: null, updatedAt: new Date() })
      .where(eq(agents.id, agentId));
  }

  async searchAgentsForSponsor(query: string): Promise<{ id: number; firstName: string; lastName: string; maskedEmail: string; referralCode: string | null }[]> {
    // Require minimum 2 characters to prevent enumeration
    if (!query || query.length < 2) {
      return [];
    }
    
    const searchTerm = `%${query.toLowerCase()}%`;
    const results = await db.select({
      id: agents.id,
      firstName: agents.firstName,
      lastName: agents.lastName,
      email: agents.email,
      referralCode: agents.referralCode,
    }).from(agents)
      .where(and(
        eq(agents.status, 'active'),
        or(
          sql`LOWER(${agents.firstName}) LIKE ${searchTerm}`,
          sql`LOWER(${agents.lastName}) LIKE ${searchTerm}`,
          sql`LOWER(${agents.email}) LIKE ${searchTerm}`,
          sql`LOWER(CONCAT(${agents.firstName}, ' ', ${agents.lastName})) LIKE ${searchTerm}`
        )
      ))
      .orderBy(asc(agents.firstName))
      .limit(20);
    
    // Mask emails for privacy (show first 2 chars + domain)
    return results.map(agent => ({
      id: agent.id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      maskedEmail: this.maskEmail(agent.email),
      referralCode: agent.referralCode,
    }));
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    const maskedLocal = local.length > 2 
      ? local.substring(0, 2) + '***' 
      : local + '***';
    return `${maskedLocal}@${domain}`;
  }

  // ==================== TREE / TEAM ====================

  async findPlacement(sponsorId: number, strategy: 'left' | 'right' | 'auto'): Promise<{ placementId: number, leg: 'left' | 'right' }> {
    let currentId = sponsorId;
    let targetLeg: 'left' | 'right' = strategy === 'auto' ? 'left' : strategy;
    
    // For auto, find the weaker leg
    if (strategy === 'auto') {
      const leftVol = await this.getLegVolume(sponsorId, 'left', new Date(0));
      const rightVol = await this.getLegVolume(sponsorId, 'right', new Date(0));
      targetLeg = leftVol <= rightVol ? 'left' : 'right';
    }
    
    while (true) {
      const [child] = await db.select().from(agents).where(and(
        eq(agents.placementId, currentId),
        eq(agents.leg, targetLeg)
      ));
      
      if (!child) {
        return { placementId: currentId, leg: targetLeg };
      }
      
      currentId = child.id;
    }
  }

  async getTeamStructure(rootAgentId: number, maxDepth: number = 10): Promise<AgentWithTeam> {
    const root = await this.getAgent(rootAgentId);
    if (!root) throw new Error("Agent not found");
    
    const buildTree = async (node: Agent, depth: number = 0): Promise<AgentWithTeam> => {
      if (depth >= maxDepth) {
        return { ...node, children: [], volume: { left: 0, right: 0 } };
      }
      
      const children = await db.select().from(agents)
        .where(eq(agents.placementId, node.id))
        .orderBy(asc(agents.leg));
      
      const enrichedChildren = await Promise.all(children.map(c => buildTree(c, depth + 1)));
      
      // Calculate volumes
      const leftVol = await this.getLegVolume(node.id, 'left', getWeekStart());
      const rightVol = await this.getLegVolume(node.id, 'right', getWeekStart());
      
      return {
        ...node,
        children: enrichedChildren,
        volume: { left: leftVol, right: rightVol },
        teamSize: await this.getTeamSize(node.id),
      };
    };

    return buildTree(root);
  }
  
  async getUpline(agentId: number): Promise<Agent[]> {
    const upline: Agent[] = [];
    let current = await this.getAgent(agentId);
    
    while (current?.sponsorId) {
      const sponsor = await this.getAgent(current.sponsorId);
      if (!sponsor) break;
      upline.push(sponsor);
      current = sponsor;
    }
    
    return upline;
  }
  
  async getLegVolume(agentId: number, leg: 'left' | 'right', startDate: Date): Promise<number> {
    const [child] = await db.select().from(agents).where(and(
      eq(agents.placementId, agentId),
      eq(agents.leg, leg)
    ));
    
    if (!child) return 0;
    
    const getVolumeForNode = async (nodeId: number): Promise<number> => {
      const dealResults = await db.select({ total: sum(deals.companyRevenue) })
        .from(deals)
        .where(and(
          eq(deals.agentId, nodeId),
          gte(deals.createdAt, startDate),
          eq(deals.status, 'funded')
        ));
      
      const personalVol = Number(dealResults[0]?.total || 0);
      
      const children = await db.select().from(agents).where(eq(agents.placementId, nodeId));
      let childrenVol = 0;
      for (const c of children) {
        childrenVol += await getVolumeForNode(c.id);
      }
      
      return personalVol + childrenVol;
    };
    
    return getVolumeForNode(child.id);
  }

  // ==================== DEALS ====================

  async getDeal(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: Partial<Deal> & { agentId: number; merchantName: string; loanAmount: string; companyRevenue: string }): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values({
      agentId: deal.agentId,
      merchantName: deal.merchantName,
      merchantDba: deal.merchantDba ?? null,
      merchantEmail: deal.merchantEmail ?? null,
      merchantPhone: deal.merchantPhone ?? null,
      businessType: deal.businessType ?? null,
      ein: deal.ein ?? null,
      businessStartDate: deal.businessStartDate ?? null,
      industry: deal.industry ?? null,
      businessAddress: deal.businessAddress ?? null,
      businessCity: deal.businessCity ?? null,
      businessState: deal.businessState ?? null,
      businessZip: deal.businessZip ?? null,
      ownerFirstName: deal.ownerFirstName ?? null,
      ownerLastName: deal.ownerLastName ?? null,
      ownerEmail: deal.ownerEmail ?? null,
      ownerPhone: deal.ownerPhone ?? null,
      ownerDob: deal.ownerDob ?? null,
      ownerSsn: deal.ownerSsn ?? null,
      ownerOwnershipPct: deal.ownerOwnershipPct ?? null,
      ownerAddress: deal.ownerAddress ?? null,
      ownerCity: deal.ownerCity ?? null,
      ownerState: deal.ownerState ?? null,
      ownerZip: deal.ownerZip ?? null,
      requestedAmount: deal.requestedAmount ?? null,
      useOfFunds: deal.useOfFunds ?? null,
      loanAmount: deal.loanAmount,
      companyRevenue: deal.companyRevenue,
      avgMonthlyRevenue: deal.avgMonthlyRevenue ?? null,
      gbrAmount: deal.gbrAmount ?? null,
      programType: (deal.programType as any) ?? 'pmf_funding',
      documents: deal.documents ?? [],
      isVaMerchant: deal.isVaMerchant ?? false,
      isCaMerchant: deal.isCaMerchant ?? false,
      isUtMerchant: deal.isUtMerchant ?? false,
      stateDisclosureConfirmed: deal.stateDisclosureConfirmed ?? false,
      pmfSubmissionStatus: deal.pmfSubmissionStatus ?? 'pending',
      fulfillmentAgentId: deal.fulfillmentAgentId ?? null,
      status: deal.status ?? 'pending',
      notes: deal.notes ?? null,
      approvedById: deal.approvedById ?? null,
      fundedAt: deal.fundedAt ?? null,
    }).returning();
    
    // Update agent's personal volume
    await this.updateAgentVolume(deal.agentId);
    
    return newDeal;
  }

  async updateDeal(id: number, data: Partial<Deal>): Promise<Deal> {
    const [updated] = await db.update(deals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    return updated;
  }

  async getDealsByAgent(agentId: number): Promise<Deal[]> {
    return await db.select().from(deals)
      .where(eq(deals.agentId, agentId))
      .orderBy(desc(deals.createdAt));
  }
  
  async getAllDeals(): Promise<Deal[]> {
    return await db.select().from(deals).orderBy(desc(deals.createdAt));
  }

  async getDealsPaginated(page: number = 1, pageSize: number = 20, filters?: {
    status?: string;
    agentId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ deals: (Deal & { agent: Agent })[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    let conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(deals.status, filters.status as any));
    }
    if (filters?.agentId) {
      conditions.push(eq(deals.agentId, filters.agentId));
    }
    if (filters?.startDate) {
      conditions.push(gte(deals.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(deals.createdAt, filters.endDate));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(deals)
      .where(whereClause);
    
    const results = await db.select({
      deal: deals,
      agent: agents,
    })
      .from(deals)
      .leftJoin(agents, eq(deals.agentId, agents.id))
      .where(whereClause)
      .orderBy(desc(deals.createdAt))
      .limit(pageSize)
      .offset(offset);
    
    return {
      deals: results.map(r => ({ ...r.deal, agent: r.agent! })),
      total: totalResult.count,
    };
  }

  private async updateAgentVolume(agentId: number): Promise<void> {
    const weekStart = getWeekStart();
    
    const [pvResult] = await db.select({ total: sum(deals.companyRevenue) })
      .from(deals)
      .where(and(
        eq(deals.agentId, agentId),
        gte(deals.createdAt, weekStart),
        eq(deals.status, 'funded')
      ));
    
    const personalVolume = pvResult?.total || '0';
    
    await db.update(agents)
      .set({ personalVolume, updatedAt: new Date() })
      .where(eq(agents.id, agentId));
  }

  // ==================== COMMISSIONS ====================

  async createCommission(commission: Partial<Commission> & { agentId: number; type: Commission['type']; amount: string; periodDate: string }): Promise<Commission> {
    const values = {
      agentId: commission.agentId,
      type: commission.type,
      amount: commission.amount,
      dealId: commission.dealId ?? null,
      subscriptionId: commission.subscriptionId ?? null,
      sourceAgentId: commission.sourceAgentId ?? null,
      periodDate: commission.periodDate,
      periodWeekStart: commission.periodWeekStart ?? null,
      status: commission.status ?? 'pending',
      approvedById: commission.approvedById ?? null,
      approvedAt: commission.approvedAt ?? null,
      voidedById: commission.voidedById ?? null,
      voidedAt: commission.voidedAt ?? null,
      voidReason: commission.voidReason ?? null,
      payoutId: commission.payoutId ?? null,
    };

    if (commission.subscriptionId != null) {
      const [inserted] = await db.insert(commissions).values(values).onConflictDoNothing().returning();
      if (inserted) return inserted;
      const [existing] = await db.select().from(commissions).where(
        and(
          eq(commissions.agentId, commission.agentId),
          eq(commissions.subscriptionId, commission.subscriptionId),
          eq(commissions.periodDate, commission.periodDate),
          eq(commissions.type, commission.type),
        )
      ).limit(1);
      return existing;
    }

    const [newComm] = await db.insert(commissions).values(values).returning();
    return newComm;
  }

  async findSubscriptionCommission(agentId: number, subscriptionId: number, periodDate: string, type: Commission['type']): Promise<Commission | null> {
    const [existing] = await db.select().from(commissions).where(
      and(
        eq(commissions.agentId, agentId),
        eq(commissions.subscriptionId, subscriptionId),
        eq(commissions.periodDate, periodDate),
        eq(commissions.type, type),
      )
    ).limit(1);
    return existing ?? null;
  }

  async getCommissionsByAgent(agentId: number): Promise<Commission[]> {
    return await db.select().from(commissions)
      .where(eq(commissions.agentId, agentId))
      .orderBy(desc(commissions.createdAt));
  }

  async getAllCommissions(): Promise<Commission[]> {
    return await db.select().from(commissions).orderBy(desc(commissions.createdAt));
  }

  async getPendingCommissions(): Promise<(Commission & { agent: Agent })[]> {
    const results = await db.select({
      commission: commissions,
      agent: agents,
    })
      .from(commissions)
      .leftJoin(agents, eq(commissions.agentId, agents.id))
      .where(eq(commissions.status, 'pending'))
      .orderBy(desc(commissions.createdAt));
    
    return results.map(r => ({ ...r.commission, agent: r.agent! }));
  }

  async approveCommission(id: number, approvedById: number): Promise<Commission> {
    const [updated] = await db.update(commissions)
      .set({ status: 'approved', approvedById, approvedAt: new Date() })
      .where(eq(commissions.id, id))
      .returning();
    return updated;
  }

  async approveAllPendingCommissions(approvedById: number): Promise<number> {
    const result = await db.update(commissions)
      .set({ status: 'approved', approvedById, approvedAt: new Date() })
      .where(eq(commissions.status, 'pending'));
    
    return result.rowCount || 0;
  }

  async voidCommission(id: number, voidedById: number, reason: string): Promise<Commission> {
    const [updated] = await db.update(commissions)
      .set({ status: 'voided', voidedById, voidedAt: new Date(), voidReason: reason })
      .where(eq(commissions.id, id))
      .returning();
    return updated;
  }

  async getCommissionStats(agentId: number): Promise<{
    totalEarned: number;
    pending: number;
    thisWeek: number;
    thisMonth: number;
    byType: Record<string, number>;
  }> {
    const agentCommissions = await this.getCommissionsByAgent(agentId);
    
    const weekStart = getWeekStart();
    const monthStart = getMonthStart();
    
    const totalEarned = agentCommissions
      .filter(c => c.status === 'paid' || c.status === 'approved')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    
    const pending = agentCommissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + Number(c.amount), 0);
    
    const thisWeek = agentCommissions
      .filter(c => new Date(c.createdAt) >= weekStart)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    
    const thisMonth = agentCommissions
      .filter(c => new Date(c.createdAt) >= monthStart)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    
    const byType: Record<string, number> = {};
    for (const c of agentCommissions) {
      byType[c.type] = (byType[c.type] || 0) + Number(c.amount);
    }
    
    return { totalEarned, pending, thisWeek, thisMonth, byType };
  }

  // ==================== PAYOUTS ====================

  async createPayout(payout: Partial<Payout> & { agentId: number; amount: string; method: string; periodStart: Date; periodEnd: Date }): Promise<Payout> {
    const [newPayout] = await db.insert(payouts).values({
      agentId: payout.agentId,
      amount: payout.amount,
      method: payout.method,
      status: payout.status ?? 'pending',
      externalId: payout.externalId ?? null,
      externalStatus: payout.externalStatus ?? null,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      processedById: payout.processedById ?? null,
      processedAt: payout.processedAt ?? null,
      notes: payout.notes ?? null,
    }).returning();
    return newPayout;
  }

  async getPayoutsByAgent(agentId: number): Promise<Payout[]> {
    return await db.select().from(payouts)
      .where(eq(payouts.agentId, agentId))
      .orderBy(desc(payouts.createdAt));
  }

  async getAllPayouts(): Promise<Payout[]> {
    return await db.select().from(payouts).orderBy(desc(payouts.createdAt));
  }

  async getPayoutPreview(periodStart: Date, periodEnd: Date): Promise<{
    agents: { agentId: number; firstName: string; lastName: string; email: string; amount: number; commissionCount: number }[];
    totalAmount: number;
  }> {
    const results = await db.select({
      agentId: agents.id,
      firstName: agents.firstName,
      lastName: agents.lastName,
      email: agents.email,
      amount: sum(commissions.amount),
      commissionCount: count(commissions.id),
    })
      .from(commissions)
      .leftJoin(agents, eq(commissions.agentId, agents.id))
      .where(and(
        eq(commissions.status, 'approved'),
        isNull(commissions.payoutId),
        gte(commissions.createdAt, periodStart),
        lte(commissions.createdAt, periodEnd)
      ))
      .groupBy(agents.id, agents.firstName, agents.lastName, agents.email);
    
    const agentsData = results.map(r => ({
      agentId: r.agentId!,
      firstName: r.firstName!,
      lastName: r.lastName!,
      email: r.email!,
      amount: Number(r.amount || 0),
      commissionCount: Number(r.commissionCount || 0),
    }));
    
    const totalAmount = agentsData.reduce((sum, a) => sum + a.amount, 0);
    
    return { agents: agentsData, totalAmount };
  }

  async processPayout(id: number, processedById: number): Promise<Payout> {
    const [payout] = await db.select().from(payouts).where(eq(payouts.id, id));
    if (!payout) throw new Error("Payout not found");
    const [updated] = await db.update(payouts)
      .set({ status: 'processing', processedById, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(payouts.id, id))
      .returning();
    return updated;
  }

  async markPayoutComplete(id: number, externalId?: string): Promise<Payout> {
    const payout = await db.select().from(payouts).where(eq(payouts.id, id)).then(r => r[0]);
    if (!payout) throw new Error("Payout not found");
    
    // Mark commissions as paid
    await db.update(commissions)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(commissions.payoutId, id));
    
    const [updated] = await db.update(payouts)
      .set({ status: 'completed', externalId, processedAt: new Date(), updatedAt: new Date() })
      .where(eq(payouts.id, id))
      .returning();
    
    return updated;
  }

  // ==================== NOTIFICATIONS ====================

  async createNotification(notification: Partial<Notification> & { agentId: number; type: Notification['type']; title: string; message: string }): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values({
      agentId: notification.agentId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      dealId: notification.dealId ?? null,
      commissionId: notification.commissionId ?? null,
      announcementId: notification.announcementId ?? null,
      isRead: notification.isRead ?? false,
      readAt: notification.readAt ?? null,
      emailSent: notification.emailSent ?? false,
      emailSentAt: notification.emailSentAt ?? null,
    }).returning();
    return newNotification;
  }

  async getNotificationsByAgent(agentId: number, limit: number = 50): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.agentId, agentId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(agentId: number): Promise<number> {
    const [result] = await db.select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.agentId, agentId), eq(notifications.isRead, false)));
    return result.count;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(agentId: number): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.agentId, agentId), eq(notifications.isRead, false)));
  }

  // ==================== ANNOUNCEMENTS ====================

  async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Announcement> {
    const [newAnnouncement] = await db.insert(announcements).values(announcement).returning();
    return newAnnouncement;
  }

  async getAnnouncements(includeUnpublished: boolean = false): Promise<Announcement[]> {
    if (includeUnpublished) {
      return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
    }
    
    const now = new Date();
    return await db.select().from(announcements)
      .where(and(
        eq(announcements.isPublished, true),
        or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now))
      ))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt));
  }

  async updateAnnouncement(id: number, data: Partial<Announcement>): Promise<Announcement> {
    const [updated] = await db.update(announcements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();
    return updated;
  }

  async deleteAnnouncement(id: number): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  // ==================== RESOURCES ====================

  async createResource(resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
    const [newResource] = await db.insert(resources).values(resource).returning();
    return newResource;
  }

  async getResources(includeUnpublished: boolean = false): Promise<Resource[]> {
    if (includeUnpublished) {
      return await db.select().from(resources).orderBy(asc(resources.sortOrder), desc(resources.createdAt));
    }
    
    return await db.select().from(resources)
      .where(eq(resources.isPublished, true))
      .orderBy(asc(resources.sortOrder), desc(resources.createdAt));
  }

  async getResourcesByCategory(category: string): Promise<Resource[]> {
    return await db.select().from(resources)
      .where(and(eq(resources.category, category), eq(resources.isPublished, true)))
      .orderBy(asc(resources.sortOrder));
  }

  async updateResource(id: number, data: Partial<Resource>): Promise<Resource> {
    const [updated] = await db.update(resources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning();
    return updated;
  }

  async deleteResource(id: number): Promise<void> {
    await db.delete(resources).where(eq(resources.id, id));
  }

  // ==================== COURSE MODULES ====================

  async getCourseModules(): Promise<CourseModule[]> {
    return db.select().from(courseModules)
      .where(eq(courseModules.isPublished, true))
      .orderBy(courseModules.sortOrder, courseModules.moduleNumber);
  }

  async getCourseModuleById(id: number): Promise<CourseModule | undefined> {
    const [module] = await db.select().from(courseModules).where(eq(courseModules.id, id));
    return module;
  }

  async createCourseModule(data: InsertCourseModule): Promise<CourseModule> {
    const [module] = await db.insert(courseModules).values(data).returning();
    return module;
  }

  async updateCourseModule(id: number, data: Partial<CourseModule>): Promise<CourseModule> {
    const [updated] = await db.update(courseModules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(courseModules.id, id))
      .returning();
    return updated;
  }

  // ==================== COURSE PROGRESS ====================

  async getAgentCourseProgress(agentId: number): Promise<CourseProgress[]> {
    return db.select().from(courseProgress).where(eq(courseProgress.agentId, agentId));
  }

  async getModuleProgress(agentId: number, moduleId: number): Promise<CourseProgress | undefined> {
    const [progress] = await db.select().from(courseProgress)
      .where(and(
        eq(courseProgress.agentId, agentId),
        eq(courseProgress.moduleId, moduleId)
      ));
    return progress;
  }

  async upsertCourseProgress(agentId: number, moduleId: number, data: Partial<InsertCourseProgress>): Promise<CourseProgress> {
    const existing = await this.getModuleProgress(agentId, moduleId);
    
    if (existing) {
      const [updated] = await db.update(courseProgress)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(courseProgress.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(courseProgress)
        .values({ 
          agentId, 
          moduleId, 
          ...data,
          startedAt: new Date(),
        })
        .returning();
      return created;
    }
  }

  async getAgentTrainingStats(agentId: number): Promise<{
    totalModules: number;
    completedModules: number;
    overallProgress: number;
  }> {
    const modules = await this.getCourseModules();
    const progress = await this.getAgentCourseProgress(agentId);
    
    const completedCount = progress.filter(p => p.status === 'completed').length;
    
    return {
      totalModules: modules.length,
      completedModules: completedCount,
      overallProgress: modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0,
    };
  }

  // ==================== ADMIN STATS ====================

  async getAdminStats(): Promise<{
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
  }> {
    const weekStart = getWeekStart();
    
    const [totalAgentsResult] = await db.select({ count: count() }).from(agents);
    const [activeAgentsResult] = await db.select({ count: count() })
      .from(agents).where(eq(agents.status, 'active'));
    const [newAgentsResult] = await db.select({ count: count() })
      .from(agents).where(gte(agents.createdAt, weekStart));
    
    const [totalDealsResult] = await db.select({ count: count() }).from(deals);
    const [dealsThisWeekResult] = await db.select({ count: count() })
      .from(deals).where(gte(deals.createdAt, weekStart));
    
    const [totalVolumeResult] = await db.select({ total: sum(deals.companyRevenue) })
      .from(deals).where(eq(deals.status, 'funded'));
    const [volumeThisWeekResult] = await db.select({ total: sum(deals.companyRevenue) })
      .from(deals).where(and(eq(deals.status, 'funded'), gte(deals.createdAt, weekStart)));
    
    const [totalCommissionsResult] = await db.select({ total: sum(commissions.amount) }).from(commissions);
    const [pendingCommissionsResult] = await db.select({ total: sum(commissions.amount) })
      .from(commissions).where(eq(commissions.status, 'pending'));
    const [pendingPayoutsResult] = await db.select({ total: sum(payouts.amount) })
      .from(payouts).where(eq(payouts.status, 'pending'));
    
    return {
      totalAgents: totalAgentsResult.count,
      activeAgents: activeAgentsResult.count,
      newAgentsThisWeek: newAgentsResult.count,
      totalDeals: totalDealsResult.count,
      dealsThisWeek: dealsThisWeekResult.count,
      totalVolume: Number(totalVolumeResult.total || 0),
      volumeThisWeek: Number(volumeThisWeekResult.total || 0),
      totalCommissions: Number(totalCommissionsResult.total || 0),
      pendingCommissions: Number(pendingCommissionsResult.total || 0),
      pendingPayouts: Number(pendingPayoutsResult.total || 0),
    };
  }

  // ==================== LEADERBOARDS ====================

  async getTopEarners(limit: number = 10): Promise<{
    agentId: number;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    currentRank: string;
    totalEarned: number;
  }[]> {
    const monthStart = getMonthStart();
    
    const results = await db.select({
      agentId: agents.id,
      firstName: agents.firstName,
      lastName: agents.lastName,
      profileImageUrl: agents.profileImageUrl,
      currentRank: agents.currentRank,
      totalEarned: sum(commissions.amount),
    })
      .from(commissions)
      .leftJoin(agents, eq(commissions.agentId, agents.id))
      .where(gte(commissions.createdAt, monthStart))
      .groupBy(agents.id, agents.firstName, agents.lastName, agents.profileImageUrl, agents.currentRank)
      .orderBy(desc(sum(commissions.amount)))
      .limit(limit);
    
    return results.map(r => ({
      agentId: r.agentId!,
      firstName: r.firstName!,
      lastName: r.lastName!,
      profileImageUrl: r.profileImageUrl,
      currentRank: r.currentRank!,
      totalEarned: Number(r.totalEarned || 0),
    }));
  }

  async getRankAdvances(limit: number = 20): Promise<{
    agentId: number;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    newRank: string;
    advancedAt: string;
  }[]> {
    const results = await db.select({
      id: agents.id,
      firstName: agents.firstName,
      lastName: agents.lastName,
      profileImageUrl: agents.profileImageUrl,
      currentRank: agents.currentRank,
      updatedAt: agents.updatedAt,
    })
      .from(agents)
      .where(ne(agents.currentRank, 'agent'))
      .orderBy(desc(agents.updatedAt))
      .limit(limit);

    return results.map(r => ({
      agentId: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      profileImageUrl: r.profileImageUrl,
      newRank: r.currentRank,
      advancedAt: r.updatedAt.toISOString(),
    }));
  }

  async getTopRecruiters(limit: number = 10): Promise<{
    agentId: number;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    currentRank: string;
    recruits: number;
  }[]> {
    const monthStart = getMonthStart();
    
    const results = await db.select({
      agentId: agents.id,
      firstName: agents.firstName,
      lastName: agents.lastName,
      profileImageUrl: agents.profileImageUrl,
      currentRank: agents.currentRank,
      recruits: count(sql`CASE WHEN ${agents.createdAt} >= ${monthStart} THEN 1 END`),
    })
      .from(agents)
      .leftJoin(
        db.select({ sponsorId: agents.sponsorId, id: agents.id, createdAt: agents.createdAt })
          .from(agents)
          .as('recruits'),
        sql`recruits.sponsor_id = ${agents.id}`
      )
      .groupBy(agents.id, agents.firstName, agents.lastName, agents.profileImageUrl, agents.currentRank)
      .orderBy(desc(count(sql`CASE WHEN ${agents.createdAt} >= ${monthStart} THEN 1 END`)))
      .limit(limit);
    
    return results.map(r => ({
      agentId: r.agentId!,
      firstName: r.firstName!,
      lastName: r.lastName!,
      profileImageUrl: r.profileImageUrl,
      currentRank: r.currentRank!,
      recruits: Number(r.recruits || 0),
    }));
  }

  // ==================== ACTIVITY LOG ====================

  async logActivity(log: Omit<typeof activityLog.$inferInsert, 'id' | 'createdAt'>): Promise<void> {
    await db.insert(activityLog).values(log);
  }

  async getActivityLogs(page: number = 1, pageSize: number = 50, filters?: {
    actorId?: number;
    actorType?: string;
    entityType?: string;
    entityId?: number;
    entityIds?: number[];
    action?: string;
    actions?: string[];
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ logs: ((typeof activityLog.$inferSelect) & { actorName: string | null })[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const conditions: SQL<unknown>[] = [];
    
    if (filters?.actorId) {
      conditions.push(eq(activityLog.actorId, filters.actorId));
    }
    if (filters?.actorType) {
      conditions.push(eq(activityLog.actorType, filters.actorType));
    }
    if (filters?.entityType) {
      conditions.push(eq(activityLog.entityType, filters.entityType));
    }
    if (filters?.actions && filters.actions.length > 0) {
      conditions.push(inArray(activityLog.action, filters.actions));
    } else if (filters?.action) {
      conditions.push(eq(activityLog.action, filters.action));
    }
    if (filters?.entityIds && filters.entityIds.length > 0) {
      conditions.push(inArray(activityLog.entityId, filters.entityIds));
    } else if (filters?.entityId) {
      conditions.push(eq(activityLog.entityId, filters.entityId));
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      const searchCond = or(
        like(activityLog.action, term),
        like(activityLog.entityType, term),
        like(activityLog.description, term),
      );
      if (searchCond) conditions.push(searchCond);
    }
    if (filters?.startDate) {
      conditions.push(gte(activityLog.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      // Inclusive of the full selected day (end at 23:59:59.999)
      const endOfDay = new Date(filters.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(activityLog.createdAt, endOfDay));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(activityLog)
      .where(whereClause);
    
    const actorAgent = alias(agents, "actor_agent");
    const rawLogs = await db
      .select({
        id: activityLog.id,
        actorId: activityLog.actorId,
        actorType: activityLog.actorType,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        description: activityLog.description,
        details: activityLog.details,
        ipAddress: activityLog.ipAddress,
        userAgent: activityLog.userAgent,
        createdAt: activityLog.createdAt,
        actorFirstName: actorAgent.firstName,
        actorLastName: actorAgent.lastName,
        actorEmail: actorAgent.email,
      })
      .from(activityLog)
      .leftJoin(actorAgent, eq(activityLog.actorId, actorAgent.id))
      .where(whereClause)
      .orderBy(desc(activityLog.createdAt))
      .limit(pageSize)
      .offset(offset);

    const logs = rawLogs.map((row) => {
      let actorName: string | null = null;
      if (row.actorType === "system") {
        actorName = "System";
      } else if (row.actorFirstName && row.actorLastName) {
        actorName = `${row.actorFirstName} ${row.actorLastName}`;
      } else if (row.actorEmail) {
        actorName = row.actorEmail;
      }
      return {
        id: row.id,
        actorId: row.actorId,
        actorType: row.actorType,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        description: row.description,
        details: row.details,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        actorName,
      };
    });
    
    return { logs, total: totalResult.count };
  }

  // ==================== LEADS ====================

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async createLeadsBulk(leadsData: InsertLead[]): Promise<Lead[]> {
    if (leadsData.length === 0) return [];
    const newLeads = await db.insert(leads).values(leadsData).returning();
    return newLeads;
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async updateLead(id: number, data: Partial<Lead>): Promise<Lead> {
    const [updated] = await db.update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async updateLeadStatus(id: number, status: Lead['status'], notes?: string): Promise<Lead> {
    const [updated] = await db.update(leads)
      .set({ 
        status, 
        notes: notes || undefined,
        statusUpdatedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async requestAIFollowup(id: number): Promise<Lead> {
    const [updated] = await db.update(leads)
      .set({ 
        aiFollowupRequested: true,
        aiFollowupRequestedAt: new Date(),
        status: 'ai_followup',
        statusUpdatedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async markAIFollowupProcessed(id: number): Promise<Lead> {
    const [updated] = await db.update(leads)
      .set({ 
        aiFollowupProcessed: true,
        aiFollowupProcessedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async getLeadsByAgent(agentId: number): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(eq(leads.assignedAgentId, agentId))
      .orderBy(desc(leads.createdAt));
  }

  async getUnassignedLeads(): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(isNull(leads.assignedAgentId))
      .orderBy(desc(leads.createdAt));
  }

  async getAllLeads(page: number = 1, pageSize: number = 50, filters?: {
    status?: string;
    assignedAgentId?: number;
    unassigned?: boolean;
    aiFollowupRequested?: boolean;
  }): Promise<{ leads: Lead[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    let conditions: any[] = [];
    
    if (filters?.status) {
      conditions.push(eq(leads.status, filters.status as any));
    }
    if (filters?.assignedAgentId) {
      conditions.push(eq(leads.assignedAgentId, filters.assignedAgentId));
    }
    if (filters?.unassigned) {
      conditions.push(isNull(leads.assignedAgentId));
    }
    if (filters?.aiFollowupRequested) {
      conditions.push(eq(leads.aiFollowupRequested, true));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(leads)
      .where(whereClause);
    
    const results = await db.select()
      .from(leads)
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(pageSize)
      .offset(offset);
    
    return { leads: results, total: totalResult.count };
  }

  async getAIFollowupQueue(): Promise<(Lead & { agent?: Agent })[]> {
    const results = await db.select({
      lead: leads,
      agent: agents,
    })
      .from(leads)
      .leftJoin(agents, eq(leads.assignedAgentId, agents.id))
      .where(and(
        eq(leads.aiFollowupRequested, true),
        eq(leads.aiFollowupProcessed, false)
      ))
      .orderBy(asc(leads.aiFollowupRequestedAt));
    
    return results.map(r => ({ ...r.lead, agent: r.agent || undefined }));
  }

  async assignLeadsToAgent(leadIds: number[], agentId: number, assignedById: number): Promise<Lead[]> {
    const updated = await db.update(leads)
      .set({ 
        assignedAgentId: agentId,
        assignedById,
        assignedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(inArray(leads.id, leadIds))
      .returning();
    return updated;
  }

  async getLeadStats(): Promise<{
    total: number;
    unassigned: number;
    byStatus: Record<string, number>;
    aiFollowupPending: number;
  }> {
    const [totalResult] = await db.select({ count: count() }).from(leads);
    const [unassignedResult] = await db.select({ count: count() })
      .from(leads).where(isNull(leads.assignedAgentId));
    const [aiFollowupResult] = await db.select({ count: count() })
      .from(leads).where(and(eq(leads.aiFollowupRequested, true), eq(leads.aiFollowupProcessed, false)));
    
    const allLeads = await db.select().from(leads);
    const byStatus: Record<string, number> = {};
    for (const lead of allLeads) {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
    }
    
    return {
      total: totalResult.count,
      unassigned: unassignedResult.count,
      byStatus,
      aiFollowupPending: aiFollowupResult.count,
    };
  }

  // ==================== LEAD REQUESTS ====================

  async createLeadRequest(request: InsertLeadRequest): Promise<LeadRequest> {
    const [newRequest] = await db.insert(leadRequests).values(request).returning();
    return newRequest;
  }

  async getLeadRequest(id: number): Promise<LeadRequest | undefined> {
    const [request] = await db.select().from(leadRequests).where(eq(leadRequests.id, id));
    return request;
  }

  async getLeadRequestsByAgent(agentId: number): Promise<LeadRequest[]> {
    return await db.select().from(leadRequests)
      .where(eq(leadRequests.agentId, agentId))
      .orderBy(desc(leadRequests.createdAt));
  }

  async getPendingLeadRequests(): Promise<(LeadRequest & { agent: Agent })[]> {
    const results = await db.select({
      request: leadRequests,
      agent: agents,
    })
      .from(leadRequests)
      .leftJoin(agents, eq(leadRequests.agentId, agents.id))
      .where(eq(leadRequests.status, 'pending'))
      .orderBy(asc(leadRequests.createdAt));
    
    return results.map(r => ({ ...r.request, agent: r.agent! }));
  }

  async getAllLeadRequests(page: number = 1, pageSize: number = 50): Promise<{ requests: (LeadRequest & { agent: Agent })[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    const [totalResult] = await db.select({ count: count() }).from(leadRequests);
    
    const results = await db.select({
      request: leadRequests,
      agent: agents,
    })
      .from(leadRequests)
      .leftJoin(agents, eq(leadRequests.agentId, agents.id))
      .orderBy(desc(leadRequests.createdAt))
      .limit(pageSize)
      .offset(offset);
    
    return {
      requests: results.map(r => ({ ...r.request, agent: r.agent! })),
      total: totalResult.count,
    };
  }

  async respondToLeadRequest(id: number, respondedById: number, status: 'approved' | 'denied' | 'fulfilled', responseNotes?: string, leadsAssigned?: number): Promise<LeadRequest> {
    const [updated] = await db.update(leadRequests)
      .set({ 
        status,
        respondedById,
        respondedAt: new Date(),
        responseNotes: responseNotes || null,
        leadsAssigned: leadsAssigned || 0,
        updatedAt: new Date() 
      })
      .where(eq(leadRequests.id, id))
      .returning();
    return updated;
  }

  // ==================== SUBSCRIPTIONS ====================

  async createSubscription(sub: {
    agentId: number;
    merchantName: string;
    merchantEmail?: string;
    tier: 'tier_1' | 'tier_2' | 'tier_3';
    monthlyAmount: string;
    mcaPairedDealId?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Subscription> {
    const [newSub] = await db.insert(subscriptions).values({
      agentId: sub.agentId,
      merchantName: sub.merchantName,
      merchantEmail: sub.merchantEmail ?? null,
      tier: sub.tier,
      monthlyAmount: sub.monthlyAmount,
      status: 'active',
      mcaPairedDealId: sub.mcaPairedDealId ?? null,
      startDate: sub.startDate ?? new Date(),
      endDate: sub.endDate ?? null,
    }).returning();
    return newSub;
  }

  async updateSubscriptionEndDate(id: number, endDate: Date | null): Promise<Subscription> {
    const [updated] = await db.update(subscriptions)
      .set({ endDate, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated;
  }

  async getSubscriptionsByAgent(agentId: number): Promise<(Subscription & { reactivatedByName: string | null; pausedByName: string | null; cancelledByName: string | null })[]> {
    const reactivatedByAgents = alias(agents, 'reactivated_by_agents');
    const pausedByAgents = alias(agents, 'paused_by_agents');
    const cancelledByAgents = alias(agents, 'cancelled_by_agents');
    const results = await db.select({
      subscription: subscriptions,
      reactivatedBy: reactivatedByAgents,
      pausedBy: pausedByAgents,
      cancelledBy: cancelledByAgents,
    })
      .from(subscriptions)
      .leftJoin(reactivatedByAgents, eq(subscriptions.reactivatedById, reactivatedByAgents.id))
      .leftJoin(pausedByAgents, eq(subscriptions.pausedById, pausedByAgents.id))
      .leftJoin(cancelledByAgents, eq(subscriptions.cancelledById, cancelledByAgents.id))
      .where(eq(subscriptions.agentId, agentId))
      .orderBy(desc(subscriptions.createdAt));
    return results.map(r => ({
      ...r.subscription,
      reactivatedByName: r.reactivatedBy
        ? `${r.reactivatedBy.firstName} ${r.reactivatedBy.lastName}`
        : null,
      pausedByName: r.pausedBy
        ? `${r.pausedBy.firstName} ${r.pausedBy.lastName}`
        : null,
      cancelledByName: r.cancelledBy
        ? `${r.cancelledBy.firstName} ${r.cancelledBy.lastName}`
        : null,
    }));
  }

  async getSubscriptionById(id: number): Promise<(Subscription & { reactivatedBy: Agent | null }) | undefined> {
    const reactivatedByAgents = alias(agents, 'reactivated_by_agents');
    const [result] = await db.select({
      subscription: subscriptions,
      reactivatedBy: reactivatedByAgents,
    })
      .from(subscriptions)
      .leftJoin(reactivatedByAgents, eq(subscriptions.reactivatedById, reactivatedByAgents.id))
      .where(eq(subscriptions.id, id));
    if (!result) return undefined;
    return {
      ...result.subscription,
      reactivatedBy: result.reactivatedBy ?? null,
    };
  }

  async getAllSubscriptions(): Promise<(Subscription & { agent: Agent; pausedBy: Agent | null; cancelledBy: Agent | null; reactivatedBy: Agent | null })[]> {
    const pausedByAgents = alias(agents, 'paused_by_agents');
    const cancelledByAgents = alias(agents, 'cancelled_by_agents');
    const reactivatedByAgents = alias(agents, 'reactivated_by_agents');
    const results = await db.select({
      subscription: subscriptions,
      agent: agents,
      pausedBy: pausedByAgents,
      cancelledBy: cancelledByAgents,
      reactivatedBy: reactivatedByAgents,
    })
      .from(subscriptions)
      .leftJoin(agents, eq(subscriptions.agentId, agents.id))
      .leftJoin(pausedByAgents, eq(subscriptions.pausedById, pausedByAgents.id))
      .leftJoin(cancelledByAgents, eq(subscriptions.cancelledById, cancelledByAgents.id))
      .leftJoin(reactivatedByAgents, eq(subscriptions.reactivatedById, reactivatedByAgents.id))
      .orderBy(desc(subscriptions.createdAt));
    return results.map(r => ({
      ...r.subscription,
      agent: r.agent!,
      pausedBy: r.pausedBy ?? null,
      cancelledBy: r.cancelledBy ?? null,
      reactivatedBy: r.reactivatedBy ?? null,
    }));
  }

  async updateSubscriptionStatus(id: number, status: 'active' | 'paused' | 'cancelled' | 'expired', actorId?: number): Promise<Subscription> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'cancelled') {
      updates.cancelledAt = new Date();
      if (actorId) updates.cancelledById = actorId;
      updates.reactivatedAt = null;
      updates.reactivatedById = null;
    }
    if (status === 'paused') {
      updates.pausedAt = new Date();
      if (actorId) updates.pausedById = actorId;
      updates.reactivatedAt = null;
      updates.reactivatedById = null;
    }
    if (status === 'active') {
      updates.pausedAt = null;
      updates.reactivatedAt = new Date();
      updates.reactivatedById = actorId ?? null;
    }
    const [updated] = await db.update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.id, id))
      .returning();
    return updated;
  }

  async getSubscriptionsDueForExpiry(): Promise<Subscription[]> {
    const now = new Date();
    return await db.select().from(subscriptions)
      .where(and(
        lte(subscriptions.endDate, now),
        or(
          eq(subscriptions.status, 'active'),
          eq(subscriptions.status, 'paused')
        )
      ));
  }

  async getActiveSubscriptionRevenue(agentId: number): Promise<number> {
    const subs = await db.select().from(subscriptions)
      .where(and(eq(subscriptions.agentId, agentId), eq(subscriptions.status, 'active')));
    return subs.reduce((sum, s) => sum + Number(s.monthlyAmount), 0);
  }

  // ==================== HOLDBACKS ====================

  async createHoldback(holdback: {
    dealId: number;
    agentId: number;
    commissionId?: number;
    totalAmount: string;
    releaseDate?: Date;
  }): Promise<Holdback> {
    const [newHoldback] = await db.insert(holdbacks).values({
      dealId: holdback.dealId,
      agentId: holdback.agentId,
      commissionId: holdback.commissionId ?? null,
      totalAmount: holdback.totalAmount,
      releasedAmount: "0",
      clawbackAmount: "0",
      status: 'held',
      releaseDate: holdback.releaseDate ?? null,
    }).returning();
    return newHoldback;
  }

  async getHoldbacksByAgent(agentId: number): Promise<Holdback[]> {
    return await db.select().from(holdbacks)
      .where(eq(holdbacks.agentId, agentId))
      .orderBy(desc(holdbacks.createdAt));
  }

  async getHoldbacksByDeal(dealId: number): Promise<Holdback[]> {
    return await db.select().from(holdbacks)
      .where(eq(holdbacks.dealId, dealId))
      .orderBy(desc(holdbacks.createdAt));
  }

  async getAllHoldbacks(): Promise<(Holdback & { agent: Agent; dealName: string | null })[]> {
    const results = await db.select({
      holdback: holdbacks,
      agent: agents,
      dealName: deals.merchantName,
    })
      .from(holdbacks)
      .leftJoin(agents, eq(holdbacks.agentId, agents.id))
      .leftJoin(deals, eq(holdbacks.dealId, deals.id))
      .orderBy(desc(holdbacks.createdAt));
    return results.map(r => ({ ...r.holdback, agent: r.agent!, dealName: r.dealName ?? null }));
  }

  async releaseHoldback(id: number): Promise<Holdback> {
    const [existing] = await db.select().from(holdbacks).where(eq(holdbacks.id, id));
    if (!existing) throw new Error("Holdback not found");
    const [updated] = await db.update(holdbacks)
      .set({
        releasedAmount: existing.totalAmount,
        status: 'released',
        releaseDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(holdbacks.id, id))
      .returning();
    return updated;
  }

  async applyClawback(id: number, reason: string, percentage: number = 100): Promise<Holdback> {
    const [existing] = await db.select().from(holdbacks).where(eq(holdbacks.id, id));
    if (!existing) throw new Error("Holdback not found");
    const clawbackAmt = (Number(existing.totalAmount) * percentage / 100).toFixed(2);
    const [updated] = await db.update(holdbacks)
      .set({
        clawbackAmount: clawbackAmt,
        status: 'clawed_back',
        clawbackDate: new Date(),
        clawbackReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(holdbacks.id, id))
      .returning();
    return updated;
  }

  async getPendingHoldbacks(): Promise<(Holdback & { agent: Agent })[]> {
    const results = await db.select({
      holdback: holdbacks,
      agent: agents,
    })
      .from(holdbacks)
      .leftJoin(agents, eq(holdbacks.agentId, agents.id))
      .where(eq(holdbacks.status, 'held'))
      .orderBy(asc(holdbacks.releaseDate));
    return results.map(r => ({ ...r.holdback, agent: r.agent! }));
  }

  async getReleasableHoldbacks(): Promise<Holdback[]> {
    return await db.select().from(holdbacks)
      .where(and(
        eq(holdbacks.status, 'held'),
        lte(holdbacks.releaseDate, new Date())
      ));
  }

  // ==================== FULFILLMENT TIERS ====================

  async getFulfillmentTier(agentId: number, month: string): Promise<FulfillmentTier | undefined> {
    const [tier] = await db.select().from(fulfillmentTiers)
      .where(and(eq(fulfillmentTiers.agentId, agentId), eq(fulfillmentTiers.month, month)));
    return tier;
  }

  async upsertFulfillmentTier(data: {
    agentId: number;
    month: string;
    tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
    dealCount: number;
    totalGbr: string;
  }): Promise<FulfillmentTier> {
    const existing = await this.getFulfillmentTier(data.agentId, data.month);
    if (existing) {
      const [updated] = await db.update(fulfillmentTiers)
        .set({
          tier: data.tier,
          dealCount: data.dealCount,
          totalGbr: data.totalGbr,
          qualifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(fulfillmentTiers.id, existing.id))
        .returning();
      return updated;
    }
    const [newTier] = await db.insert(fulfillmentTiers).values({
      agentId: data.agentId,
      month: data.month,
      tier: data.tier,
      dealCount: data.dealCount,
      totalGbr: data.totalGbr,
      qualifiedAt: new Date(),
    }).returning();
    return newTier;
  }

  async getCurrentFulfillmentTierRate(agentId: number): Promise<number> {
    const month = new Date().toISOString().slice(0, 7);
    const tier = await this.getFulfillmentTier(agentId, month);
    const rates: Record<string, number> = {
      'tier_1': 0.30,
      'tier_2': 0.33,
      'tier_3': 0.36,
      'tier_4': 0.40,
    };
    return rates[tier?.tier || 'tier_1'] || 0.30;
  }

  // ==================== PLATFORM SETTINGS ====================

  async getPlatformSetting(key: string): Promise<any | null> {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    return row ? row.value : null;
  }

  async savePlatformSetting(key: string, value: any, updatedById?: number): Promise<void> {
    const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    if (existing.length > 0) {
      await db.update(platformSettings)
        .set({ value, updatedAt: new Date(), updatedById: updatedById ?? null })
        .where(eq(platformSettings.key, key));
    } else {
      await db.insert(platformSettings).values({ key, value, updatedById: updatedById ?? null });
    }
  }

  async getAllPlatformSettings(): Promise<Record<string, any>> {
    const rows = await db.select().from(platformSettings);
    const result: Record<string, any> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
