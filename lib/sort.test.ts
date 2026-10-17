import { describe, expect, it } from "vitest";
import { addDays, bucketOf, buildQueue, endOfWeek, startOfWeek, upNext } from "./sort";
import type { Difficulty, Task } from "./task";

// 2026-10-14 is a Wednesday. Its week runs 2026-10-12 to 2026-10-18.
const WEDNESDAY = "2026-10-14";
const SUNDAY = "2026-10-18";

let counter = 0;

function task(overrides: Partial<Task> & { name: string }): Task {
  counter += 1;
  return {
    id: `id-${counter}`,
    group: "Made-up group",
    description: "",
    dueDate: WEDNESDAY,
    difficulty: "med" as Difficulty,
    createdAt: `2026-10-01T08:00:${String(counter % 60).padStart(2, "0")}.000Z`,
    completedAt: null,
    ...overrides,
  };
}

function localNoon(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12).toISOString();
}

function names(tasks: Task[]): string[] {
  return tasks.map((t) => t.name);
}

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
});

describe("buckets", () => {
  it("puts overdue, today, and tomorrow in Due soon", () => {
    expect(bucketOf(task({ name: "a", dueDate: "2026-09-01" }), WEDNESDAY)).toBe("dueSoon");
    expect(bucketOf(task({ name: "b", dueDate: "2026-10-14" }), WEDNESDAY)).toBe("dueSoon");
    expect(bucketOf(task({ name: "c", dueDate: "2026-10-15" }), WEDNESDAY)).toBe("dueSoon");
  });

  it("puts the day after tomorrow through Sunday in Rest of this week", () => {
    expect(bucketOf(task({ name: "a", dueDate: "2026-10-16" }), WEDNESDAY)).toBe("restOfWeek");
    expect(bucketOf(task({ name: "b", dueDate: SUNDAY }), WEDNESDAY)).toBe("restOfWeek");
  });

  it("puts anything after Sunday in Later", () => {
    expect(bucketOf(task({ name: "a", dueDate: "2026-10-19" }), WEDNESDAY)).toBe("later");
  });
});

describe("Due soon order", () => {
  it("puts an overdue task first", () => {
    const queue = buildQueue(
      [
        task({ name: "tomorrow", dueDate: "2026-10-15" }),
        task({ name: "overdue", dueDate: "2026-10-01", difficulty: "high" }),
        task({ name: "today", dueDate: WEDNESDAY, difficulty: "low" }),
      ],
      WEDNESDAY,
    );
    expect(names(queue.dueSoon)).toEqual(["overdue", "today", "tomorrow"]);
    expect(queue.doNow?.name).toBe("overdue");
  });

  it("orders low, med, high on the same date", () => {
    const queue = buildQueue(
      [
        task({ name: "high", difficulty: "high" }),
        task({ name: "low", difficulty: "low" }),
        task({ name: "med", difficulty: "med" }),
      ],
      WEDNESDAY,
    );
    expect(names(queue.dueSoon)).toEqual(["low", "med", "high"]);
  });

  it("breaks a full tie by the task created first", () => {
    const queue = buildQueue(
      [
        task({ name: "second", createdAt: "2026-10-02T09:00:00.000Z" }),
        task({ name: "first", createdAt: "2026-10-02T08:00:00.000Z" }),
      ],
      WEDNESDAY,
    );
    expect(names(queue.dueSoon)).toEqual(["first", "second"]);
  });
});

describe("Rest of this week order", () => {
  it("orders by difficulty, then due date, then created", () => {
    const queue = buildQueue(
      [
        task({ name: "high-fri", dueDate: "2026-10-16", difficulty: "high" }),
        task({ name: "low-sun", dueDate: SUNDAY, difficulty: "low" }),
        task({
          name: "low-fri-late",
          dueDate: "2026-10-16",
          difficulty: "low",
          createdAt: "2026-10-03T00:00:00.000Z",
        }),
        task({
          name: "low-fri-early",
          dueDate: "2026-10-16",
          difficulty: "low",
          createdAt: "2026-10-02T00:00:00.000Z",
        }),
        task({ name: "med-sat", dueDate: "2026-10-17", difficulty: "med" }),
      ],
      WEDNESDAY,
    );
    expect(names(queue.restOfWeek)).toEqual([
      "low-fri-early",
      "low-fri-late",
      "low-sun",
      "med-sat",
      "high-fri",
    ]);
  });

  it("takes Do now when Due soon is empty", () => {
    const queue = buildQueue([task({ name: "friday", dueDate: "2026-10-16" })], WEDNESDAY);
    expect(queue.doNow?.name).toBe("friday");
  });
});

