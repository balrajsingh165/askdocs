# AskDocs — Task Tracker

The single task tracker for this project. Tick a task (`[ ]` → `[x]`) only
when it is implemented **and verified**. Checkboxes only — no dates, no
status notes. Newly discovered work is added as an unchecked task in the
right phase.

---

## Phase 0 — Project Setup

- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind project
- [x] Write project documentation (`docs/requirements.md`, `docs/architecture.md`, `docs/todo.md`, `README.md`, `CLAUDE.md`)
- [ ] Install runtime dependencies (`@google/genai`, `better-sqlite3`, `drizzle-orm`, `@xenova/transformers`, `unpdf`, `mammoth`, `zod`)
- [ ] Install dev dependencies (`drizzle-kit`, `vitest`, `@types/better-sqlite3`)
- [ ] Add scripts to `package.json` (`typecheck`, `test`, `db:generate`, `db:migrate`, `db:seed`)
- [ ] Create `.env.example` documenting all environment variables
- [ ] Fix `.gitignore`: un-ignore `.env.example`, ignore `*.db-wal` / `*.db-shm`, keep `data/askdocs.db` committed
- [ ] Implement `lib/config.ts` (zod-validated env, all constants incl. `NO_CONTEXT_MESSAGE`, `PROMPT_VERSION`)

## Phase 1 — Database

- [ ] Define Drizzle schema (`users`, `documents`, `chunks`, `answer_cache`, `embedding_cache`, `rate_limit_events`)
- [ ] Implement `lib/db/client.ts` (better-sqlite3 connection, WAL mode)
- [ ] Generate initial migration and apply it
- [ ] Implement seed script for the developer user
- [ ] Implement repositories (`users`, `documents`, `chunks`)
- [ ] Commit pre-migrated, seeded `data/askdocs.db`

## Phase 2 — Auth (developer mode)

- [ ] Implement `lib/auth/session.ts` (`getCurrentUser`, `requireUser`, developer-mode resolution)
- [ ] Implement `middleware.ts` guarding `/api/*` (except `/api/health`)
- [ ] Leave the `AUTH_MODE=full` seam documented and type-safe (throws "not implemented")

## Phase 3 — RAG Pipeline

- [ ] Implement `lib/rag/extraction.ts` (PDF via unpdf, DOCX via mammoth, normalization, `ExtractionError`)
- [ ] Implement `lib/rag/chunking.ts` (overlapping chunks, boundary snapping, pure function)
- [ ] Implement `lib/rag/embedding.ts` (MiniLM singleton pipeline, mean pooling, L2 normalization)
- [ ] Implement `lib/cache/embedding-cache.ts` and wire it into embedding
- [ ] Implement `lib/rag/retrieval.ts` (cosine scoring, TOP_K, similarity-threshold relevance gate)
- [ ] Implement `lib/rag/prompt.ts` (grounding system prompt, context-wrapped user message, `PROMPT_VERSION`)
- [ ] Implement `lib/rag/generation.ts` (SDK wrapper, streaming, adaptive thinking, no sampling params)

## Phase 4 — API Routes

- [ ] `POST /api/documents` (upload → validate → extract → chunk → embed → persist, status lifecycle)
- [ ] `GET /api/documents` (list with status)
- [ ] `DELETE /api/documents/[id]` (transactional delete of document + chunks)
- [ ] `POST /api/ask` (guards, answer cache, retrieval gate, streamed generation, cache write-back)
- [ ] `GET /api/health` (liveness, unauthenticated)
- [ ] Implement `lib/ratelimit/limiter.ts` and apply to `/api/ask` and `/api/documents` (429 + `Retry-After`)
- [ ] Implement `lib/cache/answer-cache.ts` and wire into `/api/ask`
- [ ] Domain-error → HTTP mapping in the route layer
- [ ] `export const runtime = 'nodejs'` on every DB/SDK/embedding route

## Phase 5 — UI

- [ ] Page layout: document panel + chat panel (responsive, Tailwind)
- [ ] Upload dropzone (click + drag-and-drop) with type/size validation feedback
- [ ] Document list with name, size, status badge (`processing` / `ready` / `failed`), delete action
- [ ] Chat message list with user/assistant bubbles
- [ ] Streaming answer rendering with typing indicator
- [ ] Composer (textarea, Enter to send, disabled while streaming or with no ready documents)
- [ ] Empty states (no documents, no messages) and error toasts
- [ ] Distinct styling for the out-of-context fallback response

## Phase 6 — Testing

- [ ] Test infrastructure: temp-file SQLite per test, mocked Gemini client, mocked embedding model
- [ ] Extraction tests (PDF fixture, DOCX fixture, corrupt/empty file → `ExtractionError`)
- [ ] Chunking tests (size, overlap, boundary snapping, short-text edge cases)
- [ ] Embedding tests (cache hit/miss, normalization)
- [ ] Retrieval tests (ranking, TOP_K, gate fires below threshold)
- [ ] Prompt-construction tests (grounding rules present, chunks labeled, fallback instruction)
- [ ] Answer-cache tests (hit, miss, key changes on corpus/model/prompt-version change)
- [ ] Rate-limiter tests (window sliding, 429 boundary, per-subject isolation)
- [ ] Out-of-context fallback path test (gate → exact `NO_CONTEXT_MESSAGE`, LLM not called)
- [ ] API route tests end-to-end with services stubbed (upload, list, delete, ask, health, 429s)

## Phase 7 — Polish & Delivery

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass clean
- [ ] Walk the acceptance checklist in `docs/requirements.md`
- [ ] Verify fresh-clone experience (install → env → dev, zero DB setup)
- [ ] Final review of README and architecture docs against actual behavior
- [ ] Deploy (or document exact local run steps for reviewers)

## Backlog (not required for the assessment)

- [ ] Chat-history persistence (`messages` table + reload)
- [ ] `AUTH_MODE=full` with Auth.js
- [ ] `sqlite-vec` retrieval at scale
- [ ] OCR for scanned PDFs
