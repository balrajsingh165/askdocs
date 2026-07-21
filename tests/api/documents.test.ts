import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

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

vi.mock("@/lib/rag/extraction", () => ({
  extractDocumentText: vi.fn(
    async () => "Hello world. This is a test document about cats and dogs.",
  ),
  normalizeText: (text: string) => text,
}));

vi.mock("@/lib/rag/embedding", () => ({
  embedChunks: vi.fn(async (_db: unknown, texts: string[]) =>
    texts.map(() => new Float32Array([1, 0, 0])),
  ),
  embedQuery: vi.fn(async () => new Float32Array([1, 0, 0])),
  embedChunk: vi.fn(async () => new Float32Array([1, 0, 0])),
}));

const { POST, GET } = await import("@/app/api/documents/route");
const { DELETE } = await import("@/app/api/documents/[id]/route");
const { db } = await import("@/lib/db/client");
const { DEVELOPER_USER_ID } = await import("@/lib/auth/session");
const { upsertUser } = await import("@/lib/db/repositories/users");
const schema = await import("@/lib/db/schema");

function uploadRequest(name: string, type: string): NextRequest {
  const form = new FormData();
  form.append("file", new File(["file content bytes"], name, { type }));
  return new Request("http://localhost/api/documents", {
    method: "POST",
    body: form,
  }) as unknown as NextRequest;
}

function deleteRequest(): NextRequest {
  return new Request("http://localhost/api/documents/x", {
    method: "DELETE",
  }) as unknown as NextRequest;
}

function deleteContext(id: string): Parameters<typeof DELETE>[1] {
  return { params: Promise.resolve({ id }) } as unknown as Parameters<
    typeof DELETE
  >[1];
}

beforeEach(() => {
  db.delete(schema.chunks).run();
  db.delete(schema.documents).run();
  db.delete(schema.rateLimitEvents).run();
  db.delete(schema.users).run();
  upsertUser(db, { id: DEVELOPER_USER_ID, name: "Dev" });
});

describe("/api/documents", () => {
  it("uploads and processes a PDF to ready status", async () => {
    const res = await POST(uploadRequest("cats.pdf", "application/pdf"));
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      document: { status: string; chunkCount: number; kind: string };
    };
    expect(body.document.status).toBe("ready");
    expect(body.document.kind).toBe("pdf");
    expect(body.document.chunkCount).toBeGreaterThan(0);
  });

  it("detects DOCX by extension", async () => {
    const res = await POST(uploadRequest("report.docx", ""));
    const body = (await res.json()) as { document: { kind: string } };
    expect(body.document.kind).toBe("docx");
  });

  it("rejects unsupported file types with 400", async () => {
    const res = await POST(uploadRequest("notes.txt", "text/plain"));
    expect(res.status).toBe(400);
  });

  it("lists uploaded documents newest first", async () => {
    await POST(uploadRequest("a.pdf", "application/pdf"));
    await POST(uploadRequest("b.pdf", "application/pdf"));
    const res = GET();
    const body = (await res.json()) as { documents: { filename: string }[] };
    expect(body.documents).toHaveLength(2);
    expect(body.documents[0].filename).toBe("b.pdf");
  });

  it("deletes a document", async () => {
    const created = (await (
      await POST(uploadRequest("a.pdf", "application/pdf"))
    ).json()) as { document: { id: string } };

    const del = await DELETE(deleteRequest(), deleteContext(created.document.id));
    expect(del.status).toBe(200);

    const list = (await GET().json()) as { documents: unknown[] };
    expect(list.documents).toHaveLength(0);
  });

  it("returns 404 when deleting a missing document", async () => {
    const del = await DELETE(deleteRequest(), deleteContext("does-not-exist"));
    expect(del.status).toBe(404);
  });
});
