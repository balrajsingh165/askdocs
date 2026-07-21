import { and, eq, gte, lt } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { rateLimitEvents } from "@/lib/db/schema";
import { RateLimitError } from "@/lib/errors";

/**
 * Per-subject sliding-window rate limiter, backed by the `rate_limit_events`
 * SQLite table. Each allowed request records an event; a request is rejected
 * when the number of events for `(subject, route)` within the window reaches
 * the limit.
 *
 * @module lib/ratelimit/limiter
 */

const DEFAULT_WINDOW_MS = 60_000;

/** Options for {@link enforceRateLimit}. */
export interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. Defaults to 60_000. */
  windowMs?: number;
  /** Current time in ms. Injectable for deterministic tests. */
  now?: number;
}

/**
 * Enforce the rate limit for a subject on a route, recording the request when
 * allowed.
 *
 * @param db - Database client.
 * @param subject - Rate-limit subject (e.g. `user:<id>`).
 * @param route - Route identifier (e.g. `ask`).
 * @param options - Limit, window, and injectable clock.
 * @throws {RateLimitError} When the limit is reached; carries `Retry-After`.
 */
export function enforceRateLimit(
  db: Db,
  subject: string,
  route: string,
  options: RateLimitOptions,
): void {
  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const windowStart = now - windowMs;

  db.delete(rateLimitEvents)
    .where(
      and(
        eq(rateLimitEvents.subject, subject),
        eq(rateLimitEvents.route, route),
        lt(rateLimitEvents.at, windowStart),
      ),
    )
    .run();

  const events = db
    .select({ at: rateLimitEvents.at })
    .from(rateLimitEvents)
    .where(
      and(
        eq(rateLimitEvents.subject, subject),
        eq(rateLimitEvents.route, route),
        gte(rateLimitEvents.at, windowStart),
      ),
    )
    .all();

  if (events.length >= options.limit) {
    const oldest = Math.min(...events.map((event) => event.at));
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
      retryAfterSeconds,
    );
  }

  db.insert(rateLimitEvents).values({ subject, route, at: now }).run();
}

/** Delete all rate-limit events. For test isolation only. */
export function clearRateLimitEvents(db: Db): void {
  db.delete(rateLimitEvents).run();
}
