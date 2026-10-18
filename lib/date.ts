// Pure functions. Due dates are YYYY-MM-DD strings. They are compared as strings or turned into a
// local date from year, month, and day, never parsed with new Date("YYYY-MM-DD"), which reads the
// string as UTC midnight and can shift the day.

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function formatDate(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

export function localDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const result = new Date(2000, month - 1, date);
  // The Date constructor reads years 0 to 99 as 1900 to 1999, so the year is set separately.
  result.setFullYear(year);
  return result;
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
