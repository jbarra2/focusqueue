import { describe, expect, it } from "vitest";
import { completedLabel, dueLabel, formatDay, isOverdue, truncateLabel } from "./format";
import { addDays } from "./date";

// An open task is due on a day. A done task has the day it was completed as well.
const open = (dueDate: string) => ({ dueDate, completedAt: null });
const done = (dueDate: string) => ({ dueDate, completedAt: "2026-10-13T12:00:00.000Z" });

describe("years 0 to 99", () => {
  it("are not read as 1900 to 1999", () => {
    expect(addDays("0050-03-01", 1)).toBe("0050-03-02");
    expect(dueLabel(open("0050-03-01"), "0050-03-01")).toBe("Today");
  });
});

describe("formatDay", () => {
  it("shows the weekday, month, and day", () => {
    expect(formatDay("2026-10-14")).toBe("Wed, Oct 14");
  });

  it("does not shift the day", () => {
    expect(formatDay("2026-01-01")).toBe("Thu, Jan 1");
  });
});

describe("dueLabel", () => {
  const today = "2026-10-14";

  it("says Overdue with the date for a past day", () => {
    expect(dueLabel(open("2026-10-12"), today)).toBe("Overdue · Mon, Oct 12");
  });

  it("says Today and Tomorrow", () => {
    expect(dueLabel(open("2026-10-14"), today)).toBe("Today");
    expect(dueLabel(open("2026-10-15"), today)).toBe("Tomorrow");
  });

  it("shows the date for a later day", () => {
    expect(dueLabel(open("2026-10-17"), today)).toBe("Sat, Oct 17");
  });

  it("finds tomorrow across a month and a year", () => {
    expect(dueLabel(open("2026-11-01"), "2026-10-31")).toBe("Tomorrow");
    expect(dueLabel(open("2027-01-01"), "2026-12-31")).toBe("Tomorrow");
  });

  it("does not say Overdue for a task that is done, only the date", () => {
    expect(dueLabel(done("2026-10-12"), today)).toBe("Mon, Oct 12");
    // A done task is still shown as due Today or Tomorrow when that is its date.
    expect(dueLabel(done("2026-10-14"), today)).toBe("Today");
    expect(dueLabel(done("2026-10-15"), today)).toBe("Tomorrow");
  });
});

describe("isOverdue", () => {
  const today = "2026-10-14";

  it("is true for an open task due before today", () => {
    expect(isOverdue({ dueDate: "2026-10-13", completedAt: null }, today)).toBe(true);
  });

  it("is false for an open task due today or later", () => {
    expect(isOverdue({ dueDate: "2026-10-14", completedAt: null }, today)).toBe(false);
    expect(isOverdue({ dueDate: "2026-10-20", completedAt: null }, today)).toBe(false);
  });

  it("is false for a done task, even when its due date has passed", () => {
    expect(
      isOverdue({ dueDate: "2026-10-01", completedAt: "2026-10-13T12:00:00.000Z" }, today),
    ).toBe(false);
  });
});

describe("truncateLabel", () => {
  it("leaves text that fits as it is, including exactly the limit", () => {
    expect(truncateLabel("Home", 20)).toBe("Home");
    expect(truncateLabel("", 20)).toBe("");
    expect(truncateLabel("a".repeat(20), 20)).toBe("a".repeat(20));
  });

  it("cuts longer text so that it is the limit long, ending with an ellipsis", () => {
    const cut = truncateLabel("a".repeat(21), 20);
    expect(cut).toBe(`${"a".repeat(19)}…`);
    expect(Array.from(cut)).toHaveLength(20);
  });

  it("drops a space that would sit before the ellipsis", () => {
    expect(truncateLabel("Quarterly planning meeting with the whole team", 20)).toBe(
      "Quarterly planning…",
    );
    expect(truncateLabel("ab     cdef", 5)).toBe("ab…");
  });

  it("counts what a person sees as one character, so an emoji or an accent is not split", () => {
    // Each emoji is two UTF-16 units, and the family is seven code points joined into one.
    expect(truncateLabel("😀".repeat(30), 5)).toBe(`${"😀".repeat(4)}…`);
    const family = "👨‍👩‍👧‍👦";
    expect(truncateLabel(family.repeat(6), 4)).toBe(`${family.repeat(3)}…`);
    // "é" written as an e and a combining accent is one character.
    const accented = "é";
    expect(truncateLabel(accented.repeat(10), 4)).toBe(`${accented.repeat(3)}…`);
  });

  it("never cuts text that has as many characters as the limit, however many code units", () => {
    expect(truncateLabel("😀😀😀", 3)).toBe("😀😀😀");
  });

  it("gives just the ellipsis for a limit of 1 or less, and does not throw", () => {
    expect(truncateLabel("abc", 1)).toBe("…");
    expect(truncateLabel("abc", 0)).toBe("…");
    expect(truncateLabel("abc", -3)).toBe("…");
  });

  it("does not change the text it was given", () => {
    const text = "x".repeat(40);
    truncateLabel(text, 10);
    expect(text).toHaveLength(40);
  });
});

describe("completedLabel", () => {
  it("shows the local day of a timestamp, even late in the evening", () => {
    // Built from local parts, so it holds in any time zone, including where the UTC day differs.
    expect(completedLabel(new Date(2026, 9, 14, 23, 30).toISOString())).toBe("Wed, Oct 14");
    expect(completedLabel(new Date(2026, 9, 14, 0, 30).toISOString())).toBe("Wed, Oct 14");
  });
});
