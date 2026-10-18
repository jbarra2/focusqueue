import { addDays, endOfWeek, localDay, startOfWeek } from "./date";
import type { Difficulty, Task } from "./task";

// Pure functions. Today's date is always an argument, so nothing here reads the clock.
// Due dates are YYYY-MM-DD strings, compared as strings. The date helpers are in ./date.

export type Bucket = "dueSoon" | "restOfWeek" | "later";

export type Queue = {
  doNow: Task | null;
  dueSoon: Task[];
  restOfWeek: Task[];
  later: Task[];
  done: Task[];
};

const DIFFICULTY_RANK: Record<Difficulty, number> = { low: 0, med: 1, high: 2 };

export function bucketOf(task: Task, today: string): Bucket {
  if (task.dueDate <= addDays(today, 1)) return "dueSoon";
  if (task.dueDate <= endOfWeek(today)) return "restOfWeek";
  return "later";
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byDifficulty(a: Task, b: Task): number {
  return DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty];
}

function byDueDate(a: Task, b: Task): number {
  return compareText(a.dueDate, b.dueDate);
}

// The id is the last tie-break, so two tasks created in the same millisecond always sort the same
// way, instead of in whatever order the database returned them.
function byCreated(a: Task, b: Task): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt) || compareText(a.id, b.id);
}

/** Earliest due date, then low before med before high, then the task created first. */
export function compareDueSoon(a: Task, b: Task): number {
  return byDueDate(a, b) || byDifficulty(a, b) || byCreated(a, b);
}

/** Low before med before high, then earliest due date, then the task created first. */
export function compareRestOfWeek(a: Task, b: Task): number {
  return byDifficulty(a, b) || byDueDate(a, b) || byCreated(a, b);
}

/** Later has no rule beyond the date, so it reads like Due soon. */
export const compareLater = compareDueSoon;

function byCompletedDesc(a: Task, b: Task): number {
  return (
    Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? "") || compareText(a.id, b.id)
  );
}

/** Up next: every open task in queue order. Do now, if there is one, comes first. */
export function upNext(queue: Queue): Task[] {
  return [...queue.dueSoon, ...queue.restOfWeek, ...queue.later];
}

export function buildQueue(tasks: Task[], today: string): Queue {
  const open = tasks.filter((task) => task.completedAt === null);
  const dueSoon = open.filter((task) => bucketOf(task, today) === "dueSoon").sort(compareDueSoon);
  const restOfWeek = open
    .filter((task) => bucketOf(task, today) === "restOfWeek")
    .sort(compareRestOfWeek);
  const later = open.filter((task) => bucketOf(task, today) === "later").sort(compareLater);

  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const done = tasks
    .filter((task) => {
      if (task.completedAt === null) return false;
      const day = localDay(task.completedAt);
      return day >= weekStart && day <= weekEnd;
    })
    .sort(byCompletedDesc);

  // Later is never Do now.
  return { doNow: dueSoon[0] ?? restOfWeek[0] ?? null, dueSoon, restOfWeek, later, done };
}
