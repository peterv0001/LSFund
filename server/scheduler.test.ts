import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage.js", () => ({
  storage: {
    getSubscriptionsDueForExpiry: vi.fn(),
    updateSubscriptionStatus: vi.fn(),
    getAgent: vi.fn(),
    createNotification: vi.fn(),
    logActivity: vi.fn(),
    getPlatformSetting: vi.fn(),
    getSubscriptionsDueForWarning: vi.fn(),
    markSubscriptionWarningSent: vi.fn(),
  },
}));

vi.mock("./email.js", () => ({
  emailService: {
    sendSubscriptionExpiredEmail: vi.fn(),
    sendSubscriptionExpiringWarningEmail: vi.fn(),
  },
}));

import { storage } from "./storage.js";
import { emailService } from "./email.js";
import {
  expireOverdueSubscriptions,
  warnUpcomingExpirations,
  EXPIRY_CHECK_INTERVAL_MS,
} from "./scheduler.js";

const mockStorage = storage as {
  getSubscriptionsDueForExpiry: ReturnType<typeof vi.fn>;
  updateSubscriptionStatus: ReturnType<typeof vi.fn>;
  getAgent: ReturnType<typeof vi.fn>;
  createNotification: ReturnType<typeof vi.fn>;
  logActivity: ReturnType<typeof vi.fn>;
  getPlatformSetting: ReturnType<typeof vi.fn>;
  getSubscriptionsDueForWarning: ReturnType<typeof vi.fn>;
  markSubscriptionWarningSent: ReturnType<typeof vi.fn>;
};

const mockEmailService = emailService as {
  sendSubscriptionExpiredEmail: ReturnType<typeof vi.fn>;
  sendSubscriptionExpiringWarningEmail: ReturnType<typeof vi.fn>;
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
  mockStorage.getPlatformSetting.mockResolvedValue(undefined);
  mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([]);
  mockStorage.markSubscriptionWarningSent.mockResolvedValue(undefined);
  mockEmailService.sendSubscriptionExpiredEmail.mockResolvedValue({});
  mockEmailService.sendSubscriptionExpiringWarningEmail.mockResolvedValue({});
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

// =========================================================
// warnUpcomingExpirations — helpers
// =========================================================

const futureDate = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const makeWarningSubscription = (overrides: object = {}) => ({
  id: 300,
  agentId: 1,
  merchantName: "Acme Corp",
  tier: "tier_1",
  monthlyAmount: "199.00",
  status: "active",
  endDate: futureDate(7),
  expiryWarningSentAt: null,
  ...overrides,
});

// =========================================================
// warnUpcomingExpirations — no-op when queue is empty
// =========================================================

describe("warnUpcomingExpirations – no subscriptions due", () => {
  it("does nothing when getSubscriptionsDueForWarning returns an empty array", async () => {
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([]);

    await warnUpcomingExpirations();

    expect(mockStorage.getAgent).not.toHaveBeenCalled();
    expect(mockStorage.createNotification).not.toHaveBeenCalled();
    expect(mockEmailService.sendSubscriptionExpiringWarningEmail).not.toHaveBeenCalled();
    expect(mockStorage.markSubscriptionWarningSent).not.toHaveBeenCalled();
  });
});

// =========================================================
// warnUpcomingExpirations — warning window days resolution
// =========================================================

describe("warnUpcomingExpirations – warning window days", () => {
  it("defaults to 7 days when the platform setting is not configured", async () => {
    mockStorage.getPlatformSetting.mockResolvedValue(undefined);
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([]);

    await warnUpcomingExpirations();

    expect(mockStorage.getSubscriptionsDueForWarning).toHaveBeenCalledWith(7);
  });

  it("uses the configured platform setting value when present", async () => {
    mockStorage.getPlatformSetting.mockResolvedValue(14);
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([]);

    await warnUpcomingExpirations();

    expect(mockStorage.getSubscriptionsDueForWarning).toHaveBeenCalledWith(14);
  });

  it("clamps an out-of-range setting up to the maximum of 90 days", async () => {
    mockStorage.getPlatformSetting.mockResolvedValue(200);
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([]);

    await warnUpcomingExpirations();

    expect(mockStorage.getSubscriptionsDueForWarning).toHaveBeenCalledWith(90);
  });

  it("clamps an out-of-range setting up to the minimum of 1 day", async () => {
    mockStorage.getPlatformSetting.mockResolvedValue(0);
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([]);

    await warnUpcomingExpirations();

    expect(mockStorage.getSubscriptionsDueForWarning).toHaveBeenCalledWith(1);
  });

  it("rounds a fractional setting to the nearest whole day", async () => {
    mockStorage.getPlatformSetting.mockResolvedValue(5.6);
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([]);

    await warnUpcomingExpirations();

    expect(mockStorage.getSubscriptionsDueForWarning).toHaveBeenCalledWith(6);
  });
});

// =========================================================
// warnUpcomingExpirations — sends warning for a due subscription
// =========================================================

describe("warnUpcomingExpirations – subscription expiring soon", () => {
  it("looks up the agent for the warning subscription", async () => {
    const sub = makeWarningSubscription();
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub]);

    await warnUpcomingExpirations();

    expect(mockStorage.getAgent).toHaveBeenCalledWith(sub.agentId);
  });

  it("creates an in-app warning notification for the agent", async () => {
    const sub = makeWarningSubscription();
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub]);

    await warnUpcomingExpirations();

    expect(mockStorage.createNotification).toHaveBeenCalledOnce();
    const [notifArg] = mockStorage.createNotification.mock.calls[0];
    expect(notifArg.agentId).toBe(sub.agentId);
    expect(notifArg.type).toBe("system");
    expect(notifArg.title).toContain(sub.merchantName);
    expect(notifArg.message).toMatch(/expires/i);
  });

  it("sends a warning email to the agent", async () => {
    const sub = makeWarningSubscription();
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub]);

    await warnUpcomingExpirations();

    expect(mockEmailService.sendSubscriptionExpiringWarningEmail).toHaveBeenCalledOnce();
    const [emailAddr, emailData] =
      mockEmailService.sendSubscriptionExpiringWarningEmail.mock.calls[0];
    expect(emailAddr).toBe(mockAgent.email);
    expect(emailData.firstName).toBe(mockAgent.firstName);
    expect(emailData.merchantName).toBe(sub.merchantName);
    expect(typeof emailData.daysUntilExpiry).toBe("number");
  });

  it("marks the warning as sent so it is not repeated", async () => {
    const sub = makeWarningSubscription();
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub]);

    await warnUpcomingExpirations();

    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledOnce();
    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledWith(sub.id);
  });
});

