import type { Task } from "./task";

// Pure helpers for the card stack. They run in the browser, so nothing here touches the database.

export type Move = "previous" | "next" | "first" | "last";

/** Cards further than this from the current one are hidden. */
export const STACK_REACH = 6;

/** A move or a direct index, clamped to the list. An empty list always gives 0. */
export function moveIndex(current: number, count: number, move: Move | number): number {
  if (count <= 0) return 0;
  const target =
    typeof move === "number"
      ? move
      : move === "previous"
        ? current - 1
        : move === "next"
          ? current + 1
          : move === "first"
            ? 0
            : count - 1;
  if (!Number.isInteger(target)) return Math.min(Math.max(Math.trunc(current) || 0, 0), count - 1);
  return Math.min(Math.max(target, 0), count - 1);
}

/**
 * Where a task is in the list. If it is not there (done or deleted), the place it was in
 * (`fallback`), kept inside the list, so the card that took its place has the focus.
 */
export function indexOfTask(tasks: Task[], id: string | null, fallback: number): number {
  const found = tasks.findIndex((task) => task.id === id);
  return found >= 0 ? found : moveIndex(fallback, tasks.length, fallback);
}

/**
 * The id of the task that has the focus after a move, starting from the task `fromId`. A move is
 * a step, a place in the list, or a task by id. A task that is not in the list changes nothing,
 * so a click that arrives after a refresh cannot land on the wrong card.
 */
export function focusAfter(
  tasks: Task[],
  fromId: string | null,
  fallback: number,
  move: Move | number | { id: string },
): string | null {
  const from = indexOfTask(tasks, fromId, fallback);
  if (typeof move === "object") {
    const found = tasks.find((task) => task.id === move.id);
    return (found ?? tasks[from])?.id ?? null;
  }
  const position = moveIndex(from, tasks.length, move);
  return tasks[position]?.id ?? null;
}

/** The move a key asks for, or null for any other key. */
export function stepFromKey(key: string): Move | null {
  switch (key) {
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/** Arrow keys must keep working inside text fields, so the stack ignores them there. */
export function isEditableTarget(tagName: string, isContentEditable: boolean): boolean {
  return isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tagName.toUpperCase());
}

/**
 * The part of a wheel event that moves the stack. Sideways scrolling always counts. Vertical
 * scrolling only counts when the page itself has nothing to scroll, so it never blocks the page.
 * Positive means toward the next card.
 */
export function wheelDelta(deltaX: number, deltaY: number, pageScrolls: boolean): number {
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return deltaX;
  return pageScrolls ? 0 : deltaY;
}

export const WHEEL_THRESHOLD = 60;

/**
 * One wheel delta in pixels. A browser reports a mouse wheel notch in pixels (about 100), in
 * lines (Firefox, about 3), or in pages, so any notch counted in lines or pages is one full step.
 * That keeps one notch from falling short of the threshold.
 */
export function wheelAmount(delta: number, deltaMode: number): number {
  return deltaMode === 0 ? delta : Math.sign(delta) * WHEEL_THRESHOLD;
}

/** Adds a wheel delta to what has built up. One card per threshold, so a flick moves one card. */
export function accumulateWheel(
  built: number,
  delta: number,
  threshold: number = WHEEL_THRESHOLD,
): { built: number; step: -1 | 0 | 1 } {
  const total = built + delta;
  if (total >= threshold) return { built: 0, step: 1 };
  if (total <= -threshold) return { built: 0, step: -1 };
  return { built: total, step: 0 };
}
