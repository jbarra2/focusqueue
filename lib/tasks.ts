import "server-only";
import type { Database } from "better-sqlite3";
import type { Difficulty, Task } from "./task";
import { taskIdSchema, taskInputSchema, type TaskInput } from "./task-schema";

// Every write parses its input with Zod first, then runs one prepared statement.
// SQL never contains input. Values go through ? placeholders.

type TaskRow = {
  id: string;
  name: string;
  course: string;
  description: string;
  due_date: string;
  difficulty: Difficulty;
  created_at: string;
  completed_at: string | null;
};

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    course: row.course,
    description: row.description,
    dueDate: row.due_date,
    difficulty: row.difficulty,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

/** Returns the id if it is a valid task id, otherwise null. */
function parseId(id: unknown): string | null {
  const result = taskIdSchema.safeParse(id);
  return result.success ? result.data : null;
}

export function listTasks(db: Database): Task[] {
  const rows = db
    .prepare(
      `SELECT id, name, course, description, due_date, difficulty, created_at, completed_at
       FROM task ORDER BY due_date, created_at`,
    )
    .all() as TaskRow[];
  return rows.map(toTask);
}

/** Course names already used, for suggestions. */
export function listCourses(db: Database): string[] {
  const rows = db
    .prepare(`SELECT DISTINCT course FROM task ORDER BY course COLLATE NOCASE`)
    .all() as { course: string }[];
  return rows.map((row) => row.course);
}

/** Adds a task. Throws a ZodError if the input is invalid. */
export function createTask(
  db: Database,
  input: TaskInput,
  now: string = new Date().toISOString(),
): Task {
  const data = taskInputSchema.parse(input);
  const task: Task = { id: crypto.randomUUID(), ...data, createdAt: now, completedAt: null };
  db.prepare(
    `INSERT INTO task (id, name, course, description, due_date, difficulty, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
  ).run(
    task.id,
    task.name,
    task.course,
    task.description,
    task.dueDate,
    task.difficulty,
    task.createdAt,
  );
  return task;
}

/** Replaces a task's fields. Returns false if no task has this id. Throws a ZodError if the input is invalid. */
export function updateTask(db: Database, id: string, input: TaskInput): boolean {
  const data = taskInputSchema.parse(input);
  const taskId = parseId(id);
  if (taskId === null) return false;
  const result = db
    .prepare(
      `UPDATE task SET name = ?, course = ?, description = ?, due_date = ?, difficulty = ?
       WHERE id = ?`,
    )
    .run(data.name, data.course, data.description, data.dueDate, data.difficulty, taskId);
  return result.changes > 0;
}

/** Returns false if no task has this id. */
export function deleteTask(db: Database, id: string): boolean {
  const taskId = parseId(id);
  if (taskId === null) return false;
  return db.prepare(`DELETE FROM task WHERE id = ?`).run(taskId).changes > 0;
}

/** Marks a task done. A task already done keeps its first completion time. Returns false if no task has this id. */
export function markDone(
  db: Database,
  id: string,
  now: string = new Date().toISOString(),
): boolean {
  const taskId = parseId(id);
  if (taskId === null) return false;
  return (
    db
      .prepare(`UPDATE task SET completed_at = COALESCE(completed_at, ?) WHERE id = ?`)
      .run(now, taskId).changes > 0
  );
}

/** Marks a task open again. Returns false if no task has this id. */
export function markOpen(db: Database, id: string): boolean {
  const taskId = parseId(id);
  if (taskId === null) return false;
  return db.prepare(`UPDATE task SET completed_at = NULL WHERE id = ?`).run(taskId).changes > 0;
}
