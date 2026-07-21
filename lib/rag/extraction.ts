import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import type { DocumentKind } from "@/lib/config";
import { ExtractionError } from "@/lib/errors";

/**
 * Document text extraction. PDF via `unpdf`, DOCX via `mammoth`. Output is
 * whitespace-normalised plain text with paragraph breaks preserved.
 *
 * @module lib/rag/extraction
 */

/**
 * Normalise extracted text: unify newlines, collapse intra-line whitespace,
 * and collapse runs of blank lines to a single blank line (paragraph break).
 *
 * @param text - Raw extracted text.
 * @returns Normalised text, trimmed.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractPdfText(pdf, { mergePages: true });
  return text;
}

async function extractDocx(data: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: data });
  return value;
}

/**
 * Extract and normalise text from an uploaded document.
 *
 * @param kind - Document kind (`pdf` or `docx`).
 * @param data - Raw file bytes.
 * @returns Normalised plain text.
 * @throws {ExtractionError} When the file cannot be parsed or contains no
 *   extractable text.
 */
export async function extractDocumentText(
  kind: DocumentKind,
  data: Buffer,
): Promise<string> {
  let raw: string;
  try {
    raw = kind === "pdf" ? await extractPdf(new Uint8Array(data)) : await extractDocx(data);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new ExtractionError(`Could not read the ${kind.toUpperCase()} file: ${detail}`);
  }

  const normalized = normalizeText(raw);
  if (normalized.length === 0) {
    throw new ExtractionError(
      "The document contains no extractable text. Scanned or image-only files are not supported.",
    );
  }
  return normalized;
}
