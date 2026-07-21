import type { FeatureExtractionPipeline } from "@xenova/transformers";
import { config, EMBEDDING_MODEL } from "@/lib/config";
import {
  getCachedEmbedding,
  setCachedEmbedding,
} from "@/lib/cache/embedding-cache";
import type { Db } from "@/lib/db/client";

/**
 * Local sentence embeddings via Transformers.js. The model is loaded lazily
 * and reused for the lifetime of the process; embeddings are mean-pooled and
 * L2-normalised.
 *
 * @module lib/rag/embedding
 */

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Load the embedding pipeline lazily via dynamic import. The dynamic import
 * keeps the heavy `@xenova/transformers` module (and its `sharp` dependency)
 * out of the build-time module graph — it is only evaluated when an embedding
 * is first requested at runtime.
 */
function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = import("@xenova/transformers").then((module) =>
      module.pipeline("feature-extraction", EMBEDDING_MODEL),
    );
  }
  return extractorPromise;
}

/**
 * Embed a single piece of text without consulting the cache. Used for
 * question embeddings, which are not worth caching.
 *
 * @param text - Text to embed.
 * @returns A normalised embedding vector.
 */
export async function embedQuery(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data as ArrayLike<number>);
}

/**
 * Embed chunk text, using the embedding cache to avoid recomputing vectors for
 * identical content.
 *
 * @param db - Database client.
 * @param text - Chunk text.
 * @returns A normalised embedding vector.
 */
export async function embedChunk(db: Db, text: string): Promise<Float32Array> {
  if (config.embeddingCacheEnabled) {
    const cached = getCachedEmbedding(db, text);
    if (cached) return cached;
  }
  const vector = await embedQuery(text);
  if (config.embeddingCacheEnabled) {
    setCachedEmbedding(db, text, vector);
  }
  return vector;
}

/**
 * Embed many chunks in order, each via {@link embedChunk}.
 *
 * @param db - Database client.
 * @param texts - Chunk texts.
 * @returns Embeddings in the same order as the input.
 */
export async function embedChunks(
  db: Db,
  texts: string[],
): Promise<Float32Array[]> {
  const vectors: Float32Array[] = [];
  for (const text of texts) {
    vectors.push(await embedChunk(db, text));
  }
  return vectors;
}
