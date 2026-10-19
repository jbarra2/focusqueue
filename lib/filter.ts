import { z } from "zod";
import { findGroup, foldCase } from "./group";
import { upNext, type Queue } from "./sort";
import type { Difficulty, Group, Task } from "./task";
import { groupNameSchema, taskIdSchema } from "./task-schema";

// Pure functions for the header filters and the URL that holds them. They run on the server, to
// read the URL and pick the tasks, and in the browser, to build links, so nothing here touches
// the database. Every value read from the URL is checked, and a bad one falls back to its default.

// The one list of views, in the order the header shows them. The ids are what the URL holds.
const VIEW_LABELS = {
  "up-next": "Up next",
  "due-soon": "Due soon",
  "rest-of-week": "Rest of this week",
  later: "Later",
  completed: "Completed",
} as const;

export type View = keyof typeof VIEW_LABELS;

export const DEFAULT_VIEW: View = "up-next";

export const VIEWS: readonly { id: View; label: string }[] = (
  Object.keys(VIEW_LABELS) as View[]
).map((id) => ({ id, label: VIEW_LABELS[id] }));

export type GroupFilter =
  | { kind: "all" }
  | { kind: "none" }
  // The name as the group is stored, so a URL in other letter case still picks the same group.
  | { kind: "named"; name: string };

export type Filters = {
  view: View;
  group: GroupFilter;
  difficulty: Difficulty | null;
  /** Trimmed text to find in a task name, or "" for no search. */
  q: string;
};

export const DEFAULT_FILTERS: Filters = {
  view: DEFAULT_VIEW,
  group: { kind: "all" },
  difficulty: null,
  q: "",
};

/** The longest search text. A longer one in the URL is ignored. */
export const SEARCH_MAX_LENGTH = 200;

export function viewLabel(view: View): string {
  return VIEW_LABELS[view];
}

// The search text: trimmed, and ignored (empty) when longer than the limit.
const searchTextSchema = z.string().trim().max(SEARCH_MAX_LENGTH).catch("");

/**
 * The search text in a query string such as `window.location.search`, read the same way the page
 * reads it. A parameter given more than once counts as no search, like on the server.
 */
export function searchTextOf(search: string): string {
  const values = new URLSearchParams(search).getAll("q");
  return values.length === 1 ? searchTextSchema.parse(values[0]) : "";
}

// Each field has its own fallback, so one bad value never resets the others. A parameter that
// appears twice reaches here as a list, which is not a string, so it falls back too. The view is
// matched against the list's own keys, so a name like "constructor" is not a view.
const paramsSchema = z.object({
  view: z
    .custom<View>((value) => typeof value === "string" && Object.hasOwn(VIEW_LABELS, value))
    .catch(DEFAULT_VIEW),
  group: groupNameSchema.nullable().catch(null),
  nogroup: z.literal("1").nullable().catch(null),
  difficulty: z.enum(["low", "med", "high"]).nullable().catch(null),
  q: searchTextSchema,
  task: taskIdSchema.nullable().catch(null),
});

export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * The filters in a page URL, and the task a link asks to start on. Never throws. "No group" is
 * its own parameter, never a group name, because a group name is free text.
 */
export function parseSearchParams(
  raw: RawSearchParams,
  groups: Group[],
): { filters: Filters; focusTaskId: string | null } {
  const params = paramsSchema.parse(raw);
  let group: GroupFilter = { kind: "all" };
  if (params.nogroup === "1") {
    group = { kind: "none" };
  } else if (params.group !== null) {
    const found = findGroup(groups, params.group);
    // A group that does not exist, for example one that was emptied, means all groups.
    if (found) group = { kind: "named", name: found.name };
  }
  return {
    filters: { view: params.view, group, difficulty: params.difficulty, q: params.q },
    focusTaskId: params.task,
  };
}

/** The tasks of one view, in that view's own order, before the other filters. */
export function viewTasks(queue: Queue, view: View): Task[] {
  switch (view) {
    case "up-next":
      return upNext(queue);
    case "due-soon":
      return queue.dueSoon;
    case "rest-of-week":
      return queue.restOfWeek;
    case "later":
      return queue.later;
    case "completed":
      return queue.done;
  }
}

/** Keeps the tasks that match the group, difficulty and search. The order never changes. */
export function filterTasks(tasks: Task[], filters: Filters): Task[] {
  const { group, difficulty, q } = filters;
  const wantedGroup = group.kind === "named" ? foldCase(group.name) : null;
  const wantedText = q.trim().toLowerCase();
  return tasks.filter((task) => {
    if (group.kind === "none" && task.group !== null) return false;
    if (wantedGroup !== null && (task.group === null || foldCase(task.group) !== wantedGroup)) {
      return false;
    }
    if (difficulty !== null && task.difficulty !== difficulty) return false;
    return wantedText === "" || task.name.toLowerCase().includes(wantedText);
  });
}

/** Whether anything besides the view narrows the stack. */
export function hasActiveFilters(filters: Filters): boolean {
  return filters.group.kind !== "all" || filters.difficulty !== null || filters.q.trim() !== "";
}

/**
 * The page URL for these filters. Anything at its default is left out, so no filters at all is
 * "/". Parameters come in a fixed order. This is the only place a URL is built.
 */
export function filterHref(filters: Filters, focusTaskId: string | null = null): string {
  const params = new URLSearchParams();
  if (filters.view !== DEFAULT_VIEW) params.set("view", filters.view);
  if (filters.group.kind === "none") params.set("nogroup", "1");
  if (filters.group.kind === "named") params.set("group", filters.group.name);
  if (filters.difficulty !== null) params.set("difficulty", filters.difficulty);
  const q = filters.q.trim();
  if (q !== "") params.set("q", q);
  if (focusTaskId !== null) params.set("task", focusTaskId);
  const query = params.toString();
  return query === "" ? "/" : `/?${query}`;
}

const EMPTY_VIEW_MESSAGE: Record<View, string> = {
  "up-next": "No open tasks.",
  "due-soon": "Nothing is due soon.",
  "rest-of-week": "Nothing else is due this week.",
  later: "Nothing is due after this week.",
  completed: "No tasks completed this week.",
};

/**
 * What to say when the stack is empty. It depends on the view's own list before the other
 * filters: a view with nothing in it says so, even when a filter is also set. If the view has
 * tasks, the filters must have hidden them all.
 */
export function emptyMessage(view: View, viewHasTasks: boolean): string {
  return viewHasTasks ? "No tasks match these filters." : EMPTY_VIEW_MESSAGE[view];
}

export const WEEK_CLEAR_MESSAGE = "The week is clear.";

/**
 * Everything the card stack needs from the queue and the filters, so the page and the tests
 * work it out the same way: the tasks of the view, then the group, difficulty and search.
 * The week-clear line is about the week, not the filters, but it is drawn above a stack, so it is
 * only given when there are cards. An empty stack says its own message instead.
 */
export function stackView(
  queue: Queue,
  filters: Filters,
): {
  tasks: Task[];
  doNowId: string | null;
  label: string;
  emptyMessage: string;
  notice?: string;
} {
  const inView = viewTasks(queue, filters.view);
  const tasks = filterTasks(inView, filters);
  const doNowId = queue.doNow?.id ?? null;
  return {
    tasks,
    doNowId,
    label: viewLabel(filters.view),
    emptyMessage: emptyMessage(filters.view, inView.length > 0),
    notice:
      filters.view === "up-next" && doNowId === null && tasks.length > 0
        ? WEEK_CLEAR_MESSAGE
        : undefined,
  };
}
