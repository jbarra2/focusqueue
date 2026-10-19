import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  emptyMessage,
  filterHref,
  hasActiveFilters,
  parseSearchParams,
  searchTextOf,
  stackView,
  VIEWS,
  type Filters,
  type RawSearchParams,
  type View,
} from "./filter";
import { buildQueue, type Queue } from "./sort";
import type { Group, Task } from "./task";

// 2026-10-14 is a Wednesday. Its week runs 2026-10-12 to 2026-10-18.
const today = "2026-10-14";

const groups: Group[] = [
  { name: "Home", color: 1 },
  { name: "Work", color: 2 },
];

let counter = 0;

function task(overrides: Partial<Task> & { name: string }): Task {
  counter += 1;
  return {
    id: `id-${counter}`,
    group: null,
    description: "",
    dueDate: today,
    difficulty: "med",
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

function filters(overrides: Partial<Filters> = {}): Filters {
  return { ...DEFAULT_FILTERS, ...overrides };
}

/** The tasks the stack shows for these filters. */
function shownTasks(queue: Queue, filters: Filters): Task[] {
  return stackView(queue, filters).tasks;
}

function rawOf(href: string): RawSearchParams {
  return Object.fromEntries(new URLSearchParams(href.split("?")[1] ?? ""));
}

const open = [
  task({ name: "Overdue", dueDate: "2026-10-12", group: "Home" }),
  task({ name: "Today", dueDate: "2026-10-14", difficulty: "low", group: "Work" }),
  task({ name: "Friday", dueDate: "2026-10-16", difficulty: "high" }),
  task({ name: "Saturday", dueDate: "2026-10-17", difficulty: "low", group: "home" }),
  task({ name: "Far away", dueDate: "2026-10-26", group: "Work" }),
];
const done = [
  task({ name: "Done Tuesday", completedAt: localNoon("2026-10-13"), group: "Home" }),
  task({ name: "Done Monday", completedAt: localNoon("2026-10-12"), difficulty: "high" }),
  task({ name: "Done last week", completedAt: localNoon("2026-10-09") }),
];
const queue = buildQueue([...open, ...done], today);

describe("parseSearchParams", () => {
  it("gives the defaults for an empty URL", () => {
    expect(parseSearchParams({}, groups)).toEqual({
      filters: DEFAULT_FILTERS,
      focusTaskId: null,
    });
  });

  it("reads each view, and falls back to Up next for an unknown one", () => {
    for (const { id } of VIEWS) {
      expect(parseSearchParams({ view: id }, groups).filters.view).toBe(id);
    }
    expect(parseSearchParams({ view: "nope" }, groups).filters.view).toBe("up-next");
    expect(parseSearchParams({ view: "" }, groups).filters.view).toBe("up-next");
    expect(parseSearchParams({ view: "Completed" }, groups).filters.view).toBe("up-next");
    // Names every object has are not views.
    for (const view of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(parseSearchParams({ view }, groups).filters.view).toBe("up-next");
    }
  });

  it("reads the difficulty, and ignores one that is not low, med or high", () => {
    expect(parseSearchParams({ difficulty: "high" }, groups).filters.difficulty).toBe("high");
    expect(parseSearchParams({ difficulty: "extreme" }, groups).filters.difficulty).toBeNull();
    expect(parseSearchParams({ difficulty: "HIGH" }, groups).filters.difficulty).toBeNull();
  });

  it("trims the search text, and ignores one over 200 characters", () => {
    expect(parseSearchParams({ q: "  report  " }, groups).filters.q).toBe("report");
    expect(parseSearchParams({ q: "   " }, groups).filters.q).toBe("");
    expect(parseSearchParams({ q: "x".repeat(200) }, groups).filters.q).toBe("x".repeat(200));
    expect(parseSearchParams({ q: "x".repeat(201) }, groups).filters.q).toBe("");
  });

  it("finds a group without case and keeps the name it is stored under", () => {
    expect(parseSearchParams({ group: "WORK" }, groups).filters.group).toEqual({
      kind: "named",
      name: "Work",
    });
  });

  it("means all groups for a group that does not exist", () => {
    expect(parseSearchParams({ group: "Ghost" }, groups).filters.group).toEqual({ kind: "all" });
    expect(parseSearchParams({ group: "Home" }, []).filters.group).toEqual({ kind: "all" });
    expect(parseSearchParams({ group: "" }, groups).filters.group).toEqual({ kind: "all" });
  });

  it("reads No group from its own parameter, which wins over a group", () => {
    expect(parseSearchParams({ nogroup: "1" }, groups).filters.group).toEqual({ kind: "none" });
    expect(parseSearchParams({ nogroup: "1", group: "Home" }, groups).filters.group).toEqual({
      kind: "none",
    });
    // Only "1" counts, and a group can be called "none" or "nogroup" without being mistaken.
    expect(parseSearchParams({ nogroup: "yes" }, groups).filters.group).toEqual({ kind: "all" });
    const odd: Group[] = [{ name: "none", color: 4 }];
    expect(parseSearchParams({ group: "none" }, odd).filters.group).toEqual({
      kind: "named",
      name: "none",
    });
  });

  it("reads a task id, and ignores one that is not an id", () => {
    const id = crypto.randomUUID();
    expect(parseSearchParams({ task: id }, groups).focusTaskId).toBe(id);
    expect(parseSearchParams({ task: "x" }, groups).focusTaskId).toBeNull();
    expect(parseSearchParams({ task: "' OR 1=1 --" }, groups).focusTaskId).toBeNull();
  });

  it("falls back to the default for a parameter given twice", () => {
    const result = parseSearchParams(
      { view: ["later", "completed"], difficulty: ["low", "high"], q: ["a", "b"], group: ["Home"] },
      groups,
    );
    expect(result.filters).toEqual(DEFAULT_FILTERS);
  });

  it("resets only the value that is bad, never the others", () => {
    const result = parseSearchParams(
      { view: "nope", difficulty: "low", q: "plan", group: "Work", task: "x" },
      groups,
    );
    expect(result.filters).toEqual({
      view: "up-next",
      group: { kind: "named", name: "Work" },
      difficulty: "low",
      q: "plan",
    });
    expect(result.focusTaskId).toBeNull();
  });

  it("ignores parameters it does not know, including ones named like object internals", () => {
    const raw = JSON.parse(
      '{"__proto__": "x", "constructor": "y", "other": "z"}',
    ) as RawSearchParams;
    expect(parseSearchParams(raw, groups)).toEqual({ filters: DEFAULT_FILTERS, focusTaskId: null });
  });
});

describe("shownTasks, by view", () => {
  it("Up next is every open task in queue order", () => {
    expect(names(shownTasks(queue, filters()))).toEqual([
      "Overdue",
      "Today",
      "Saturday",
      "Friday",
      "Far away",
    ]);
  });

  it("Due soon, Rest of this week and Later each show their own tasks in their own order", () => {
    expect(names(shownTasks(queue, filters({ view: "due-soon" })))).toEqual(["Overdue", "Today"]);
    // Low before high, so Saturday comes before Friday here, though Friday is due first.
    expect(names(shownTasks(queue, filters({ view: "rest-of-week" })))).toEqual([
      "Saturday",
      "Friday",
    ]);
    expect(names(shownTasks(queue, filters({ view: "later" })))).toEqual(["Far away"]);
  });

  it("Completed is this week's done tasks, most recent first, and nothing open", () => {
    expect(names(shownTasks(queue, filters({ view: "completed" })))).toEqual([
      "Done Tuesday",
      "Done Monday",
    ]);
  });

  it("a done task is in no other view", () => {
    for (const view of ["up-next", "due-soon", "rest-of-week", "later"] as const) {
      expect(names(shownTasks(queue, filters({ view }))).some((n) => n.startsWith("Done"))).toBe(
        false,
      );
    }
  });
});

describe("shownTasks, by group, difficulty and search", () => {
  it("keeps one group, matching without case", () => {
    expect(names(shownTasks(queue, filters({ group: { kind: "named", name: "Home" } })))).toEqual([
      "Overdue",
      "Saturday",
    ]);
    expect(names(shownTasks(queue, filters({ group: { kind: "named", name: "WORK" } })))).toEqual([
      "Today",
      "Far away",
    ]);
  });

  it("matches a group the way the database does, folding only English letters", () => {
    // Two different groups, as the database sees them. Lower-casing everything would merge them.
    const accents = buildQueue(
      [
        task({ name: "First", group: "Éclair" }),
        task({ name: "Second", group: "éclair" }),
        task({ name: "Third", group: "ÉCLAIR" }),
      ],
      today,
    );
    expect(
      names(shownTasks(accents, filters({ group: { kind: "named", name: "Éclair" } }))).sort(),
    ).toEqual(["First", "Third"]);
    expect(
      names(shownTasks(accents, filters({ group: { kind: "named", name: "éclair" } }))),
    ).toEqual(["Second"]);
  });

  it("keeps only tasks with no group for No group", () => {
    expect(names(shownTasks(queue, filters({ group: { kind: "none" } })))).toEqual(["Friday"]);
  });

  it("keeps one difficulty", () => {
    expect(names(shownTasks(queue, filters({ difficulty: "low" })))).toEqual(["Today", "Saturday"]);
    expect(names(shownTasks(queue, filters({ difficulty: "high" })))).toEqual(["Friday"]);
  });

  it("finds text in the name without case, and nowhere else", () => {
    expect(names(shownTasks(queue, filters({ q: "DAY" })))).toEqual([
      "Today",
      "Saturday",
      "Friday",
    ]);
    // The group is "Home", but the search looks only at the name.
    expect(shownTasks(queue, filters({ q: "home" }))).toEqual([]);
  });

  it("ignores spaces around the search text, and a search of only spaces", () => {
    expect(names(shownTasks(queue, filters({ q: "  sat " })))).toEqual(["Saturday"]);
    expect(shownTasks(queue, filters({ q: "   " }))).toHaveLength(5);
  });

  it("treats the search text as plain text, not a pattern", () => {
    expect(shownTasks(queue, filters({ q: ".*" }))).toEqual([]);
    expect(shownTasks(queue, filters({ q: "%" }))).toEqual([]);
  });

  it("combines every filter with the view", () => {
    expect(
      names(
        shownTasks(
          queue,
          filters({
            view: "rest-of-week",
            group: { kind: "named", name: "Home" },
            difficulty: "low",
            q: "sat",
          }),
        ),
      ),
    ).toEqual(["Saturday"]);
    expect(shownTasks(queue, filters({ view: "due-soon", group: { kind: "none" } }))).toEqual([]);
  });

  it("filters the Completed view too", () => {
    expect(names(shownTasks(queue, filters({ view: "completed", difficulty: "high" })))).toEqual([
      "Done Monday",
    ]);
    expect(
      names(shownTasks(queue, filters({ view: "completed", group: { kind: "none" } }))),
    ).toEqual(["Done Monday"]);
  });

  it("never changes the order of the view", () => {
    const all = names(shownTasks(queue, filters()));
    const some = names(shownTasks(queue, filters({ q: "a" })));
    expect(some).toEqual(all.filter((n) => some.includes(n)));
  });
});

describe("searchTextOf", () => {
  it("reads the search text from a query string, with or without the question mark", () => {
    expect(searchTextOf("?q=plan")).toBe("plan");
    expect(searchTextOf("q=plan")).toBe("plan");
    expect(searchTextOf("?view=later&q=plan&difficulty=low")).toBe("plan");
  });

  it("decodes it, and trims it, like the page does", () => {
    expect(searchTextOf("?q=a%26b+c")).toBe("a&b c");
    expect(searchTextOf("?q=%20%20plan%20")).toBe("plan");
    expect(searchTextOf("?q=%C3%A9")).toBe("é");
  });

  it("is empty when there is no search, or when it is longer than the limit", () => {
    expect(searchTextOf("")).toBe("");
    expect(searchTextOf("?view=later")).toBe("");
    expect(searchTextOf("?q=")).toBe("");
    expect(searchTextOf(`?q=${"x".repeat(201)}`)).toBe("");
    expect(searchTextOf(`?q=${"x".repeat(200)}`)).toBe("x".repeat(200));
  });

  it("is empty when the parameter is given more than once, as on the server", () => {
    expect(searchTextOf("?q=a&q=b")).toBe("");
    const raw = { q: ["a", "b"] };
    expect(parseSearchParams(raw, groups).filters.q).toBe("");
  });

  it("agrees with the page for the addresses the page builds", () => {
    for (const q of ["plan", "a&b=c #d é", "x".repeat(200), "a+b", "100%"]) {
      const href = filterHref(filters({ q }));
      const search = href.includes("?") ? `?${href.split("?")[1]}` : "";
      expect(searchTextOf(search)).toBe(q);
      expect(parseSearchParams(rawOf(href), groups).filters.q).toBe(q);
    }
  });
});

describe("filterHref", () => {
  it("is the bare path when everything is at its default", () => {
    expect(filterHref(DEFAULT_FILTERS)).toBe("/");
  });

  it("leaves out the defaults and keeps a fixed order", () => {
    expect(
      filterHref(
        filters({
          view: "completed",
          group: { kind: "named", name: "Home" },
          difficulty: "high",
          q: "plan",
        }),
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBe(
      "/?view=completed&group=Home&difficulty=high&q=plan&task=11111111-1111-4111-8111-111111111111",
    );
    expect(filterHref(filters({ group: { kind: "none" } }))).toBe("/?nogroup=1");
    expect(filterHref(filters({ difficulty: "low" }))).toBe("/?difficulty=low");
  });

  it("trims the search text, and leaves it out when it is only spaces", () => {
    expect(filterHref(filters({ q: "  plan  " }))).toBe("/?q=plan");
    expect(filterHref(filters({ q: "   " }))).toBe("/");
  });

  it("encodes characters that would break a URL", () => {
    const href = filterHref(
      filters({ q: "a&b=c #d", group: { kind: "named", name: "R&D / ops" } }),
    );
    expect(href).not.toContain(" ");
    expect(href).not.toContain("#");
    expect(href.split("&")).toHaveLength(2);
  });

  it("is read back as the same filters", () => {
    const cases: Filters[] = [
      DEFAULT_FILTERS,
      filters({ view: "later" }),
      filters({ group: { kind: "none" }, difficulty: "med" }),
      filters({ group: { kind: "named", name: "Work" }, q: "a&b=c #d é" }),
      filters({ view: "completed", difficulty: "high", q: "x".repeat(200) }),
    ];
    for (const original of cases) {
      const back = parseSearchParams(rawOf(filterHref(original)), groups).filters;
      expect(back).toEqual(original);
    }
  });

  it("is read back with the task it names", () => {
    const id = crypto.randomUUID();
    const result = parseSearchParams(rawOf(filterHref(filters({ view: "later" }), id)), groups);
    expect(result.focusTaskId).toBe(id);
    expect(result.filters.view).toBe("later");
  });
});

describe("hasActiveFilters", () => {
  it("is false for the view alone, and true for a group, difficulty or search", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ view: "completed" }))).toBe(false);
    expect(hasActiveFilters(filters({ group: { kind: "none" } }))).toBe(true);
    expect(hasActiveFilters(filters({ group: { kind: "named", name: "Home" } }))).toBe(true);
    expect(hasActiveFilters(filters({ difficulty: "low" }))).toBe(true);
    expect(hasActiveFilters(filters({ q: "x" }))).toBe(true);
    expect(hasActiveFilters(filters({ q: "  " }))).toBe(false);
  });
});

