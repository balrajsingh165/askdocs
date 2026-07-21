@AGENTS.md

# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

AskDocs is a Retrieval-Augmented Generation (RAG) web application built with
**Next.js**. Users upload PDF or DOCX documents and ask natural-language
questions answered strictly from the uploaded content. If the answer is not
present in the documents, the app refuses with a fixed fallback message
instead of guessing.

Full specification: [docs/requirements.md](docs/requirements.md)
System design: [docs/architecture.md](docs/architecture.md)
Task tracker: [docs/todo.md](docs/todo.md)

## Stack

- **Next.js (App Router) + TypeScript + React**
- **Tailwind CSS** for styling
- **SQLite** via `better-sqlite3` + **Drizzle ORM** — the database file
  (`data/askdocs.db`) is committed to git so reviewers see identical state
- **Transformers.js** (`Xenova/all-MiniLM-L6-v2`) for local embeddings — no
  second API key, runs in-process
- **Google Gemini** (`gemini-2.5-flash`) via `@google/genai` for generation
- **pdf extraction** via `unpdf`, **docx extraction** via `mammoth`
- **Vitest** for tests
- **pnpm** is the package manager (lockfile committed) — never use npm/yarn

## Commands

| Task                  | Command                     |
| --------------------- | --------------------------- |
| Install dependencies  | `pnpm install`              |
| Run dev server        | `pnpm dev`                  |
| Production build      | `pnpm build`                |
| Start production      | `pnpm start`                |
| Lint                  | `pnpm lint`                 |
| Typecheck             | `pnpm typecheck`            |
| Run tests             | `pnpm test`                 |
| Generate DB schema    | `pnpm db:generate`          |
| Apply migrations      | `pnpm db:migrate`           |
| Seed developer user   | `pnpm db:seed`              |

## Environment

- Secrets live in `.env.local` or `.env` (never committed). See `.env.example`.
- Required: `GEMINI_API_KEY` (a Google AI Studio key; `GOOGLE_API_KEY` is also
  accepted).
- Optional (have defaults): `GEMINI_MODEL`, `GEMINI_MAX_TOKENS`, `AUTH_MODE`,
  `SQLITE_PATH`, `DEVELOPER_NAME`, rate-limit and cache settings.
- All configuration is read once in `lib/config.ts`. Never call
  `process.env` anywhere else.

## Architecture Overview

The UI and API live in one Next.js app. The RAG pipeline is a set of
framework-agnostic services under `lib/` that the API routes call.

```
app/                          Next.js App Router (UI + API)
├── layout.tsx, page.tsx      Chat + upload single page
├── api/
│   ├── documents/route.ts        POST upload, GET list
│   ├── documents/[id]/route.ts   DELETE
│   ├── ask/route.ts              POST question (streamed answer)
│   └── health/route.ts           Liveness probe
components/                    React UI (chat/, upload/, ui/)
lib/
├── config.ts                 Settings + constants (NO_CONTEXT_MESSAGE, model, thresholds)
├── db/                       Drizzle schema, client, repositories
├── auth/                     Developer-mode session, extendable to full login
├── cache/                    Answer cache + embedding cache
├── ratelimit/                Per-subject limiter
└── rag/                      extraction, chunking, embedding, retrieval, generation
data/askdocs.db               Committed SQLite database
tests/                        Mirrors lib/ and app/api/
```

Rules:

- `lib/rag/` and `lib/db/` must not import from `next/*` or React — they stay
  reusable and unit-testable in isolation.
- API route handlers stay thin: authenticate, rate-limit, validate, delegate
  to a service, shape the response. No business logic in routes.
- All API routes that touch the DB, embeddings, or the SDK must run on the
  Node.js runtime: `export const runtime = 'nodejs'` (not Edge).

## Code Style

- Write reusable, single-responsibility functions and modules. If logic is
  needed twice, extract it — never copy-paste.
- **No inline comments.** Code must be self-explanatory through naming and
  structure. Document behavior with **JSDoc/TSDoc doc comments** on exported
  functions, types, and modules (summary + `@param` + `@returns` + `@throws`).
- Full TypeScript types on all exports. No `any`; prefer precise types and
  discriminated unions. Use `zod` to validate anything crossing the API
  boundary, and derive types from the schemas.
- Constants live once in `lib/config.ts` and are imported — never re-declare a
  literal (fallback message, model name, chunk size, thresholds, limits).
