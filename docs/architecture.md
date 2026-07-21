# AskDocs — System Architecture

How AskDocs is built. What it must do is specified in
[requirements.md](requirements.md); work items live in [todo.md](todo.md).

---

## 1. High-Level Overview

One Next.js application serves both the UI and the API. The RAG pipeline is a
set of framework-agnostic services under `lib/` that route handlers call —
nothing in `lib/rag/` or `lib/db/` imports from `next/*` or React, so every
service is unit-testable in isolation.

```
┌────────────────────────────  Next.js (App Router)  ───────────────────────────┐
│                                                                               │
│  UI (React + Tailwind)                 API route handlers (Node.js runtime)   │
│  ┌──────────────┐ ┌────────────┐       ┌──────────────────────────────────┐   │
│  │ Upload panel │ │ Chat panel │ ───▶  │ /api/documents   /api/ask        │   │
│  └──────────────┘ └────────────┘       │ /api/documents/[id]  /api/health │   │
│                                        └───────────────┬──────────────────┘   │
│                     auth ▸ rate limit ▸ validate ▸ delegate ▸ shape response  │
│                                                        │                      │
│  lib/ (framework-agnostic services)                    ▼                      │
│  ┌─────────┐ ┌────────┐ ┌─────────┐ ┌───────────┐ ┌────────────────────────┐  │
│  │ config  │ │ auth   │ │ cache   │ │ ratelimit │ │ rag                    │  │
│  │         │ │ session│ │ answer/ │ │ sliding   │ │ extraction ▸ chunking  │  │
│  │         │ │        │ │ embed   │ │ window    │ │ ▸ embedding ▸ retrieval│  │
│  │         │ │        │ │         │ │           │ │ ▸ generation (Gemini)  │  │
│  └─────────┘ └────────┘ └─────────┘ └───────────┘ └────────────────────────┘  │
│                                   │                                           │
│                                   ▼                                           │
│               SQLite  data/askdocs.db  (better-sqlite3 + Drizzle, committed)  │
└───────────────────────────────────────────────────────────────────────────────┘
```

External dependencies: the Google Gemini API (generation only) and the
Transformers.js MiniLM model (downloaded once, cached locally, runs
in-process). Embeddings never leave the machine.

## 2. Directory Layout

```
app/
├── layout.tsx, page.tsx           Single page: chat + upload
├── globals.css                    Tailwind entry
└── api/
    ├── documents/route.ts         POST upload · GET list
    ├── documents/[id]/route.ts    DELETE
    ├── ask/route.ts               POST question → streamed answer
    └── health/route.ts            Liveness probe (unauthenticated)
components/
├── upload/                        Dropzone, file list, status badges
├── chat/                          Message list, streamed message, composer
└── ui/                            Shared primitives (button, spinner, toast)
lib/
├── config.ts                      All settings + constants (single source)
├── db/
│   ├── schema.ts                  Drizzle table definitions
│   ├── client.ts                  better-sqlite3 connection (WAL mode)
│   └── repositories/              Typed data access per aggregate
├── auth/
│   └── session.ts                 getCurrentUser / requireUser
├── cache/
│   ├── answer-cache.ts            Question→answer cache
│   └── embedding-cache.ts         Text→vector cache
├── ratelimit/
│   └── limiter.ts                 Sliding-window limiter
└── rag/
    ├── extraction.ts              PDF (unpdf) + DOCX (mammoth) → plain text
    ├── chunking.ts                Text → overlapping chunks
    ├── embedding.ts               Chunks → vectors (MiniLM, cached)
    ├── retrieval.ts               Question → top-K relevant chunks + gate
    ├── prompt.ts                  System + user prompt construction
    └── generation.ts              Gemini SDK wrapper (the only SDK touchpoint)
middleware.ts                      Guards /api/* (except /api/health)
drizzle/                           Generated SQL migrations (committed)
data/askdocs.db                    Committed, pre-migrated, seeded database
tests/                             Mirrors lib/ and app/api/
docs/                              requirements · architecture · todo
```

## 3. Configuration (`lib/config.ts`)

All environment access happens once, here, validated with `zod`. Everything
else imports typed values. Key entries:

| Constant | Default | Purpose |
|----------|---------|---------|
| `GEMINI_API_KEY` | — (required) | Google Gemini API access (`GOOGLE_API_KEY` also accepted) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Generation model |
| `GEMINI_MAX_TOKENS` | `1024` | Max generated answer length |
| `EMBEDDING_MODEL` | `Xenova/all-MiniLM-L6-v2` | Local embedding model (384-dim) |
| `NO_CONTEXT_MESSAGE` | fixed string | The out-of-context fallback (single definition) |
| `PROMPT_VERSION` | `1` | Bumped on prompt changes; part of the answer-cache key |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | 1200 / 200 chars | Chunking parameters |
| `TOP_K` | 8 | Retrieved chunks per question |
| `SIMILARITY_THRESHOLD` | 0.35 | Relevance gate (cosine) |
| `MAX_FILE_SIZE_MB` / `MAX_DOCUMENTS` | 20 / 20 | Upload limits |
| `RATE_LIMIT_ASK` / `RATE_LIMIT_DOCUMENTS` | 20/min · 30/min | Sliding windows |
| `ANSWER_CACHE_ENABLED` / `EMBEDDING_CACHE_ENABLED` | true | Cache toggles |
| `AUTH_MODE` | `developer` | `developer` \| `full` (future) |
| `SQLITE_PATH` | `data/askdocs.db` | Database location |

## 4. Database Schema (Drizzle)

Every row is scoped by `userId` so multi-user works later with no schema
change.

| Table | Columns (abridged) | Notes |
|-------|--------------------|-------|
| `users` | `id`, `name`, `createdAt` | Seeded with the developer user |
| `documents` | `id`, `userId`, `filename`, `mimeType`, `sizeBytes`, `status`, `error`, `createdAt` | `status`: `processing` → `ready` \| `failed` |
| `chunks` | `id`, `documentId`, `userId`, `chunkIndex`, `content`, `embedding` (BLOB) | Embedding stored as a `Float32Array` buffer |
| `answer_cache` | `key` (PK), `userId`, `question`, `answer`, `createdAt` | Key = SHA-256 of normalized question + sorted doc ids + model + prompt version |
| `embedding_cache` | `key` (PK), `embedding` (BLOB), `model`, `createdAt` | Key = SHA-256 of chunk text + model |
| `rate_limit_events` | `id`, `subject`, `route`, `at` | Pruned as windows slide |

Schema changes go through `pnpm db:generate` → `pnpm db:migrate`; the
regenerated `data/askdocs.db` is committed alongside the migration. The
connection opens in WAL mode; `*.db-wal` / `*.db-shm` are gitignored, the
`.db` is not.

## 5. Request Flows

### 5.1 Upload (`POST /api/documents`)

```
multipart upload
  → middleware auth → rate limit → zod-validate type/size/count
  → insert documents row (status: processing)
  → extraction   unpdf (PDF) | mammoth (DOCX) → plain text (normalized)
  → chunking     split into ~1200-char chunks, 200-char overlap,
                 preferring paragraph/sentence boundaries
  → embedding    MiniLM per chunk (embedding cache consulted first)
  → persist      chunks + vectors in one transaction, status → ready
  → response     document metadata (or status: failed + reason)
```

Extraction failures (encrypted PDF, empty text layer, corrupt file) mark the
document `failed` with a human-readable reason; the UI shows it on the badge.

### 5.2 Ask (`POST /api/ask`)

```
{ question }
  → middleware auth → rate limit → zod-validate
  → guard        no ready documents → 409 with guidance
  → answer cache hit → return cached answer immediately (no retrieval, no LLM)
  → embed the question (MiniLM)
  → retrieval    cosine similarity against all ready chunks for this user,
                 take TOP_K above SIMILARITY_THRESHOLD
  → gate         zero chunks pass → stream NO_CONTEXT_MESSAGE (LLM never called)
  → generation   Gemini via SDK stream; system prompt carries grounding rules,
                 user message carries retrieved chunks + question
  → stream       tokens forwarded to the client as they arrive
  → on complete  full answer written to the answer cache
```

Both the cache hit and the gated fallback are returned through the same
streamed response shape, so the UI has exactly one rendering path.

### 5.3 Delete (`DELETE /api/documents/[id]`)

Deletes the document and its chunks in one transaction. The answer-cache key
includes the sorted list of active document ids, so all cached answers that
depended on the deleted document become unreachable automatically — no
explicit invalidation needed.

## 6. RAG Pipeline Details

### Extraction (`lib/rag/extraction.ts`)
- PDF: `unpdf` (`extractText`) — pure JS, no native binaries.
- DOCX: `mammoth` (`extractRawText`).
- Output normalized: collapsed whitespace, preserved paragraph breaks.
- Throws typed `ExtractionError` for unreadable/empty documents.

### Chunking (`lib/rag/chunking.ts`)
- Sliding window over characters with overlap, snapping split points to the
  nearest paragraph or sentence boundary within a tolerance window.
- Pure function: `(text, {size, overlap}) → Chunk[]` — trivially testable.

### Embedding (`lib/rag/embedding.ts`)
- Transformers.js `feature-extraction` pipeline, mean-pooled, L2-normalized
  → 384-dim vectors. Model instance is a module-level singleton (loaded once
  per process).