describe("Later", () => {
  it("is never Do now", () => {
    const queue = buildQueue(
      [task({ name: "next week", dueDate: "2026-10-26", difficulty: "low" })],
      WEDNESDAY,
    );
    expect(names(queue.later)).toEqual(["next week"]);
    expect(queue.doNow).toBeNull();
  });

  it("holds a task due after Sunday while an earlier one is Do now", () => {
    const queue = buildQueue(
      [
        task({ name: "later", dueDate: "2026-10-20", difficulty: "low" }),
        task({ name: "soon", dueDate: "2026-10-15", difficulty: "high" }),
      ],
      WEDNESDAY,
    );
    expect(queue.doNow?.name).toBe("soon");
    expect(names(queue.later)).toEqual(["later"]);
  });
});

describe("a Sunday", () => {
  it("treats a task due Monday as due soon", () => {
    const queue = buildQueue(
      [
        task({ name: "monday", dueDate: "2026-10-19" }),
        task({ name: "tuesday", dueDate: "2026-10-20" }),
      ],
      SUNDAY,
    );
    expect(names(queue.dueSoon)).toEqual(["monday"]);
    expect(names(queue.later)).toEqual(["tuesday"]);
    expect(queue.doNow?.name).toBe("monday");
  });
});

describe("an empty week", () => {
  it("has no Do now task", () => {
    const queue = buildQueue([], WEDNESDAY);
    expect(queue).toEqual({ doNow: null, dueSoon: [], restOfWeek: [], later: [], done: [] });
  });
});

describe("Done", () => {
  it("lists tasks completed this week, most recent first, and keeps them out of the queue", () => {
    const queue = buildQueue(
      [
        task({ name: "mon", completedAt: localNoon("2026-10-12") }),
        task({ name: "tue", completedAt: localNoon("2026-10-13") }),
        task({ name: "last week", completedAt: localNoon("2026-10-11") }),
        task({ name: "open", dueDate: WEDNESDAY }),
      ],
      WEDNESDAY,
    );
    expect(names(queue.done)).toEqual(["tue", "mon"]);
    expect(names(queue.dueSoon)).toEqual(["open"]);
  });

  it("does not let a completed overdue task be Do now", () => {
    const queue = buildQueue(
      [task({ name: "finished", dueDate: "2026-10-01", completedAt: localNoon(WEDNESDAY) })],
      WEDNESDAY,
    );
    expect(queue.doNow).toBeNull();
  });
});

describe("Up next", () => {
  it("lists every open task in queue order: Due soon, Rest of this week, then Later", () => {
    const queue = buildQueue(
      [
        task({ name: "later", dueDate: "2026-10-26" }),
        task({ name: "friday", dueDate: "2026-10-16" }),
        task({ name: "overdue", dueDate: "2026-10-01" }),
        task({ name: "today", dueDate: WEDNESDAY, difficulty: "low" }),
      ],
      WEDNESDAY,
    );
    expect(names(upNext(queue))).toEqual(["overdue", "today", "friday", "later"]);
  });

  it("starts with Do now when there is one", () => {
    const queue = buildQueue([task({ name: "friday", dueDate: "2026-10-16" })], WEDNESDAY);
    expect(upNext(queue)[0]).toBe(queue.doNow);
  });

  it("starts with a Later task when nothing else is open, and Do now stays empty", () => {
    const queue = buildQueue([task({ name: "next week", dueDate: "2026-10-26" })], WEDNESDAY);
    expect(names(upNext(queue))).toEqual(["next week"]);
    expect(queue.doNow).toBeNull();
  });

  it("leaves out done tasks", () => {
    const queue = buildQueue(
      [
        task({ name: "finished", completedAt: localNoon(WEDNESDAY) }),
        task({ name: "open", dueDate: WEDNESDAY }),
      ],
      WEDNESDAY,
    );
    expect(names(upNext(queue))).toEqual(["open"]);
  });

  it("is empty for an empty week", () => {
    expect(upNext(buildQueue([], WEDNESDAY))).toEqual([]);
  });
});

