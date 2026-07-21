import { describe, expect, it } from "vitest";
import { NO_CONTEXT_MESSAGE } from "@/lib/config";
import { buildUserMessage, SYSTEM_PROMPT } from "@/lib/rag/prompt";
import type { RetrievedChunk } from "@/lib/rag/retrieval";

const chunks: RetrievedChunk[] = [
  { documentId: "1", documentName: "alpha.pdf", content: "Alpha content.", score: 0.9 },
  { documentId: "2", documentName: "beta.docx", content: "Beta content.", score: 0.8 },
];

describe("SYSTEM_PROMPT", () => {
  it("embeds the exact fallback message", () => {
    expect(SYSTEM_PROMPT).toContain(NO_CONTEXT_MESSAGE);
  });

  it("forbids outside knowledge", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("only");
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("general knowledge");
  });
});

describe("buildUserMessage", () => {
  it("wraps context and labels each excerpt by source document", () => {
    const message = buildUserMessage("What is alpha?", chunks);
    expect(message).toContain("<context>");
    expect(message).toContain("</context>");
    expect(message).toContain("source: alpha.pdf");
    expect(message).toContain("source: beta.docx");
    expect(message).toContain("Alpha content.");
    expect(message).toContain("Beta content.");
    expect(message).toContain("Question: What is alpha?");
  });
});