- Checks the embedding cache before computing; writes back on miss.
- Because vectors are L2-normalized, cosine similarity reduces to a dot
  product at query time.

### Retrieval + relevance gate (`lib/rag/retrieval.ts`)
- Loads the user's ready chunks (id, content, vector) and scores them against
  the question vector in-process. At assessment scale (tens of documents,
  thousands of chunks) this is milliseconds; the seam to swap in `sqlite-vec`
  or a vector DB is isolated in this one module.
- Returns `{ chunks, gated }`: `gated: true` when nothing clears
  `SIMILARITY_THRESHOLD` — the caller then short-circuits to
  `NO_CONTEXT_MESSAGE` without an LLM call.

### Prompt (`lib/rag/prompt.ts`)
- **System prompt**: the grounding contract — answer only from the provided
  context; if the context does not contain the answer, output exactly
  `NO_CONTEXT_MESSAGE`; never use general knowledge; keep answers concise.
- **User message**: retrieved chunks wrapped in `<context>` tags (labeled with
  source document names, enabling multi-document synthesis), followed by the
  question.
- `PROMPT_VERSION` is exported and folded into the answer-cache key.

### Generation (`lib/rag/generation.ts`)
- The **only** module importing `@google/genai`.
- `ai.models.generateContentStream(...)` with model `gemini-2.5-flash`,
  `maxOutputTokens: 1024`, `temperature: 0` (faithful, deterministic
  grounding), and `thinkingConfig: { thinkingBudget: 0 }` (thinking disabled
  for fast, short factual answers).
- Grounding rules go in `systemInstruction`; retrieved chunks and the question
  go in `contents`.
- Exposes `streamAnswer`, an async iterator of text fragments, to the route
  layer; the route adapts it to a web `ReadableStream` response.

## 7. Auth

`lib/auth/session.ts` exposes `getCurrentUser()` / `requireUser()`. In
`developer` mode both resolve to the seeded developer user. `middleware.ts`
rejects unauthenticated access to `/api/*` (except `/api/health`) — in
developer mode this is a pass-through that stamps the request, keeping the
enforcement point in place for `full` mode. Nothing outside `lib/auth/` reads
`AUTH_MODE`.

## 8. Caching & Rate Limiting

Both are SQLite-backed (durable across restarts, visible to reviewers in the
committed DB) with an in-memory map in front for hot-path reads.

- **Answer cache** — exact-match by design: only the identical normalized
  question against the identical corpus hits. Semantic caching is explicitly
  out of scope (a semantically-near question could deserve a different
  answer).
- **Embedding cache** — saves model time when documents share content
  (re-uploads, boilerplate) and across test runs.
- **Rate limiter** — sliding window: count events for `(subject, route)` in
  the last window; at/over limit → 429 with `Retry-After`; else record the
  event. Old events are pruned opportunistically.

## 9. Error Handling

Services throw domain errors (`ExtractionError`, `ValidationError`,
`RateLimitError`, `NotFoundError`, `GenerationError`); only the route layer
maps them to HTTP:

| Error | Status |
|-------|--------|
| `ValidationError` (zod) | 400 |
| Unauthenticated | 401 |
| `NotFoundError` | 404 |
| No ready documents | 409 |
| Payload too large | 413 |
| `RateLimitError` | 429 (+ `Retry-After`) |
| `ExtractionError` | 422 (document marked `failed`) |
| `GenerationError` / unknown | 500 (sanitized message) |

All API routes touching the DB, embeddings, or the SDK declare
`export const runtime = 'nodejs'` (never Edge — `better-sqlite3` and
Transformers.js require Node).

## 10. Security Notes

- `GEMINI_API_KEY` lives only in `.env.local`/`.env` and is read only in
  `lib/config.ts`; it never reaches the client bundle.
- Uploads validated by MIME type **and** extension, plus size/count caps.
- Extracted text is treated as data, never as instructions to execute; the
  system prompt instructs the model to ignore instruction-like content inside
  documents (prompt-injection hardening).
- Rate limiting bounds spend on the Gemini API.

## 11. Future Extensions (deliberate seams)

| Extension | Seam |
|-----------|------|
| Real login (Auth.js) | `AUTH_MODE=full` in `lib/auth/session.ts`; all rows already `userId`-scoped |
| Vector index at scale | Swap the scoring internals of `lib/rag/retrieval.ts` (e.g. `sqlite-vec`) |
| Chat history persistence | New `messages` table + repository; UI already message-list shaped |
| OCR for scanned PDFs | Additional extractor behind `lib/rag/extraction.ts` |
| Postgres instead of SQLite | Drizzle schema ports; repositories unchanged |
