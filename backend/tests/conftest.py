import pytest
from fastapi.testclient import TestClient

from app.deps import get_store
from app.main import app
from app.store import Store


@pytest.fixture
def store() -> Store:
    """A throwaway in-memory metadata store, isolated per test."""
    return Store(":memory:")


@pytest.fixture
def client(store, monkeypatch):
    """TestClient wired to the in-memory store, with Qdrant calls stubbed out so
    the suite never touches a running vector database."""
    monkeypatch.setattr("app.services.vectorstore.ensure_collection", lambda: None)
    monkeypatch.setattr("app.services.vectorstore.delete_document", lambda *_: None)
    app.dependency_overrides[get_store] = lambda: store
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
