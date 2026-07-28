/**
 * Shared formatting helpers for COMP_V2026 figures.
 * Exported so the compensation UI pages and the drift-guard test both use the
 * exact same formatter — a divergence in either one will surface as a test failure.
 */
export const usd = (n: number) => `$${n.toLocaleString()}`;
export const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
