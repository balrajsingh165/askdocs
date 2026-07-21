# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

AskDocs is a Retrieval-Augmented Generation (RAG) chatbot. Users upload PDF or
DOCX documents and ask natural-language questions answered strictly from the
uploaded content. If the answer is not present, the app refuses with a fixed
fallback message instead of guessing.

Spec: [docs/requirements.md](docs/requirements.md) ·
Design: [docs/architecture.md](docs/architecture.md) ·
Tasks: [docs/todo.md](docs/todo.md)

## Architecture

Three services in a monorepo:

- **`web/`** — Next.js (App Router) + React + Tailwind frontend. Chat UI,
  upload, streaming answers. Talks to the backend over HTTP; see
  `web/AGENTS.md` for the Next.js 16 caveats.
- **`backend/`** — Python FastAPI. The entire RAG pipeline. Managed with `uv`.
- **Qdrant** — vector database (Docker), cosine, 768-dim.
- **Gemini** — `gemini-embedding-001` (embeddings) + `gemini-2.5-flash`
  (generation), via `google-genai`.

## Commands

Run from the repo root unless noted.

| Task | Command |
| ---- | ------- |
| Install everything | `pnpm install && pnpm run setup` |
| Start Qdrant | `pnpm run qdrant` (or `docker compose up -d qdrant`) |
| Dev (both servers) | `pnpm run dev` (backend :8000, web :3000) |
| Backend only | `cd backend && uv run uvicorn app.main:app --reload --port 8000` |
| Frontend only | `cd web && pnpm dev` |
| Backend tests | `cd backend && uv run pytest` (or `pnpm run test:api`) |
| Frontend checks | `cd web && pnpm typecheck && pnpm lint && pnpm build` |
| Full stack (Docker) | `docker compose up --build` |

## Environment

- Secrets live in `.env` at the repo root (never committed). See `.env.example`.
- Required: `GEMINI_API_KEY` (`GOOGLE_API_KEY` also accepted).
- The backend reads `backend/.env` then the repo-root `.env`; docker-compose
  injects the root `.env` into the backend container.
- All config is read once in `backend/app/config.py` (pydantic-settings). Never
  read `os.environ` elsewhere.

## Backend code style

- `api/` handlers stay thin: validate, delegate to a service, shape the
  response. Business logic lives in `services/`.
- Services raise domain errors (`ExtractionError`, `GenerationError`); routes
  map failures to `HTTPException`.
- Full type hints on public functions; docstrings on modules and public
  functions. Keep functions short and pure where possible; isolate I/O.
- Constants live once (`grounding.py` for `NO_CONTEXT_MESSAGE` / the prompt,
  `config.py` for settings). Never duplicate a literal.
- `services/vectorstore.py` is the **only** Qdrant touchpoint;
  `services/generation.py` and `services/embedding.py` are the **only**
  Gemini touchpoints.

## Frontend code style

- No inline comments; TSDoc on exported functions. Full TypeScript types; no
  `any`. Client-safe modules only under `web/lib/shared/`.
- Server-only concerns do not exist in the frontend anymore — it is a pure
  client that calls the backend via `web/lib/shared/api.ts`.

## RAG Grounding Rules (non-negotiable)

- Every answer must derive only from the uploaded document content.
- When no relevant context exists, respond with exactly:
  `I don't have enough context in the uploaded document(s) to answer that question.`
- That string is `NO_CONTEXT_MESSAGE` in `backend/app/grounding.py`. Never
  duplicate the literal.
- Enforce grounding twice: the retrieval relevance gate (skip generation when
  nothing clears `similarity_threshold`) and the prompt-side instruction.
- The model must never answer from general knowledge.

## Gemini usage

- Use `google-genai`. Generation: `client.models.generate_content_stream(...)`
  with `system_instruction`, `temperature=0`, `thinking_config` budget 0,
  streamed. Embeddings: `client.models.embed_content(...)` with task types
  `RETRIEVAL_DOCUMENT` (chunks) and `RETRIEVAL_QUERY` (questions).
- Model ids come from `config.py` (`gemini_model`, `gemini_embed_model`).

## Qdrant

- One collection (`askdocs_chunks`), cosine, `embed_dim` (768). Payload carries
  `user_id`, `document_id`, `document_name`, `chunk_index`, `content`.
- Filter by `user_id` on search; delete by `document_id`.

## Testing

- pytest under `backend/tests/`, mirroring the app layout.
- Mock Gemini (embedding/generation) and Qdrant — tests never hit the network
  and need no running services. Use an in-memory SQLite store per test.
- Required coverage: chunking, retrieval gate, extraction, answer-cache key,
  and the API routes end-to-end.

## Workflow

- [docs/todo.md](docs/todo.md) is the task tracker. Tick a task only when
  implemented **and verified**. Checkboxes only — no dates or notes.
- Keep [README.md](README.md) and [docs/architecture.md](docs/architecture.md)
  accurate when behavior or structure changes.
