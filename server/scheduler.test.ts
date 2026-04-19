import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage.js", () => ({
  storage: {
    getSubscriptionsDueForExpiry: vi.fn(),
    updateSubscriptionStatus: vi.fn(),
    getAgent: vi.fn(),
    createNotification: vi.fn(),
    logActivity: vi.fn(),
  },
}));

vi.mock("./email.js", () => ({
  emailService: {
    sendSubscriptionExpiredEmail: vi.fn(),
  },
}));

import { storage } from "./storage.js";
import { emailService } from "./email.js";
import { expireOverdueSubscriptions, EXPIRY_CHECK_INTERVAL_MS } from "./scheduler.js";

const mockStorage = storage as {
  getSubscriptionsDueForExpiry: ReturnType<typeof vi.fn>;
  updateSubscriptionStatus: ReturnType<typeof vi.fn>;
  getAgent: ReturnType<typeof vi.fn>;
  createNotification: ReturnType<typeof vi.fn>;
  logActivity: ReturnType<typeof vi.fn>;
};

const mockEmailService = emailService as {
  sendSubscriptionExpiredEmail: ReturnType<typeof vi.fn>;
};

const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

const mockAgent = {
  id: 1,
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
};

const makeSubscription = (overrides: object = {}) => ({
  id: 100,
  agentId: 1,
  merchantName: "Acme Corp",
  tier: "tier_1",
  monthlyAmount: "199.00",
  status: "active",
  endDate: pastDate,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.updateSubscriptionStatus.mockResolvedValue({});
  mockStorage.getAgent.mockResolvedValue(mockAgent);
  mockStorage.createNotification.mockResolvedValue({});
  mockStorage.logActivity.mockResolvedValue({});
  mockEmailService.sendSubscriptionExpiredEmail.mockResolvedValue({});
});

// =========================================================
// expireOverdueSubscriptions — no-op when queue is empty
// =========================================================

