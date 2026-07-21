import { describe, expect, it } from "vitest";
import { RateLimitError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit/limiter";
import { makeTestDb } from "../../helpers/test-db";

describe("enforceRateLimit", () => {
  it("allows requests up to the limit, then rejects", () => {
    const { db } = makeTestDb();
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) {
      expect(() =>
        enforceRateLimit(db, "user:1", "ask", { limit: 3, now }),
      ).not.toThrow();
    }
    expect(() =>
      enforceRateLimit(db, "user:1", "ask", { limit: 3, now }),
    ).toThrow(RateLimitError);
  });

  it("sets a positive Retry-After on rejection", () => {
    const { db } = makeTestDb();
    const now = 1_000_000;
    enforceRateLimit(db, "user:1", "ask", { limit: 1, now });
    try {
      enforceRateLimit(db, "user:1", "ask", { limit: 1, now: now + 10_000 });
      throw new Error("expected a RateLimitError");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect((error as RateLimitError).retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("isolates subjects from one another", () => {
    const { db } = makeTestDb();
    const now = 1_000_000;
    enforceRateLimit(db, "user:1", "ask", { limit: 1, now });
    expect(() =>
      enforceRateLimit(db, "user:2", "ask", { limit: 1, now }),
    ).not.toThrow();
  });

  it("isolates routes from one another", () => {
    const { db } = makeTestDb();
    const now = 1_000_000;
    enforceRateLimit(db, "user:1", "ask", { limit: 1, now });
    expect(() =>
      enforceRateLimit(db, "user:1", "documents", { limit: 1, now }),
    ).not.toThrow();
  });

  it("allows requests again once the window has slid past", () => {
    const { db } = makeTestDb();
    enforceRateLimit(db, "user:1", "ask", { limit: 1, now: 1_000_000 });
    expect(() =>
      enforceRateLimit(db, "user:1", "ask", {
        limit: 1,
        now: 1_000_000 + 61_000,
      }),
    ).not.toThrow();
  });
});
