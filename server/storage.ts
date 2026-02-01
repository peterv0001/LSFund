import { db } from "./db";
import { 
  agents, deals, commissions, 
  type Agent, type InsertAgent, type Deal, type InsertDeal, type Commission, type AgentWithTeam 
} from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";

export interface IStorage {
  // Agents
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentByEmail(email: string): Promise<Agent | undefined>;
  getAgentByReferralCode(id: number): Promise<Agent | undefined>; // Using ID as ref code for MVP
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgentRank(id: number, rank: Agent['currentRank']): Promise<Agent>;
  
  // Tree / Team
  getTeamStructure(rootAgentId: number): Promise<AgentWithTeam>;
  findPlacement(sponsorId: number, strategy: 'left' | 'right' | 'auto'): Promise<{ placementId: number, leg: 'left' | 'right' }>;
  
  // Deals
  createDeal(deal: InsertDeal): Promise<Deal>;
  getDealsByAgent(agentId: number): Promise<Deal[]>;
  getAllDeals(): Promise<Deal[]>; // Admin
  
  // Commissions
  createCommission(commission: typeof commissions.$inferInsert): Promise<Commission>;
  getCommissionsByAgent(agentId: number): Promise<Commission[]>;
  getCommissionsStats(): Promise<{ totalEarned: number, pending: number, thisWeek: number }>;
  
  // Admin logic helpers
  getUpline(agentId: number): Promise<Agent[]>;
  getLegVolume(agentId: number, leg: 'left' | 'right', startDate: Date): Promise<number>;
  getAllAgents(): Promise<Agent[]>; // Admin
}

export class DatabaseStorage implements IStorage {
  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async getAgentByEmail(email: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.email, email));
    return agent;
  }
  
  async getAgentByReferralCode(id: number): Promise<Agent | undefined> {
    // For MVP, referral code IS the agent ID
    return this.getAgent(id);
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [newAgent] = await db.insert(agents).values(agent).returning();
    return newAgent;
  }
  
  async updateAgentRank(id: number, rank: Agent['currentRank']): Promise<Agent> {
    const [updated] = await db.update(agents)
      .set({ currentRank: rank })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async getAllAgents(): Promise<Agent[]> {
    return await db.select().from(agents);
  }

  // === TREE LOGIC ===

  async findPlacement(sponsorId: number, strategy: 'left' | 'right' | 'auto'): Promise<{ placementId: number, leg: 'left' | 'right' }> {
    // 1. If strategy is left/right, we walk down that leg until we find a spot
    // 2. If auto, we typically look for the "weak leg" or just alternate. 
    // For MVP "Auto", let's just pick Left for now to keep it simple, or balance based on direct count.
    
    // Simple implementation: Always place on the extreme bottom of the chosen leg (Power Leg strategy)
    // Or if it's the very first recruit, place Left.
    
    let currentId = sponsorId;
    let targetLeg: 'left' | 'right' = strategy === 'auto' ? 'left' : strategy;
    
    while (true) {
      // Find who is currently in the target leg of currentId
      const [child] = await db.select().from(agents).where(and(
        eq(agents.placementId, currentId),
        eq(agents.leg, targetLeg)
      ));
      
      if (!child) {
        // Found an empty spot!
        return { placementId: currentId, leg: targetLeg };
      }
      
      // Move down
      currentId = child.id;
    }
  }

  async getTeamStructure(rootAgentId: number): Promise<AgentWithTeam> {
    const root = await this.getAgent(rootAgentId);
    if (!root) throw new Error("Agent not found");
    
    // Recursive function to build tree
    // Note: This is inefficient for deep trees (N+1 queries). 
    // In production, use a CTE (Common Table Expression) or dedicated closure table.
    // For MVP with small depth, recursion is acceptable.
    
    const buildTree = async (node: Agent): Promise<AgentWithTeam> => {
      const children = await db.select().from(agents).where(eq(agents.placementId, node.id));
      
      const enrichedChildren = await Promise.all(children.map(c => buildTree(c)));
      
      // Calculate simplistic volume (just count of people for now, or fetch deals)
      // Real volume requires sum of deals.
      
      return {
        ...node,
        children: enrichedChildren,
        volume: { 
          left: 0, // TODO: Implement real volume calc
          right: 0 
        }
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
    // 1. Get the child in that leg
    const [child] = await db.select().from(agents).where(and(
      eq(agents.placementId, agentId),
      eq(agents.leg, leg)
    ));
    
    if (!child) return 0;
    
    // 2. Get all deals for that child and THEIR descendants
    // Need a recursive "getAllDescendants" helper
    
    // Recursive volume collector
    const getVolumeForNode = async (nodeId: number): Promise<number> => {
       // Personal Volume
       const deals = await this.getDealsByAgent(nodeId);
       const personalVol = deals
         .filter(d => new Date(d.createdAt) >= startDate)
         .reduce((sum, d) => sum + Number(d.companyRevenue), 0);
         
       // Children Volume
       const children = await db.select().from(agents).where(eq(agents.placementId, nodeId));
       let childrenVol = 0;
       for (const c of children) {
         childrenVol += await getVolumeForNode(c.id);
       }
       
       return personalVol + childrenVol;
    };
    
    return getVolumeForNode(child.id);
  }

  // === DEALS ===

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [newDeal] = await db.insert(deals).values(deal).returning();
    return newDeal;
  }

  async getDealsByAgent(agentId: number): Promise<Deal[]> {
    return await db.select().from(deals).where(eq(deals.agentId, agentId)).orderBy(desc(deals.createdAt));
  }
  
  async getAllDeals(): Promise<Deal[]> {
    return await db.select().from(deals).orderBy(desc(deals.createdAt));
  }

  // === COMMISSIONS ===

  async createCommission(commission: typeof commissions.$inferInsert): Promise<Commission> {
    const [newComm] = await db.insert(commissions).values(commission).returning();
    return newComm;
  }

  async getCommissionsByAgent(agentId: number): Promise<Commission[]> {
    return await db.select().from(commissions).where(eq(commissions.agentId, agentId)).orderBy(desc(commissions.createdAt));
  }
  
  async getCommissionsStats(): Promise<{ totalEarned: number, pending: number, thisWeek: number }> {
    const all = await db.select().from(commissions);
    // In a real app, filter by authenticated user ID context or pass it in
    // This function signature assumes global stats or I need to refactor to take ID
    return { totalEarned: 0, pending: 0, thisWeek: 0 }; 
  }
}

export const storage = new DatabaseStorage();
