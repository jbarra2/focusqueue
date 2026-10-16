import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDatabase } from "./db";
import { migrate, migrations } from "./migrations";

const VALID = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Made-up reading",
  group_name: "Made-up group",
  description: "",
  due_date: "2026-10-14",
  difficulty: "low",
  created_at: "2026-10-01T08:00:00.000Z",
};

function insert(
  db: BetterSqlite3.Database,
  overrides: Partial<Record<keyof typeof VALID, unknown>>,
) {
  const row = { ...VALID, ...overrides };
  db.prepare(
    `INSERT INTO task (id, name, group_name, description, due_date, difficulty, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.name,
    row.group_name,
    row.description,
    row.due_date,
    row.difficulty,
    row.created_at,
  );
}

describe("migrate", () => {
  it("brings a new database to the latest version", () => {
    const db = openDatabase(":memory:");
    expect(db.pragma("user_version", { simple: true })).toBe(migrations.length);
  });

  it("does nothing on a second run", () => {
    const db = openDatabase(":memory:");
    insert(db, {});
    migrate(db);
    expect(db.pragma("user_version", { simple: true })).toBe(migrations.length);
    expect(db.prepare("SELECT count(*) AS n FROM task").get()).toEqual({ n: 1 });
  });

  it("refuses a database newer than the app", () => {
    const db = new BetterSqlite3(":memory:");
    db.pragma(`user_version = ${migrations.length + 1}`);
    expect(() => migrate(db)).toThrow();
  });

  it("renames course to group_name and keeps existing rows and checks", () => {
    const db = new BetterSqlite3(":memory:");
    db.exec(migrations[0]);
    db.pragma("user_version = 1");
    db.prepare(
      `INSERT INTO task (id, name, course, description, due_date, difficulty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(VALID.id, VALID.name, "Old course value", "", VALID.due_date, "low", VALID.created_at);

    migrate(db);

    expect(db.pragma("user_version", { simple: true })).toBe(migrations.length);
    expect(db.prepare("SELECT group_name FROM task").get()).toEqual({
      group_name: "Old course value",
    });
    expect(() =>
      insert(db, { id: "00000000-0000-4000-8000-000000000002", group_name: " " }),
    ).toThrow();
    expect(db.prepare("SELECT count(*) AS n FROM task").get()).toEqual({ n: 1 });
  });
});

describe("task CHECK constraints", () => {
  it("accepts a valid row", () => {
    const db = openDatabase(":memory:");
    expect(() => insert(db, {})).not.toThrow();
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a blank name", { name: "   " }],
    ["an empty group", { group_name: "" }],
    ["a blank group", { group_name: " \t" }],
    ["an unknown difficulty", { difficulty: "medium" }],
    ["a date without padding", { due_date: "2026-2-3" }],
    ["a date that does not exist", { due_date: "2026-02-30" }],
    ["a timestamp as the due date", { due_date: "2026-10-14T00:00:00Z" }],
    ["a null description", { description: null }],
  ])("rejects %s", (_label, overrides) => {
    const db = openDatabase(":memory:");
    expect(() => insert(db, overrides)).toThrow();
    expect(db.prepare("SELECT count(*) AS n FROM task").get()).toEqual({ n: 0 });
  });
});
