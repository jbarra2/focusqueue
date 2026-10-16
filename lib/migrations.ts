import "server-only";
import type { Database } from "better-sqlite3";

// A migration is SQL, or a function when it must check the data and fail with a clear message.
export type Migration = string | ((db: Database) => void);

// Ordered schema changes. PRAGMA user_version records how many have been applied.
// Never edit a committed migration. Add a new one to the end.
export const migrations: readonly Migration[] = [
  // trim() alone strips only spaces, so the text checks also strip tab, newlines, and form feed.
  `CREATE TABLE task (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name, char(32, 9, 10, 11, 12, 13))) > 0),
    course TEXT NOT NULL CHECK (length(trim(course, char(32, 9, 10, 11, 12, 13))) > 0),
    description TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL CHECK (
      due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND date(due_date) IS due_date
    ),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('low', 'med', 'high')),
    created_at TEXT NOT NULL,
    completed_at TEXT
  ) STRICT`,
  // The app is not tied to one field, so a task's course is now its group. The column keeps
  // its NOT NULL and CHECK constraints under the new name.
  `ALTER TABLE task RENAME COLUMN course TO group_name`,
  addTaskGroups,
];

/**
 * Groups become rows in task_group, each with one of the theme's 8 color slots, and a task's
 * group becomes optional. The 8 is written out here on purpose: a committed migration must not
 * change when the app's constants do.
 */
function addTaskGroups(db: Database): void {
  const found = db
    .prepare(`SELECT count(DISTINCT group_name COLLATE NOCASE) AS n FROM task`)
    .get() as { n: number };
  if (found.n > 8) {
    throw new Error(
      `This database has ${found.n} groups, but a theme has 8 group colors. ` +
        `Move tasks into at most 8 groups, then start the app again.`,
    );
  }
  const taskCount = (db.prepare(`SELECT count(*) AS n FROM task`).get() as { n: number }).n;

  db.exec(`
    CREATE TABLE task_group (
      name TEXT PRIMARY KEY COLLATE NOCASE
        CHECK (length(trim(name, char(32, 9, 10, 11, 12, 13))) > 0),
      color INTEGER NOT NULL UNIQUE CHECK (color BETWEEN 1 AND 8)
    ) STRICT;

    -- One group per name compared without case. With min(created_at), SQLite takes the bare
    -- column (group_name) from the row that has the minimum, so a group keeps the spelling of
    -- the task that used it first. Colors follow the order of first use.
    INSERT INTO task_group (name, color)
    SELECT name, row_number() OVER (ORDER BY first_used, name)
    FROM (
      SELECT group_name AS name, min(created_at) AS first_used
      FROM task
      GROUP BY group_name COLLATE NOCASE
    );

    CREATE TABLE task_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL CHECK (length(trim(name, char(32, 9, 10, 11, 12, 13))) > 0),
      group_name TEXT COLLATE NOCASE REFERENCES task_group(name) ON UPDATE CASCADE
        CHECK (group_name IS NULL OR length(trim(group_name, char(32, 9, 10, 11, 12, 13))) > 0),
      description TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL CHECK (
        due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(due_date) IS due_date
      ),
      difficulty TEXT NOT NULL CHECK (difficulty IN ('low', 'med', 'high')),
      created_at TEXT NOT NULL,
      completed_at TEXT
    ) STRICT;

    -- Each task stores its group's spelling.
    INSERT INTO task_new (id, name, group_name, description, due_date, difficulty, created_at, completed_at)
    SELECT t.id, t.name, g.name, t.description, t.due_date, t.difficulty, t.created_at, t.completed_at
    FROM task t JOIN task_group g ON g.name = t.group_name;

    DROP TABLE task;
    ALTER TABLE task_new RENAME TO task;
    CREATE INDEX task_by_group ON task(group_name);
  `);

  const copied = (db.prepare(`SELECT count(*) AS n FROM task`).get() as { n: number }).n;
  if (copied !== taskCount) {
    throw new Error(`Migration lost tasks: ${taskCount} before, ${copied} after.`);
  }
  if ((db.pragma("foreign_key_check") as unknown[]).length > 0) {
    throw new Error("Migration left a task pointing at a group that does not exist.");
  }
}

/** Applies every pending migration in one transaction. A failure leaves the schema as it was. */
export function migrate(db: Database): void {
  // The version is read inside an immediate transaction, so two processes opening a new
  // database at once cannot both decide to run the same migration.
  db.transaction(() => {
    const current = db.pragma("user_version", { simple: true }) as number;
    if (current > migrations.length) {
      throw new Error(
        `Database schema version ${current} is newer than this app (${migrations.length}).`,
      );
    }
    if (current === migrations.length) return;

    for (let version = current; version < migrations.length; version += 1) {
      const migration = migrations[version];
      if (typeof migration === "string") db.exec(migration);
      else migration(db);
    }
    // PRAGMA takes no placeholders. The value is a count from this file, never input.
    db.pragma(`user_version = ${migrations.length}`);
  }).immediate();
}
