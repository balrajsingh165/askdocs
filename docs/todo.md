# AskDocs — Task Tracker

Single task tracker. Tick a task (`[ ]` → `[x]`) only when implemented **and
verified**. Checkboxes only — no dates or notes.

---

## Phase 0 — Setup & Structure

- [x] Monorepo: `web/` (Next.js) + `backend/` (FastAPI) + `docker-compose.yml`
- [x] Backend deps via `uv` (`pyproject.toml`, `uv.lock`)
- [x] Frontend deps via `npm`
- [x] Root task runner (`npm run dev` / `setup` / `qdrant`) with `concurrently`
- [x] `.env.example`, `.gitignore` (ignore `node_modules`, `.venv`, `data/`, `.env`)
- [x] `backend/app/config.py` (pydantic-settings; single env reader)

## Phase 1 — Vector Store & Data

- [x] Qdrant via docker-compose (cosine, 768-dim)
- [x] `services/vectorstore.py` (ensure collection, upsert, search, delete)
- [x] SQLite `store.py` (documents metadata + answer cache)

## Phase 2 — RAG Pipeline (backend services)

- [x] `extraction.py` (pypdf + python-docx, normalization, `ExtractionError`)
- [x] `chunking.py` (overlapping chunks, boundary snapping, pure)
- [x] `embedding.py` (Gemini `gemini-embedding-001`, RETRIEVAL_DOCUMENT/QUERY)
- [x] `retrieval.py` (Qdrant search + relevance gate, pure `apply_gate`)
- [x] `grounding.py` (system prompt, `NO_CONTEXT_MESSAGE`, user-message builder)
- [x] `generation.py` (Gemini `gemini-2.5-flash` streaming, temp 0, no thinking)
- [x] `services/documents.py` (upload orchestration, background processing)

## Phase 3 — API

- [x] `POST /documents` (validate → insert processing → background embed)
- [x] `GET /documents` (list with status)
- [x] `DELETE /documents/{id}` (SQLite row + Qdrant points)
- [x] `POST /ask` (validate, answer cache, retrieval gate, streamed generation)
- [x] `GET /health` (liveness)
- [x] Developer-mode user (`deps.py`); answer cache wired into `/ask`
- [x] CORS for the web origin; `X-AskDocs-Source` header

## Phase 4 — Frontend

- [x] Repoint to FastAPI (`API_BASE_URL`) with streaming answer rendering
- [x] Upload dropzone (click + drag-and-drop) with type/size feedback
- [x] Document list with status badge (`processing`/`ready`/`failed`) + delete
- [x] Live processing status via polling while any document is `processing`
- [x] Distinct styling for the out-of-context fallback
- [x] Empty states and error toasts

## Phase 5 — Tests

- [x] pytest infra (in-memory store, mocked Gemini/Qdrant)
- [x] Chunking tests
- [x] Retrieval gate tests
- [x] Extraction tests (docx + normalization + failure)
- [x] Answer-cache key tests
- [x] API route tests (upload, list, delete, ask fallback/generated/cache, health)

## Phase 6 — Delivery

- [x] Dockerfiles (backend uv, web) + full docker-compose (qdrant + backend + web)
- [x] `backend` pytest green; `web` typecheck/lint/build green
- [x] Live end-to-end verified (grounded answer + exact fallback + cache) against Gemini + Qdrant
- [ ] Walk the acceptance checklist in the browser
- [ ] Deploy to a host (or document the `docker compose up` run for reviewers)

## Backlog (not required)

- [ ] Real multi-user auth
- [ ] Rate limiting
- [ ] Chat-history persistence
- [ ] OCR for scanned PDFs
