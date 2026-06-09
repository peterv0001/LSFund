import { describe, it, expect } from "vitest";
import {
  shouldShowAllNotificationsOffWarning,
  isSaveNotificationPrefsDisabled,
  type SubscriptionNotifPrefs,
} from "./notification-prefs";

const allOn: SubscriptionNotifPrefs = {
  emailOnPaused: true,
  emailOnCancelled: true,
  emailOnReactivated: true,
};

const allOff: SubscriptionNotifPrefs = {
  emailOnPaused: false,
  emailOnCancelled: false,
  emailOnReactivated: false,
};

describe("shouldShowAllNotificationsOffWarning", () => {
  it("is hidden when all three subscription toggles are on", () => {
    expect(shouldShowAllNotificationsOffWarning(allOn)).toBe(false);
  });

  it("is hidden when at least one toggle is on", () => {
    const keys: (keyof SubscriptionNotifPrefs)[] = [
      "emailOnPaused",
      "emailOnCancelled",
      "emailOnReactivated",
    ];

    for (const key of keys) {
      const prefs = { ...allOff, [key]: true };
      expect(shouldShowAllNotificationsOffWarning(prefs)).toBe(false);
    }
  });

  it("appears when all three subscription toggles (Paused, Cancelled, Reactivated) are off", () => {
    expect(shouldShowAllNotificationsOffWarning(allOff)).toBe(true);
  });

  it("disappears again once a toggle is turned back on", () => {
    expect(shouldShowAllNotificationsOffWarning(allOff)).toBe(true);
    const reactivated = { ...allOff, emailOnReactivated: true };
    expect(shouldShowAllNotificationsOffWarning(reactivated)).toBe(false);
  });
});

describe("isSaveNotificationPrefsDisabled", () => {
  it("keeps the Save button enabled while the warning is shown (not saving)", () => {
    expect(shouldShowAllNotificationsOffWarning(allOff)).toBe(true);
    expect(isSaveNotificationPrefsDisabled(false)).toBe(false);
  });

  it("disables the Save button only while a save is in progress", () => {
    expect(isSaveNotificationPrefsDisabled(true)).toBe(true);
  });
});
