import type { Group } from "./task";
import { GROUP_COLOR_COUNT } from "./theme";

// Pure helpers for matching a group name. They run in the browser, so nothing here touches the
// database.

// SQLite's NOCASE folds English letters only, so "É" and "é" are two groups. Folding the same
// way here keeps each task on the color of its own group.
export function foldCase(text: string): string {
  return text.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/** The group with this name, matched without case like the database does. */
export function findGroup(groups: Group[], name: string): Group | undefined {
  const wanted = foldCase(name);
  return groups.find((g) => foldCase(g.name) === wanted);
}

/** A group's color slot, or null when it is not one of the theme's slots. */
function validSlot(group: Group): number | null {
  const slot = group.color;
  return Number.isInteger(slot) && slot >= 1 && slot <= GROUP_COLOR_COUNT ? slot : null;
}

/**
 * The color slot for each group name, matched without case like the database does. The group names
 * are folded once, so each lookup is one map read, which is for a page that looks up many names.
 * The first group with a name wins. A name that is no group's, and no name at all, give null.
 */
export function slotLookup(groups: Group[]): (name: string | null) => number | null {
  const slots = new Map<string, number | null>();
  for (const group of groups) {
    const key = foldCase(group.name);
    if (!slots.has(key)) slots.set(key, validSlot(group));
  }
  return (name) => (name === null ? null : (slots.get(foldCase(name)) ?? null));
}

/** The color slot of one group, with the same rules as `slotLookup`, or null. */
export function slotFor(groups: Group[], name: string | null): number | null {
  return slotLookup(groups)(name);
}

/**
 * The lowest color slot that no group has, or null when all of the theme's slots are taken. A
 * color outside the theme's slots takes nothing from it.
 */
export function firstFreeColor(taken: Iterable<number>): number | null {
  const used = taken instanceof Set ? taken : new Set(taken);
  for (let slot = 1; slot <= GROUP_COLOR_COUNT; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return null;
}
