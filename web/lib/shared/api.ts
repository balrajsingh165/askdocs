import { API_BASE_URL } from "@/lib/shared/config";
import type { AnswerSource, DocumentDto } from "@/lib/shared/types";

/**
 * Browser-side API client for the FastAPI backend. Thin `fetch` wrappers with
 * consistent error extraction. Safe to import from client components.
 *
 * @module lib/shared/api
 */

interface ApiErrorBody {
  error?: { code?: string; message?: string };
  detail?: string;
}

async function extractError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.message) return body.error.message;
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* fall through to a generic message */
  }
  return `Request failed (${response.status}).`;
}

/**
 * Fetch the current user's documents.
 *
 * @returns The list of documents, newest first.
 */
export async function fetchDocuments(): Promise<DocumentDto[]> {
  const response = await fetch(`${API_BASE_URL}/documents`);
  if (!response.ok) throw new Error(await extractError(response));
  const body = (await response.json()) as { documents: DocumentDto[] };
  return body.documents;
}

/**
 * Upload a document. The backend responds immediately with the document in a
 * `processing` state and finishes extraction/embedding in the background.
 *
 * @param file - The file to upload.
 * @returns The created document (initially `processing`).
 */
export async function uploadDocument(file: File): Promise<DocumentDto> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/documents`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await extractError(response));
  const body = (await response.json()) as { document: DocumentDto };
  return body.document;
}

/**
 * Delete a document.
 *
 * @param id - Document id.
 */
export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await extractError(response));
}

/**
 * Ask a question, streaming the answer.
 *
 * @param question - The natural-language question.
 * @param onDelta - Called with each text fragment as it arrives.
 * @returns How the answer was produced.
 */
export async function askQuestion(
  question: string,
  onDelta: (text: string) => void,
): Promise<{ source: AnswerSource }> {
  const response = await fetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error(await extractError(response));

  const source =
    (response.headers.get("X-AskDocs-Source") as AnswerSource | null) ??
    "generated";

  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      onDelta(decoder.decode(value, { stream: true }));
    }
    const tail = decoder.decode();
    if (tail) onDelta(tail);
  } else {
    onDelta(await response.text());
  }

  return { source };
}
