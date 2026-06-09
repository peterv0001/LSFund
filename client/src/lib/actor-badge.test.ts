import { describe, it, expect } from "vitest";
import { getActorBadge, ACTOR_BADGE_STYLES } from "./action-styles";

describe("getActorBadge", () => {
  describe("admin actor", () => {
    it("returns the 'Admin' label for actorType 'admin'", () => {
      const badge = getActorBadge("admin");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("Admin");
    });

    it("returns purple styling classes for actorType 'admin'", () => {
      const badge = getActorBadge("admin");
      expect(badge?.className).toContain("bg-purple-100");
      expect(badge?.className).toContain("text-purple-700");
      expect(badge?.className).toContain("border-purple-200");
    });

    it("matches the ACTOR_BADGE_STYLES.admin entry exactly", () => {
      expect(getActorBadge("admin")).toEqual(ACTOR_BADGE_STYLES.admin);
    });

    it("does NOT use any blue (agent) classes for an admin badge", () => {
      const badge = getActorBadge("admin");
      expect(badge?.className).not.toContain("blue");
    });
  });

  describe("agent actor", () => {
    it("returns the 'Agent' label for actorType 'agent'", () => {
      const badge = getActorBadge("agent");
      expect(badge).not.toBeNull();
      expect(badge?.label).toBe("Agent");
    });

    it("returns blue styling classes for actorType 'agent'", () => {
      const badge = getActorBadge("agent");
      expect(badge?.className).toContain("bg-blue-100");
      expect(badge?.className).toContain("text-blue-700");
      expect(badge?.className).toContain("border-blue-200");
    });

    it("matches the ACTOR_BADGE_STYLES.agent entry exactly", () => {
      expect(getActorBadge("agent")).toEqual(ACTOR_BADGE_STYLES.agent);
    });

    it("does NOT use any purple (admin) classes for an agent badge", () => {
      const badge = getActorBadge("agent");
      expect(badge?.className).not.toContain("purple");
    });
  });

  describe("no actor type", () => {
    it("returns null (no badge) when actorType is null", () => {
      expect(getActorBadge(null)).toBeNull();
    });

    it("returns null (no badge) when actorType is undefined", () => {
      expect(getActorBadge(undefined)).toBeNull();
    });

    it("returns null (no badge) when actorType is an empty string", () => {
      expect(getActorBadge("")).toBeNull();
    });
  });

  describe("admin and agent badges are visually distinct", () => {
    it("admin and agent return different labels", () => {
      expect(getActorBadge("admin")?.label).not.toBe(getActorBadge("agent")?.label);
    });

    it("admin and agent return different class strings", () => {
      expect(getActorBadge("admin")?.className).not.toBe(
        getActorBadge("agent")?.className
      );
    });
  });
});
