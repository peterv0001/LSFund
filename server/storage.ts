import { db } from "./db";
import { 
  agents, deals, commissions, payouts, notifications, announcements, resources, rankQualifications, activityLog,
  type Agent, type InsertAgent, type Deal, type Commission, type AgentWithTeam, type Payout, type Notification, type Announcement, type Resource
} from "@shared/schema";
import { eq, sql, and, desc, asc, gte, lte, like, or, inArray, isNull, count, sum } from "drizzle-orm";

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
  }): Promise<{ agents: Agent[]; total: number }> {
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
    
    const results = await db.select()
      .from(agents)
      .where(whereClause)
      .orderBy(desc(agents.createdAt))
      .limit(pageSize)
      .offset(offset);
    
    return { agents: results, total: totalResult.count };
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

  async createDeal(deal: Partial<Deal> & { agentId: number; merchantName: string; loanAmount: string; companyRevenue: string }): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values({
      agentId: deal.agentId,
      merchantName: deal.merchantName,
      merchantEmail: deal.merchantEmail ?? null,
      merchantPhone: deal.merchantPhone ?? null,
      loanAmount: deal.loanAmount,
      companyRevenue: deal.companyRevenue,
      status: deal.status ?? 'funded',
      notes: deal.notes ?? null,
      approvedById: deal.approvedById ?? null,
      fundedAt: deal.fundedAt ?? new Date(),
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
    const [newComm] = await db.insert(commissions).values({
      agentId: commission.agentId,
      type: commission.type,
      amount: commission.amount,
      dealId: commission.dealId ?? null,
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
    }).returning();
    return newComm;
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
    entityType?: string;
    entityId?: number;
  }): Promise<{ logs: (typeof activityLog.$inferSelect)[]; total: number }> {
    const offset = (page - 1) * pageSize;
    
    let conditions: any[] = [];
    
    if (filters?.actorId) {
      conditions.push(eq(activityLog.actorId, filters.actorId));
    }
    if (filters?.entityType) {
      conditions.push(eq(activityLog.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(activityLog.entityId, filters.entityId));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(activityLog)
      .where(whereClause);
    
    const logs = await db.select()
      .from(activityLog)
      .where(whereClause)
      .orderBy(desc(activityLog.createdAt))
      .limit(pageSize)
      .offset(offset);
    
    return { logs, total: totalResult.count };
  }
}

export const storage = new DatabaseStorage();
