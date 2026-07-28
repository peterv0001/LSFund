import { describe, it, expect } from "vitest";
import { getActionStyle, ACTION_STYLES, FALLBACK_STYLE, getActorBadge, ACTOR_BADGE_STYLES } from "./action-styles";

describe("getActionStyle", () => {
  describe("expire events", () => {
    it("returns orange color for action containing 'expire'", () => {
      const style = getActionStyle("expire");
      expect(style.color).toBe("text-orange-700");
    });

    it("returns orange dot for action containing 'expire'", () => {
      const style = getActionStyle("expire");
      expect(style.dot).toBe("bg-orange-500");
    });

    it("returns orange color for mixed-case 'Subscription Expired'", () => {
      const style = getActionStyle("Subscription Expired");
      expect(style.color).toBe("text-orange-700");
      expect(style.dot).toBe("bg-orange-500");
    });

    it("does NOT return gray fallback for expire events", () => {
      const style = getActionStyle("expire");
      expect(style.color).not.toBe(FALLBACK_STYLE.color);
      expect(style.dot).not.toBe(FALLBACK_STYLE.dot);
    });

    it("matches the ACTION_STYLES.expire entry exactly", () => {
      const style = getActionStyle("expire");
      expect(style).toEqual(ACTION_STYLES.expire);
    });
  });

  describe("gray fallback for unknown actions", () => {
    it("returns gray color for an unrecognized action", () => {
      const style = getActionStyle("unknown_action");
      expect(style.color).toBe("text-gray-600");
    });

    it("returns gray dot for an unrecognized action", () => {
      const style = getActionStyle("unknown_action");
      expect(style.dot).toBe("bg-gray-400");
    });

    it("gray fallback is NOT returned for expire events", () => {
      const expireStyle = getActionStyle("expire");
      const fallback = getActionStyle("unknown_action");
      expect(expireStyle).not.toEqual(fallback);
    });
  });

  describe("other action types", () => {
    it("returns green for create events", () => {
      const style = getActionStyle("create");
      expect(style.color).toBe("text-green-700");
      expect(style.dot).toBe("bg-green-500");
    });

    it("returns green for mixed-case 'Subscription Created'", () => {
      const style = getActionStyle("Subscription Created");
      expect(style.color).toBe("text-green-700");
      expect(style.dot).toBe("bg-green-500");
    });

    it("matches the ACTION_STYLES.create entry exactly", () => {
      const style = getActionStyle("create");
      expect(style).toEqual(ACTION_STYLES.create);
    });

    it("returns yellow for pause events", () => {
      const style = getActionStyle("pause");
      expect(style.color).toBe("text-yellow-700");
      expect(style.dot).toBe("bg-yellow-500");
    });

    it("returns yellow for mixed-case 'Subscription Paused'", () => {
      const style = getActionStyle("Subscription Paused");
      expect(style.color).toBe("text-yellow-700");
      expect(style.dot).toBe("bg-yellow-500");
    });

    it("matches the ACTION_STYLES.pause entry exactly", () => {
      const style = getActionStyle("pause");
      expect(style).toEqual(ACTION_STYLES.pause);
    });

    it("returns red for cancel events", () => {
      const style = getActionStyle("cancel");
      expect(style.color).toBe("text-red-700");
      expect(style.dot).toBe("bg-red-500");
    });

    it("returns red for mixed-case 'Subscription Cancelled'", () => {
      const style = getActionStyle("Subscription Cancelled");
      expect(style.color).toBe("text-red-700");
      expect(style.dot).toBe("bg-red-500");
    });

    it("matches the ACTION_STYLES.cancel entry exactly", () => {
      const style = getActionStyle("cancel");
      expect(style).toEqual(ACTION_STYLES.cancel);
    });

    it("returns blue for reactivate events", () => {
      const style = getActionStyle("reactivate");
      expect(style.color).toBe("text-blue-700");
      expect(style.dot).toBe("bg-blue-500");
    });

    it("returns blue for mixed-case 'Subscription Reactivated'", () => {
      const style = getActionStyle("Subscription Reactivated");
      expect(style.color).toBe("text-blue-700");
      expect(style.dot).toBe("bg-blue-500");
    });

    it("matches the ACTION_STYLES.reactivate entry exactly", () => {
      const style = getActionStyle("reactivate");
      expect(style).toEqual(ACTION_STYLES.reactivate);
    });
  });

  describe("named actions never use the gray fallback", () => {
    it.each(["create", "pause", "cancel", "reactivate"])(
      "does NOT return gray fallback for '%s'",
      (action) => {
        const style = getActionStyle(action);
        expect(style.color).not.toBe(FALLBACK_STYLE.color);
        expect(style.dot).not.toBe(FALLBACK_STYLE.dot);
      }
    );
  });
});

describe("getActorBadge", () => {
  describe("admin badge", () => {
    it("returns the admin badge for actorType 'admin'", () => {
      const badge = getActorBadge("admin");
      expect(badge).toEqual(ACTOR_BADGE_STYLES.admin);
    });

    it("returns purple className for admin", () => {
      const badge = getActorBadge("admin");
      expect(badge?.className).toContain("purple");
    });

    it("returns 'Admin' label for admin", () => {
      const badge = getActorBadge("admin");
      expect(badge?.label).toBe("Admin");
    });
  });

  describe("agent badge", () => {
    it("returns the agent badge for actorType 'agent'", () => {
      const badge = getActorBadge("agent");
      expect(badge).toEqual(ACTOR_BADGE_STYLES.agent);
    });

    it("returns blue className for agent", () => {
      const badge = getActorBadge("agent");
      expect(badge?.className).toContain("blue");
    });

    it("returns 'Agent' label for agent", () => {
      const badge = getActorBadge("agent");
      expect(badge?.label).toBe("Agent");
    });
  });

  describe("null / undefined inputs", () => {
    it("returns null for null actorType", () => {
      expect(getActorBadge(null)).toBeNull();
    });

    it("returns null for undefined actorType", () => {
      expect(getActorBadge(undefined)).toBeNull();
    });
  });

  describe("unrecognized actorType", () => {
    it("returns null for an unrecognized actorType", () => {
      expect(getActorBadge("superuser")).toBeNull();
    });

    it("returns null for an empty string actorType", () => {
      expect(getActorBadge("")).toBeNull();
    });
  });

  describe("admin vs agent are distinct", () => {
    it("admin and agent badges have different classNames", () => {
      expect(ACTOR_BADGE_STYLES.admin.className).not.toBe(
        ACTOR_BADGE_STYLES.agent.className
      );
    });

    it("admin and agent badges have different labels", () => {
      expect(ACTOR_BADGE_STYLES.admin.label).not.toBe(
        ACTOR_BADGE_STYLES.agent.label
      );
    });
  });
});
