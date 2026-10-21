import "server-only";
import type { Database } from "better-sqlite3";
import { firstFreeColor } from "./group";
import { isOldCompleted } from "./sort";
import type { Difficulty, Group, Task } from "./task";
import {
  calendarDaySchema,
  COLOR_TAKEN_MESSAGE,
  GROUP_LIMIT_MESSAGE,
  groupColorSchema,
  groupNameSchema,
  taskIdSchema,
  taskInputSchema,
  type TaskInput,
} from "./task-schema";

// Every write parses its input with Zod first, then runs as one transaction, so a failed write
// leaves the database as it was. SQL never contains input. Values go through ? placeholders.

/** An expected group failure. Its message is one sentence a person can act on, safe to show. */
export class GroupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupError";
  }
}

type TaskRow = {
  id: string;
  name: string;
  group_name: string | null;
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
    group: row.group_name,
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

/** The group with this name, matched without case, or undefined. */
function findGroup(db: Database, name: string): Group | undefined {
  return db.prepare(`SELECT name, color FROM task_group WHERE name = ?`).get(name) as
    Group | undefined;
}

/**
 * Returns the stored name of the group, matched without case, adding the group if it is new.
 * A new group takes the requested color, or the first free one. Run it inside a transaction.
 */
function resolveGroup(db: Database, name: string, color: number | undefined): string {
  const existing = findGroup(db, name);
  if (existing) return existing.name;

  const taken = new Set(
    (db.prepare(`SELECT color FROM task_group`).all() as { color: number }[]).map((r) => r.color),
  );
  const free = firstFreeColor(taken);
  if (free === null) throw new GroupError(GROUP_LIMIT_MESSAGE);
  if (color !== undefined && taken.has(color)) throw new GroupError(COLOR_TAKEN_MESSAGE);

  db.prepare(`INSERT INTO task_group (name, color) VALUES (?, ?)`).run(name, color ?? free);
  return name;
}

/** Deletes the group when no task uses it, which frees its color. Run it inside a transaction. */
function dropGroupIfUnused(db: Database, name: string): void {
  db.prepare(
    `DELETE FROM task_group
     WHERE name = ? AND NOT EXISTS (SELECT 1 FROM task WHERE group_name = ?)`,
  ).run(name, name);
}

export function listTasks(db: Database): Task[] {
  const rows = db
    .prepare(
      `SELECT id, name, group_name, description, due_date, difficulty, created_at, completed_at
       FROM task ORDER BY due_date, created_at`,
    )
    .all() as TaskRow[];
  return rows.map(toTask);
}

/** Every group in use with its color slot, for suggestions and for coloring cards. */
export function listGroups(db: Database): Group[] {
  return db
    .prepare(`SELECT name, color FROM task_group ORDER BY name COLLATE NOCASE`)
    .all() as Group[];
}

/**
 * Adds a task. Throws a ZodError if the input is invalid, or a GroupError if the group is new
 * and no color is free or the requested color is taken.
 */
export function createTask(
  db: Database,
  input: TaskInput,
  now: string = new Date().toISOString(),
): Task {
  const { groupColor, ...data } = taskInputSchema.parse(input);
  const id = crypto.randomUUID();
  return db
    .transaction((): Task => {
      const group = data.group === null ? null : resolveGroup(db, data.group, groupColor);
      const task: Task = { id, ...data, group, createdAt: now, completedAt: null };
      db.prepare(
        `INSERT INTO task (id, name, group_name, description, due_date, difficulty, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      ).run(
        task.id,
        task.name,
        task.group,
        task.description,
        task.dueDate,
        task.difficulty,
        task.createdAt,
      );
      return task;
    })
    .immediate();
}

/**
 * Replaces a task's fields. Returns false if no task has this id. Throws a ZodError if the input
 * is invalid, or a GroupError as createTask does. A group left without tasks is deleted.
 */
export function updateTask(db: Database, id: string, input: TaskInput): boolean {
  const { groupColor, ...data } = taskInputSchema.parse(input);
  const taskId = parseId(id);
  if (taskId === null) return false;
  return db
    .transaction((): boolean => {
      const before = db.prepare(`SELECT group_name FROM task WHERE id = ?`).get(taskId) as
        { group_name: string | null } | undefined;
      if (!before) return false;
      const oldGroup = before.group_name;

      // Moving the last task of a group to a new group frees the old color first, so it can
      // be used even when all colors were taken.
      if (oldGroup !== null && data.group !== null && !findGroup(db, data.group)) {
        db.prepare(`UPDATE task SET group_name = NULL WHERE id = ?`).run(taskId);
        dropGroupIfUnused(db, oldGroup);
      }

      const group = data.group === null ? null : resolveGroup(db, data.group, groupColor);
      db.prepare(
        `UPDATE task SET name = ?, group_name = ?, description = ?, due_date = ?, difficulty = ?
         WHERE id = ?`,
      ).run(data.name, group, data.description, data.dueDate, data.difficulty, taskId);
      if (oldGroup !== null) dropGroupIfUnused(db, oldGroup);
      return true;
    })
    .immediate();
}

/** Deletes a task, and its group if it was the last task using it. Returns false if no task has this id. */
export function deleteTask(db: Database, id: string): boolean {
  const taskId = parseId(id);
  if (taskId === null) return false;
  return db
    .transaction((): boolean => {
      const before = db.prepare(`SELECT group_name FROM task WHERE id = ?`).get(taskId) as
        { group_name: string | null } | undefined;
      if (!before) return false;
      db.prepare(`DELETE FROM task WHERE id = ?`).run(taskId);
      if (before.group_name !== null) dropGroupIfUnused(db, before.group_name);
      return true;
    })
    .immediate();
}

/**
 * Gives a group another color slot. Returns false if there is no such group. Throws a ZodError
 * for a color outside the slots, or a GroupError if another group already uses the color.
 */
export function setGroupColor(db: Database, name: string, color: number): boolean {
  const slot = groupColorSchema.parse(color);
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) return false;
  return db
    .transaction((): boolean => {
      const group = findGroup(db, parsed.data);
      if (!group) return false;
      const clash = db
        .prepare(`SELECT 1 AS taken FROM task_group WHERE color = ? AND name <> ?`)
        .get(slot, group.name);
      if (clash) throw new GroupError(COLOR_TAKEN_MESSAGE);
      db.prepare(`UPDATE task_group SET color = ? WHERE name = ?`).run(slot, group.name);
      return true;
    })
    .immediate();
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

/**
 * Deletes every task completed before this week, and each group that is left with no tasks, which
 * frees its color. It is one transaction, so a failure changes nothing. Returns how many tasks went.
 * `today` is the local day as YYYY-MM-DD. The caller reads the clock, so the rule can be tested, and
 * a date that is not one throws a ZodError before anything is deleted. The tasks are picked with
 * isOldCompleted, the same rule the page counts them with, and deleted by id.
 */
export function clearOldCompleted(db: Database, today: string): number {
  const day = calendarDaySchema.parse(today);
  return db
    .transaction((): number => {
      const done = db
        .prepare(`SELECT id, group_name, completed_at FROM task WHERE completed_at IS NOT NULL`)
        .all() as { id: string; group_name: string | null; completed_at: string }[];
      const old = done.filter((row) => isOldCompleted({ completedAt: row.completed_at }, day));
      const remove = db.prepare(`DELETE FROM task WHERE id = ?`);
      for (const row of old) remove.run(row.id);
      const groups = new Set(
        old.flatMap((row) => (row.group_name === null ? [] : [row.group_name])),
      );
      for (const name of groups) dropGroupIfUnused(db, name);
      return old.length;
    })
    .immediate();
}
