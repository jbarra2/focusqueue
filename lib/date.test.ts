import { describe, expect, it } from "vitest";
import { addDays, endOfWeek, localDate, localDay, startOfWeek } from "./date";

// 2026-10-14 is a Wednesday. Its week runs 2026-10-12 to 2026-10-18.
const WEDNESDAY = "2026-10-14";
const SUNDAY = "2026-10-18";

describe("date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("runs the week from Monday to Sunday", () => {
    expect(startOfWeek(WEDNESDAY)).toBe("2026-10-12");
    expect(endOfWeek(WEDNESDAY)).toBe(SUNDAY);
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(endOfWeek(SUNDAY)).toBe(SUNDAY);
    expect(startOfWeek(SUNDAY)).toBe("2026-10-12");
  });

  it("builds a local date from year, month, and day, including years 0 to 99", () => {
    const date = localDate("2026-10-14");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 14]);
    // The Date constructor would read year 50 as 1950.
    expect(localDate("0050-03-01").getFullYear()).toBe(50);
  });

  it("finds the local day of a timestamp, whatever the time zone", () => {
    // Noon and the last minute of the day, both built in local time, then written as ISO text.
    expect(localDay(new Date(2026, 9, 14, 12).toISOString())).toBe("2026-10-14");
    expect(localDay(new Date(2026, 9, 14, 23, 59).toISOString())).toBe("2026-10-14");
    expect(localDay(new Date(2026, 9, 15, 0, 1).toISOString())).toBe("2026-10-15");
  });
});
