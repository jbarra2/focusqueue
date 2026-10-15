import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "better-sqlite3";
import { openDatabase } from "./db";
import {
  createTask,
  deleteTask,
  listCourses,
  listTasks,
  markDone,
  markOpen,
  updateTask,
} from "./tasks";
import type { TaskInput } from "./task-schema";

const INPUT: TaskInput = {
  name: "Made-up problem set",
  course: "Made-up course",
  description: "Chapters 1 and 2",
  dueDate: "2026-10-16",
  difficulty: "med",
};

const NOW = "2026-10-14T15:00:00.000Z";
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

let db: Database;

beforeEach(() => {
  db = openDatabase(":memory:");
});

function count(): number {
  return (db.prepare("SELECT count(*) AS n FROM task").get() as { n: number }).n;
}

describe("createTask and listTasks", () => {
  it("round-trips a task", () => {
    const task = createTask(db, INPUT, NOW);
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(listTasks(db)).toEqual([
      {
        id: task.id,
        name: INPUT.name,
        course: INPUT.course,
        description: INPUT.description,
        dueDate: INPUT.dueDate,
        difficulty: INPUT.difficulty,
        createdAt: NOW,
        completedAt: null,
      },
    ]);
  });

  it("trims text and defaults the description to empty", () => {
    const task = createTask(db, { ...INPUT, name: "  Essay  ", description: undefined }, NOW);
    expect(task.name).toBe("Essay");
    expect(listTasks(db)[0].description).toBe("");
  });

  it("stores text that looks like SQL as plain text", () => {
    const name = `Robert'); DROP TABLE task; --`;
    createTask(db, { ...INPUT, name }, NOW);
    expect(listTasks(db).map((t) => t.name)).toEqual([name]);
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a blank course", { course: "   " }],
    ["a bad difficulty", { difficulty: "hard" }],
    ["a date that does not exist", { dueDate: "2026-02-30" }],
    ["a date without padding", { dueDate: "2026-2-3" }],
    ["a name that is too long", { name: "x".repeat(201) }],
  ])("rejects %s and writes nothing", (_label, overrides) => {
    expect(() => createTask(db, { ...INPUT, ...overrides } as TaskInput, NOW)).toThrow();
    expect(count()).toBe(0);
  });
});

describe("updateTask", () => {
  it("replaces the fields and keeps id, created, and completed", () => {
    const task = createTask(db, INPUT, NOW);
    markDone(db, task.id, NOW);
    const changed = {
      ...INPUT,
      name: "Renamed",
      dueDate: "2026-10-20",
      difficulty: "high" as const,
    };
    expect(updateTask(db, task.id, changed)).toBe(true);
    expect(listTasks(db)[0]).toMatchObject({
      id: task.id,
      name: "Renamed",
      dueDate: "2026-10-20",
      difficulty: "high",
      createdAt: NOW,
      completedAt: NOW,
    });
  });

  it("leaves the task as it was when the input is invalid", () => {
    const task = createTask(db, INPUT, NOW);
    expect(() => updateTask(db, task.id, { ...INPUT, name: "" })).toThrow();
    expect(listTasks(db)[0].name).toBe(INPUT.name);
  });

  it("returns false for a missing or malformed id", () => {
    createTask(db, INPUT, NOW);
    expect(updateTask(db, MISSING_ID, INPUT)).toBe(false);
    expect(updateTask(db, "' OR 1=1 --", INPUT)).toBe(false);
  });
});

describe("deleteTask", () => {
  it("deletes only the given task", () => {
    const keep = createTask(db, INPUT, NOW);
    const gone = createTask(db, { ...INPUT, name: "Other" }, NOW);
    expect(deleteTask(db, gone.id)).toBe(true);
    expect(listTasks(db).map((t) => t.id)).toEqual([keep.id]);
  });

  it("returns false for a missing or malformed id", () => {
    createTask(db, INPUT, NOW);
    expect(deleteTask(db, MISSING_ID)).toBe(false);
    expect(deleteTask(db, "' OR 1=1 --")).toBe(false);
    expect(count()).toBe(1);
  });
});

describe("markDone and markOpen", () => {
  it("sets and clears completed_at", () => {
    const task = createTask(db, INPUT, NOW);
    expect(markDone(db, task.id, NOW)).toBe(true);
    expect(listTasks(db)[0].completedAt).toBe(NOW);
    expect(markOpen(db, task.id)).toBe(true);
    expect(listTasks(db)[0].completedAt).toBeNull();
  });

  it("keeps the first completion time when marked done twice", () => {
    const task = createTask(db, INPUT, NOW);
    markDone(db, task.id, NOW);
    markDone(db, task.id, "2026-10-15T09:00:00.000Z");
    expect(listTasks(db)[0].completedAt).toBe(NOW);
  });

  it("returns false for a missing id", () => {
    expect(markDone(db, MISSING_ID, NOW)).toBe(false);
    expect(markOpen(db, MISSING_ID)).toBe(false);
  });
});

describe("listCourses", () => {
  it("lists each course once, sorted without regard to case", () => {
    createTask(db, { ...INPUT, course: "physics" }, NOW);
    createTask(db, { ...INPUT, course: "Algebra" }, NOW);
    createTask(db, { ...INPUT, course: "physics" }, NOW);
    expect(listCourses(db)).toEqual(["Algebra", "physics"]);
  });
});
