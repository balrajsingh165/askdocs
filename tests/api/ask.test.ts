import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mockState = vi.hoisted(() => ({
  queryVector: new Float32Array([1, 0, 0]),
  generationCalls: 0,
}));

vi.mock("@/lib/db/client", async () => {
  const BetterSqlite = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const schema = await import("@/lib/db/schema");
  const sqlite = new BetterSqlite(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "drizzle" });
  return { db, sqlite, createDb: () => ({ db, sqlite }) };
});

vi.mock("@/lib/rag/embedding", () => ({
  embedQuery: vi.fn(async () => mockState.queryVector),
  embedChunk: vi.fn(async () => mockState.queryVector),
  embedChunks: vi.fn(async (_db: unknown, texts: string[]) =>
    texts.map(() => mockState.queryVector),
  ),
}));

vi.mock("@/lib/rag/generation", () => ({
  streamAnswer: vi.fn(async function* () {
    mockState.generationCalls += 1;
    yield "Test ";
    yield "answer.";
  }),
}));

const { POST } = await import("@/app/api/ask/route");
const { db } = await import("@/lib/db/client");
const { NO_CONTEXT_MESSAGE, config } = await import("@/lib/config");
const { DEVELOPER_USER_ID } = await import("@/lib/auth/session");
const { upsertUser } = await import("@/lib/db/repositories/users");
const { insertDocument } = await import("@/lib/db/repositories/documents");
const { insertChunks } = await import("@/lib/db/repositories/chunks");
const { vectorToBuffer } = await import("@/lib/rag/vector");
const { resetAnswerMemoryCache } = await import("@/lib/cache/answer-cache");
const { resetEmbeddingMemoryCache } = await import(
  "@/lib/cache/embedding-cache"
);
const schema = await import("@/lib/db/schema");

function seedReadyDoc(vector: Float32Array): void {
  insertDocument(db, {
    id: "doc-1",
    userId: DEVELOPER_USER_ID,
    filename: "doc.pdf",
    kind: "pdf",
    mimeType: "application/pdf",
    sizeBytes: 10,
    status: "ready",
    chunkCount: 1,
  });
  insertChunks(db, [
    {
      id: "chunk-1",
      documentId: "doc-1",
      userId: DEVELOPER_USER_ID,
      chunkIndex: 0,
      content: "The document is about cats.",
      embedding: vectorToBuffer(vector),
    },
  ]);
}

function askRequest(question: string): NextRequest {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  db.delete(schema.chunks).run();
  db.delete(schema.documents).run();
  db.delete(schema.answerCache).run();
  db.delete(schema.embeddingCache).run();
  db.delete(schema.rateLimitEvents).run();
  db.delete(schema.users).run();
  upsertUser(db, { id: DEVELOPER_USER_ID, name: "Dev" });
  resetAnswerMemoryCache();
  resetEmbeddingMemoryCache();
  mockState.generationCalls = 0;
  mockState.queryVector = new Float32Array([1, 0, 0]);
});

describe("POST /api/ask", () => {
  it("returns the exact fallback and never calls the LLM when nothing is relevant", async () => {
    seedReadyDoc(new Float32Array([1, 0, 0]));
    mockState.queryVector = new Float32Array([0, 1, 0]);

    const res = await POST(askRequest("Who won the 2022 World Cup?"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-AskDocs-Source")).toBe("no_context");
    expect(await res.text()).toBe(NO_CONTEXT_MESSAGE);
    expect(mockState.generationCalls).toBe(0);
  });

  it("streams a generated answer when relevant context exists", async () => {
    seedReadyDoc(new Float32Array([1, 0, 0]));

    const res = await POST(askRequest("What is the document about?"));
    expect(res.status).toBe(200);
    expect(res.headers.get("X-AskDocs-Source")).toBe("generated");
    expect(await res.text()).toBe("Test answer.");
    expect(mockState.generationCalls).toBe(1);
  });

  it("serves a repeated question from the cache without calling the LLM again", async () => {
    seedReadyDoc(new Float32Array([1, 0, 0]));

    const first = await POST(askRequest("Same question?"));
    await first.text();
    const second = await POST(askRequest("Same question?"));

    expect(second.headers.get("X-AskDocs-Source")).toBe("cache");
    expect(await second.text()).toBe("Test answer.");
    expect(mockState.generationCalls).toBe(1);
  });

  it("returns 409 when no documents are ready", async () => {
    const res = await POST(askRequest("Anything?"));
    expect(res.status).toBe(409);
  });

  it("rejects an empty question with 400", async () => {
    seedReadyDoc(new Float32Array([1, 0, 0]));
    const res = await POST(askRequest("   "));
    expect(res.status).toBe(400);
  });

  it("rate limits after the configured number of requests", async () => {
    for (let i = 0; i < config.rateLimitAskPerMinute; i += 1) {
      const res = await POST(askRequest("q"));
      expect(res.status).toBe(409);
    }
    const limited = await POST(askRequest("q"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });
});
