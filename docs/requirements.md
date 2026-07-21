# AskDocs — Requirements Specification

AskDocs is a Retrieval-Augmented Generation (RAG) web application. A user
uploads one or more documents (PDF or DOCX) and asks natural-language
questions. The application answers **strictly from the uploaded content**.
When the answer is not present in the documents, it refuses with a fixed
fallback message instead of guessing.

This document is the single source of truth for *what* the application must
do. *How* it is built is described in [architecture.md](architecture.md).
Work items are tracked in [todo.md](todo.md).

---

## 1. Objective

Demonstrate the ability to design, build, and deploy a production-quality RAG
application:

- Upload and process PDF / DOCX documents.
- Ask natural-language questions about the uploaded document(s).
- Receive concise, accurate answers derived **only** from the uploaded
  content.
- Refuse out-of-context questions with a fixed message — never fabricate or
  infer information that is not present in the documents.

## 2. Functional Requirements

### 2.1 Document Upload

| # | Requirement |
|---|-------------|
| U1 | Accept PDF (`.pdf`) files. |
| U2 | Accept Microsoft Word (`.docx`) files. |
| U3 | Reject all other file types with a clear error message. |
| U4 | Support uploading multiple documents; all active documents form the question-answering corpus. |
| U5 | Display the uploaded document name, size, and processing status. |
| U6 | Allow removing (deleting) an uploaded document. |
| U7 | Allow uploading additional documents at any time (effectively replacing or extending the corpus). |
| U8 | Provide familiar upload affordances, matching products like ChatGPT/Claude: file-picker button, drag-and-drop onto the page, and a visible upload/processing indicator. |
| U9 | Enforce a maximum file size (configurable, default 20 MB) and a maximum number of active documents (configurable, default 20). |
| U10 | Extract text server-side immediately after upload; a document becomes `ready` only after chunking and embedding complete. Failures surface as a `failed` status with a reason. |

### 2.2 Question Answering

| # | Requirement |
|---|-------------|
| Q1 | Accept free-form natural-language questions through a chat interface. |
| Q2 | Answer concisely and accurately, based **only** on the uploaded document(s). |
| Q3 | When multiple documents contain relevant information, use context from all of them. |
| Q4 | Stream the answer token-by-token to the UI (like ChatGPT/Claude), not as a single blob. |
| Q5 | Reject questions when no document is uploaded, with a helpful prompt to upload one. |
| Q6 | The model must never answer from its own general knowledge, even when it knows the answer. |

### 2.3 Out-of-Context Handling (non-negotiable)

| # | Requirement |
|---|-------------|
| O1 | When the required information is not present in the uploaded documents, respond with **exactly**: `I don't have enough context in the uploaded document(s) to answer that question.` |
| O2 | That string exists once in the codebase, as the constant `NO_CONTEXT_MESSAGE` in `lib/config.ts`. |
| O3 | Grounding is enforced **twice**: (a) a retrieval-side relevance gate — if no chunk clears the similarity threshold, the fallback is returned without calling the LLM at all; (b) a prompt-side instruction — the system prompt orders the model to output the fallback when the provided context does not contain the answer. |

Worked example from the assignment:

> **Q:** Who won the FIFA World Cup in 2022?
> **A:** I don't have enough context in the uploaded document(s) to answer that question.

## 3. Non-Functional Requirements

### 3.1 Authentication

- `AUTH_MODE=developer` (default): every request resolves to a single seeded
  developer user. No login screen. This is the assessment mode.
- `AUTH_MODE=full`: reserved seam for real multi-user login (Auth.js). Not
  implemented now, but the design must make enabling it a non-breaking
  change — every database row is already scoped by `userId`.
- All `/api/*` routes (except `/api/health`) are guarded by middleware.

### 3.2 Caching

- **Answer cache** — keyed by a hash of `(normalized question + sorted active
  document ids + model + prompt version)`. A hit returns immediately without
  retrieval or an LLM call. Adding or removing a document changes the key, so
  cached answers can never go stale.
- **Embedding cache** — keyed by a hash of `(chunk text + embedding model)`,
  so identical content is never re-embedded.
- Both caches are backed by SQLite tables (durable, committed) with an
  in-memory fast path, and can be disabled via configuration.

### 3.3 Rate Limiting

- Per-subject (developer user / IP) sliding-window limits on `/api/ask` and
  `/api/documents`.
- Exceeding a limit returns HTTP 429 with a `Retry-After` header.
- Limits are configurable via environment variables with sensible defaults.

### 3.4 Persistence

- SQLite via `better-sqlite3` + Drizzle ORM.
- The database file `data/askdocs.db` **is committed to git**, pre-migrated
  and seeded, so reviewers clone the repo and see identical state without any
  setup steps. WAL side files (`*.db-wal`, `*.db-shm`) are gitignored.

### 3.5 UI / UX

- Single-page layout: document panel (upload + list) and chat panel, styled
  with Tailwind CSS. Clean, modern, responsive.
- Streaming answer rendering with a typing indicator.
- Clear empty states (no documents yet, no messages yet), error states, and
  loading states.

### 3.6 Quality

- TypeScript throughout; no `any`. `zod` validation on every API boundary.
- Vitest test suite covering extraction, chunking, retrieval + relevance gate,
  the fallback path, caches, the rate limiter, prompt construction, and the
  API routes (services stubbed). Tests never hit the network.
- Lint (`pnpm lint`) and typecheck (`pnpm typecheck`) pass clean.

## 4. Technology Constraints

| Concern | Choice |
|---------|--------|
| Framework | Next.js (App Router) + React + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (`better-sqlite3`) + Drizzle ORM, committed `data/askdocs.db` |
| Embeddings | Transformers.js `Xenova/all-MiniLM-L6-v2`, in-process, no extra API key |
| Generation | Google Gemini `gemini-2.5-flash` via the official `@google/genai`, streamed |
| PDF extraction | `unpdf` |
| DOCX extraction | `mammoth` |
| Testing | Vitest |
| Package manager | pnpm (lockfile committed) |

The only required secret is `GEMINI_API_KEY` (in `.env.local` or `.env`, never
committed).

## 5. Out of Scope (for this assessment)

- Real login / multi-user auth (seam exists, implementation deferred).
- OCR for scanned/image-only PDFs — text-layer extraction only.
- External vector databases — in-process cosine similarity over SQLite-stored
  vectors is sufficient at this scale (scaling path noted in
  [architecture.md](architecture.md)).
- Chat-history persistence across page reloads (documented as future work).

## 6. Acceptance Checklist

- [ ] Upload a PDF and a DOCX; both appear in the document list as `ready`.
- [ ] Ask a question answered by one document → correct, concise, streamed answer.
- [ ] Ask a question whose answer spans both documents → answer uses both.
- [ ] Ask "Who won the FIFA World Cup in 2022?" (unrelated) → exact fallback message.
- [ ] Ask the same question twice → second response is served from the answer cache.
- [ ] Delete a document → questions about its content now return the fallback.
- [ ] Hammer `/api/ask` past the limit → 429 with `Retry-After`.
- [ ] Fresh clone + `pnpm install` + `.env.local` with API key + `pnpm dev` works with zero DB setup.
