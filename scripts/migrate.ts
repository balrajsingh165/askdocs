import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { config } from "../lib/config";
import { createDb } from "../lib/db/client";

/**
 * Apply pending Drizzle migrations to the configured SQLite database.
 * Run via `pnpm db:migrate`.
 */
function main(): void {
  const { db, sqlite } = createDb(config.sqlitePath);
  migrate(db, { migrationsFolder: "drizzle" });
  sqlite.close();
  console.log(`Migrations applied to ${config.sqlitePath}.`);
}

main();
