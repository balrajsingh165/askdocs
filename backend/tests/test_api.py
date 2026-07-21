from app.grounding import NO_CONTEXT_MESSAGE
from app.services.retrieval import RetrievedChunk
from app.store import Store, now_ms

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _seed_ready(store: Store, doc_id: str = "doc-1") -> None:
    store.insert_document(
        {
            "id": doc_id,
            "user_id": "developer",
            "filename": "handbook.pdf",
            "kind": "pdf",
            "mime_type": "application/pdf",
            "size_bytes": 10,
            "status": "ready",
            "error": None,
            "chunk_count": 1,
            "created_at": now_ms(),
        }
    )


def _chunk() -> RetrievedChunk:
    return RetrievedChunk("doc-1", "handbook.pdf", "The HQ is in Lisbon.", 0.9)


# --- health -----------------------------------------------------------------


def test_health_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


# --- documents --------------------------------------------------------------


def test_upload_processes_to_ready(client, monkeypatch):
    def fake_process(store, document_id, user_id, kind, filename, data):
        store.update_document(document_id, status="ready", error=None, chunk_count=3)

    monkeypatch.setattr("app.services.documents.process_document", fake_process)

    res = client.post(
        "/documents", files={"file": ("handbook.docx", b"bytes", DOCX_MIME)}
    )
    assert res.status_code == 201
    assert res.json()["document"]["status"] == "processing"

    listed = client.get("/documents").json()["documents"]
    assert len(listed) == 1
    assert listed[0]["status"] == "ready"
    assert listed[0]["chunkCount"] == 3


def test_upload_rejects_unsupported_type(client):
    res = client.post("/documents", files={"file": ("notes.txt", b"hi", "text/plain")})
    assert res.status_code == 400


def test_upload_detects_docx_by_extension(client, monkeypatch):
    monkeypatch.setattr(
        "app.services.documents.process_document", lambda *a, **k: None
    )
    res = client.post(
        "/documents", files={"file": ("report.docx", b"bytes", "")}
    )
    assert res.status_code == 201
    assert res.json()["document"]["kind"] == "docx"


def test_delete_document(client):
    _seed_ready(client_store(client))
    res = client.delete("/documents/doc-1")
    assert res.status_code == 200
    assert client.get("/documents").json()["documents"] == []


def test_delete_missing_returns_404(client):
    assert client.delete("/documents/nope").status_code == 404


# --- ask --------------------------------------------------------------------


def test_ask_without_documents_returns_409(client):
    assert client.post("/ask", json={"question": "Anything?"}).status_code == 409


def test_ask_empty_question_returns_400(client):
    assert client.post("/ask", json={"question": "   "}).status_code == 400


def test_ask_gated_returns_exact_fallback_without_llm(client, monkeypatch):
    _seed_ready(client_store(client))
    calls = {"n": 0}

    def fake_stream(question, chunks):
        calls["n"] += 1
        yield "should not run"

    monkeypatch.setattr("app.services.retrieval.retrieve", lambda uid, q: (True, []))
    monkeypatch.setattr("app.services.generation.stream_answer", fake_stream)

    res = client.post("/ask", json={"question": "Who won the 2022 World Cup?"})
    assert res.status_code == 200
    assert res.headers["X-AskDocs-Source"] == "no_context"
    assert res.text == NO_CONTEXT_MESSAGE
    assert calls["n"] == 0


def test_ask_generated_streams_answer(client, monkeypatch):
    _seed_ready(client_store(client))
    monkeypatch.setattr(
        "app.services.retrieval.retrieve", lambda uid, q: (False, [_chunk()])
    )
    monkeypatch.setattr(
        "app.services.generation.stream_answer",
        lambda q, c: iter(["The HQ ", "is in Lisbon."]),
    )

    res = client.post("/ask", json={"question": "Where is the HQ?"})
    assert res.status_code == 200
    assert res.headers["X-AskDocs-Source"] == "generated"
    assert res.text == "The HQ is in Lisbon."


def test_ask_repeat_is_served_from_cache(client, monkeypatch):
    _seed_ready(client_store(client))
    calls = {"n": 0}

    def fake_stream(question, chunks):
        calls["n"] += 1
        yield "Cached answer."

    monkeypatch.setattr(
        "app.services.retrieval.retrieve", lambda uid, q: (False, [_chunk()])
    )
    monkeypatch.setattr("app.services.generation.stream_answer", fake_stream)

    first = client.post("/ask", json={"question": "Where is the HQ?"})
    assert first.text == "Cached answer."
    second = client.post("/ask", json={"question": "Where is the HQ?"})
    assert second.headers["X-AskDocs-Source"] == "cache"
    assert second.text == "Cached answer."
    assert calls["n"] == 1


def client_store(client) -> Store:
    """Resolve the in-memory store bound to this client's dependency override."""
    from app.deps import get_store
    from app.main import app

    return app.dependency_overrides[get_store]()
