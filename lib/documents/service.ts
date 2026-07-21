import { randomUUID } from "node:crypto";
import { ACCEPTED_UPLOAD_TYPES, config } from "@/lib/config";
import type { Db } from "@/lib/db/client";
import {
  getDocument,
  insertDocument,
  updateDocument,
} from "@/lib/db/repositories/documents";
import { insertChunks } from "@/lib/db/repositories/chunks";
import type { DocumentRow } from "@/lib/db/schema";
import { ExtractionError, PayloadTooLargeError, ValidationError } from "@/lib/errors";
import { chunkText } from "@/lib/rag/chunking";
import { embedChunks } from "@/lib/rag/embedding";
import { extractDocumentText } from "@/lib/rag/extraction";
import { vectorToBuffer } from "@/lib/rag/vector";
import type { DocumentDto, DocumentKind } from "@/lib/shared/types";

/**
 * Upload validation, document processing (extract → chunk → embed → persist),
 * and the API serialisation shape for documents.
 *
 * @module lib/documents/service
 */

/** A validated upload ready for processing. */
export interface ValidatedUpload {
  kind: DocumentKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
}

function detectKind(filename: string, mimeType: string): DocumentKind | null {
  const byMime = ACCEPTED_UPLOAD_TYPES.find((t) => t.mimeType === mimeType);
  if (byMime) return byMime.kind;
  const lower = filename.toLowerCase();
  const byExtension = ACCEPTED_UPLOAD_TYPES.find((t) =>
    lower.endsWith(t.extension),
  );
  return byExtension ? byExtension.kind : null;
}

/**
 * Validate an uploaded file: presence, type (PDF/DOCX), and size.
 *
 * @param file - The uploaded file from `formData`.
 * @returns The validated upload with its bytes buffered.
 * @throws {ValidationError} When no file is present or the type is unsupported.
 * @throws {PayloadTooLargeError} When the file exceeds the size limit.
 */
export async function validateUpload(file: File): Promise<ValidatedUpload> {
  if (!file || file.size === 0) {
    throw new ValidationError("No file was uploaded.");
  }
  if (file.size > config.maxFileSizeBytes) {
    const limitMb = Math.round(config.maxFileSizeBytes / (1024 * 1024));
    throw new PayloadTooLargeError(`File exceeds the ${limitMb} MB limit.`);
  }

  const kind = detectKind(file.name, file.type);
  if (!kind) {
    throw new ValidationError("Only PDF and DOCX files are supported.");
  }

  return {
    kind,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    data: Buffer.from(await file.arrayBuffer()),
  };
}

/**
 * Process a validated upload end to end: create the document row, extract text,
 * chunk it, embed the chunks, and persist. On failure the document is marked
 * `failed` with a reason rather than throwing, so the outcome is always visible
 * as the document's status.
 *
 * @param db - Database client.
 * @param userId - Owner id.
 * @param upload - The validated upload.
 * @returns The resulting document row (`ready` or `failed`).
 */
export async function processUpload(
  db: Db,
  userId: string,
  upload: ValidatedUpload,
): Promise<DocumentRow> {
  const documentId = randomUUID();
  insertDocument(db, {
    id: documentId,
    userId,
    filename: upload.filename,
    kind: upload.kind,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    status: "processing",
  });

  try {
    const text = await extractDocumentText(upload.kind, upload.data);
    const parts = chunkText(text);
    const vectors = await embedChunks(
      db,
      parts.map((part) => part.content),
    );
    insertChunks(
      db,
      parts.map((part, i) => ({
        id: randomUUID(),
        documentId,
        userId,
        chunkIndex: part.index,
        content: part.content,
        embedding: vectorToBuffer(vectors[i]),
      })),
    );
    updateDocument(db, documentId, {
      status: "ready",
      error: null,
      chunkCount: parts.length,
    });
  } catch (error) {
    const reason =
      error instanceof ExtractionError ? error.message : "Processing failed.";
    if (!(error instanceof ExtractionError)) {
      console.error("[askdocs] document processing failed:", error);
    }
    updateDocument(db, documentId, { status: "failed", error: reason });
  }

  return getDocument(db, userId, documentId) as DocumentRow;
}

/**
 * Map a document row to its API representation.
 *
 * @param row - The document row.
 * @returns The API document shape.
 */
export function serializeDocument(row: DocumentRow): DocumentDto {
  return {
    id: row.id,
    filename: row.filename,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    error: row.error,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt,
  };
}
