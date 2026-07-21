import { config } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import { listReadyChunks } from "@/lib/db/repositories/chunks";
import { embedQuery } from "@/lib/rag/embedding";
import { bufferToVector, cosineSimilarity } from "@/lib/rag/vector";

/**
 * Retrieval with a relevance gate. Chunks are scored by cosine similarity to
 * the question; if nothing clears the similarity threshold the result is
 * "gated" and the caller returns the out-of-context fallback without calling
 * the LLM.
 *
 * @module lib/rag/retrieval
 */

/** A candidate chunk with its embedding, before scoring. */
export interface ScorableChunk {
  documentId: string;
  documentName: string;
  content: string;
  vector: Float32Array;
}

/** A retrieved chunk with its similarity score. */
export interface RetrievedChunk {
  documentId: string;
  documentName: string;
  content: string;
  score: number;
}

/** Outcome of a retrieval: either gated (no relevant context) or with chunks. */
export interface RetrievalResult {
  gated: boolean;
  chunks: RetrievedChunk[];
}

/** Tuning parameters for {@link rankChunks}. */
export interface RankOptions {
  topK?: number;
  threshold?: number;
}

/**
 * Score, threshold, and rank candidate chunks against a query vector. Pure
 * function — no database or embedding I/O.
 *
 * @param queryVector - The embedded question.
 * @param candidates - Candidate chunks with embeddings.
 * @param options - Optional `topK` and `threshold` overrides.
 * @returns The relevance gate result and the top chunks above threshold.
 */
export function rankChunks(
  queryVector: Float32Array,
  candidates: ScorableChunk[],
  options: RankOptions = {},
): RetrievalResult {
  const topK = options.topK ?? config.topK;
  const threshold = options.threshold ?? config.similarityThreshold;

  const scored = candidates
    .map((candidate) => ({
      documentId: candidate.documentId,
      documentName: candidate.documentName,
      content: candidate.content,
      score: cosineSimilarity(queryVector, candidate.vector),
    }))
    .filter((candidate) => candidate.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { gated: scored.length === 0, chunks: scored };
}

/**
 * Retrieve the most relevant chunks for a question from a user's ready
 * documents.
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @param question - The natural-language question.
 * @returns The relevance gate result and retrieved chunks.
 */
export async function retrieveContext(
  db: Db,
  userId: string,
  question: string,
): Promise<RetrievalResult> {
  const rows = listReadyChunks(db, userId);
  if (rows.length === 0) return { gated: true, chunks: [] };

  const queryVector = await embedQuery(question);
  const candidates: ScorableChunk[] = rows.map((row) => ({
    documentId: row.documentId,
    documentName: row.documentName,
    content: row.content,
    vector: bufferToVector(row.embedding),
  }));

  return rankChunks(queryVector, candidates);
}
