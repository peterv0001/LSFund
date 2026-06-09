import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Seed course modules independently (can run even if agents exist)
async function seedCourseModules() {
  try {
    const existingModules = await storage.getCourseModules();
    if (existingModules.length > 0) {
      console.log(`Course modules already exist (${existingModules.length} modules)`);
      return;
    }

    console.log("Seeding course modules...");

    const courseModulesData = [
      {
        moduleNumber: 1,
        title: "MCA Fundamentals",
        description: "Understanding merchant cash advance - what it is, key terms, transaction flow, and how you earn commissions.",
        videoUrl: "https://www.youtube.com/embed/V_yT4AVwAgU",
        durationSeconds: 662,
        slideCount: 16,
        isPublished: true,
        sortOrder: 1,
      },
      {
        moduleNumber: 2,
        title: "Finding Leads",
        description: "How to find and attract MCA leads - warm markets, online marketing, referral systems, and UCC lead strategies.",
        videoUrl: "https://www.youtube.com/embed/MhipHRWbC3s",
        durationSeconds: 281,
        slideCount: 9,
        isPublished: true,
        sortOrder: 2,
      },
      {
        moduleNumber: 3,
        title: "Qualifying Deals",
        description: "How to qualify MCA deals - pre-screening questions, documentation requirements, and identifying deal-killers early.",
        videoUrl: "https://www.youtube.com/embed/nVYX551fOKE",
        durationSeconds: 376,
        slideCount: 12,
        isPublished: true,
        sortOrder: 3,
      },
      {
        moduleNumber: 4,
        title: "Submission Process",
        description: "Step-by-step guide to submitting MCA deals - portal walkthrough, document uploads, and getting quick approvals.",
        videoUrl: "https://www.youtube.com/embed/MpJD_2DJC5I",
        durationSeconds: 252,
        slideCount: 8,
        isPublished: true,
        sortOrder: 4,
      },
      {
        moduleNumber: 5,
        title: "Managing Your Pipeline",
        description: "Track and manage your deals from submission to funding - pipeline stages, follow-up strategies, and maximizing close rates.",
        videoUrl: "https://www.youtube.com/embed/VOtLffd7gbs",
        durationSeconds: 217,
        slideCount: 7,
        isPublished: true,
        sortOrder: 5,
      },
      {
        moduleNumber: 6,
        title: "Scaling Your Business",
        description: "Build a sustainable MCA business - recruiting partners, building systems, and creating passive income through team development.",
        videoUrl: "https://www.youtube.com/embed/zAIoJ0x5A70",
        durationSeconds: 242,
        slideCount: 8,
        isPublished: true,
        sortOrder: 6,
      },
    ];

    for (const module of courseModulesData) {
      await storage.createCourseModule(module);
    }

    console.log("Course modules seeded successfully!");
  } catch (error) {
    console.error("Error seeding course modules:", error);
  }
}

