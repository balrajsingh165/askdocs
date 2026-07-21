import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  documents,
  type DocumentRow,
  type NewDocumentRow,
} from "@/lib/db/schema";

/**
 * Data access for {@link documents}. Every query is scoped by `userId`.
 *
 * @module lib/db/repositories/documents
 */

/** Fields that may be patched after a document is created. */
export interface DocumentPatch {
  status?: DocumentRow["status"];
  error?: string | null;
  chunkCount?: number;
}

/**
 * Insert a new document row.
 *
 * @param db - Database client.
 * @param values - The document to insert.
 * @returns The inserted row.
 */
export function insertDocument(db: Db, values: NewDocumentRow): DocumentRow {
  return db.insert(documents).values(values).returning().get();
}

/**
 * List a user's documents, newest first.
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @returns The user's documents ordered by creation time descending.
 */
export function listDocuments(db: Db, userId: string): DocumentRow[] {
  return db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt))
    .all();
}

/**
 * Fetch a single document owned by a user.
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @param id - Document id.
 * @returns The document, or `undefined` if it does not exist for this user.
 */
export function getDocument(
  db: Db,
  userId: string,
  id: string,
): DocumentRow | undefined {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.id, id)))
    .get();
}

/**
 * Apply a partial update to a document.
 *
 * @param db - Database client.
 * @param id - Document id.
 * @param patch - Fields to update.
 */
export function updateDocument(db: Db, id: string, patch: DocumentPatch): void {
  db.update(documents).set(patch).where(eq(documents.id, id)).run();
}

/**
 * Delete a document (its chunks cascade via foreign key).
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @param id - Document id.
 * @returns `true` if a row was deleted, `false` if nothing matched.
 */
export function deleteDocument(db: Db, userId: string, id: string): boolean {
  const result = db
    .delete(documents)
    .where(and(eq(documents.userId, userId), eq(documents.id, id)))
    .run();
  return result.changes > 0;
}

/**
 * Count a user's documents (any status).
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @returns The number of documents the user owns.
 */
export function countDocuments(db: Db, userId: string): number {
  return db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.userId, userId))
    .all().length;
}

/**
 * List the ids of a user's `ready` documents, sorted ascending.
 *
 * The sorted id list is part of the answer-cache key, so callers rely on the
 * deterministic ordering.
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @returns Sorted array of ready document ids.
 */
export function listReadyDocumentIds(db: Db, userId: string): string[] {
  return db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.status, "ready")))
    .all()
    .map((row) => row.id)
    .sort();
}
