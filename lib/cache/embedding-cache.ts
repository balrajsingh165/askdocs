import { eq } from "drizzle-orm";
import { EMBEDDING_MODEL } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { embeddingCache } from "@/lib/db/schema";
import { sha256 } from "@/lib/hash";
import { bufferToVector, vectorToBuffer } from "@/lib/rag/vector";

/**
 * Embedding cache: identical chunk text is embedded once and reused.
 *
 * Backed by the `embedding_cache` SQLite table with a process-level in-memory
 * fast path. The cache key is a hash of `(chunk text + embedding model)`.
 *
 * @module lib/cache/embedding-cache
 */

const memory = new Map<string, Float32Array>();

function keyFor(text: string): string {
  return sha256(EMBEDDING_MODEL, text);
}

/**
 * Look up a cached embedding for the given text.
 *
 * @param db - Database client.
 * @param text - Chunk text.
 * @returns The cached vector, or `undefined` on a miss.
 */
export function getCachedEmbedding(
  db: Db,
  text: string,
): Float32Array | undefined {
  const key = keyFor(text);
  const cached = memory.get(key);
  if (cached) return cached;

  const row = db
    .select()
    .from(embeddingCache)
    .where(eq(embeddingCache.key, key))
    .get();
  if (!row) return undefined;

  const vector = bufferToVector(row.embedding);
  memory.set(key, vector);
  return vector;
}

/**
 * Store an embedding for the given text.
 *
 * @param db - Database client.
 * @param text - Chunk text.
 * @param vector - The embedding to cache.
 */
export function setCachedEmbedding(
  db: Db,
  text: string,
  vector: Float32Array,
): void {
  const key = keyFor(text);
  memory.set(key, vector);
  db.insert(embeddingCache)
    .values({ key, model: EMBEDDING_MODEL, embedding: vectorToBuffer(vector) })
    .onConflictDoNothing()
    .run();
}

/** Clear the in-memory layer. For test isolation only. */
export function resetEmbeddingMemoryCache(): void {
  memory.clear();
}
