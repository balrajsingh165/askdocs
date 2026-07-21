import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration. Used by `pnpm db:generate` to emit SQL migrations
 * from the schema. Migrations are applied by `scripts/migrate.ts`.
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.SQLITE_PATH ?? "data/askdocs.db",
  },
});
