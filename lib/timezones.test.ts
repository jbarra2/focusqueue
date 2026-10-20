import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays, endOfWeek, localDay, msUntilMidnight, startOfWeek } from "./date";
import { buildQueue } from "./sort";
import type { Task } from "./task";

// The queue and the date helpers run in the person's time zone, so these run in three zones that
// differ from each other, and a helper that reads the machine's own zone by mistake fails in at
// least two of them: UTC, a zone far ahead that changes its clocks (Auckland, 13 hours ahead in
// October), and a zone with a half-hour offset and no clock changes (Kolkata). Node reads TZ again
// each time it is set, and each test file has its own process, as in lib/date.dst.test.ts.

const ZONES = ["UTC", "Pacific/Auckland", "Asia/Kolkata"] as const;
type Zone = (typeof ZONES)[number];

const ORIGINAL_TZ = process.env.TZ;
const HOUR = 3_600_000;

const TODAY = "2026-10-14"; // a Wednesday, so the week is Oct 12 to Oct 18

function task(name: string, overrides: Partial<Task> = {}): Task {
  return {
    id: name,
    name,
    group: null,
    description: "",
    dueDate: "2026-10-20",
    difficulty: "med",
    createdAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

/** What each zone says for an instant, by zone. */
type PerZone<T> = Record<Zone, T>;

// Instants around local midnight. The expected day is the local calendar day in each zone.
const LOCAL_DAYS: [string, PerZone<string>][] = [
  [
    "2026-10-14T10:59:59Z",
    { UTC: "2026-10-14", "Pacific/Auckland": "2026-10-14", "Asia/Kolkata": "2026-10-14" },
  ],
  [
    "2026-10-14T11:00:00Z",
    { UTC: "2026-10-14", "Pacific/Auckland": "2026-10-15", "Asia/Kolkata": "2026-10-14" },
  ],
  [
    "2026-10-14T18:29:59Z",
    { UTC: "2026-10-14", "Pacific/Auckland": "2026-10-15", "Asia/Kolkata": "2026-10-14" },
  ],
  [
    "2026-10-14T18:30:00Z",
    { UTC: "2026-10-14", "Pacific/Auckland": "2026-10-15", "Asia/Kolkata": "2026-10-15" },
  ],
  [
    "2026-10-14T23:59:59Z",
    { UTC: "2026-10-14", "Pacific/Auckland": "2026-10-15", "Asia/Kolkata": "2026-10-15" },
  ],
  [
    "2026-10-15T00:00:00Z",
    { UTC: "2026-10-15", "Pacific/Auckland": "2026-10-15", "Asia/Kolkata": "2026-10-15" },
  ],
];

// The offset in October, in minutes behind UTC (negative when ahead), and how long the days are
// on which Auckland changes its clocks: 27 September 2026 (23 hours) and 4 April 2027 (25 hours).
const OCTOBER_OFFSET: PerZone<number> = { UTC: 0, "Pacific/Auckland": -780, "Asia/Kolkata": -330 };
// The local hour of 18:30 UTC on 14 October.
const HOUR_AT_1830Z: PerZone<number> = { UTC: 18, "Pacific/Auckland": 7, "Asia/Kolkata": 0 };
const SHORT_DAY_HOURS: PerZone<number> = { UTC: 24, "Pacific/Auckland": 23, "Asia/Kolkata": 24 };
const LONG_DAY_HOURS: PerZone<number> = { UTC: 24, "Pacific/Auckland": 25, "Asia/Kolkata": 24 };

// Tasks completed on the edge of the week. Whether each is in this week depends on the zone.
const SUNDAY_IN_UTC = task("sunday in utc", { completedAt: "2026-10-18T20:00:00Z" });
const MONDAY_IN_UTC_AHEAD = task("monday ahead", { completedAt: "2026-10-11T18:40:00Z" });
const MIDWEEK = task("midweek", { completedAt: "2026-10-14T05:00:00Z" });
const DONE_THIS_WEEK: PerZone<string[]> = {
  // Most recently completed first.
  UTC: ["sunday in utc", "midweek"],
  "Pacific/Auckland": ["midweek", "monday ahead"],
  "Asia/Kolkata": ["midweek", "monday ahead"],
};

// What a completed task's day reads as, for the same two edge instants.
const COMPLETED_LABELS: [string, PerZone<string>][] = [
  [
    "2026-10-14T20:00:00Z",
    { UTC: "Wed, Oct 14", "Pacific/Auckland": "Thu, Oct 15", "Asia/Kolkata": "Thu, Oct 15" },
  ],
  [
    "2026-10-14T18:29:59Z",
    { UTC: "Wed, Oct 14", "Pacific/Auckland": "Thu, Oct 15", "Asia/Kolkata": "Wed, Oct 14" },
  ],
];

describe.each(ZONES)("in %s", (zone) => {
  // The label formatter is made when lib/format.ts is first loaded, in the zone of that moment, so
  // the module is loaded again after the zone is set.
  let completedLabel: (completedAt: string) => string;

  beforeAll(async () => {
    process.env.TZ = zone;
    vi.resetModules();
    ({ completedLabel } = await import("./format"));
  });

  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });

  it("runs in that zone, or the checks below prove nothing", () => {
    expect(new Date(2026, 9, 14, 12).getTimezoneOffset()).toBe(OCTOBER_OFFSET[zone]);
    // The formatter agrees with Date. Its zone name is not compared, as ICU may spell it Calcutta.
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23" })
      .formatToParts(new Date("2026-10-14T18:30:00Z"))
      .find((part) => part.type === "hour");
    expect(Number(parts?.value)).toBe(HOUR_AT_1830Z[zone]);
    const day = (y: number, m: number, d: number) => new Date(y, m, d).getTime();
    expect((day(2026, 8, 28) - day(2026, 8, 27)) / HOUR).toBe(SHORT_DAY_HOURS[zone]);
    expect((day(2027, 3, 5) - day(2027, 3, 4)) / HOUR).toBe(LONG_DAY_HOURS[zone]);
  });

  describe("the local day of an instant", () => {
    it.each(LOCAL_DAYS)("%s", (instant, expected) => {
      expect(localDay(instant)).toBe(expected[zone]);
    });
  });

  describe("dates counted in calendar days, which no clock change can move", () => {
    it("adds days across the short day and the long day", () => {
      expect(addDays("2026-09-26", 1)).toBe("2026-09-27");
      expect(addDays("2026-09-26", 2)).toBe("2026-09-28");
      expect(addDays("2026-09-28", -1)).toBe("2026-09-27");
      expect(addDays("2026-09-28", -2)).toBe("2026-09-26");
      expect(addDays("2027-04-03", 1)).toBe("2027-04-04");
      expect(addDays("2027-04-03", 2)).toBe("2027-04-05");
      expect(addDays("2027-04-05", -2)).toBe("2027-04-03");
    });

    it("adds days across Auckland's clock change in April 2026, and the year end", () => {
      // The clocks went back there on Sunday 5 April 2026, so that day had 25 hours. The United
      // States changes are covered by lib/date.dst.test.ts, in a zone that has them.
      expect(addDays("2026-04-04", 1)).toBe("2026-04-05");
      expect(addDays("2026-04-04", 2)).toBe("2026-04-06");
      expect(addDays("2026-04-06", -2)).toBe("2026-04-04");
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    });

    it("finds Monday and Sunday of a week, whichever day of it is today", () => {
      expect(startOfWeek(TODAY)).toBe("2026-10-12");
      expect(endOfWeek(TODAY)).toBe("2026-10-18");
      // The Sunday the clocks went forward in Auckland, and the Monday after it.
      expect(startOfWeek("2026-09-27")).toBe("2026-09-21");
      expect(endOfWeek("2026-09-27")).toBe("2026-09-27");
      expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
      expect(endOfWeek("2026-09-28")).toBe("2026-10-04");
      // The Sunday the clocks went back in Auckland.
      expect(startOfWeek("2027-04-04")).toBe("2027-03-29");
      expect(endOfWeek("2027-03-29")).toBe("2027-04-04");
    });
  });

  describe("the time until midnight", () => {
    // The clocks change at 02:00 or 03:00, so 00:30 has the change still ahead of it.
    it("is shorter on the day the clocks go forward, and longer on the day they go back", () => {
      const short = (SHORT_DAY_HOURS[zone] - 0.5) * HOUR;
      const long = (LONG_DAY_HOURS[zone] - 0.5) * HOUR;
      expect(msUntilMidnight(new Date(2026, 8, 27, 0, 30))).toBe(short);
      expect(msUntilMidnight(new Date(2027, 3, 4, 0, 30))).toBe(long);
    });

    it("is the plain clock time on an ordinary day, and never 0", () => {
      expect(msUntilMidnight(new Date(2026, 9, 14, 12))).toBe(12 * HOUR);
      expect(msUntilMidnight(new Date(2026, 9, 14, 0, 0, 0))).toBe(24 * HOUR);
      expect(msUntilMidnight(new Date(2026, 9, 14, 23, 59, 59))).toBe(1000);
    });
  });

  describe("the queue for one day", () => {
    const open = [
      task("overdue", { dueDate: "2026-10-13" }),
      task("tomorrow", { dueDate: "2026-10-15" }),
      task("friday", { dueDate: "2026-10-17" }),
      task("next week", { dueDate: "2026-10-19" }),
    ];

    it("puts the open tasks in the same buckets in every zone, because today is passed in", () => {
      const queue = buildQueue(open, TODAY);
      expect(queue.dueSoon.map((t) => t.name)).toEqual(["overdue", "tomorrow"]);
      expect(queue.restOfWeek.map((t) => t.name)).toEqual(["friday"]);
      expect(queue.later.map((t) => t.name)).toEqual(["next week"]);
      expect(queue.doNow?.name).toBe("overdue");
    });

    it("counts a done task in this week by the local day it was completed on", () => {
      const queue = buildQueue([...open, SUNDAY_IN_UTC, MONDAY_IN_UTC_AHEAD, MIDWEEK], TODAY);
      expect(queue.done.map((t) => t.name)).toEqual(DONE_THIS_WEEK[zone]);
    });
  });

  describe("the day a task was completed", () => {
    it.each(COMPLETED_LABELS)("%s", (instant, expected) => {
      expect(completedLabel(instant)).toBe(expected[zone]);
    });
  });
});
