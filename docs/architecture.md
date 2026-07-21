# AskDocs — System Architecture

How AskDocs is built. What it must do is in [requirements.md](requirements.md);
tasks are in [todo.md](todo.md).

---

## 1. Overview

AskDocs is split into three services with clear responsibilities:

| Service | Tech | Responsibility |
|---------|------|----------------|
| **web** | Next.js (App Router), React, Tailwind | Chat UI, upload, streaming answers |
| **backend** | Python FastAPI | The RAG pipeline (extract → chunk → embed → retrieve → generate) |
| **qdrant** | Qdrant (Docker) | Vector storage + similarity search |

External APIs: **Google Gemini** for embeddings (`gemini-embedding-001`) and
generation (`gemini-2.5-flash`) — one API key for both.

```
                          POST /documents (upload)
                          GET  /documents (list + status)
                          DELETE /documents/{id}
   ┌──────────────┐       POST /ask  (streamed answer)     ┌────────────────────┐
   │  Next.js UI  │ ────────────────────────────────────▶ │  FastAPI backend   │
   │   (web)      │ ◀──────────────────────────────────── │                    │
   └──────────────┘   text/plain stream + X-AskDocs-Source └───┬────────────┬───┘
                                                               │            │
                                              embed + generate │            │ upsert / search / delete
                                                        ┌──────▼─────┐ ┌────▼──────┐
                                                        │ Gemini API │ │  Qdrant   │
                                                        └────────────┘ └───────────┘
                                                                            ▲
                          document metadata + answer cache ──▶ SQLite ──────┘ (vectors only in Qdrant)
```

## 2. Backend layout

```
backend/app/
├── main.py            FastAPI app, CORS, Qdrant bootstrap (lifespan)
├── config.py          Settings (pydantic-settings) — the only env reader
├── grounding.py       NO_CONTEXT_MESSAGE, system prompt, user-message builder
├── answer_cache.py    Answer-cache key derivation (pure)
├── store.py           SQLite: document metadata + answer cache
├── deps.py            Developer-mode user + store dependency
├── schemas.py         Pydantic request/response models (camelCase out)
├── api/
│   ├── documents.py   POST upload (+ background processing), GET list, DELETE
│   ├── ask.py         POST question → streamed answer
│   └── health.py      Liveness probe
└── services/
    ├── extraction.py  pypdf (PDF) + python-docx (DOCX) → normalised text
    ├── chunking.py    Overlapping chunks with boundary snapping (pure)
    ├── embedding.py   Gemini embeddings (RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY)
    ├── vectorstore.py Qdrant client: ensure collection, upsert, search, delete
    ├── retrieval.py   Embed query → Qdrant search → relevance gate
    ├── generation.py  Gemini streaming generation
    └── documents.py   Upload orchestration (extract → chunk → embed → upsert)
```

Rule: `api/` handlers stay thin (validate, delegate, shape the response);
business logic lives in `services/`. Services raise domain errors
(`ExtractionError`, `GenerationError`); routes map failures to HTTP.

## 3. Configuration (`app/config.py`)

All environment access happens once, via `pydantic-settings`. Reads
`backend/.env` then the repo-root `.env` (so one root `.env` works for both
local dev and docker-compose); real OS env vars win. Key settings:

| Setting | Default | Purpose |
|---------|---------|---------|
| `gemini_api_key` / `google_api_key` | — (required) | Gemini access |
| `gemini_model` | `gemini-2.5-flash` | Generation |
| `gemini_embed_model` | `gemini-embedding-001` | Embeddings |
| `embed_dim` | `768` | Vector size |
| `top_k` | `8` | Retrieved chunks |
| `similarity_threshold` | `0.5` | Relevance gate (cosine) |
| `qdrant_url` / `qdrant_collection` | `http://localhost:6333` / `askdocs_chunks` | Vector store |
| `sqlite_path` | `data/askdocs.db` | Metadata + answer cache |
| `max_documents` / `max_file_size_mb` | `20` / `20` | Upload limits |
| `answer_cache_enabled` | `true` | Answer cache toggle |
| `prompt_version` | `1` | Part of the answer-cache key |

## 4. Data stores

**Qdrant** holds all chunk vectors. One collection (`askdocs_chunks`, cosine,
768-dim). Each point: a UUID id, the vector, and a payload of
`{user_id, document_id, document_name, chunk_index, content}`. Payload indexes
on `user_id` and `document_id` support filtered search and deletion.

**SQLite** (`store.py`) holds only what Qdrant shouldn't: document metadata /
lifecycle and the answer cache.

| Table | Columns | Notes |
|-------|---------|-------|
| `documents` | id, user_id, filename, kind, mime_type, size_bytes, status, error, chunk_count, created_at | `status`: `processing` → `ready` \| `failed` |
| `answer_cache` | key (PK), user_id, question, answer, created_at | Key = SHA-256 of normalised question + sorted ready doc ids + model + prompt version |

## 5. Request flows

