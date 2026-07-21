import { CHUNK_OVERLAP, CHUNK_SIZE } from "@/lib/config";

/**
 * Split normalised document text into overlapping chunks, snapping chunk
 * boundaries to paragraph, sentence, line, or word breaks where possible so
 * chunks stay semantically coherent.
 *
 * @module lib/rag/chunking
 */

/** A single chunk of document text. */
export interface TextChunk {
  /** Zero-based position of this chunk within the document. */
  index: number;
  /** The chunk text. */
  content: string;
}

/** Options controlling {@link chunkText}. */
export interface ChunkOptions {
  /** Target chunk length in characters. */
  size?: number;
  /** Overlap between consecutive chunks in characters. */
  overlap?: number;
}

const SENTENCE_BOUNDARY = /[.!?]["')\]]?\s/g;

/**
 * Find the best split point within `[end - overlap, end]`, preferring a
 * paragraph break, then a sentence end, then a line break, then a word break.
 *
 * @returns The split offset (exclusive end of the chunk), or `end` if no
 *   boundary is found in the window.
 */
function findBoundary(
  text: string,
  start: number,
  end: number,
  overlap: number,
): number {
  const windowStart = Math.max(start + 1, end - overlap);
  const slice = text.slice(windowStart, end);

  const paragraph = slice.lastIndexOf("\n\n");
  if (paragraph !== -1) return windowStart + paragraph + 2;

  let sentence = -1;
  SENTENCE_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_BOUNDARY.exec(slice)) !== null) {
    sentence = match.index + match[0].length;
  }
  if (sentence !== -1) return windowStart + sentence;

  const newline = slice.lastIndexOf("\n");
  if (newline !== -1) return windowStart + newline + 1;

  const space = slice.lastIndexOf(" ");
  if (space !== -1) return windowStart + space + 1;

  return end;
}

/**
 * Split text into overlapping chunks.
 *
 * @param text - Normalised document text.
 * @param options - Optional size and overlap overrides.
 * @returns Ordered, non-empty chunks. Returns an empty array for blank input.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const size = options.size ?? CHUNK_SIZE;
  const overlap = Math.min(options.overlap ?? CHUNK_OVERLAP, Math.floor(size / 2));

  const clean = text.trim();
  if (clean.length === 0) return [];
  if (clean.length <= size) return [{ index: 0, content: clean }];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      end = findBoundary(clean, start, end, overlap);
    }

    const content = clean.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({ index, content });
      index += 1;
    }

    if (end >= clean.length) break;
    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : end;
  }

  return chunks;
}
