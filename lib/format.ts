import { addDays, localDate, localDay } from "./date";

// Pure functions. Today's date is an argument, so nothing here reads the clock.
// Dates are built from year, month, and day, never from new Date("YYYY-MM-DD").

const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** A calendar day such as "Fri, Oct 17". */
export function formatDay(day: string): string {
  return dayFormat.format(localDate(day));
}

type Dated = { dueDate: string; completedAt: string | null };

/** Whether an open task is past its due date. A done task is never overdue. */
export function isOverdue(task: Dated, today: string): boolean {
  return task.completedAt === null && task.dueDate < today;
}

/** Overdue, Today, Tomorrow, or the date. Only an open task is overdue. */
export function dueLabel(task: Dated, today: string): string {
  if (isOverdue(task, today)) return `Overdue · ${formatDay(task.dueDate)}`;
  if (task.dueDate === today) return "Today";
  if (task.dueDate === addDays(today, 1)) return "Tomorrow";
  return formatDay(task.dueDate);
}

const characters = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Text cut to at most `max` characters, ending with an ellipsis when it was cut. A character is
 * what a person sees as one, so an emoji or a letter with an accent is never split, and a space
 * before the cut is dropped. It is for showing only: the full text is kept where it is stored.
 */
export function truncateLabel(text: string, max: number): string {
  const parts = Array.from(characters.segment(text), (part) => part.segment);
  if (parts.length <= max) return text;
  return (
    parts
      .slice(0, Math.max(0, max - 1))
      .join("")
      .trimEnd() + "…"
  );
}

/** The local day an ISO 8601 timestamp falls on, such as "Fri, Oct 17". */
export function completedLabel(completedAt: string): string {
  return formatDay(localDay(completedAt));
}
