import { describe, expect, it } from "vitest";
import { completedLabel, dueLabel, formatDay } from "./format";
import { addDays } from "./date";

describe("years 0 to 99", () => {
  it("are not read as 1900 to 1999", () => {
    expect(addDays("0050-03-01", 1)).toBe("0050-03-02");
    expect(dueLabel("0050-03-01", "0050-03-01")).toBe("Today");
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
    expect(dueLabel("2026-10-12", today)).toBe("Overdue · Mon, Oct 12");
  });

  it("says Today and Tomorrow", () => {
    expect(dueLabel("2026-10-14", today)).toBe("Today");
    expect(dueLabel("2026-10-15", today)).toBe("Tomorrow");
  });

  it("shows the date for a later day", () => {
    expect(dueLabel("2026-10-17", today)).toBe("Sat, Oct 17");
  });

  it("finds tomorrow across a month and a year", () => {
    expect(dueLabel("2026-11-01", "2026-10-31")).toBe("Tomorrow");
    expect(dueLabel("2027-01-01", "2026-12-31")).toBe("Tomorrow");
  });
});

describe("completedLabel", () => {
  it("shows the local day of a timestamp, even late in the evening", () => {
    // Built from local parts, so it holds in any time zone, including where the UTC day differs.
    expect(completedLabel(new Date(2026, 9, 14, 23, 30).toISOString())).toBe("Wed, Oct 14");
    expect(completedLabel(new Date(2026, 9, 14, 0, 30).toISOString())).toBe("Wed, Oct 14");
  });
});
