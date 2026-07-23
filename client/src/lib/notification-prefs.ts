export interface SubscriptionNotifPrefs {
  emailOnPaused: boolean;
  emailOnCancelled: boolean;
  emailOnReactivated: boolean;
}

export function shouldShowAllNotificationsOffWarning(
  prefs: SubscriptionNotifPrefs,
): boolean {
  return (
    !prefs.emailOnPaused &&
    !prefs.emailOnCancelled &&
    !prefs.emailOnReactivated
  );
}

export function isSaveNotificationPrefsDisabled(isPending: boolean): boolean {
  return isPending;
}

export interface ToggleGateState<K extends string> {
  prefs: Record<K, boolean>;
  pendingDisable: K | null;
}

export function requestToggleChange<K extends string>(
  state: ToggleGateState<K>,
  key: K,
  checked: boolean,
): ToggleGateState<K> {
  if (!checked) {
    return { ...state, pendingDisable: key };
  }
  return {
    prefs: { ...state.prefs, [key]: true },
    pendingDisable: state.pendingDisable,
  };
}

export function confirmPendingDisable<K extends string>(
  state: ToggleGateState<K>,
): ToggleGateState<K> {
  if (state.pendingDisable === null) return state;
  return {
    prefs: { ...state.prefs, [state.pendingDisable]: false },
    pendingDisable: null,
  };
}

export function cancelPendingDisable<K extends string>(
  state: ToggleGateState<K>,
): ToggleGateState<K> {
  return { ...state, pendingDisable: null };
}