// =========================================================
// warnUpcomingExpirations — respects per-agent email preference
// =========================================================

describe("warnUpcomingExpirations – email preference handling", () => {
  it("skips the warning email when the agent opted out via emailOnExpiryWarning=false", async () => {
    const sub = makeWarningSubscription();
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub]);
    mockStorage.getAgent.mockResolvedValue({
      ...mockAgent,
      emailPreferences: { emailOnExpiryWarning: false },
    });

    await warnUpcomingExpirations();

    expect(mockEmailService.sendSubscriptionExpiringWarningEmail).not.toHaveBeenCalled();
    // The in-app notification and the sent-marker should still fire.
    expect(mockStorage.createNotification).toHaveBeenCalledOnce();
    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledWith(sub.id);
  });

  it("sends the warning email when the preference is unset (defaults to opted-in)", async () => {
    const sub = makeWarningSubscription();
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub]);
    mockStorage.getAgent.mockResolvedValue({ ...mockAgent, emailPreferences: {} });

    await warnUpcomingExpirations();

    expect(mockEmailService.sendSubscriptionExpiringWarningEmail).toHaveBeenCalledOnce();
  });
});

// =========================================================
// warnUpcomingExpirations — missing agent guard
// =========================================================

describe("warnUpcomingExpirations – agent not found", () => {
  it("skips notification, email, and sent-marker when the agent cannot be resolved", async () => {
    const sub = makeWarningSubscription();
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub]);
    mockStorage.getAgent.mockResolvedValue(null);

    await warnUpcomingExpirations();

    expect(mockStorage.createNotification).not.toHaveBeenCalled();
    expect(mockEmailService.sendSubscriptionExpiringWarningEmail).not.toHaveBeenCalled();
    expect(mockStorage.markSubscriptionWarningSent).not.toHaveBeenCalled();
  });
});

// =========================================================
// warnUpcomingExpirations — multiple subscriptions
// =========================================================

describe("warnUpcomingExpirations – multiple subscriptions due", () => {
  it("marks every due subscription as warned exactly once", async () => {
    const sub1 = makeWarningSubscription({ id: 301, agentId: 1, merchantName: "Alpha Inc" });
    const sub2 = makeWarningSubscription({ id: 302, agentId: 2, merchantName: "Beta LLC" });
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub1, sub2]);

    await warnUpcomingExpirations();

    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledTimes(2);
    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledWith(sub1.id);
    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledWith(sub2.id);
    expect(mockEmailService.sendSubscriptionExpiringWarningEmail).toHaveBeenCalledTimes(2);
  });
});

// =========================================================
// warnUpcomingExpirations — per-subscription failures are non-fatal
// =========================================================

describe("warnUpcomingExpirations – per-subscription errors do not abort the run", () => {
  it("continues to the next subscription if marking one as warned throws", async () => {
    const sub1 = makeWarningSubscription({ id: 311, merchantName: "Failing Corp" });
    const sub2 = makeWarningSubscription({ id: 312, merchantName: "Healthy LLC" });
    mockStorage.getSubscriptionsDueForWarning.mockResolvedValue([sub1, sub2]);
    mockStorage.markSubscriptionWarningSent
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockResolvedValue(undefined);

    await warnUpcomingExpirations();

    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledTimes(2);
    expect(mockStorage.markSubscriptionWarningSent).toHaveBeenCalledWith(sub2.id);
  });
});
