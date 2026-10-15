import "server-only";
import fs from "node:fs";
import path from "node:path";
import BetterSqlite3, { type Database } from "better-sqlite3";
import { migrate } from "./migrations";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "focusqueue.sqlite");

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
    fs.mkdirSync(DATA_DIR, { recursive: true });
    cache.focusqueueDb = openDatabase(DB_PATH);
  }
  return cache.focusqueueDb;
}