- Throw domain-specific errors from services; map them to HTTP responses only
  in the route layer.
- Keep functions short and pure where possible; isolate I/O at the edges.
- Prefer server components and server actions/route handlers; keep client
  components thin and focused on interaction.

## RAG Grounding Rules (non-negotiable)

- Every answer must be derived only from the uploaded document content passed
  as retrieval context.
- When no relevant context exists, respond with exactly:
  `I don't have enough context in the uploaded document(s) to answer that question.`
- That string is the constant `NO_CONTEXT_MESSAGE` in `lib/config.ts`. Never
  duplicate the literal anywhere else.
- Enforce grounding twice: a retrieval-side relevance gate (skip the LLM call
  entirely when nothing clears the similarity threshold) and a prompt-side
  instruction telling the model to output the fallback message when the
  context does not contain the answer.
- The model must never answer from its own general knowledge, even when it
  knows the answer.

## Gemini API Usage

- Use the official `@google/genai` SDK — never raw HTTP.
- Model: `gemini-2.5-flash` by default, read from `config.geminiModel`
  (override with `GEMINI_MODEL`).
- `temperature: 0` for faithful, deterministic grounding; `thinkingConfig:
  { thinkingBudget: 0 }` to keep short factual answers fast; `maxOutputTokens`
  from `config.geminiMaxTokens` (~1024).
- Stream the answer (`ai.models.generateContentStream(...)`) so the UI renders
  tokens as they arrive, like ChatGPT/Claude.
- Grounding rules go in `systemInstruction`; retrieved chunks and the user
  question go in the `contents`.
- All SDK access is wrapped in `lib/rag/generation.ts` (which exposes
  `streamAnswer`) so nothing else in the codebase touches the SDK directly.

## Auth (developer mode)

- `AUTH_MODE=developer` (default) resolves every request to the seeded
  developer user — no login screen. `AUTH_MODE=full` is the future seam for
  real login (Auth.js) and is not implemented yet.
- Session lookup lives behind `lib/auth/session.ts` (`getCurrentUser`,
  `requireUser`). Nothing else reads the auth mode directly.
- Every DB row is scoped by `userId`, so enabling multi-user later requires no
  schema change.
- Middleware guards `/api/*` (except `/api/health`).

## Caching & Rate Limiting

- **Answer cache** — keyed by a hash of `(normalized question + sorted active
  document ids + model + prompt version)`. A hit returns immediately without
  retrieval or an LLM call. Adding/removing a document changes the key, so
  answers can never go stale.
- **Embedding cache** — keyed by a hash of `(chunk text + embedding model)` so
  identical content is never re-embedded.
- **Rate limiting** — per-subject (developer user / IP) sliding window on
  `/api/ask` and `/api/documents`; returns 429 with `Retry-After`.
- Both are backed by SQLite tables (committed, durable) with an in-memory fast
  path. Limits and cache toggles come from `lib/config.ts`.

## Database

- `data/askdocs.db` **is committed** — it is the shared source of truth for
  reviewers. Keep it pre-migrated and seeded.
- Gitignore the WAL side files (`*.db-wal`, `*.db-shm`) but **not** the `.db`.
- Schema changes go through Drizzle migrations (`pnpm db:generate` →
  `pnpm db:migrate`); commit the regenerated `.db` alongside the migration.

## Testing

- Vitest, tests mirroring the `lib/` and `app/api/` layout under `tests/`.
- Mock the Gemini client and the embedding model — tests never hit the
  network and never download model weights.
- Use a throwaway in-memory / temp-file SQLite database per test; never touch
  the committed `data/askdocs.db`.
- Required coverage: PDF and DOCX extraction, chunking, retrieval + relevance
  gate, the out-of-context fallback path, cache hit/miss, the rate limiter,
  prompt construction, and the API routes end to end with services stubbed.

## Workflow

- [docs/todo.md](docs/todo.md) is the single task tracker. Before starting
  work, find the relevant task. When a task is implemented **and verified**,
  tick it (`[ ]` → `[x]`). Never add dates, timestamps, or status notes —
  checkboxes only.
- If new work is discovered, add it as a new unchecked task in the right phase.
- Keep [README.md](README.md) and [docs/architecture.md](docs/architecture.md)
  accurate whenever behavior or structure changes.
