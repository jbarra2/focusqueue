import { describe, expect, it } from "vitest";
import type { Task } from "./task";
import {
  accumulateWheel,
  focusAfter,
  indexOfTask,
  isEditableTarget,
  moveIndex,
  slotFor,
  stepFromKey,
  WHEEL_THRESHOLD,
  wheelAmount,
  wheelDelta,
} from "./stack";

describe("moveIndex", () => {
  it("moves one card at a time", () => {
    expect(moveIndex(2, 5, "next")).toBe(3);
    expect(moveIndex(2, 5, "previous")).toBe(1);
  });

  it("jumps to the first and last card", () => {
    expect(moveIndex(2, 5, "first")).toBe(0);
    expect(moveIndex(2, 5, "last")).toBe(4);
  });

  it("stays inside the list", () => {
    expect(moveIndex(0, 5, "previous")).toBe(0);
    expect(moveIndex(4, 5, "next")).toBe(4);
    expect(moveIndex(0, 5, 99)).toBe(4);
    expect(moveIndex(3, 5, -7)).toBe(0);
  });

  it("goes straight to a card by index", () => {
    expect(moveIndex(0, 5, 3)).toBe(3);
  });

  it("gives 0 for an empty list", () => {
    expect(moveIndex(0, 0, "next")).toBe(0);
    expect(moveIndex(3, 0, 2)).toBe(0);
  });

  it("keeps the current card for an index that is not a whole number", () => {
    expect(moveIndex(2, 5, Number.NaN)).toBe(2);
    expect(moveIndex(2, 5, 1.5)).toBe(2);
    expect(moveIndex(2, 5, Number.POSITIVE_INFINITY)).toBe(2);
  });
});

describe("stepFromKey", () => {
  it("maps the arrow, Home, and End keys", () => {
    expect(stepFromKey("ArrowRight")).toBe("next");
    expect(stepFromKey("ArrowLeft")).toBe("previous");
    expect(stepFromKey("Home")).toBe("first");
    expect(stepFromKey("End")).toBe("last");
  });

  it("ignores other keys", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "a", "Tab", ""]) {
      expect(stepFromKey(key)).toBeNull();
    }
  });
});

describe("isEditableTarget", () => {
  it("is true for text fields and editable content", () => {
    expect(isEditableTarget("INPUT", false)).toBe(true);
    expect(isEditableTarget("textarea", false)).toBe(true);
    expect(isEditableTarget("SELECT", false)).toBe(true);
    expect(isEditableTarget("DIV", true)).toBe(true);
  });

  it("is false for buttons and plain elements", () => {
    expect(isEditableTarget("BUTTON", false)).toBe(false);
    expect(isEditableTarget("LI", false)).toBe(false);
  });
});

describe("wheel", () => {
  it("uses sideways scrolling whether or not the page scrolls", () => {
    expect(wheelDelta(40, 5, true)).toBe(40);
    expect(wheelDelta(-40, 5, false)).toBe(-40);
  });

  it("uses vertical scrolling only when the page does not scroll", () => {
    expect(wheelDelta(2, 50, false)).toBe(50);
    expect(wheelDelta(2, 50, true)).toBe(0);
  });

  it("moves one card per threshold, in either direction", () => {
    expect(accumulateWheel(0, WHEEL_THRESHOLD)).toEqual({ built: 0, step: 1 });
    expect(accumulateWheel(0, -WHEEL_THRESHOLD)).toEqual({ built: 0, step: -1 });
  });

  it("builds up small deltas before moving", () => {
    const first = accumulateWheel(0, 25);
    expect(first).toEqual({ built: 25, step: 0 });
    const second = accumulateWheel(first.built, 25);
    expect(second).toEqual({ built: 50, step: 0 });
    expect(accumulateWheel(second.built, 25)).toEqual({ built: 0, step: 1 });
  });

  it("cancels opposite deltas", () => {
    expect(accumulateWheel(40, -30)).toEqual({ built: 10, step: 0 });
  });
});

describe("slotFor", () => {
  const groups = [
    { name: "Home", color: 3 },
    { name: "Errands", color: 8 },
  ];

  it("finds the slot of a group, matching without case", () => {
    expect(slotFor(groups, "Home")).toBe(3);
    expect(slotFor(groups, "hOmE")).toBe(3);
    expect(slotFor(groups, "Errands")).toBe(8);
  });

  it("folds only English letters, as the database does", () => {
    const accented = [
      { name: "Éclair", color: 2 },
      { name: "éclair", color: 6 },
    ];
    expect(slotFor(accented, "Éclair")).toBe(2);
    expect(slotFor(accented, "éclair")).toBe(6);
    // The English letters fold and the É stays, so this is the first group, not the second.
    expect(slotFor(accented, "ÉCLAIR")).toBe(2);
  });

  it("is null for no group or an unknown group", () => {
    expect(slotFor(groups, null)).toBeNull();
    expect(slotFor(groups, "Nowhere")).toBeNull();
    expect(slotFor([], "Home")).toBeNull();
  });

  it("is null for a slot outside 1 to 8", () => {
    for (const color of [0, 9, -1, 1.5, Number.NaN]) {
      expect(slotFor([{ name: "Odd", color }], "Odd")).toBeNull();
    }
  });
});