async function mockHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedDatabase() {
  // Always seed course modules if they don't exist
  await seedCourseModules();
  
  const agents = await storage.getAllAgents();
  if (agents.length > 0) return;

  console.log("Seeding database...");

  const password = await mockHash("password123");

  // 1. Root Agent (Partner + Admin)
  const root = await storage.createAgent({
    email: "admin@psl.capital",
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
    email: "sarah@leadershieldfunding.com",
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
    email: "mike@leadershieldfunding.com",
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
    email: "john@leadershieldfunding.com",
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
    email: "lisa@leadershieldfunding.com",
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
  
  // 8. Seed Training Resources (MCA Mastery Course)
  const trainingVideos = [
    {
      title: "Module 1: MCA Fundamentals",
      description: "Understanding merchant cash advance - what it is, key terms, transaction flow, and how you earn commissions.",
      type: "video" as const,
      url: "https://youtu.be/V_yT4AVwAgU",
      thumbnailUrl: null,
      category: "training",
      sortOrder: 1,
      isPublished: true,
      createdById: root.id
    },
    {
      title: "Module 2: Finding Leads",
      description: "How to find and attract MCA leads - warm markets, online marketing, referral systems, and UCC lead strategies.",
      type: "video" as const,
      url: "https://youtu.be/MhipHRWbC3s",
      thumbnailUrl: null,
      category: "training",
      sortOrder: 2,
      isPublished: true,
      createdById: root.id
    },
    {
      title: "Module 3: Qualifying Deals",
      description: "How to qualify MCA deals - pre-screening questions, documentation requirements, and identifying deal-killers early.",
      type: "video" as const,
      url: "https://youtu.be/nVYX551fOKE",
      thumbnailUrl: null,
      category: "training",
      sortOrder: 3,
      isPublished: true,
      createdById: root.id
    },
    {
      title: "Module 4: Submission Process",
      description: "Step-by-step guide to submitting MCA deals - portal walkthrough, document uploads, and getting quick approvals.",
      type: "video" as const,
      url: "https://youtu.be/MpJD_2DJC5I",
      thumbnailUrl: null,
      category: "training",
      sortOrder: 4,
      isPublished: true,
      createdById: root.id
    },
    {
      title: "Module 5: Managing Your Pipeline",
      description: "Track and manage your deals from submission to funding - pipeline stages, follow-up strategies, and maximizing close rates.",
      type: "video" as const,
      url: "https://youtu.be/VOtLffd7gbs",
      thumbnailUrl: null,
      category: "training",
      sortOrder: 5,
      isPublished: true,
      createdById: root.id
    },
    {
      title: "Module 6: Scaling Your Business",
      description: "Build a sustainable MCA business - recruiting partners, building systems, and creating passive income through team development.",
      type: "video" as const,
      url: "https://youtu.be/zAIoJ0x5A70",
      thumbnailUrl: null,
      category: "training",
      sortOrder: 6,
      isPublished: true,
      createdById: root.id
    }
  ];

  for (const video of trainingVideos) {
    await storage.createResource(video);
  }

  // 9. Seed Course Modules (for progress tracking)
  const courseModulesData = [
    {
      moduleNumber: 1,
      title: "MCA Fundamentals",
      description: "Understanding merchant cash advance - what it is, key terms, transaction flow, and how you earn commissions.",
      videoUrl: "https://www.youtube.com/embed/V_yT4AVwAgU",
      durationSeconds: 662, // 11:02
      slideCount: 16,
      isPublished: true,
      sortOrder: 1,
    },
    {
      moduleNumber: 2,
      title: "Finding Leads",
      description: "How to find and attract MCA leads - warm markets, online marketing, referral systems, and UCC lead strategies.",
      videoUrl: "https://www.youtube.com/embed/MhipHRWbC3s",
      durationSeconds: 281, // 4:41
      slideCount: 9,
      isPublished: true,
      sortOrder: 2,
    },
    {
      moduleNumber: 3,
      title: "Qualifying Deals",
      description: "How to qualify MCA deals - pre-screening questions, documentation requirements, and identifying deal-killers early.",
      videoUrl: "https://www.youtube.com/embed/nVYX551fOKE",
      durationSeconds: 376, // 6:16
      slideCount: 12,
      isPublished: true,
      sortOrder: 3,
    },
    {
      moduleNumber: 4,
      title: "Submission Process",
      description: "Step-by-step guide to submitting MCA deals - portal walkthrough, document uploads, and getting quick approvals.",
      videoUrl: "https://www.youtube.com/embed/MpJD_2DJC5I",
      durationSeconds: 252, // 4:12
      slideCount: 8,
      isPublished: true,
      sortOrder: 4,
    },
    {
      moduleNumber: 5,
      title: "Managing Your Pipeline",
      description: "Track and manage your deals from submission to funding - pipeline stages, follow-up strategies, and maximizing close rates.",
      videoUrl: "https://www.youtube.com/embed/VOtLffd7gbs",
      durationSeconds: 217, // 3:37
      slideCount: 7,
      isPublished: true,
      sortOrder: 5,
    },
    {
      moduleNumber: 6,
      title: "Scaling Your Business",
      description: "Build a sustainable MCA business - recruiting partners, building systems, and creating passive income through team development.",
      videoUrl: "https://www.youtube.com/embed/zAIoJ0x5A70",
      durationSeconds: 242, // 4:02
      slideCount: 8,
      isPublished: true,
      sortOrder: 6,
    },
  ];

  for (const module of courseModulesData) {
    await storage.createCourseModule(module);
  }

  console.log("Database seeded with sample data!");
}
