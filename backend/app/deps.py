from app.config import settings
from app.store import Store

"""FastAPI dependencies: the developer-mode user and the store singleton.

In developer mode every request resolves to a single user id, so reviewers need
no login. ``get_store`` returns a process-wide store; tests override it with a
throwaway in-memory store via ``app.dependency_overrides``.
"""

DEVELOPER_USER_ID = "developer"

_store = Store(settings.sqlite_path)


def get_store() -> Store:
    """Return the shared metadata store."""
    return _store


def current_user_id() -> str:
    """Resolve the current user id (developer mode)."""
    return DEVELOPER_USER_ID