function tasksNamed(...ids: string[]): Task[] {
  return ids.map((id) => ({
    id,
    name: id,
    group: null,
    description: "",
    dueDate: "2026-10-14",
    difficulty: "med" as const,
    createdAt: "2026-10-01T08:00:00.000Z",
    completedAt: null,
  }));
}

describe("indexOfTask", () => {
  it("finds the task by id, wherever it is in the list", () => {
    expect(indexOfTask(tasksNamed("a", "b", "c"), "c", 0)).toBe(2);
  });

  it("follows the task when the list changes around it", () => {
    // A new task came in above "b", so it moved from place 1 to place 2.
    expect(indexOfTask(tasksNamed("a", "new", "b", "c"), "b", 1)).toBe(2);
  });

  it("uses the place it was in when the task is gone, so the next card takes over", () => {
    // "b" was done. "c" now sits where it was.
    expect(indexOfTask(tasksNamed("a", "c"), "b", 1)).toBe(1);
  });

  it("stays inside the list when the task was last and is gone", () => {
    expect(indexOfTask(tasksNamed("a", "b"), "c", 2)).toBe(1);
  });

  it("gives 0 for an empty list or no focus", () => {
    expect(indexOfTask([], "a", 3)).toBe(0);
    expect(indexOfTask(tasksNamed("a"), null, 0)).toBe(0);
  });
});

describe("focusAfter", () => {
  const list = tasksNamed("a", "b", "c");

  it("moves to the next and previous task", () => {
    expect(focusAfter(list, "b", 1, "next")).toBe("c");
    expect(focusAfter(list, "b", 1, "previous")).toBe("a");
  });

  it("stays on the same task at either end", () => {
    expect(focusAfter(list, "c", 2, "next")).toBe("c");
    expect(focusAfter(list, "a", 0, "previous")).toBe("a");
  });

  it("goes straight to a place in the list, and to the first and last", () => {
    expect(focusAfter(list, "a", 0, 2)).toBe("c");
    expect(focusAfter(list, "b", 1, "first")).toBe("a");
    expect(focusAfter(list, "b", 1, "last")).toBe("c");
  });

  it("starts from the place the focus task was in when it is gone", () => {
    // "x" is gone and was at place 1, so a move to the next card lands on "c".
    expect(focusAfter(list, "x", 1, "next")).toBe("c");
  });

  it("gives null for an empty list", () => {
    expect(focusAfter([], "a", 0, "next")).toBeNull();
  });
});

describe("wheelAmount", () => {
  it("leaves a pixel delta as it is", () => {
    expect(wheelAmount(100, 0)).toBe(100);
    expect(wheelAmount(-7, 0)).toBe(-7);
  });

  it("counts a notch in lines or pages as one full step, in either direction", () => {
    // Firefox reports one notch as about 3 lines, which is less than the threshold in pixels.
    expect(wheelAmount(3, 1)).toBe(WHEEL_THRESHOLD);
    expect(wheelAmount(-3, 1)).toBe(-WHEEL_THRESHOLD);
    expect(wheelAmount(1, 2)).toBe(WHEEL_THRESHOLD);
    expect(accumulateWheel(0, wheelAmount(3, 1)).step).toBe(1);
  });

  it("gives nothing for no movement in lines", () => {
    expect(wheelAmount(0, 1)).toBe(0);
  });
});

describe("focusAfter by id", () => {
  const list = tasksNamed("a", "b", "c");

  it("goes to the task with that id", () => {
    expect(focusAfter(list, "a", 0, { id: "c" })).toBe("c");
  });

  it("stays where it is when the task is not in the list, so a late click does nothing", () => {
    expect(focusAfter(list, "b", 1, { id: "gone" })).toBe("b");
  });

  it("stays on the place the focus was in when its task is gone too", () => {
    expect(focusAfter(list, "x", 1, { id: "gone" })).toBe("b");
  });

  it("gives null for an empty list", () => {
    expect(focusAfter([], null, 0, { id: "a" })).toBeNull();
  });
});
