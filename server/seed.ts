import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function mockHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedDatabase() {
  const agents = await storage.getAllAgents();
  if (agents.length > 0) return;

  console.log("Seeding database...");

  const password = await mockHash("password123");

  // 1. Root Agent (Partner + Admin)
  const root = await storage.createAgent({
    email: "admin@capital.com",
    password,
    firstName: "Admin",
    lastName: "User",
    currentRank: "partner",
    highestRank: "partner",
    isAdmin: true,
    isSuperAdmin: true,
    status: "active",
    sponsorId: null,
    placementId: null,
    leg: null
  });

  // 2. Left Leg (Director)
  const leftLeader = await storage.createAgent({
    email: "sarah@capital.com",
    password,
    firstName: "Sarah",
    lastName: "Director",
    currentRank: "director",
    highestRank: "director",
    isAdmin: false,
    isSuperAdmin: false,
    status: "active",
    sponsorId: root.id,
    placementId: root.id,
    leg: "left"
  });

  // 3. Right Leg (Leader)
  const rightLeader = await storage.createAgent({
    email: "mike@capital.com",
    password,
    firstName: "Mike",
    lastName: "Leader",
    currentRank: "leader",
    highestRank: "leader",
    isAdmin: false,
    isSuperAdmin: false,
    status: "active",
    sponsorId: root.id,
    placementId: root.id,
    leg: "right"
  });

  // 4. Downline under Sarah (Left)
  const agent4 = await storage.createAgent({
    email: "john@capital.com",
    password,
    firstName: "John",
    lastName: "Builder",
    currentRank: "builder",
    highestRank: "builder",
    sponsorId: leftLeader.id,
    placementId: leftLeader.id,
    leg: "left",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false
  });

  // 5. Downline under Mike (Right)
  const agent5 = await storage.createAgent({
    email: "lisa@capital.com",
    password,
    firstName: "Lisa",
    lastName: "Agent",
    currentRank: "agent",
    highestRank: "agent",
    sponsorId: rightLeader.id,
    placementId: rightLeader.id,
    leg: "right",
    status: "active",
    isAdmin: false,
    isSuperAdmin: false
  });

  // 6. Create some Deals
  const deal1 = await storage.createDeal({
    agentId: agent4.id,
    merchantName: "Joe's Pizza",
    merchantEmail: null,
    merchantPhone: null,
    loanAmount: "50000",
    companyRevenue: "5000",
    status: "funded",
    notes: null,
    approvedById: null,
    fundedAt: new Date()
  });

  const deal2 = await storage.createDeal({
    agentId: agent5.id,
    merchantName: "Tech Startup Inc",
    merchantEmail: null,
    merchantPhone: null,
    loanAmount: "25000",
    companyRevenue: "2500",
    status: "funded",
    notes: null,
    approvedById: null,
    fundedAt: new Date()
  });
  
  // 7. Create some Commissions
  await storage.createCommission({
    agentId: agent4.id,
    type: "personal_deal",
    amount: "2000",
    dealId: deal1.id,
    sourceAgentId: null,
    periodDate: new Date().toISOString().split('T')[0],
    periodWeekStart: null,
    status: "pending"
  });

  await storage.createCommission({
    agentId: agent5.id,
    type: "personal_deal",
    amount: "1000",
    dealId: deal2.id,
    sourceAgentId: null,
    periodDate: new Date().toISOString().split('T')[0],
    periodWeekStart: null,
    status: "pending"
  });

  // Override for Sarah (Director gets 15% of G1)
  await storage.createCommission({
    agentId: leftLeader.id,
    type: "generation_override",
    amount: "300",
    dealId: deal1.id,
    sourceAgentId: agent4.id,
    periodDate: new Date().toISOString().split('T')[0],
    periodWeekStart: null,
    status: "pending"
  });
  
  console.log("Database seeded with sample data!");
}
