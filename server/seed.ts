import { storage } from "./storage";
import { hashPassword } from "./routes"; // Need to export hashPassword or move it to utils
// Moving hashPassword to a utils file would be cleaner, but for now I'll duplicate or just use a fixed hash for seed
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

  // 1. Root Agent (Partner)
  const root = await storage.createAgent({
    email: "admin@capital.com",
    password,
    firstName: "Admin",
    lastName: "User",
    currentRank: "partner",
    isAdmin: true,
    status: "active",
    sponsorId: null,
    placementId: null,
    leg: null
  });

  // 2. Left Leg Leader (Director)
  const leftLeader = await storage.createAgent({
    email: "sarah@capital.com",
    password,
    firstName: "Sarah",
    lastName: "Director",
    currentRank: "director",
    isAdmin: false,
    status: "active",
    sponsorId: root.id,
    placementId: root.id,
    leg: "left"
  });

  // 3. Right Leg Leader (Leader)
  const rightLeader = await storage.createAgent({
    email: "mike@capital.com",
    password,
    firstName: "Mike",
    lastName: "Leader",
    currentRank: "leader",
    isAdmin: false,
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
    sponsorId: leftLeader.id,
    placementId: leftLeader.id,
    leg: "left",
    status: "active",
    isAdmin: false
  });

  // 5. Downline under Mike (Right)
  const agent5 = await storage.createAgent({
    email: "lisa@capital.com",
    password,
    firstName: "Lisa",
    lastName: "Agent",
    currentRank: "agent",
    sponsorId: rightLeader.id,
    placementId: rightLeader.id,
    leg: "right",
    status: "active",
    isAdmin: false
  });

  // 6. Create some Deals
  await storage.createDeal({
    agentId: agent4.id, // John
    merchantName: "Joe's Pizza",
    loanAmount: "50000",
    companyRevenue: "5000",
    status: "funded",
    fundedAt: new Date()
  });

  await storage.createDeal({
    agentId: agent5.id, // Lisa
    merchantName: "Tech Startup Inc",
    loanAmount: "25000",
    companyRevenue: "2500",
    status: "funded",
    fundedAt: new Date()
  });
  
  // 7. Create some Commissions
  await storage.createCommission({
    agentId: agent4.id,
    type: "personal_deal",
    amount: "2000", // 40% of 5000
    dealId: 1, // approximate
    periodDate: new Date(),
    status: "pending"
  });
  
  console.log("Database seeded!");
}