### Upload — `POST /documents`
```
multipart file
  → validate type (PDF/DOCX) + size + document count
  → insert documents row (status: processing)
  → respond 201 with the processing document          ← returns immediately
  → [background task] extract → chunk → embed (Gemini RETRIEVAL_DOCUMENT)
                      → upsert vectors to Qdrant → status: ready | failed
```
The UI polls `GET /documents` while any document is `processing`, so the
`processing → ready`/`failed` transition is visible without blocking the upload.

### Ask — `POST /ask`
```
{ question }
  → validate (non-empty) → require ≥1 ready document (else 409)
  → answer-cache hit → return cached answer (header: cache)   ← no retrieval, no LLM
  → embed question (Gemini RETRIEVAL_QUERY)
  → Qdrant search (top_k, filtered by user_id)
  → relevance gate: nothing ≥ threshold → NO_CONTEXT_MESSAGE (header: no_context)  ← no LLM
  → Gemini streaming generation with grounding prompt (header: generated)
  → on completion: write full answer to the answer cache
```
The `X-AskDocs-Source` response header (`cache` / `no_context` / `generated`)
tells the UI how the answer was produced. Cache hit, gated fallback, and
generated answer all return as streamed `text/plain`, so the UI has one path.

### Delete — `DELETE /documents/{id}`
Deletes the SQLite metadata row and all matching Qdrant points (filtered by
`document_id`). Because the answer-cache key includes the sorted ready-document
ids, cached answers that depended on the deleted document become unreachable.

## 6. RAG pipeline details

- **Extraction** (`extraction.py`) — `pypdf` for PDF, `python-docx` for DOCX;
  whitespace normalised, paragraph breaks preserved. Empty/unparseable →
  `ExtractionError`.
- **Chunking** (`chunking.py`) — sliding character window (~1200 chars, 200
  overlap), snapping split points to paragraph/sentence/line/word boundaries.
  Pure function.
- **Embedding** (`embedding.py`) — Gemini `gemini-embedding-001`, 768-dim,
  batched. Chunks use task type `RETRIEVAL_DOCUMENT`, questions
  `RETRIEVAL_QUERY` — the asymmetric setup that gives clean relevance
  separation (relevant chunks ≈ 0.65–0.75, unrelated ≈ 0.45).
- **Vector store** (`vectorstore.py`) — Qdrant cosine collection; the only
  module that talks to Qdrant. The retrieval seam is isolated here.
- **Retrieval** (`retrieval.py`) — embed the query, search Qdrant, then
  `apply_gate` (pure): keep chunks at/above the threshold, gate if none.
- **Generation** (`generation.py`) — the only module that streams from Gemini.
  `temperature=0` and `thinking_budget=0` for faithful, fast grounded answers.
  Grounding rules in `system_instruction`; chunks + question in `contents`.

## 7. Grounding (enforced twice)

1. **Retrieval gate** — if no chunk clears `similarity_threshold`, the backend
   returns `NO_CONTEXT_MESSAGE` without calling Gemini.
2. **Prompt-side** — the system instruction orders the model to answer only
   from the provided context and to emit the exact `NO_CONTEXT_MESSAGE` when
   the context doesn't contain the answer, never using outside knowledge.

`NO_CONTEXT_MESSAGE` is defined once (`grounding.py`).

## 8. Auth

Developer mode: `deps.current_user_id()` returns a single developer id, so
reviewers need no login. Every row and every Qdrant payload is scoped by
`user_id`, so real multi-user auth is a non-breaking change (swap the
dependency; nothing else changes).

## 9. Answer cache

Exact-match cache in SQLite. Key = SHA-256 of `(normalised question + sorted
ready document ids + model + prompt version)`. A hit returns immediately with
`X-AskDocs-Source: cache`, skipping retrieval and generation. Because the key
includes the active document set, adding/removing a document changes the key
and cached answers can never go stale.

## 10. Error handling

Services raise domain errors; routes translate:

| Condition | Status |
|-----------|--------|
| Bad/empty request, unsupported file type | 400 |
| No ready documents | 409 |
| Not found (delete) | 404 |
| File too large | 413 |
| Extraction failure | recorded as document `status: failed` |
| Generation failure | surfaced on the stream / logged |

## 11. Deployment

`docker compose up --build` runs all three services: `qdrant`, `backend`
(uvicorn), and `web` (Next.js). The backend reaches Qdrant at
`http://qdrant:6333` inside the compose network; the browser reaches the
backend at `http://localhost:8000`. The same image set deploys to any Docker
host.

## 12. Deliberate seams

| Extension | Seam |
|-----------|------|
| Real multi-user auth | `deps.current_user_id()`; all data already `user_id`-scoped |
| Different embedding/generation model | `config.py` settings |
| Swap vector DB | `services/vectorstore.py` is the only Qdrant touchpoint |
| Chat history persistence | new SQLite table + endpoint; UI already message-shaped |
| Rate limiting / real login | add middleware / dependency in the backend |
