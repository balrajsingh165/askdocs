/**
 * Vector helpers: conversion between embeddings and SQLite BLOBs, and
 * similarity scoring.
 *
 * @module lib/rag/vector
 */

/**
 * View a Float32 embedding as a Node `Buffer` for storage. Shares memory with
 * the input, so the buffer must be consumed (written) before the vector is
 * mutated or garbage-collected.
 *
 * @param vector - The embedding.
 * @returns A Buffer view over the vector's bytes.
 */
export function vectorToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

/**
 * Decode a stored BLOB back into a Float32 embedding. Copies into a freshly
 * aligned ArrayBuffer so the result is independent and correctly aligned.
 *
 * @param buffer - The stored bytes (length must be a multiple of 4).
 * @returns The embedding.
 */
export function bufferToVector(buffer: Buffer): Float32Array {
  const aligned = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(aligned).set(buffer);
  return new Float32Array(aligned);
}

/**
 * Cosine similarity between two equal-length vectors.
 *
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Similarity in `[-1, 1]`; `0` when either vector has zero magnitude
 *   or lengths differ.
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
