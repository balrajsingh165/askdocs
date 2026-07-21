import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { config } from "@/lib/config";
import * as schema from "./schema";

/**
 * SQLite connection and Drizzle client.
 *
 * The connection is a process-wide singleton opened against the committed
 * database file in WAL mode. Repositories and services accept a {@link Db}
 * instance so that tests can pass a throwaway in-memory database instead of
 * touching the committed file.
 *
 * @module lib/db/client
 */

/** Typed Drizzle database bound to the AskDocs schema. */
export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Open a SQLite database and wrap it in a Drizzle client.
 *
 * @param path - File path, or `:memory:` for an ephemeral database.
 * @returns A Drizzle client and the underlying `better-sqlite3` handle.
 */
export function createDb(path: string): {
  db: Db;
  sqlite: Database.Database;
} {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { db: drizzle(sqlite, { schema }), sqlite };
}

const shared = createDb(config.sqlitePath);

/** The shared application database client (WAL, foreign keys on). */
export const db = shared.db;

/** The underlying `better-sqlite3` handle, for migrations and pragmas. */
export const sqlite = shared.sqlite;
