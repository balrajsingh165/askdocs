# AskDocs

AskDocs is a Retrieval-Augmented Generation (RAG) chatbot. Upload PDF or DOCX
documents and ask natural-language questions — every answer is derived
**strictly from the uploaded content**. If the answer isn't in your documents,
AskDocs says so instead of guessing:

> I don't have enough context in the uploaded document(s) to answer that question.

## Architecture

Three services, cleanly separated:

```
┌──────────────┐   HTTP/JSON + SSE-style stream   ┌───────────────────────┐
│  Next.js UI  │ ───────────────────────────────▶ │   FastAPI backend     │
│  (web, 3000) │ ◀─────────────────────────────── │   (backend, 8000)     │
└──────────────┘                                  │  extract · chunk ·    │
                                                   │  embed · retrieve ·   │
                                                   │  generate (stream)    │
                                                   └──────┬─────────┬──────┘
                                              embeddings +│         │ vectors
                                              generation  │         │
                                                   ┌──────▼───┐ ┌───▼────────┐
                                                   │  Gemini  │ │  Qdrant    │
                                                   │  API     │ │  (6333)    │
                                                   └──────────┘ └────────────┘
```

- **Frontend** — Next.js (App Router) + React + Tailwind. Streaming chat UI,
  drag-and-drop upload, live processing status.
- **Backend** — Python FastAPI. The whole RAG pipeline: text extraction,
  chunking, Gemini embeddings, Qdrant vector search with a relevance gate, and
  streamed Gemini generation.
- **Qdrant** — self-hosted vector database (cosine, 768-dim), run via Docker.
- **Gemini** — `gemini-embedding-001` for embeddings and `gemini-2.5-flash`
  for generation (one API key for both).

Full design: [docs/architecture.md](docs/architecture.md) ·
Spec: [docs/requirements.md](docs/requirements.md) ·
Tasks: [docs/todo.md](docs/todo.md)

## Prerequisites

- **Node.js** 20+ and **pnpm** (`corepack enable pnpm`)
- **Python** 3.11+ and **[uv](https://docs.astral.sh/uv/)**
- **Docker** (for Qdrant)
- A **Google Gemini API key** ([get one](https://aistudio.google.com/apikey))

## Quickstart

```bash
cp .env.example .env      # then set GEMINI_API_KEY
```

### Option A — everything in one command (Docker)

```bash
docker compose up --build
```

Starts Qdrant, the backend (`:8000`), and the web app (`:3000`). Open
http://localhost:3000.

### Option B — local dev with hot reload

```bash
pnpm install         # root task runner (concurrently)
pnpm run setup       # installs web deps (pnpm) + backend deps (uv)
pnpm run qdrant      # start Qdrant in Docker
pnpm run dev         # starts backend (:8000) and web (:3000) together
```

Open http://localhost:3000.

### Running the two servers in separate terminals

```bash
# Terminal 1 — Qdrant
docker compose up -d qdrant

# Terminal 2 — backend (FastAPI on 8000)
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend (Next.js on 3000)
cd web && pnpm dev
```

## Environment

Set in `.env` (root). The backend reads it directly in local dev and
docker-compose injects it into the backend container.

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | ✅ | — | Gemini API (embeddings + generation); `GOOGLE_API_KEY` also works |
| `GEMINI_MODEL` | | `gemini-2.5-flash` | Generation model |
| `GEMINI_EMBED_MODEL` | | `gemini-embedding-001` | Embedding model |
| `EMBED_DIM` | | `768` | Embedding dimensionality |
| `SIMILARITY_THRESHOLD` | | `0.5` | Retrieval relevance gate (cosine) |
| `TOP_K` | | `8` | Chunks retrieved per question |
| `QDRANT_URL` | | `http://localhost:6333` | Qdrant endpoint |
| `MAX_DOCUMENTS` / `MAX_FILE_SIZE_MB` | | `20` / `20` | Upload limits |
| `CORS_ORIGINS` | | `http://localhost:3000` | Allowed web origin(s) |
| `NEXT_PUBLIC_API_BASE_URL` | | `http://localhost:8000` | Backend URL used by the browser |

## How It Works

1. **Upload** — the backend accepts the file and responds immediately with a
   `processing` document, then (in the background) extracts text
   (`pypdf`/`python-docx`), splits it into overlapping chunks, embeds each with
   Gemini (`RETRIEVAL_DOCUMENT`), and upserts the vectors into Qdrant. The UI
   polls until the document is `ready`.
2. **Ask** — the question is embedded (`RETRIEVAL_QUERY`) and searched against
   Qdrant. If nothing clears the similarity threshold, the fixed fallback is
   returned **without calling the LLM**.
3. **Answer** — the top chunks and the question go to Gemini with a system
   instruction that forbids outside knowledge and mandates the exact fallback
   when the context is insufficient. The answer streams to the UI and is cached.

## Testing

```bash
cd backend && uv run pytest      # or: pnpm run test:api  (from repo root)
```

The suite covers chunking, the retrieval relevance gate, extraction, the
answer-cache key, and the API routes end-to-end (Gemini and Qdrant mocked, so
tests hit no network and need no running services).

## Project Structure

```
web/       Next.js frontend (chat UI, upload, streaming)
backend/   FastAPI RAG service
  app/
    api/         documents · ask · health routes
    services/    extraction · chunking · embedding · vectorstore · retrieval · generation
    store.py     SQLite metadata + answer cache
    config.py    settings (pydantic-settings)
  tests/         pytest suite
docker-compose.yml   qdrant + backend + web
docs/                requirements · architecture · todo
```

## Auth Model

Runs in **developer mode**: every request resolves to a single developer user,
so reviewers need no login. All data is scoped by `user_id`, so enabling real
multi-user auth later is a non-breaking change.
