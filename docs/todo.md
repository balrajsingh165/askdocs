# AskDocs — Task Tracker

The single task tracker for this project. Tick a task (`[ ]` → `[x]`) only
when it is implemented **and verified**. Checkboxes only — no dates, no
status notes. Newly discovered work is added as an unchecked task in the
right phase.

---

## Phase 0 — Project Setup

- [x] Scaffold Next.js (App Router) + TypeScript + Tailwind project
- [x] Write project documentation (`docs/requirements.md`, `docs/architecture.md`, `docs/todo.md`, `README.md`, `CLAUDE.md`)
- [x] Install runtime dependencies (`@google/genai`, `better-sqlite3`, `drizzle-orm`, `@xenova/transformers`, `unpdf`, `mammoth`, `zod`)
- [x] Install dev dependencies (`drizzle-kit`, `vitest`, `@types/better-sqlite3`, `tsx`)
- [x] Add scripts to `package.json` (`typecheck`, `test`, `db:generate`, `db:migrate`, `db:seed`)
- [x] Create `.env.example` documenting all environment variables
- [x] Fix `.gitignore`: un-ignore `.env.example`, ignore `*.db-wal` / `*.db-shm`, keep `data/askdocs.db` committed
- [x] Implement `lib/config.ts` (zod-validated env, all constants incl. `NO_CONTEXT_MESSAGE`, `PROMPT_VERSION`)

## Phase 1 — Database

- [x] Define Drizzle schema (`users`, `documents`, `chunks`, `answer_cache`, `embedding_cache`, `rate_limit_events`)
- [x] Implement `lib/db/client.ts` (better-sqlite3 connection, WAL mode)
- [x] Generate initial migration and apply it
- [x] Implement seed script for the developer user
- [x] Implement repositories (`users`, `documents`, `chunks`)
- [x] Commit pre-migrated, seeded `data/askdocs.db`

## Phase 2 — Auth (developer mode)

- [x] Implement `lib/auth/session.ts` (`getCurrentUser`, `requireUser`, developer-mode resolution)
- [x] Implement `proxy.ts` guarding `/api/*` (except `/api/health`)
- [x] Leave the `AUTH_MODE=full` seam documented and type-safe (throws "not implemented")

## Phase 3 — RAG Pipeline

- [x] Implement `lib/rag/extraction.ts` (PDF via unpdf, DOCX via mammoth, normalization, `ExtractionError`)
- [x] Implement `lib/rag/chunking.ts` (overlapping chunks, boundary snapping, pure function)
- [x] Implement `lib/rag/embedding.ts` (MiniLM singleton pipeline, mean pooling, L2 normalization)
- [x] Implement `lib/cache/embedding-cache.ts` and wire it into embedding
- [x] Implement `lib/rag/retrieval.ts` (cosine scoring, TOP_K, similarity-threshold relevance gate)
- [x] Implement `lib/rag/prompt.ts` (grounding system prompt, context-wrapped user message, `PROMPT_VERSION`)
- [x] Implement `lib/rag/generation.ts` (Gemini SDK wrapper, streaming, temperature 0, thinking disabled)

## Phase 4 — API Routes

- [x] `POST /api/documents` (upload → validate → extract → chunk → embed → persist, status lifecycle)
- [x] `GET /api/documents` (list with status)
- [x] `DELETE /api/documents/[id]` (transactional delete of document + chunks)
- [x] `POST /api/ask` (guards, answer cache, retrieval gate, streamed generation, cache write-back)
- [x] `GET /api/health` (liveness, unauthenticated)
- [x] Implement `lib/ratelimit/limiter.ts` and apply to `/api/ask` and `/api/documents` (429 + `Retry-After`)
- [x] Implement `lib/cache/answer-cache.ts` and wire into `/api/ask`
- [x] Domain-error → HTTP mapping in the route layer
- [x] `export const runtime = 'nodejs'` on every DB/SDK/embedding route

## Phase 5 — UI

- [x] Page layout: document panel + chat panel (responsive, Tailwind)
- [x] Upload dropzone (click + drag-and-drop) with type/size validation feedback
- [x] Document list with name, size, status badge (`processing` / `ready` / `failed`), delete action
- [x] Chat message list with user/assistant bubbles
- [x] Streaming answer rendering with typing indicator
- [x] Composer (textarea, Enter to send, disabled while streaming or with no ready documents)
- [x] Empty states (no documents, no messages) and error toasts
- [x] Distinct styling for the out-of-context fallback response

## Phase 6 — Testing

- [x] Test infrastructure: temp-file SQLite per test, mocked Gemini client, mocked embedding model
- [x] Extraction tests (mocked unpdf/mammoth, normalization, empty → `ExtractionError`)
- [x] Chunking tests (size, overlap, boundary snapping, short-text edge cases)
- [x] Embedding cache tests (cache hit/miss, persistence)
- [x] Retrieval tests (ranking, TOP_K, gate fires below threshold)
- [x] Prompt-construction tests (grounding rules present, chunks labeled, fallback instruction)
- [x] Answer-cache tests (hit, miss, key changes on corpus/model/prompt-version change)
- [x] Rate-limiter tests (window sliding, 429 boundary, per-subject isolation)
- [x] Out-of-context fallback path test (gate → exact `NO_CONTEXT_MESSAGE`, LLM not called)
- [x] API route tests end-to-end with services stubbed (upload, list, delete, ask, health, 429s)

## Phase 7 — Polish & Delivery

- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass clean
- [x] Verify grounded answer + exact fallback against the live Gemini API
- [ ] Walk the full acceptance checklist in `docs/requirements.md` in the browser
- [ ] Deploy (or document exact local run steps for reviewers)

## Backlog (not required for the assessment)

- [ ] Chat-history persistence (`messages` table + reload)
- [ ] `AUTH_MODE=full` with Auth.js
- [ ] `sqlite-vec` retrieval at scale
- [ ] OCR for scanned PDFs
