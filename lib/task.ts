export type Difficulty = "low" | "med" | "high";

export type Task = {
  id: string;
  name: string;
  group: string;
  description: string;
  /** Calendar day as YYYY-MM-DD. */
  dueDate: string;
  difficulty: Difficulty;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp, or null while the task is open. */
  completedAt: string | null;
};
