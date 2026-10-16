export type Difficulty = "low" | "med" | "high";

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
