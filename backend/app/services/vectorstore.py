from functools import lru_cache

from qdrant_client import QdrantClient, models

from app.config import settings

"""Qdrant vector store. One cosine collection holds all chunk vectors; each
point's payload carries the owning user, document, and the chunk text so
retrieval returns everything needed to build the prompt."""

_ensured = False


@lru_cache(maxsize=1)
def _client() -> QdrantClient:
    return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)


def ensure_collection() -> None:
    """Create the collection and payload indexes if they do not exist.
    Idempotent; the result is cached after the first successful call."""
    global _ensured
    if _ensured:
        return
    client = _client()
    if not client.collection_exists(settings.qdrant_collection):
        client.create_collection(
            settings.qdrant_collection,
            vectors_config=models.VectorParams(
                size=settings.embed_dim, distance=models.Distance.COSINE
            ),
        )
        client.create_payload_index(
            settings.qdrant_collection,
            field_name="user_id",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
        client.create_payload_index(
            settings.qdrant_collection,
            field_name="document_id",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
    _ensured = True


def upsert_chunks(items: list[dict]) -> None:
    """Upsert chunk points. Each item is ``{id, vector, payload}``."""
    if not items:
        return
    ensure_collection()
    points = [
        models.PointStruct(id=item["id"], vector=item["vector"], payload=item["payload"])
        for item in items
    ]
    _client().upsert(settings.qdrant_collection, points=points)


def search(
    user_id: str, query_vector: list[float], top_k: int
) -> list[tuple[float, dict]]:
    """Return the top-``k`` chunks for a user as ``(score, payload)`` tuples,
    highest score first."""
    ensure_collection()
    result = _client().query_points(
        settings.qdrant_collection,
        query=query_vector,
        limit=top_k,
        query_filter=models.Filter(
            must=[
                models.FieldCondition(
                    key="user_id", match=models.MatchValue(value=user_id)
                )
            ]
        ),
        with_payload=True,
    )
    return [(point.score, point.payload or {}) for point in result.points]


def delete_document(document_id: str) -> None:
    """Delete all chunk points belonging to a document."""
    ensure_collection()
    _client().delete(
        settings.qdrant_collection,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    )
                ]
            )
        ),
    )
