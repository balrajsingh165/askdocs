import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

/**
 * Liveness probe. Unauthenticated (excluded from the proxy matcher). Confirms
 * the process is up and the database is reachable.
 *
 * @returns `{ status: "ok" }` on success, `503` if the database is unreachable.
 */
export function GET(): NextResponse {
  try {
    db.get(sql`SELECT 1`);
    return NextResponse.json({ status: "ok", timestamp: Date.now() });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Database unavailable." },
      { status: 503 },
    );
  }
}
