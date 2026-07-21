import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/rag/chunking";

describe("chunkText", () => {
  it("returns an empty array for blank input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("returns a single chunk when text fits within the size", () => {
    const chunks = chunkText("A short document.", { size: 100, overlap: 20 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ index: 0, content: "A short document." });
  });

  it("splits long text into multiple overlapping, indexed chunks", () => {
    const text = "word ".repeat(400).trim();
    const chunks = chunkText(text, { size: 200, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(200);
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it("prefers paragraph boundaries when splitting", () => {
    const paragraphA = "Alpha ".repeat(30).trim();
    const paragraphB = "Beta ".repeat(30).trim();
    const chunks = chunkText(`${paragraphA}\n\n${paragraphB}`, {
      size: paragraphA.length + 10,
      overlap: 20,
    });
    expect(chunks[0].content).toBe(paragraphA);
  });

  it("covers the whole document across chunks", () => {
    const text = "The quick brown fox. ".repeat(60).trim();
    const chunks = chunkText(text, { size: 150, overlap: 30 });
    expect(chunks.at(-1)?.content.endsWith("fox.")).toBe(true);
  });

  it("caps overlap at half the size to guarantee progress", () => {
    const text = "x".repeat(1000);
    const chunks = chunkText(text, { size: 100, overlap: 500 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
