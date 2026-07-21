import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile

from app.config import settings
from app.deps import current_user_id, get_store
from app.schemas import DocumentListResponse, DocumentResponse, OkResponse
from app.services import documents as documents_service
from app.services import vectorstore
from app.store import Store, now_ms

router = APIRouter()
logger = logging.getLogger("askdocs")

_ACCEPTED = [
    ("pdf", "application/pdf", ".pdf"),
    (
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".docx",
    ),
]


def _detect_kind(filename: str, content_type: str) -> str | None:
    for kind, mime, _ in _ACCEPTED:
        if content_type == mime:
            return kind
    lower = filename.lower()
    for kind, _, extension in _ACCEPTED:
        if lower.endswith(extension):
            return kind
    return None


@router.get("/documents", response_model=DocumentListResponse)
def list_documents(
    user_id: str = Depends(current_user_id), store: Store = Depends(get_store)
):
    """List the current user's documents, newest first."""
    return {"documents": store.list_documents(user_id)}


@router.post("/documents", status_code=201, response_model=DocumentResponse)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: str = Depends(current_user_id),
    store: Store = Depends(get_store),
):
    """Upload a document. Responds immediately with a ``processing`` document
    and finishes extraction/embedding in the background."""
    if store.count_documents(user_id) >= settings.max_documents:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Maximum of {settings.max_documents} documents reached. "
                "Delete one before uploading more."
            ),
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="No file was uploaded.")
    if len(data) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_file_size_mb} MB limit.",
        )

    filename = file.filename or "document"
    kind = _detect_kind(filename, file.content_type or "")
    if kind is None:
        raise HTTPException(
            status_code=400, detail="Only PDF and DOCX files are supported."
        )

    document = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "filename": filename,
        "kind": kind,
        "mime_type": file.content_type or "application/octet-stream",
        "size_bytes": len(data),
        "status": "processing",
        "error": None,
        "chunk_count": 0,
        "created_at": now_ms(),
    }
    store.insert_document(document)
    background.add_task(
        documents_service.process_document,
        store,
        document["id"],
        user_id,
        kind,
        filename,
        data,
    )
    return {"document": document}


@router.delete("/documents/{document_id}", response_model=OkResponse)
def delete_document(
    document_id: str,
    user_id: str = Depends(current_user_id),
    store: Store = Depends(get_store),
):
    """Delete a document and its vectors."""
    if store.get_document(user_id, document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    store.delete_document(user_id, document_id)
    try:
        vectorstore.delete_document(document_id)
    except Exception:  # noqa: BLE001 - metadata already gone; log and continue
        logger.exception("Failed to delete vectors for document %s", document_id)
    return {"ok": True}
