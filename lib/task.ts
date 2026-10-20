/**
 * The difficulties, easiest first. The order is also the sort order for tasks on the same date,
 * and the order of the choices on screen. The database CHECK has its own copy, which a test keeps
 * in step with this list.
 */
export const DIFFICULTIES = ["low", "med", "high"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

/** What each difficulty is called on screen. */
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  low: "Low",
  med: "Medium",
  high: "High",
};

export type Group = {
  name: string;
  /** Color slot from 1 to 8. The theme decides what the slot looks like. */
  color: number;
};

export type Task = {
  id: string;
  name: string;
  /** Name of a group, or null when the task has no group. */
  group: string | null;
  description: string;
  /** Calendar day as YYYY-MM-DD. */
  dueDate: string;
  difficulty: Difficulty;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp, or null while the task is open. */
  completedAt: string | null;
};
