from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.deps import get_store
from app.store import Store, now_ms

router = APIRouter()


@router.get("/health")
def health(store: Store = Depends(get_store)):
    """Liveness probe. Confirms the process is up and the database is reachable."""
    try:
        store.ping()
    except Exception:  # noqa: BLE001
        return JSONResponse(
            {"status": "error", "message": "Database unavailable."}, status_code=503
        )
    return {"status": "ok", "timestamp": now_ms()}
