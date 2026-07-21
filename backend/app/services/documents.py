import logging
import uuid

from app.services import embedding, vectorstore
from app.services.chunking import chunk_text
from app.services.extraction import ExtractionError, extract_document_text
from app.store import Store

"""Document processing orchestration: extract -> chunk -> embed -> upsert to
Qdrant. Runs as a background task after the upload response is returned, so the
document appears immediately as ``processing`` and transitions to ``ready`` or
``failed`` when done."""

logger = logging.getLogger("askdocs")


def process_document(
    store: Store,
    document_id: str,
    user_id: str,
    kind: str,
    filename: str,
    data: bytes,
) -> None:
    """Process an uploaded document and update its status. Never raises — the
    outcome is recorded as the document's status."""
    try:
        text = extract_document_text(kind, data)
        parts = chunk_text(text)
        vectors = embedding.embed_documents([part.content for part in parts])
        items = [
            {
                "id": str(uuid.uuid4()),
                "vector": vectors[i],
                "payload": {
                    "user_id": user_id,
                    "document_id": document_id,
                    "document_name": filename,
                    "chunk_index": part.index,
                    "content": part.content,
                },
            }
            for i, part in enumerate(parts)
        ]
        vectorstore.upsert_chunks(items)
        store.update_document(
            document_id, status="ready", error=None, chunk_count=len(parts)
        )
    except ExtractionError as error:
        store.update_document(document_id, status="failed", error=str(error))
    except Exception:  # noqa: BLE001 - record failure, don't crash the worker
        logger.exception("Document processing failed for %s", document_id)
        store.update_document(
            document_id, status="failed", error="Processing failed."
        )
