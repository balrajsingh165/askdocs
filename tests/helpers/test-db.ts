import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/**
 * Create a throwaway in-memory database with the schema applied via the real
 * migrations. Never touches the committed `data/askdocs.db`.
 *
 * @returns The Drizzle client and underlying handle.
 */
export function makeTestDb(): { db: Db; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return { db, sqlite };
}
