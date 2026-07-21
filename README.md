# AskDocs

AskDocs is a Retrieval-Augmented Generation (RAG) web application. Upload PDF
or DOCX documents and ask natural-language questions — every answer is
derived **strictly from the uploaded content**. If the answer isn't in your
documents, AskDocs says so instead of guessing:

> I don't have enough context in the uploaded document(s) to answer that question.

## Features

- **PDF & DOCX upload** — file picker or drag-and-drop, multiple documents,
  live processing status, delete/replace at any time.
- **Grounded question answering** — answers come only from your documents;
  when multiple documents are relevant, context from all of them is used.
- **Streaming responses** — answers render token-by-token, like ChatGPT/Claude.
- **Double grounding enforcement** — a retrieval-side relevance gate (skips
  the LLM entirely when nothing relevant is found) plus a prompt-side
  instruction; the model never answers from general knowledge.
- **Answer & embedding caches** — repeated questions return instantly;
  identical content is never re-embedded. Cache keys include the active
  document set, so answers can never go stale.
- **Rate limiting** — per-user sliding windows on ask and upload endpoints.
- **Zero-setup reviewing** — the SQLite database (`data/askdocs.db`) is
  committed pre-migrated and seeded; clone, install, add an API key, run.

## Stack

| Concern | Choice |
|---------|--------|
| App | Next.js (App Router) + React + TypeScript + Tailwind CSS |
| Generation | Google Gemini (`gemini-2.5-flash`) via `@google/genai`, streamed |
| Embeddings | Transformers.js `Xenova/all-MiniLM-L6-v2` — local, no second API key |
| Database | SQLite (`better-sqlite3`) + Drizzle ORM |
| Extraction | `unpdf` (PDF) · `mammoth` (DOCX) |
| Tests | Vitest |

## Getting Started

Prerequisites: Node.js 20+, pnpm, a Google Gemini API key
([get one here](https://aistudio.google.com/apikey)).

```bash
pnpm install
cp .env.example .env.local     # then set GEMINI_API_KEY
pnpm dev
```

Open http://localhost:3000, upload a document, and ask away. No database
setup is needed — the committed `data/askdocs.db` is already migrated and
seeded with the developer user.

### Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | ✅ | — | Google Gemini API access (`GOOGLE_API_KEY` also accepted) |
| `GEMINI_MODEL` | | `gemini-2.5-flash` | Generation model |
| `AUTH_MODE` | | `developer` | `developer` (no login) or `full` (future) |
| `SQLITE_PATH` | | `data/askdocs.db` | Database file |
| `DEVELOPER_NAME` | | `Developer` | Display name for the seeded user |

Rate-limit and cache settings also have overridable defaults — see
`lib/config.ts` for the full validated list. Secrets live in `.env.local`,
which is never committed.

## Scripts

| Task | Command |
|------|---------|
| Dev server | `pnpm dev` |
| Production build / start | `pnpm build` · `pnpm start` |
| Lint / typecheck | `pnpm lint` · `pnpm typecheck` |
| Tests | `pnpm test` |
| DB migrations | `pnpm db:generate` · `pnpm db:migrate` |
| Seed developer user | `pnpm db:seed` |

## How It Works

1. **Upload** — text is extracted server-side (`unpdf`/`mammoth`), split into
   overlapping chunks, embedded locally with MiniLM, and stored in SQLite.
2. **Ask** — the question is embedded and scored (cosine similarity) against
   all chunks. If nothing clears the relevance threshold, the fixed fallback
   message is returned **without calling the LLM**.
3. **Answer** — the top chunks and the question go to Gemini with a system
   instruction that forbids outside knowledge and mandates the exact fallback
   when the context is insufficient. The answer streams to the UI and is cached.

Full design: [docs/architecture.md](docs/architecture.md) ·
Specification: [docs/requirements.md](docs/requirements.md) ·
Task tracker: [docs/todo.md](docs/todo.md)

## Auth Model

The app runs in **developer mode**: every request resolves to a single seeded
developer user, so reviewers need no login. All data is already scoped by
`userId` and API routes are middleware-guarded, so switching on real
multi-user login (`AUTH_MODE=full`, Auth.js) later requires no schema change.

## Testing

```bash
pnpm test
```

Tests mock the Gemini client and the embedding model (no network, no model
downloads) and use a throwaway SQLite database per test — the committed
`data/askdocs.db` is never touched.
