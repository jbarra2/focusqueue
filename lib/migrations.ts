import "server-only";
import type { Database } from "better-sqlite3";

// Ordered schema changes. PRAGMA user_version records how many have been applied.
// Never edit a committed migration. Add a new one to the end.
export const migrations: readonly string[] = [
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
];

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
      db.exec(migrations[version]);
    }
    // PRAGMA takes no placeholders. The value is a count from this file, never input.
    db.pragma(`user_version = ${migrations.length}`);
  }).immediate();
}
