import { beforeEach, describe, expect, it } from "vitest";
import {
  getCachedEmbedding,
  resetEmbeddingMemoryCache,
  setCachedEmbedding,
} from "@/lib/cache/embedding-cache";
import { makeTestDb } from "../../helpers/test-db";

beforeEach(() => resetEmbeddingMemoryCache());

describe("embedding cache", () => {
  it("returns undefined on a miss", () => {
    const { db } = makeTestDb();
    expect(getCachedEmbedding(db, "unseen text")).toBeUndefined();
  });

  it("stores and retrieves an embedding", () => {
    const { db } = makeTestDb();
    const vector = new Float32Array([0.1, 0.2, 0.3]);
    setCachedEmbedding(db, "hello", vector);
    expect(Array.from(getCachedEmbedding(db, "hello") ?? [])).toEqual(
      Array.from(vector),
    );
  });

  it("persists to the database beyond the in-memory layer", () => {
    const { db } = makeTestDb();
    const vector = new Float32Array([1, 2, 3, 4]);
    setCachedEmbedding(db, "persist me", vector);
    resetEmbeddingMemoryCache();
    const restored = getCachedEmbedding(db, "persist me");
    expect(Array.from(restored ?? [])).toEqual(Array.from(vector));
  });
});
