import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", async () => {
  const BetterSqlite = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const schema = await import("@/lib/db/schema");
  const sqlite = new BetterSqlite(":memory:");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return { db, sqlite, createDb: () => ({ db, sqlite }) };
});

const { GET } = await import("@/app/api/health/route");

describe("GET /api/health", () => {
  it("reports ok when the database is reachable", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});
