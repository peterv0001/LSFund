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
