/**
 * Shared, dependency-free types used by both server code and client
 * components. This module must never import server-only code (it is safe to
 * import from the browser bundle).
 *
 * @module lib/shared/types
 */

/** A supported document kind. */
export type DocumentKind = "pdf" | "docx";

/** Lifecycle status of an uploaded document. */
export type DocumentStatus = "processing" | "ready" | "failed";

/** The document shape returned by the API. */
export interface DocumentDto {
  id: string;
  filename: string;
  kind: DocumentKind;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  error: string | null;
  chunkCount: number;
  createdAt: number;
}

/** How an answer was produced, reported via the `X-AskDocs-Source` header. */
export type AnswerSource = "cache" | "generated" | "no_context";

/** A single chat message rendered in the UI. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present on assistant messages once the source is known. */
  source?: AnswerSource;
  /** True while an assistant message is still streaming. */
  pending?: boolean;
}
