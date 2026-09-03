import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import { createServer } from "http";

describe("Session secret validation", () => {
  let originalEnv: { SESSION_SECRET?: string; NODE_ENV?: string };

  beforeEach(() => {
    // Save original env vars
    originalEnv = {
      SESSION_SECRET: process.env.SESSION_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    };
  });

  afterEach(() => {
    // Restore original env vars
    if (originalEnv.SESSION_SECRET !== undefined) {
      process.env.SESSION_SECRET = originalEnv.SESSION_SECRET;
    } else {
      delete process.env.SESSION_SECRET;
    }
    if (originalEnv.NODE_ENV !== undefined) {
      process.env.NODE_ENV = originalEnv.NODE_ENV;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  it("should throw when SESSION_SECRET is missing in production", async () => {
    // Arrange: Set NODE_ENV to production and clear SESSION_SECRET
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    const testApp = express();
    const httpServer = createServer(testApp);

    // Act & Assert: Import and call registerRoutes should throw
    const { registerRoutes } = await import("./routes.js");
    
    await expect(async () => {
      await registerRoutes(httpServer, testApp);
    }).rejects.toThrow(/SESSION_SECRET environment variable is required in production/);
  });

  it("should allow missing SESSION_SECRET in development", async () => {
    // Arrange: Set NODE_ENV to development and clear SESSION_SECRET
    process.env.NODE_ENV = "development";
    delete process.env.SESSION_SECRET;

    const testApp = express();
    const httpServer = createServer(testApp);

    // Act & Assert: Should not throw
    const { registerRoutes } = await import("./routes.js");
    
    await expect(async () => {
      await registerRoutes(httpServer, testApp);
    }).resolves.not.toThrow();
  });

  it("should allow missing SESSION_SECRET when NODE_ENV is not set", async () => {
    // Arrange: Clear both NODE_ENV and SESSION_SECRET (simulates local dev)
    delete process.env.NODE_ENV;
    delete process.env.SESSION_SECRET;

    const testApp = express();
    const httpServer = createServer(testApp);

    // Act & Assert: Should not throw (treats unset NODE_ENV as non-production)
    const { registerRoutes } = await import("./routes.js");
    
    await expect(async () => {
      await registerRoutes(httpServer, testApp);
    }).resolves.not.toThrow();
  });

  it("should succeed when SESSION_SECRET is set in production", async () => {
    // Arrange: Set NODE_ENV to production and provide a SESSION_SECRET
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "secure-production-secret-for-testing";

    const testApp = express();
    const httpServer = createServer(testApp);

    // Act & Assert: Should not throw
    const { registerRoutes } = await import("./routes.js");
    
    await expect(async () => {
      await registerRoutes(httpServer, testApp);
    }).resolves.not.toThrow();
  });
});
