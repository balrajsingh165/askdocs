import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { chunks, documents, type NewChunkRow } from "@/lib/db/schema";

/**
 * Data access for {@link chunks}, including the join used at retrieval time.
 *
 * @module lib/db/repositories/chunks
 */

/** A chunk from a `ready` document, ready to be scored against a query. */
export interface RetrievableChunk {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  embedding: Buffer;
}

const INSERT_BATCH_SIZE = 100;

/**
 * Insert chunk rows in a single transaction, batching to stay within SQLite's
 * bound-parameter limit.
 *
 * @param db - Database client.
 * @param rows - Chunk rows to insert.
 */
export function insertChunks(db: Db, rows: NewChunkRow[]): void {
  if (rows.length === 0) return;
  db.transaction((tx) => {
    for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
      const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
      tx.insert(chunks).values(batch).run();
    }
  });
}

/**
 * Load every chunk belonging to a user's `ready` documents, joined with the
 * document name so retrieved context can be labelled by source.
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @returns All retrievable chunks for the user.
 */
export function listReadyChunks(db: Db, userId: string): RetrievableChunk[] {
  return db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      documentName: documents.filename,
      chunkIndex: chunks.chunkIndex,
      content: chunks.content,
      embedding: chunks.embedding,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(and(eq(chunks.userId, userId), eq(documents.status, "ready")))
    .orderBy(asc(chunks.documentId), asc(chunks.chunkIndex))
    .all();
}
