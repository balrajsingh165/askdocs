import { beforeEach, describe, expect, it } from "vitest";
import {
  answerCacheKey,
  getCachedAnswer,
  resetAnswerMemoryCache,
  setCachedAnswer,
} from "@/lib/cache/answer-cache";
import { makeTestDb } from "../../helpers/test-db";

beforeEach(() => resetAnswerMemoryCache());

describe("answerCacheKey", () => {
  it("is stable regardless of document-id order", () => {
    const a = answerCacheKey("u1", "What is X?", ["b", "a", "c"]);
    const b = answerCacheKey("u1", "What is X?", ["a", "b", "c"]);
    expect(a).toBe(b);
  });

  it("normalises the question (whitespace and case)", () => {
    const a = answerCacheKey("u1", "  What   is X? ", ["a"]);
    const b = answerCacheKey("u1", "what is x?", ["a"]);
    expect(a).toBe(b);
  });

  it("changes when the active document set changes", () => {
    const a = answerCacheKey("u1", "What is X?", ["a"]);
    const b = answerCacheKey("u1", "What is X?", ["a", "b"]);
    expect(a).not.toBe(b);
  });

  it("is scoped per user", () => {
    expect(answerCacheKey("u1", "q", ["a"])).not.toBe(
      answerCacheKey("u2", "q", ["a"]),
    );
  });
});

describe("answer cache storage", () => {
  it("returns undefined on a miss", () => {
    const { db } = makeTestDb();
    expect(getCachedAnswer(db, "missing")).toBeUndefined();
  });

  it("stores and retrieves an answer", () => {
    const { db } = makeTestDb();
    const key = answerCacheKey("u1", "q", ["a"]);
    setCachedAnswer(db, { key, userId: "u1", question: "q", answer: "42" });
    expect(getCachedAnswer(db, key)).toBe("42");
  });

  it("persists to the database beyond the in-memory layer", () => {
    const { db } = makeTestDb();
    const key = answerCacheKey("u1", "q", ["a"]);
    setCachedAnswer(db, { key, userId: "u1", question: "q", answer: "42" });
    resetAnswerMemoryCache();
    expect(getCachedAnswer(db, key)).toBe("42");
  });
});
