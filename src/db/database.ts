/**
 * Database creation is centralized so every caller gets the same SQLite safety
 * defaults before repositories run SQL. If each repository opened its own handle,
 * migrations and append-only triggers could silently diverge between app paths.
 */
import Database from "better-sqlite3";
import path from "node:path";
import electron from "electron";

export type ReacherDatabase = Database.Database;

const { app } = electron;

export function openDatabase(databasePath = defaultDatabasePath()): ReacherDatabase {
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  // better-sqlite3 defaults busy_timeout to 0 -- any momentary lock
  // contention (a WAL checkpoint, antivirus briefly touching the -wal file)
  // fails the operation immediately instead of waiting a beat and retrying.
  // 5s matches what a single-writer desktop app needs without masking a
  // genuine deadlock.
  db.pragma("busy_timeout = 5000");
  return db;
}

export function defaultDatabasePath(): string {
  return path.join(app.getPath("userData"), "reacher.sqlite");
}
