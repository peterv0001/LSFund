import { describe, it, expect } from "vitest";
import { getActionStyle, ACTION_STYLES, FALLBACK_STYLE } from "./action-styles";

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

    it("returns red for cancel events", () => {
      const style = getActionStyle("cancel");
      expect(style.color).toBe("text-red-700");
      expect(style.dot).toBe("bg-red-500");
    });
  });
});
