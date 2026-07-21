from dataclasses import dataclass

from app.config import settings
from app.services import embedding, vectorstore

"""Retrieval with a relevance gate. Chunks are scored by Qdrant (cosine); if
nothing clears the similarity threshold the result is gated and the caller
returns the out-of-context fallback without calling the LLM."""


@dataclass
class RetrievedChunk:
    """A retrieved chunk with its similarity score."""

    document_id: str
    document_name: str
    content: str
    score: float


def apply_gate(
    hits: list[tuple[float, dict]], threshold: float
) -> tuple[bool, list[RetrievedChunk]]:
    """Filter scored hits by the threshold. Returns ``(gated, chunks)`` where
    ``gated`` is True when nothing clears the threshold. Pure function."""
    relevant = [(score, payload) for score, payload in hits if score >= threshold]
    if not relevant:
        return True, []
    chunks = [
        RetrievedChunk(
            document_id=payload.get("document_id", ""),
            document_name=payload.get("document_name", ""),
            content=payload.get("content", ""),
            score=score,
        )
        for score, payload in relevant
    ]
    return False, chunks


def retrieve(user_id: str, question: str) -> tuple[bool, list[RetrievedChunk]]:
    """Embed the question, search Qdrant, and apply the relevance gate."""
    query_vector = embedding.embed_query(question)
    hits = vectorstore.search(user_id, query_vector, settings.top_k)
    return apply_gate(hits, settings.similarity_threshold)
