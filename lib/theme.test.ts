import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GROUP_COLOR_COUNT, GROUP_COLOR_NAMES, THEMES, type Theme } from "./theme";

const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

/** The variables a theme defines, from its `:root[data-theme="..."]` block. */
function themeVariables(theme: Theme): Map<string, string> {
  const block = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`No block for theme ${theme} in globals.css.`);
  const variables = new Map<string, string>();
  for (const match of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    variables.set(match[1], match[2].trim().toLowerCase());
  }
  return variables;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const slots = Array.from({ length: GROUP_COLOR_COUNT }, (_, i) => i + 1);

describe.each(THEMES)("theme %s", (theme) => {
  const variables = themeVariables(theme);
  const fills = slots.map((slot) => variables.get(`--group-${slot}`));
  const baseColors = [...variables.entries()]
    .filter(([name]) => !name.startsWith("--group-"))
    .map(([, value]) => value);

  it("has 8 group colors, each a hex color with its own text color", () => {
    expect(GROUP_COLOR_COUNT).toBe(8);
    for (const slot of slots) {
      expect(variables.get(`--group-${slot}`), `--group-${slot}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(variables.get(`--group-${slot}-ink`), `--group-${slot}-ink`).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect([...variables.keys()].filter((name) => name.startsWith("--group-"))).toHaveLength(16);
  });

  it("has 8 different group colors", () => {
    expect(new Set(fills).size).toBe(GROUP_COLOR_COUNT);
  });

  it("never uses a base color as a group color", () => {
    expect(variables.has("--card-bg")).toBe(true);
    expect(variables.has("--card-ink")).toBe(true);
    for (const fill of fills) expect(baseColors).not.toContain(fill);
  });

  it("keeps each group's text readable on its color (WCAG AA, 4.5:1)", () => {
    for (const slot of slots) {
      const ratio = contrast(
        variables.get(`--group-${slot}`)!,
        variables.get(`--group-${slot}-ink`)!,
      );
      expect(ratio, `slot ${slot}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the base card text readable on the base card (WCAG AA, 4.5:1)", () => {
    expect(
      contrast(variables.get("--card-bg")!, variables.get("--card-ink")!),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("names each of the 8 colors once", () => {
    expect(GROUP_COLOR_NAMES[theme]).toHaveLength(GROUP_COLOR_COUNT);
    expect(new Set(GROUP_COLOR_NAMES[theme]).size).toBe(GROUP_COLOR_COUNT);
  });
});

// The color grid and the group chip in the Add dialog draw each slot from the same variables as
// the cards, so a theme that changes a slot changes the cards and the grid together.
describe("the swatch rules for the group colors", () => {
  const rule = (selector: string, slot: number) =>
    // The selector may be one of a list, so anything up to the opening brace is allowed after it.
    new RegExp(`${selector}\\[data-slot="${slot}"\\][^{}]*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";

  it.each(slots)("draw slot %i from that slot's own fill and text color", (slot) => {
    for (const selector of ["\\.card", "\\.swatch", "\\.swatch-chip"]) {
      const body = rule(selector, slot);
      const where = `${selector} slot ${slot}`;
      expect(body, where).toMatch(new RegExp(`color:\\s*var\\(--group-${slot}-ink\\)`));
      expect(body, where).toMatch(new RegExp(`background(-color)?:\\s*var\\(--group-${slot}\\)`));
    }
  });
});
