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

/** A theme color as #rrggbb. A theme that gives it in any other way fails here, by name. */
function hexOf(variables: Map<string, string>, name: string): string {
  const value = variables.get(name);
  if (value === undefined || !/^#[0-9a-f]{6}$/.test(value)) {
    throw new Error(`${name} must be a #rrggbb color in the theme block, and is ${value}.`);
  }
  return value;
}

// Comments are left out, so what they say about selectors is not mistaken for a rule. So are the
// lines that open a block such as @media, so a rule inside one is read as a rule of its own.
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@[^{;]+\{/g, "");
const rules = [...bare.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selectors, body]) => ({
  selectors: selectors.split(",").map((selector) => selector.trim()),
  body,
}));

const slots = Array.from({ length: GROUP_COLOR_COUNT }, (_, i) => i + 1);

// The text colors and the fills they sit on, as the page uses them: the title and the links on the
// page, the labels on a card, the refusal in the dialog, the words on a filled button or pill, and
// the muted words on a button that cannot be pressed.
const TEXT_ON: [string, string][] = [
  ["--color-text", "--color-bg"],
  ["--color-text", "--card-bg"],
  ["--color-text", "--color-wash"],
  // The dialog writes in the card's ink, and the limit notice in it sits in the quiet box.
  ["--card-ink", "--color-wash"],
  ["--color-muted", "--color-bg"],
  ["--color-muted", "--card-bg"],
  ["--color-muted", "--color-wash"],
  ["--color-accent", "--color-bg"],
  ["--color-accent", "--card-bg"],
  ["--color-danger", "--color-bg"],
  ["--color-danger", "--card-bg"],
  ["--color-on-fill", "--color-accent"],
  ["--color-on-fill", "--color-accent-strong"],
  ["--color-on-fill", "--color-done"],
  ["--color-on-fill", "--color-muted"],
];

// What a control or a card's edge is drawn against: the page, a plain card or the dialog, and the
// quiet box a notice sits in. The edge of a group's card is measured against the page it sits on.
// The fill of a group is chosen for its text, so its edge is not measured against that fill.
const EDGE_ON = ["--color-bg", "--card-bg", "--color-wash"];

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

  // The accent is a base color, so this also keeps it from being a group fill: a button or the
  // focus card's edge in the accent is never lost against a card of the same color.
  it("never uses a base color, the accent included, as a group color", () => {
    expect(variables.has("--card-bg")).toBe(true);
    expect(variables.has("--card-ink")).toBe(true);
    expect(variables.has("--color-accent")).toBe(true);
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

  it.each(TEXT_ON)("keeps %s readable on %s (WCAG AA, 4.5:1)", (ink, fill) => {
    expect(contrast(hexOf(variables, ink), hexOf(variables, fill))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(EDGE_ON)("keeps the edge of a control and a card visible on %s (3:1)", (surface) => {
    expect(
      contrast(hexOf(variables, "--color-edge"), hexOf(variables, surface)),
    ).toBeGreaterThanOrEqual(3);
  });

  // The focus ring is drawn over any card, and the focus card has the accent as its edge, so the
  // accent has to show against the page, a plain card, the quiet box, and every group color.
  it("keeps the accent, the focus ring and the focus card's edge visible everywhere (3:1)", () => {
    const accent = hexOf(variables, "--color-accent");
    for (const surface of EDGE_ON) {
      expect(contrast(accent, hexOf(variables, surface)), surface).toBeGreaterThanOrEqual(3);
    }
    for (const slot of slots) {
      expect(
        contrast(accent, hexOf(variables, `--group-${slot}`)),
        `slot ${slot}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("names each of the 8 colors once", () => {
    expect(GROUP_COLOR_NAMES[theme]).toHaveLength(GROUP_COLOR_COUNT);
    expect(new Set(GROUP_COLOR_NAMES[theme]).size).toBe(GROUP_COLOR_COUNT);
  });
});

// A mode such as Windows high contrast replaces the colors an author wrote, so the view that is
// current has to be told apart in another way as well.
describe("the current view", () => {
  it("is underlined, so it does not rest on its fill", () => {
    const found = rules.filter(({ selectors }) =>
      selectors.includes('.view-link[aria-current="page"]'),
    );
    expect(found).toHaveLength(1);
    expect(found[0].body).toMatch(/text-decoration:\s*underline/);
  });
});

// Every color is written in a theme's block, as a variable. A rule anywhere else says which
// variable to use, so a theme can change the whole look by changing its block, and a second theme
// has nothing else to find and change.
describe("colors are written in the theme block only", () => {
  // Every named color in CSS, so that a name is caught like a hex or rgb().
  const NAMES = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
    blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson
    cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
    darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray
    darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick
    floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey
    honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon
    lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
    lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow
    lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple
    mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue
    mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
    palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
    powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen
    seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal
    thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/);
  const LITERAL = new RegExp(
    `#[0-9a-f]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(|(?<![\\w-])(?:${NAMES.join("|")})(?![\\w-])`,
    "i",
  );
  const outside = rules.filter(({ selectors }) => !selectors.some((s) => s.startsWith(":root")));

  it("recognizes a color written as a literal, and not a variable or a keyword", () => {
    for (const literal of [
      "#fff",
      "#a44a2f",
      "rgb(0 0 0 / 0.5)",
      "hsl(20 50% 50%)",
      "white",
      "1px solid red",
      "darkslategray",
      "0 0 0 1px whitesmoke",
    ]) {
      expect(LITERAL.test(literal), literal).toBe(true);
    }
    for (const fine of [
      "var(--color-edge)",
      "currentColor",
      "transparent",
      "inset 0 0 0 1px currentColor",
      "-webkit-box",
      "system-ui, sans-serif",
      "color-mix(in srgb, currentColor 40%, transparent)",
    ]) {
      expect(LITERAL.test(fine), fine).toBe(false);
    }
  });

  it("has rules outside the theme block to look at", () => {
    expect(outside.length).toBeGreaterThan(40);
    expect(outside.some(({ selectors }) => selectors.includes(".card"))).toBe(true);
  });

  it("has no color literal in any rule outside the theme block", () => {
    const found = outside.flatMap(({ selectors, body }) =>
      body
        .split(";")
        .map((declaration) => declaration.trim())
        .filter((declaration) => LITERAL.test(declaration.slice(declaration.indexOf(":") + 1)))
        .map((declaration) => `${selectors.join(", ")} { ${declaration} }`),
    );
    expect(found).toEqual([]);
  });
});

// The cards, the color grid and the group chip in the Add dialog all wear a group color. Each slot
// sets its two variables once, and the three read them, so a theme that changes a slot changes all
// of them together and one cannot drift from the others.
describe("the slot rules for the group colors", () => {
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
