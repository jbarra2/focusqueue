import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { msUntilMidnight } from "./date";

// The midnight timer must be right on a day that has 23 or 25 hours, so these run in a time zone
// that changes its clocks. In 2026 the United States moved them forward on 8 March and back on
// 1 November. Node reads TZ again each time it is set, and each test file has its own process.

const HOUR = 3_600_000;

let before: string | undefined;

beforeAll(() => {
  before = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
});

afterAll(() => {
  if (before === undefined) delete process.env.TZ;
  else process.env.TZ = before;
});

describe("msUntilMidnight on days that change length", () => {
  it("runs in a time zone that has them (or the checks below prove nothing)", () => {
    expect(new Date(2026, 2, 9).getTime() - new Date(2026, 2, 8).getTime()).toBe(23 * HOUR);
    expect(new Date(2026, 10, 2).getTime() - new Date(2026, 10, 1).getTime()).toBe(25 * HOUR);
  });

  // The clocks change at 02:00, so a time before that has the change still ahead of it.
  it("counts 22.5 hours from 00:30 on the 23-hour day, not 23.5", () => {
    expect(msUntilMidnight(new Date(2026, 2, 8, 0, 30))).toBe(22.5 * HOUR);
  });

  it("counts 24.5 hours from 00:30 on the 25-hour day, not 23.5", () => {
    expect(msUntilMidnight(new Date(2026, 10, 1, 0, 30))).toBe(24.5 * HOUR);
  });

  it("counts a whole short or long day from its first moment", () => {
    expect(msUntilMidnight(new Date(2026, 2, 8, 0, 0, 0))).toBe(23 * HOUR);
    expect(msUntilMidnight(new Date(2026, 10, 1, 0, 0, 0))).toBe(25 * HOUR);
  });

  it("is the plain clock time once the change has happened", () => {
    expect(msUntilMidnight(new Date(2026, 2, 8, 12))).toBe(12 * HOUR);
    expect(msUntilMidnight(new Date(2026, 10, 1, 12))).toBe(12 * HOUR);
  });

  it("is ordinary on the evening before the short day and before the long day", () => {
    expect(msUntilMidnight(new Date(2026, 2, 7, 22, 30))).toBe(1.5 * HOUR);
    expect(msUntilMidnight(new Date(2026, 9, 31, 22, 30))).toBe(1.5 * HOUR);
  });
});
