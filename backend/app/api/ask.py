from collections.abc import Iterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse

from app.answer_cache import answer_cache_key
from app.config import settings
from app.deps import current_user_id, get_store
from app.grounding import NO_CONTEXT_MESSAGE
from app.schemas import AskRequest
from app.services import generation, retrieval
from app.store import Store

router = APIRouter()

_SOURCE_HEADER = "X-AskDocs-Source"


@router.post("/ask")
def ask(
    body: AskRequest,
    user_id: str = Depends(current_user_id),
    store: Store = Depends(get_store),
):
    """Answer a question strictly from the user's ready documents.

    Order: validate -> require ready documents -> answer-cache lookup ->
    retrieval with relevance gate -> streamed generation. The cache hit and the
    gated fallback return the same streamed-text shape, and the response header
    reports how the answer was produced.
    """
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Ask a question to get an answer.")

    ready_ids = store.list_ready_document_ids(user_id)
    if not ready_ids:
        raise HTTPException(
            status_code=409, detail="Upload a document before asking a question."
        )

    key = answer_cache_key(user_id, question, ready_ids)
    if settings.answer_cache_enabled:
        cached = store.get_cached_answer(key)
        if cached is not None:
            return PlainTextResponse(cached, headers={_SOURCE_HEADER: "cache"})

    gated, chunks = retrieval.retrieve(user_id, question)
    if gated:
        return PlainTextResponse(
            NO_CONTEXT_MESSAGE, headers={_SOURCE_HEADER: "no_context"}
        )

    def generate() -> Iterator[str]:
        collected: list[str] = []
        for delta in generation.stream_answer(question, chunks):
            collected.append(delta)
            yield delta
        answer = "".join(collected)
        if settings.answer_cache_enabled and answer:
            store.set_cached_answer(key, user_id, question, answer)

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={_SOURCE_HEADER: "generated"},
    )