describe("emptyMessage", () => {
  const views: View[] = VIEWS.map((v) => v.id);

  it("says what the view is for when the view itself has no tasks", () => {
    expect(emptyMessage("up-next", false)).toBe("No open tasks.");
    expect(emptyMessage("due-soon", false)).toBe("Nothing is due soon.");
    expect(emptyMessage("rest-of-week", false)).toBe("Nothing else is due this week.");
    expect(emptyMessage("later", false)).toBe("Nothing is due after this week.");
    expect(emptyMessage("completed", false)).toBe("No tasks completed this week.");
  });

  it("says the filters hid everything when the view has tasks", () => {
    for (const view of views) {
      expect(emptyMessage(view, true)).toBe("No tasks match these filters.");
    }
  });
});

describe("stackView", () => {
  const onlyOpen = buildQueue(open, today);
  const nothing = buildQueue([], today);
  // Open tasks that are all due after this week, so nothing is Do now.
  const laterOnly = buildQueue(
    [
      task({ name: "Far", dueDate: "2026-11-02" }),
      task({ name: "Farther", dueDate: "2026-11-09" }),
    ],
    today,
  );

  it("gives the view's tasks, label and the Do now task", () => {
    const view = stackView(queue, filters({ view: "due-soon" }));
    expect(names(view.tasks)).toEqual(["Overdue", "Today"]);
    expect(view.label).toBe("Due soon");
    expect(view.doNowId).toBe(queue.doNow?.id);
    expect(view.notice).toBeUndefined();
  });

  it("says there are no open tasks when nothing is open, and no week-clear line", () => {
    const view = stackView(nothing, filters());
    expect(view.tasks).toEqual([]);
    expect(view.emptyMessage).toBe("No open tasks.");
    // The week-clear line goes above a stack. An empty stack shows just its own message.
    expect(view.notice).toBeUndefined();
  });

  it("gives no week-clear line when a filter hides every card, only the message", () => {
    const view = stackView(laterOnly, filters({ difficulty: "high" }));
    expect(view.tasks).toEqual([]);
    expect(view.emptyMessage).toBe("No tasks match these filters.");
    expect(view.notice).toBeUndefined();
  });

  it("says the week is clear on Up next when only Later tasks are open, and shows them", () => {
    const view = stackView(laterOnly, filters());
    expect(names(view.tasks)).toEqual(["Far", "Farther"]);
    expect(view.doNowId).toBeNull();
    expect(view.notice).toBe("The week is clear.");
  });

  it("says it only on Up next, not on the other views", () => {
    for (const view of ["due-soon", "rest-of-week", "later", "completed"] as const) {
      expect(stackView(laterOnly, filters({ view })).notice).toBeUndefined();
    }
  });

  it("does not say it when something is due this week, even if a filter hides it", () => {
    expect(stackView(onlyOpen, filters()).notice).toBeUndefined();
    const hidden = stackView(onlyOpen, filters({ q: "zzz" }));
    expect(hidden.tasks).toEqual([]);
    expect(hidden.notice).toBeUndefined();
  });

  it("says the filters hid every task when the view has some", () => {
    expect(stackView(onlyOpen, filters({ difficulty: "high", q: "zzz" })).emptyMessage).toBe(
      "No tasks match these filters.",
    );
  });

  it("keeps the plain message for a view with no tasks, even with a filter set", () => {
    const view = stackView(nothing, filters({ view: "completed", difficulty: "low" }));
    expect(view.emptyMessage).toBe("No tasks completed this week.");
    const later = stackView(onlyOpen, filters({ view: "later", q: "zzz" }));
    // Far away is in Later, so this one was hidden by the search, not empty to begin with.
    expect(later.emptyMessage).toBe("No tasks match these filters.");
    const noneLater = stackView(buildQueue(open.slice(0, 3), today), filters({ view: "later" }));
    expect(noneLater.emptyMessage).toBe("Nothing is due after this week.");
  });

  it("keeps the Do now task out of Completed, so no done card is marked Do now", () => {
    const view = stackView(queue, filters({ view: "completed" }));
    expect(view.tasks.some((t) => t.id === view.doNowId)).toBe(false);
  });
});
