import { config } from "../lib/config";
import { DEVELOPER_USER_ID } from "../lib/auth/session";
import { createDb } from "../lib/db/client";
import { upsertUser } from "../lib/db/repositories/users";

/**
 * Seed the developer user. Idempotent — safe to run repeatedly.
 * Run via `pnpm db:seed`.
 */
function main(): void {
  const { db, sqlite } = createDb(config.sqlitePath);
  upsertUser(db, { id: DEVELOPER_USER_ID, name: config.developerName });
  sqlite.close();
  console.log(`Seeded developer user '${config.developerName}'.`);
}

main();
