from functools import lru_cache

from google import genai
from google.genai import types

from app.config import settings

"""Gemini embeddings. Chunks are embedded with the ``RETRIEVAL_DOCUMENT`` task
type and questions with ``RETRIEVAL_QUERY`` — the asymmetric setup that gives
clean relevance separation for retrieval."""


class EmbeddingError(Exception):
    """Raised when embeddings cannot be produced (e.g. missing API key)."""


_BATCH_SIZE = 100


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    key = settings.resolved_gemini_key
    if not key:
        raise EmbeddingError("GEMINI_API_KEY is not configured. Set it in .env.")
    return genai.Client(api_key=key)


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    if not texts:
        return []
    client = _client()
    vectors: list[list[float]] = []
    for start in range(0, len(texts), _BATCH_SIZE):
        batch = texts[start : start + _BATCH_SIZE]
        response = client.models.embed_content(
            model=settings.gemini_embed_model,
            contents=batch,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=settings.embed_dim,
            ),
        )
        vectors.extend([list(embedding.values) for embedding in response.embeddings])
    return vectors


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed chunk texts for storage (``RETRIEVAL_DOCUMENT``)."""
    return _embed(texts, "RETRIEVAL_DOCUMENT")


def embed_query(text: str) -> list[float]:
    """Embed a question for retrieval (``RETRIEVAL_QUERY``)."""
    return _embed([text], "RETRIEVAL_QUERY")[0]