describe("expireOverdueSubscriptions – no subscriptions due", () => {
  it("does nothing when getSubscriptionsDueForExpiry returns an empty array", async () => {
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([]);

    await expireOverdueSubscriptions();

    expect(mockStorage.updateSubscriptionStatus).not.toHaveBeenCalled();
    expect(mockStorage.getAgent).not.toHaveBeenCalled();
    expect(mockEmailService.sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
  });
});

// =========================================================
// expireOverdueSubscriptions — active subscription expires
// =========================================================

describe("expireOverdueSubscriptions – active subscription with past endDate", () => {
  it("transitions the subscription status to 'expired'", async () => {
    const sub = makeSubscription({ status: "active" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);

    await expireOverdueSubscriptions();

    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledOnce();
    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledWith(sub.id, "expired");
  });

  it("looks up the agent for the expired subscription", async () => {
    const sub = makeSubscription({ status: "active" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);

    await expireOverdueSubscriptions();

    expect(mockStorage.getAgent).toHaveBeenCalledOnce();
    expect(mockStorage.getAgent).toHaveBeenCalledWith(sub.agentId);
  });

  it("creates an in-app notification for the agent", async () => {
    const sub = makeSubscription({ status: "active" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);

    await expireOverdueSubscriptions();

    expect(mockStorage.createNotification).toHaveBeenCalledOnce();
    const [notifArg] = mockStorage.createNotification.mock.calls[0];
    expect(notifArg.agentId).toBe(sub.agentId);
    expect(notifArg.type).toBe("system");
    expect(notifArg.title).toContain(sub.merchantName);
  });

  it("sends an expiry email to the agent", async () => {
    const sub = makeSubscription({ status: "active" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);

    await expireOverdueSubscriptions();

    expect(mockEmailService.sendSubscriptionExpiredEmail).toHaveBeenCalledOnce();
    const [emailAddr, emailData] = mockEmailService.sendSubscriptionExpiredEmail.mock.calls[0];
    expect(emailAddr).toBe(mockAgent.email);
    expect(emailData.firstName).toBe(mockAgent.firstName);
    expect(emailData.merchantName).toBe(sub.merchantName);
  });

  it("logs a system activity entry with actorId 0 and actorType 'system'", async () => {
    const sub = makeSubscription({ status: "active" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);

    await expireOverdueSubscriptions();

    expect(mockStorage.logActivity).toHaveBeenCalledOnce();
    const [logArg] = mockStorage.logActivity.mock.calls[0];
    expect(logArg.actorId).toBe(0);
    expect(logArg.actorType).toBe("system");
    expect(logArg.entityId).toBe(sub.id);
    expect(logArg.details.newStatus).toBe("expired");
    expect(logArg.details.previousStatus).toBe(sub.status);
  });
});

// =========================================================
// expireOverdueSubscriptions — paused subscription expires
// =========================================================

describe("expireOverdueSubscriptions – paused subscription with past endDate", () => {
  it("transitions a paused subscription to 'expired'", async () => {
    const sub = makeSubscription({ status: "paused" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);

    await expireOverdueSubscriptions();

    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledWith(sub.id, "expired");
  });

  it("records the previous status as 'paused' in the activity log details", async () => {
    const sub = makeSubscription({ status: "paused" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);

    await expireOverdueSubscriptions();

    const [logArg] = mockStorage.logActivity.mock.calls[0];
    expect(logArg.details.previousStatus).toBe("paused");
  });
});

// =========================================================
// expireOverdueSubscriptions — multiple subscriptions
// =========================================================

describe("expireOverdueSubscriptions – multiple subscriptions due", () => {
  it("processes every subscription returned by the storage query", async () => {
    const sub1 = makeSubscription({ id: 101, agentId: 1, merchantName: "Alpha Inc" });
    const sub2 = makeSubscription({ id: 102, agentId: 2, merchantName: "Beta LLC" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub1, sub2]);

    await expireOverdueSubscriptions();

    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledTimes(2);
    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledWith(sub1.id, "expired");
    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledWith(sub2.id, "expired");
    expect(mockEmailService.sendSubscriptionExpiredEmail).toHaveBeenCalledTimes(2);
  });
});

// =========================================================
// expireOverdueSubscriptions — missing agent guard
// =========================================================

describe("expireOverdueSubscriptions – agent not found", () => {
  it("skips notification and email when the agent cannot be resolved", async () => {
    const sub = makeSubscription({ status: "active" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub]);
    mockStorage.getAgent.mockResolvedValue(null);

    await expireOverdueSubscriptions();

    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledWith(sub.id, "expired");
    expect(mockStorage.createNotification).not.toHaveBeenCalled();
    expect(mockEmailService.sendSubscriptionExpiredEmail).not.toHaveBeenCalled();
  });
});

// =========================================================
// EXPIRY_CHECK_INTERVAL_MS — configurable via env var
// =========================================================

describe("EXPIRY_CHECK_INTERVAL_MS – default value", () => {
  it("defaults to 3 600 000 ms (1 hour) when EXPIRY_CHECK_INTERVAL_MS env var is not set", async () => {
    const saved = process.env.EXPIRY_CHECK_INTERVAL_MS;
    delete process.env.EXPIRY_CHECK_INTERVAL_MS;
    vi.resetModules();
    const { EXPIRY_CHECK_INTERVAL_MS: interval } = await import("./scheduler.js");
    expect(interval).toBe(3_600_000);
    if (saved !== undefined) {
      process.env.EXPIRY_CHECK_INTERVAL_MS = saved;
    }
    vi.resetModules();
  });

  it("uses the env var value when EXPIRY_CHECK_INTERVAL_MS is set", async () => {
    process.env.EXPIRY_CHECK_INTERVAL_MS = "30000";
    vi.resetModules();
    const { EXPIRY_CHECK_INTERVAL_MS: interval } = await import("./scheduler.js");
    expect(interval).toBe(30_000);
    delete process.env.EXPIRY_CHECK_INTERVAL_MS;
    vi.resetModules();
  });
});

// =========================================================
// expireOverdueSubscriptions — side-effect failures are non-fatal
// =========================================================

describe("expireOverdueSubscriptions – side-effect errors do not abort the run", () => {
  it("continues processing remaining subscriptions even if notification creation throws", async () => {
    const sub1 = makeSubscription({ id: 201, merchantName: "Failing Corp" });
    const sub2 = makeSubscription({ id: 202, merchantName: "Healthy LLC" });
    mockStorage.getSubscriptionsDueForExpiry.mockResolvedValue([sub1, sub2]);
    mockStorage.createNotification
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockResolvedValue({});

    await expireOverdueSubscriptions();

    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledTimes(2);
    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledWith(sub1.id, "expired");
    expect(mockStorage.updateSubscriptionStatus).toHaveBeenCalledWith(sub2.id, "expired");
  });
});