describe("ties", () => {
  it("sorts tasks created in the same millisecond by id, whatever order they arrive in", () => {
    const same = "2026-10-02T08:00:00.000Z";
    const first = task({ name: "first", id: "aaa", createdAt: same });
    const second = task({ name: "second", id: "bbb", createdAt: same });
    expect(names(buildQueue([second, first], WEDNESDAY).dueSoon)).toEqual(["first", "second"]);
    expect(names(buildQueue([first, second], WEDNESDAY).dueSoon)).toEqual(["first", "second"]);
  });

  it("sorts tasks completed at the same moment by id", () => {
    const at = localNoon(WEDNESDAY);
    const a = task({ name: "a", id: "aaa", completedAt: at });
    const b = task({ name: "b", id: "bbb", completedAt: at });
    expect(names(buildQueue([b, a], WEDNESDAY).done)).toEqual(["a", "b"]);
  });

  it("leaves the tasks it is given in their order", () => {
    const tasks = [
      task({ name: "later", dueDate: "2026-10-26" }),
      task({ name: "today", dueDate: WEDNESDAY }),
    ];
    buildQueue(tasks, WEDNESDAY);
    expect(names(tasks)).toEqual(["later", "today"]);
  });
});

describe("other days of the week", () => {
  it("on a Saturday, Sunday is due tomorrow and Monday is Later", () => {
    const queue = buildQueue(
      [task({ name: "sunday", dueDate: SUNDAY }), task({ name: "monday", dueDate: "2026-10-19" })],
      "2026-10-17",
    );
    expect(names(queue.dueSoon)).toEqual(["sunday"]);
    expect(names(queue.restOfWeek)).toEqual([]);
    expect(names(queue.later)).toEqual(["monday"]);
  });

  it("on a Monday, today and tomorrow are Due soon, the rest of the week follows, and next Monday is Later", () => {
    const queue = buildQueue(
      [
        task({ name: "mon", dueDate: "2026-10-12" }),
        task({ name: "tue", dueDate: "2026-10-13" }),
        task({ name: "wed", dueDate: "2026-10-14" }),
        task({ name: "sun", dueDate: SUNDAY }),
        task({ name: "next monday", dueDate: "2026-10-19" }),
      ],
      "2026-10-12",
    );
    expect(names(queue.dueSoon)).toEqual(["mon", "tue"]);
    expect(names(queue.restOfWeek)).toEqual(["wed", "sun"]);
    expect(names(queue.later)).toEqual(["next monday"]);
  });

  it("crosses a month and a year without losing a day", () => {
    // 2026-12-31 is a Thursday. Its week ends on Sunday 2027-01-03.
    const queue = buildQueue(
      [
        task({ name: "new year", dueDate: "2027-01-01" }),
        task({ name: "sunday", dueDate: "2027-01-03" }),
        task({ name: "monday", dueDate: "2027-01-04" }),
      ],
      "2026-12-31",
    );
    expect(names(queue.dueSoon)).toEqual(["new year"]);
    expect(names(queue.restOfWeek)).toEqual(["sunday"]);
    expect(names(queue.later)).toEqual(["monday"]);
  });

  it("takes a leap day as a real day", () => {
    // 2028-02-29 is a Tuesday.
    const queue = buildQueue([task({ name: "leap", dueDate: "2028-02-29" })], "2028-02-28");
    expect(names(queue.dueSoon)).toEqual(["leap"]);
  });
});

describe("the edges of the week for Done", () => {
  const local = (y: number, m: number, d: number, h: number, min: number) =>
    new Date(y, m - 1, d, h, min).toISOString();

  it("counts the first minute of Monday and the last minute of Sunday as this week", () => {
    const queue = buildQueue(
      [
        task({ name: "monday start", completedAt: local(2026, 10, 12, 0, 0) }),
        task({ name: "sunday end", completedAt: local(2026, 10, 18, 23, 59) }),
      ],
      WEDNESDAY,
    );
    expect(names(queue.done)).toEqual(["sunday end", "monday start"]);
  });

  it("leaves out the last minute of the week before and the first minute of the week after", () => {
    const queue = buildQueue(
      [
        task({ name: "before", completedAt: local(2026, 10, 11, 23, 59) }),
        task({ name: "after", completedAt: local(2026, 10, 19, 0, 0) }),
      ],
      WEDNESDAY,
    );
    expect(names(queue.done)).toEqual([]);
  });
});
