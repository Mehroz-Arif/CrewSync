/** Preset colour palette for positions */
export const ROLE_COLOR_PRESETS = [
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "purple", label: "Purple", hex: "#a855f7" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "indigo", label: "Indigo", hex: "#6366f1" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
] as const;

/** Default fallback colour when position has no colour assigned */
const DEFAULT_COLOR = "#64748b"; // slate-500

/** Build a lookup map from position label → hex colour */
export function buildRoleColorMap(
  positions: Array<{ label: string; color?: string }> | undefined,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!positions) return map;
  for (const pos of positions) {
    if (pos.color) {
      map[pos.label] = pos.color;
    }
  }
  return map;
}

/** Get the hex colour for a given position */
export function getRoleColor(
  roleColorMap: Record<string, string>,
  position?: string,
): string {
  if (!position) return DEFAULT_COLOR;
  return roleColorMap[position] ?? DEFAULT_COLOR;
}

/** Generate inline CSS styles for a shift block based on position colour */
export function roleColorStyles(hex: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  return {
    backgroundColor: `${hex}18`, // ~10% opacity
    borderColor: `${hex}50`, // ~30% opacity
    color: hex,
  };
}
