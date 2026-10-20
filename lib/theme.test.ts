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

// The cards, the color grid and the group chip in the Add dialog all wear a group color. Each slot
// sets its two variables once, and the three read them, so a theme that changes a slot changes all
// of them together and one cannot drift from the others.
describe("the slot rules for the group colors", () => {
  // Comments are left out, so what they say about selectors is not mistaken for a rule. So are the
  // lines that open a block such as @media, so a rule inside one is read as a rule of its own.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@[^{;]+\{/g, "");
  const rules = [...bare.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: selectors.split(",").map((selector) => selector.trim()),
    body,
  }));
  // Every rule that names the selector. A second one, in a media query or later on, could change
  // what the first one sets, so each is expected once.
  const rulesFor = (selector: string) =>
    rules.filter(({ selectors }) => selectors.includes(selector));

  it.each(slots)("sets slot %i's variables, once, from that slot's own colors", (slot) => {
    const found = rulesFor(`[data-slot="${slot}"]`);
    expect(found, `the rules for [data-slot="${slot}"]`).toHaveLength(1);
    expect(found[0].body).toMatch(new RegExp(`--slot-bg:\\s*var\\(--group-${slot}\\)\\s*;`));
    expect(found[0].body).toMatch(new RegExp(`--slot-ink:\\s*var\\(--group-${slot}-ink\\)\\s*;`));
  });

  it.each([".card", ".swatch", ".swatch-chip"])(
    "paints %s from the slot variables, once",
    (selector) => {
      const found = rulesFor(`${selector}[data-slot]`);
      expect(found, `the rules for ${selector}[data-slot]`).toHaveLength(1);
      // background-color, not the shorthand: a taken swatch draws stripes with background-image.
      expect(found[0].body).toMatch(/background-color:\s*var\(--slot-bg\)/);
      expect(found[0].body).toMatch(/(^|[\s;])color:\s*var\(--slot-ink\)/);
    },
  );

  it("names a group color in the eight slot rules and in no other rule", () => {
    const naming = rules
      .filter(({ body }) => body.includes("var(--group-"))
      .flatMap(({ selectors }) => selectors);
    expect(naming).toEqual(slots.map((slot) => `[data-slot="${slot}"]`));
  });
});
