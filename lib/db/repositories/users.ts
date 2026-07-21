import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { users, type UserRow } from "@/lib/db/schema";

/**
 * Data access for {@link users}.
 *
 * @module lib/db/repositories/users
 */

/**
 * Look up a user by id.
 *
 * @param db - Database client.
 * @param id - User id.
 * @returns The user row, or `undefined` if not found.
 */
export function getUserById(db: Db, id: string): UserRow | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

/**
 * Return the first user in the table, if any.
 *
 * @param db - Database client.
 * @returns The first user row, or `undefined` when the table is empty.
 */
export function getFirstUser(db: Db): UserRow | undefined {
  return db.select().from(users).limit(1).get();
}

/**
 * Insert a user if absent, or update its name if present.
 *
 * @param db - Database client.
 * @param input - User id and display name.
 * @returns The resulting user row.
 */
export function upsertUser(
  db: Db,
  input: { id: string; name: string },
): UserRow {
  return db
    .insert(users)
    .values({ id: input.id, name: input.name })
    .onConflictDoUpdate({ target: users.id, set: { name: input.name } })
    .returning()
    .get();
}
