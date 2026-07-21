import { describe, expect, it } from "vitest";
import {
  bufferToVector,
  cosineSimilarity,
  vectorToBuffer,
} from "@/lib/rag/vector";

describe("vector helpers", () => {
  it("round-trips a vector through a buffer", () => {
    const vector = new Float32Array([0.1, -0.5, 0.9, 1]);
    const restored = bufferToVector(vectorToBuffer(vector));
    expect(Array.from(restored)).toEqual(Array.from(vector));
  });

  it("scores identical vectors as 1", () => {
    const vector = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 6);
  });

  it("scores orthogonal vectors as 0", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 6);
  });

  it("scores opposite vectors as -1", () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 6);
  });

  it("returns 0 for zero-magnitude or mismatched-length inputs", () => {
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
    expect(cosineSimilarity(new Float32Array([1]), new Float32Array([1, 2]))).toBe(0);
  });
});
