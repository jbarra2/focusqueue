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

/** Overdue, Today, Tomorrow, or the date. */
export function dueLabel(dueDate: string, today: string): string {
  if (dueDate < today) return `Overdue · ${formatDay(dueDate)}`;
  if (dueDate === today) return "Today";
  if (dueDate === addDays(today, 1)) return "Tomorrow";
  return formatDay(dueDate);
}

/** The local day an ISO 8601 timestamp falls on, such as "Fri, Oct 17". */
export function completedLabel(completedAt: string): string {
  return formatDay(localDay(completedAt));
}
