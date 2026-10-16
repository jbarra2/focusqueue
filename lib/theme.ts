// Colors belong to themes. A group stores a slot number from 1 to GROUP_COLOR_COUNT, never a
// color value. Each theme defines its base colors and every slot as CSS variables in
// app/globals.css, so a chosen color stays on theme when the theme changes.

export const GROUP_COLOR_COUNT = 8;

export const THEMES = ["warm"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "warm";

/** Names for the group colors, in slot order. Color is never the only cue, so each has a name. */
export const GROUP_COLOR_NAMES: Record<Theme, readonly string[]> = {
  warm: ["Terracotta", "Mustard", "Sage", "Teal", "Sky", "Lavender", "Rose", "Sand"],
};
