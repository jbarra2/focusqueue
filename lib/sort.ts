import type { Difficulty, Task } from "./task";

// Pure functions. Today's date is always an argument, so nothing here reads the clock.
// Due dates are YYYY-MM-DD strings. They are compared as strings or turned into a local
// date from year, month, and day, never parsed with new Date("YYYY-MM-DD").

export type Bucket = "dueSoon" | "restOfWeek" | "later";

export type Queue = {
  focus: Task | null;
  dueSoon: Task[];
  restOfWeek: Task[];
  later: Task[];
  done: Task[];
};

const DIFFICULTY_RANK: Record<Difficulty, number> = { low: 0, med: 1, high: 2 };

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function formatDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

function localDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

/** Adds whole calendar days to a YYYY-MM-DD string. */
export function addDays(day: string, days: number): string {
  const date = localDate(day);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/** Days since Monday: Monday is 0 and Sunday is 6. */
function weekdayIndex(day: string): number {
  return (localDate(day).getDay() + 6) % 7;
}

export function startOfWeek(today: string): string {
  return addDays(today, -weekdayIndex(today));
}

/** The Sunday on or after today. */
export function endOfWeek(today: string): string {
  return addDays(today, 6 - weekdayIndex(today));
}

/** The local calendar day of an ISO 8601 timestamp. */
export function localDay(timestamp: string): string {
  return formatDate(new Date(timestamp));
}

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

function byCreated(a: Task, b: Task): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
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
  return Date.parse(b.completedAt ?? "") - Date.parse(a.completedAt ?? "");
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

  // Later never takes the focus card.
  return { focus: dueSoon[0] ?? restOfWeek[0] ?? null, dueSoon, restOfWeek, later, done };
}
