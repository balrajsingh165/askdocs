import { eq } from "drizzle-orm";
import { config, PROMPT_VERSION } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { answerCache } from "@/lib/db/schema";
import { sha256 } from "@/lib/hash";

/**
 * Answer cache: an exact-match cache keyed by the normalised question, the
 * active document set, the model, and the prompt version. Because the key
 * includes the sorted ready-document ids, adding or removing a document
 * changes the key and cached answers can never go stale.
 *
 * Backed by the `answer_cache` SQLite table with a process-level in-memory
 * fast path.
 *
 * @module lib/cache/answer-cache
 */

const memory = new Map<string, string>();

/**
 * Normalise a question for cache-key purposes: trim, collapse whitespace, and
 * lowercase so trivially different phrasings share a cache entry.
 *
 * @param question - Raw question text.
 * @returns Normalised question.
 */
export function normalizeQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Compute the answer-cache key.
 *
 * @param userId - Owner id.
 * @param question - The question.
 * @param readyDocumentIds - Ids of the user's ready documents.
 * @returns The cache key.
 */
export function answerCacheKey(
  userId: string,
  question: string,
  readyDocumentIds: string[],
): string {
  const corpus = [...readyDocumentIds].sort().join(",");
  return sha256(
    userId,
    normalizeQuestion(question),
    corpus,
    config.geminiModel,
    PROMPT_VERSION,
  );
}

/**
 * Look up a cached answer by key.
 *
 * @param db - Database client.
 * @param key - Answer-cache key.
 * @returns The cached answer, or `undefined` on a miss.
 */
export function getCachedAnswer(db: Db, key: string): string | undefined {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;

  const row = db
    .select()
    .from(answerCache)
    .where(eq(answerCache.key, key))
    .get();
  if (!row) return undefined;

  memory.set(key, row.answer);
  return row.answer;
}

/**
 * Store an answer under its cache key.
 *
 * @param db - Database client.
 * @param entry - Key, owner, question, and answer to persist.
 */
export function setCachedAnswer(
  db: Db,
  entry: { key: string; userId: string; question: string; answer: string },
): void {
  memory.set(entry.key, entry.answer);
  db.insert(answerCache)
    .values({
      key: entry.key,
      userId: entry.userId,
      question: entry.question,
      answer: entry.answer,
    })
    .onConflictDoUpdate({
      target: answerCache.key,
      set: { answer: entry.answer },
    })
    .run();
}

/** Clear the in-memory layer. For test isolation only. */
export function resetAnswerMemoryCache(): void {
  memory.clear();
}
