import { config } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { getUserById, upsertUser } from "@/lib/db/repositories/users";
import type { UserRow } from "@/lib/db/schema";
import { UnauthorizedError } from "@/lib/errors";

/**
 * Session resolution.
 *
 * In `developer` auth mode every request resolves to a single seeded user, so
 * reviewers need no login. `full` mode is the future seam for real multi-user
 * login (Auth.js) and is not implemented yet. Nothing outside this module
 * reads {@link config.authMode}.
 *
 * @module lib/auth/session
 */

/** Stable id of the seeded developer user. */
export const DEVELOPER_USER_ID = "developer";

/**
 * Resolve the current user, or `undefined` if none can be determined.
 *
 * In developer mode the seeded user is returned (and lazily created if the
 * database has not been seeded, so the app works on a fresh clone).
 *
 * @param db - Database client.
 * @returns The current user, or `undefined`.
 * @throws {UnauthorizedError} When `AUTH_MODE=full` (not implemented).
 */
export function getCurrentUser(db: Db): UserRow | undefined {
  if (config.authMode === "full") {
    throw new UnauthorizedError("Full auth mode is not implemented yet.");
  }
  return (
    getUserById(db, DEVELOPER_USER_ID) ??
    upsertUser(db, { id: DEVELOPER_USER_ID, name: config.developerName })
  );
}

/**
 * Resolve the current user or throw.
 *
 * @param db - Database client.
 * @returns The current, authenticated user.
 * @throws {UnauthorizedError} When no user can be resolved.
 */
export function requireUser(db: Db): UserRow {
  const user = getCurrentUser(db);
  if (!user) {
    throw new UnauthorizedError("Authentication required.");
  }
  return user;
}

/**
 * Rate-limiting subject for a user (the granularity limits are applied at).
 *
 * @param user - The current user.
 * @returns A stable subject string.
 */
export function subjectForUser(user: UserRow): string {
  return `user:${user.id}`;
}
