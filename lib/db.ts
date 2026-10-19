import "server-only";
import fs from "node:fs";
import path from "node:path";
import BetterSqlite3, { type Database } from "better-sqlite3";
import { migrate } from "./migrations";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "focusqueue.sqlite");

/**
 * Creates the data folder if it is missing, readable by its owner only. The mode applies to a
 * folder made here, not to one that already exists, and Windows ignores it.
 */
export function ensureDataDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Opens a database, sets its pragmas, and brings its schema up to date. */
export function openDatabase(filename: string): Database {
  const db = new BetterSqlite3(filename);
  if (filename !== ":memory:") db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  try {
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

// One connection per server process, kept on globalThis so dev hot reload reuses it.
const cache = globalThis as typeof globalThis & { focusqueueDb?: Database };

export function getDb(): Database {
  if (!cache.focusqueueDb) {
    ensureDataDir(DATA_DIR);
    cache.focusqueueDb = openDatabase(DB_PATH);
  }
  return cache.focusqueueDb;
}
