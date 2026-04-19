export const ACTION_STYLES: Record<string, { color: string; dot: string; label: string }> = {
  create: { color: "text-green-700", dot: "bg-green-500", label: "Created" },
  pause: { color: "text-yellow-700", dot: "bg-yellow-500", label: "Paused" },
  cancel: { color: "text-red-700", dot: "bg-red-500", label: "Cancelled" },
  reactivate: { color: "text-blue-700", dot: "bg-blue-500", label: "Reactivated" },
  expire: { color: "text-orange-700", dot: "bg-orange-500", label: "Expired" },
};

export const FALLBACK_STYLE = { color: "text-gray-600", dot: "bg-gray-400" };

export function getActionStyle(action: string) {
  const key = Object.keys(ACTION_STYLES).find((k) =>
    action.toLowerCase().includes(k)
  );
  return key ? ACTION_STYLES[key] : FALLBACK_STYLE;
}
