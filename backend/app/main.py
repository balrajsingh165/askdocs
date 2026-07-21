import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import ask, documents, health
from app.config import settings
from app.services import vectorstore

"""FastAPI application: CORS for the web app, router mounting, and a best-effort
Qdrant collection bootstrap at startup (retried lazily on first use if Qdrant
is not yet reachable)."""

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("askdocs")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        vectorstore.ensure_collection()
    except Exception:  # noqa: BLE001
        logger.warning(
            "Qdrant not reachable at startup; the collection will be created on first use."
        )
    yield


app = FastAPI(title="AskDocs API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-AskDocs-Source"],
)

app.include_router(health.router)
app.include_router(documents.router)
app.include_router(ask.router)
