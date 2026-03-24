/**
 * Shared color constants for charts and metrics.
 * All values map to Tailwind's default palette.
 */

export const CHART_COLORS = {
  blue: '#3b82f6',      // blue-500
  emerald: '#10b981',   // emerald-500
  amber: '#f59e0b',     // amber-500
  red: '#ef4444',       // red-500
  violet: '#8b5cf6',    // violet-500
  pink: '#ec4899',      // pink-500
  cyan: '#06b6d4',      // cyan-500
  orange: '#f97316',    // orange-500
  darkRed: '#dc2626',   // red-600
} as const;

/** Default color sequence for multi-series charts */
export const CHART_COLOR_SEQUENCE = [
  CHART_COLORS.blue,
  CHART_COLORS.emerald,
  CHART_COLORS.amber,
  CHART_COLORS.red,
  CHART_COLORS.violet,
  CHART_COLORS.pink,
] as const;
