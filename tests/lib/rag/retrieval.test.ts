import { describe, expect, it } from "vitest";
import { rankChunks, type ScorableChunk } from "@/lib/rag/retrieval";

function chunk(id: string, vector: number[]): ScorableChunk {
  return {
    documentId: id,
    documentName: `${id}.pdf`,
    content: `content ${id}`,
    vector: new Float32Array(vector),
  };
}

describe("rankChunks (relevance gate)", () => {
  const query = new Float32Array([1, 0, 0]);

  it("gates when no chunk clears the threshold", () => {
    const result = rankChunks(
      query,
      [chunk("a", [0, 1, 0]), chunk("b", [0, 0, 1])],
      { threshold: 0.35, topK: 8 },
    );
    expect(result.gated).toBe(true);
    expect(result.chunks).toHaveLength(0);
  });

  it("returns chunks ranked by descending similarity", () => {
    const result = rankChunks(
      query,
      [
        chunk("low", [0.9, 0.6, 0]),
        chunk("high", [1, 0.05, 0]),
        chunk("mid", [0.9, 0.3, 0]),
      ],
      { threshold: 0.1, topK: 8 },
    );
    expect(result.gated).toBe(false);
    expect(result.chunks.map((c) => c.documentId)).toEqual([
      "high",
      "mid",
      "low",
    ]);
  });

  it("limits results to topK", () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      chunk(`c${i}`, [1, 0, 0]),
    );
    const result = rankChunks(query, candidates, { threshold: 0.1, topK: 3 });
    expect(result.chunks).toHaveLength(3);
  });

  it("only includes chunks at or above the threshold", () => {
    const result = rankChunks(
      query,
      [chunk("keep", [1, 0, 0]), chunk("drop", [0.2, 0.98, 0])],
      { threshold: 0.5, topK: 8 },
    );
    expect(result.chunks.map((c) => c.documentId)).toEqual(["keep"]);
  });
});
