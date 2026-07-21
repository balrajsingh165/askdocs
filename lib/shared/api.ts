import type { AnswerSource, DocumentDto } from "@/lib/shared/types";

/**
 * Browser-side API client. Thin `fetch` wrappers over the JSON/stream routes,
 * with consistent error extraction. Safe to import from client components.
 *
 * @module lib/shared/api
 */

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function extractError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.message) return body.error.message;
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
  const response = await fetch("/api/documents");
  if (!response.ok) throw new Error(await extractError(response));
  const body = (await response.json()) as { documents: DocumentDto[] };
  return body.documents;
}

/**
 * Upload and process a document.
 *
 * @param file - The file to upload.
 * @returns The resulting document (status `ready` or `failed`).
 */
export async function uploadDocument(file: File): Promise<DocumentDto> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/documents", {
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
  const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
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
  const response = await fetch("/api/ask", {
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
