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

/** The color slot of a group, matched without case like the database does, or null. */
export function slotFor(groups: Group[], name: string | null): number | null {
  if (name === null) return null;
  const group = findGroup(groups, name);
  if (!group) return null;
  const slot = group.color;
  return Number.isInteger(slot) && slot >= 1 && slot <= GROUP_COLOR_COUNT ? slot : null;
}
