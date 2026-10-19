import { describe, expect, it } from "vitest";
import { completedLabel, dueLabel, formatDay, isOverdue } from "./format";
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

describe("completedLabel", () => {
  it("shows the local day of a timestamp, even late in the evening", () => {
    // Built from local parts, so it holds in any time zone, including where the UTC day differs.
    expect(completedLabel(new Date(2026, 9, 14, 23, 30).toISOString())).toBe("Wed, Oct 14");
    expect(completedLabel(new Date(2026, 9, 14, 0, 30).toISOString())).toBe("Wed, Oct 14");
  });
});
