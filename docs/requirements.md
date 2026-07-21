# AskDocs — Requirements Specification

AskDocs is a Retrieval-Augmented Generation (RAG) application. A user uploads
one or more documents (PDF or DOCX) and asks natural-language questions. The
application answers **strictly from the uploaded content**. When the answer is
not present, it refuses with a fixed fallback message instead of guessing.

This document is *what* the application must do. *How* it's built is in
[architecture.md](architecture.md); tasks are in [todo.md](todo.md).

---

## 1. Objective

Design, build, and deploy a production-quality RAG application:

- Upload and process PDF / DOCX documents.
- Ask natural-language questions about the uploaded document(s).
- Receive concise, accurate answers derived **only** from the uploaded content.
- Refuse out-of-context questions with a fixed message — never fabricate.

## 2. Functional Requirements

### 2.1 Document Upload

| # | Requirement |
|---|-------------|
| U1 | Accept PDF (`.pdf`) files. |
| U2 | Accept Microsoft Word (`.docx`) files. |
| U3 | Reject other file types with a clear error. |
| U4 | Support multiple documents; all `ready` documents form the corpus. |
| U5 | Display the document name, size, and processing status. |
| U6 | Allow removing (deleting) a document. |
| U7 | Allow uploading additional documents at any time. |
| U8 | Familiar upload affordances (file picker, drag-and-drop, visible status), like ChatGPT/Claude. |
| U9 | Enforce a max file size (default 20 MB) and max document count (default 20). |
| U10 | Extract, chunk, and embed server-side; a document becomes `ready` only after embedding completes, or `failed` with a reason. Processing happens in the background so the UI shows live status. |

### 2.2 Question Answering

| # | Requirement |
|---|-------------|
| Q1 | Accept free-form natural-language questions via a chat interface. |
| Q2 | Answer concisely and accurately, based **only** on the uploaded document(s). |
| Q3 | When multiple documents are relevant, use context from all of them. |
| Q4 | Stream the answer token-by-token to the UI. |
| Q5 | Reject questions when no document is ready, with guidance to upload one. |
| Q6 | Never answer from general knowledge, even when the model knows the answer. |

### 2.3 Out-of-Context Handling (non-negotiable)

| # | Requirement |
|---|-------------|
| O1 | When the answer is not present, respond with **exactly**: `I don't have enough context in the uploaded document(s) to answer that question.` |
| O2 | That string exists once, as `NO_CONTEXT_MESSAGE` in `backend/app/grounding.py`. |
| O3 | Grounding is enforced **twice**: (a) a retrieval relevance gate — if no chunk clears the similarity threshold, the fallback is returned without calling the LLM; (b) a prompt-side instruction — the system prompt orders the exact fallback when the context doesn't contain the answer. |

Worked example:

> **Q:** Who won the FIFA World Cup in 2022?
> **A:** I don't have enough context in the uploaded document(s) to answer that question.

## 3. Non-Functional Requirements

### 3.1 Architecture
- Decoupled services: a Next.js frontend and a Python FastAPI backend that owns
  the RAG pipeline, plus a Qdrant vector database.
- The backend is stateless per request except for its metadata store and the
  vector database.

### 3.2 Retrieval & Vector Store
- Chunk vectors are stored in **Qdrant** (self-hosted, cosine, 768-dim).
- Embeddings via **Gemini** `gemini-embedding-001` (asymmetric task types for
  query vs document).
- A relevance gate skips generation entirely when nothing clears the threshold.

### 3.3 Caching
- **Answer cache** — keyed by a hash of `(normalized question + sorted ready
  document ids + model + prompt version)`. A hit returns immediately without
  retrieval or an LLM call. Adding/removing a document changes the key, so
  answers can never go stale.

### 3.4 Persistence
- **Qdrant** holds chunk vectors + payloads. **SQLite** (in the backend) holds
  document metadata/status and the answer cache. Neither contains secrets.

### 3.5 Auth
- Developer mode: every request resolves to a single developer user (no login).
- All data is scoped by `user_id`, so real multi-user auth is a non-breaking
  change later.

### 3.6 UI / UX
- Single-page layout: document panel (upload + list) and chat panel, Tailwind.
- Streaming answers with a typing indicator; live upload/processing status.
- Clear empty, loading, and error states; distinct styling for the
  out-of-context refusal.

### 3.7 Quality
- Full type hints (Python) and TypeScript throughout.
- Pytest suite covering chunking, retrieval gate, extraction, answer-cache key,
  and the API routes end-to-end (Gemini + Qdrant mocked; no network in tests).
- Frontend `typecheck`, `lint`, and `build` pass clean.

## 4. Technology Constraints

| Concern | Choice |
|---------|--------|
| Frontend | Next.js (App Router) + React + TypeScript + Tailwind CSS |
| Backend | Python FastAPI (uvicorn), managed with `uv` |
| Vector DB | Qdrant (self-hosted via Docker) |
| Embeddings | Google Gemini `gemini-embedding-001` (768-dim) |
| Generation | Google Gemini `gemini-2.5-flash`, streamed |
| Extraction | `pypdf` (PDF) · `python-docx` (DOCX) |
| Metadata store | SQLite (backend) |
| Tests | pytest |
| Deploy | docker-compose (qdrant + backend + web) |

The only required secret is `GEMINI_API_KEY` (in `.env`, never committed).

## 5. Out of Scope (for this assessment)

- Real login / multi-user auth (seam exists, implementation deferred).
- Rate limiting (removed to keep the surface focused; easy to add as
  middleware).
- OCR for scanned/image-only PDFs — text-layer extraction only.
- Chat-history persistence across reloads.

## 6. Acceptance Checklist

- [ ] Upload a PDF and a DOCX; both appear as `ready` after processing.
- [ ] Ask a question answered by one document → correct, concise, streamed answer.
- [ ] Ask a question spanning both documents → answer uses both.
- [ ] Ask "Who won the FIFA World Cup in 2022?" → exact fallback message.
- [ ] Ask the same question twice → second response served from the answer cache.
- [ ] Delete a document → questions about its content now return the fallback.
- [ ] `docker compose up --build` brings up the full stack; the app works at `:3000`.
