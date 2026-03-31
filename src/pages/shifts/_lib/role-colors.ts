/** Preset colour palette for positions */
export const ROLE_COLOR_PRESETS = [
  // Blues
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "sky", label: "Sky", hex: "#0ea5e9" },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  { id: "indigo", label: "Indigo", hex: "#6366f1" },
  { id: "navy", label: "Navy", hex: "#1e3a5f" },
  // Greens
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "emerald", label: "Emerald", hex: "#10b981" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "lime", label: "Lime", hex: "#84cc16" },
  { id: "mint", label: "Mint", hex: "#34d399" },
  // Reds & Pinks
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "rose", label: "Rose", hex: "#f43f5e" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "fuchsia", label: "Fuchsia", hex: "#d946ef" },
  { id: "coral", label: "Coral", hex: "#f97066" },
  // Purples
  { id: "purple", label: "Purple", hex: "#a855f7" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "plum", label: "Plum", hex: "#9333ea" },
  // Oranges & Yellows
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "yellow", label: "Yellow", hex: "#eab308" },
  { id: "tangerine", label: "Tangerine", hex: "#fb923c" },
  // Neutrals & Earth tones
  { id: "slate", label: "Slate", hex: "#64748b" },
  { id: "stone", label: "Stone", hex: "#78716c" },
  { id: "brown", label: "Brown", hex: "#92400e" },
  { id: "charcoal", label: "Charcoal", hex: "#374151" },
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
