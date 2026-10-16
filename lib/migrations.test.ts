import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openDatabase } from "./db";
import { migrate, migrations } from "./migrations";

const VALID = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Made-up reading",
  group_name: null as string | null,
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

function addGroup(db: BetterSqlite3.Database, name: unknown, color: unknown) {
  db.prepare(`INSERT INTO task_group (name, color) VALUES (?, ?)`).run(name, color);
}

/** A database as an older version of the app left it, with foreign keys on as the app sets them. */
function databaseAtVersion(version: number): BetterSqlite3.Database {
  const db = new BetterSqlite3(":memory:");
  db.pragma("foreign_keys = ON");
  for (const migration of migrations.slice(0, version)) {
    if (typeof migration === "string") db.exec(migration);
    else migration(db);
  }
  db.pragma(`user_version = ${version}`);
  return db;
}

/** Inserts a version 2 task, which has a required group_name and no task_group table. */
function insertV2(db: BetterSqlite3.Database, n: number, group: string, createdAt: string) {
  db.prepare(
    `INSERT INTO task (id, name, group_name, description, due_date, difficulty, created_at)
     VALUES (?, ?, ?, '', '2026-10-14', 'low', ?)`,
  ).run(
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    `Made-up task ${n}`,
    group,
    createdAt,
  );
}

function groups(db: BetterSqlite3.Database) {
  return db.prepare(`SELECT name, color FROM task_group ORDER BY color`).all();
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

  it("renames course to group_name and keeps existing rows", () => {
    const db = databaseAtVersion(1);
    db.prepare(
      `INSERT INTO task (id, name, course, description, due_date, difficulty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(VALID.id, VALID.name, "Old course value", "", VALID.due_date, "low", VALID.created_at);

    migrate(db);

    expect(db.pragma("user_version", { simple: true })).toBe(migrations.length);
    expect(db.prepare("SELECT group_name FROM task").get()).toEqual({
      group_name: "Old course value",
    });
    expect(groups(db)).toEqual([{ name: "Old course value", color: 1 }]);
  });

  it("moves existing groups into task_group, one per name without case, in order of first use", () => {
    const db = databaseAtVersion(2);
    insertV2(db, 1, "Garden", "2026-10-01T08:00:00.000Z");
    insertV2(db, 2, "garden", "2026-10-01T09:00:00.000Z");
    insertV2(db, 3, "Errands", "2026-10-01T10:00:00.000Z");

    migrate(db);

    expect(groups(db)).toEqual([
      { name: "Garden", color: 1 },
      { name: "Errands", color: 2 },
    ]);
    // Both Garden tasks keep the spelling of the group.
    expect(db.prepare("SELECT group_name FROM task ORDER BY id").all()).toEqual([
      { group_name: "Garden" },
      { group_name: "Garden" },
      { group_name: "Errands" },
    ]);
  });

  it("migrates 8 groups, the number of colors a theme has", () => {
    const db = databaseAtVersion(2);
    for (let n = 1; n <= 8; n += 1) insertV2(db, n, `Group ${n}`, `2026-10-01T08:00:0${n}.000Z`);
    migrate(db);
    expect(groups(db)).toHaveLength(8);
  });

  it("refuses more than 8 groups with a clear message and changes nothing", () => {
    const db = databaseAtVersion(2);
    for (let n = 1; n <= 9; n += 1) insertV2(db, n, `Group ${n}`, `2026-10-01T08:00:0${n}.000Z`);

    expect(() => migrate(db)).toThrow(/9 groups, but a theme has 8 group colors/);

    expect(db.pragma("user_version", { simple: true })).toBe(2);
    expect(db.prepare("SELECT count(*) AS n FROM task").get()).toEqual({ n: 9 });
    expect(
      db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'task_group'").get(),
    ).toEqual({ n: 0 });
  });

  it("migrates a database with no tasks", () => {
    const db = databaseAtVersion(2);
    migrate(db);
    expect(groups(db)).toEqual([]);
    expect(() => insert(db, {})).not.toThrow();
  });
});

describe("task CHECK constraints", () => {
  it("accepts a valid row without a group", () => {
    const db = openDatabase(":memory:");
    expect(() => insert(db, {})).not.toThrow();
  });

  it("accepts a valid row in a group", () => {
    const db = openDatabase(":memory:");
    addGroup(db, "Home", 1);
    expect(() => insert(db, { group_name: "home" })).not.toThrow();
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a blank name", { name: "   " }],
    ["a group that does not exist", { group_name: "Nowhere" }],
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

  it("rejects a blank group even when foreign keys are off", () => {
    const db = openDatabase(":memory:");
    db.pragma("foreign_keys = OFF");
    expect(() => insert(db, { group_name: "" })).toThrow();
    expect(() => insert(db, { group_name: " \t" })).toThrow();
  });
});

describe("task_group constraints", () => {
  it.each([
    ["color 0", { name: "A", color: 0 }],
    ["color 9", { name: "A", color: 9 }],
    ["a color that is not a whole number", { name: "A", color: 1.5 }],
    ["a missing color", { name: "A", color: null }],
    ["a blank name", { name: " \t", color: 1 }],
    ["an empty name", { name: "", color: 1 }],
  ])("rejects %s", (_label, row) => {
    const db = openDatabase(":memory:");
    expect(() => addGroup(db, row.name, row.color)).toThrow();
    expect(groups(db)).toEqual([]);
  });

  it("rejects two groups with the same color", () => {
    const db = openDatabase(":memory:");
    addGroup(db, "A", 1);
    expect(() => addGroup(db, "B", 1)).toThrow();
  });

  it("rejects two names that differ only in case", () => {
    const db = openDatabase(":memory:");
    addGroup(db, "Home", 1);
    expect(() => addGroup(db, "home", 2)).toThrow();
    expect(groups(db)).toEqual([{ name: "Home", color: 1 }]);
  });
});
