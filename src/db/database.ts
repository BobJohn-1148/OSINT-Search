/**
 * Database creation is centralized so every caller gets the same SQLite safety
 * defaults before repositories run SQL. If each repository opened its own handle,
 * migrations and append-only triggers could silently diverge between app paths.
 */
import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";

export type ReacherDatabase = Database.Database;

export function openDatabase(databasePath = defaultDatabasePath()): ReacherDatabase {
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  return db;
}

export function defaultDatabasePath(): string {
  return path.join(app.getPath("userData"), "reacher.sqlite");
}
