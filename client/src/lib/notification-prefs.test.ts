import { describe, it, expect } from "vitest";
import {
  shouldShowAllNotificationsOffWarning,
  isSaveNotificationPrefsDisabled,
  requestToggleChange,
  confirmPendingDisable,
  cancelPendingDisable,
  type SubscriptionNotifPrefs,
  type ToggleGateState,
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

type Key = keyof SubscriptionNotifPrefs;

const initialState: ToggleGateState<Key> = {
  prefs: { ...allOn },
  pendingDisable: null,
};

describe("disable-confirmation gating", () => {
  const keys: Key[] = ["emailOnPaused", "emailOnCancelled", "emailOnReactivated"];

  it("requesting to turn a toggle off does not change the preference, only opens the dialog", () => {
    for (const key of keys) {
      const next = requestToggleChange(initialState, key, false);
      expect(next.prefs[key]).toBe(true);
      expect(next.prefs).toEqual(allOn);
      expect(next.pendingDisable).toBe(key);
    }
  });

  it("confirming the dialog turns the preference off and closes the dialog", () => {
    for (const key of keys) {
      const pending = requestToggleChange(initialState, key, false);
      const next = confirmPendingDisable(pending);
      expect(next.prefs[key]).toBe(false);
      expect(next.pendingDisable).toBeNull();
      const others = keys.filter((k) => k !== key);
      for (const other of others) expect(next.prefs[other]).toBe(true);
    }
  });

  it("cancelling the dialog leaves the preference on and closes the dialog", () => {
    for (const key of keys) {
      const pending = requestToggleChange(initialState, key, false);
      const next = cancelPendingDisable(pending);
      expect(next.prefs[key]).toBe(true);
      expect(next.prefs).toEqual(allOn);
      expect(next.pendingDisable).toBeNull();
    }
  });

  it("confirming with no pending disable is a no-op", () => {
    const next = confirmPendingDisable(initialState);
    expect(next).toEqual(initialState);
  });

  it("turning a toggle back on happens immediately without a confirmation prompt", () => {
    const offState: ToggleGateState<Key> = {
      prefs: { ...allOff },
      pendingDisable: null,
    };
    for (const key of keys) {
      const next = requestToggleChange(offState, key, true);
      expect(next.prefs[key]).toBe(true);
      expect(next.pendingDisable).toBeNull();
    }
  });

  it("re-enabling does not clear an unrelated pending disable request", () => {
    const pendingPaused = requestToggleChange(initialState, "emailOnPaused", false);
    const next = requestToggleChange(
      { ...pendingPaused, prefs: { ...allOff } },
      "emailOnCancelled",
      true,
    );
    expect(next.prefs.emailOnCancelled).toBe(true);
    expect(next.pendingDisable).toBe("emailOnPaused");
  });
});
