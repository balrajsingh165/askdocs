import sqlite3
import threading
import time
from pathlib import Path

"""SQLite metadata store: document lifecycle and the answer cache.

Vectors live in Qdrant; this store holds only document metadata/status and
cached answers. A single connection is shared with a lock so background
processing tasks and request handlers can write safely.
"""


def now_ms() -> int:
    """Current time in Unix milliseconds."""
    return int(time.time() * 1000)


_SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    kind TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS documents_user_idx ON documents(user_id);

CREATE TABLE IF NOT EXISTS answer_cache (
    key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
"""

_DOCUMENT_COLUMNS = (
    "id",
    "user_id",
    "filename",
    "kind",
    "mime_type",
    "size_bytes",
    "status",
    "error",
    "chunk_count",
    "created_at",
)


class Store:
    """Thread-safe SQLite store for document metadata and cached answers."""

    def __init__(self, path: str) -> None:
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    def ping(self) -> None:
        """Raise if the database is unreachable."""
        with self._lock:
            self._conn.execute("SELECT 1").fetchone()

    # --- documents ---------------------------------------------------------

    def insert_document(self, document: dict) -> None:
        columns = ", ".join(_DOCUMENT_COLUMNS)
        placeholders = ", ".join(f":{c}" for c in _DOCUMENT_COLUMNS)
        with self._lock:
            self._conn.execute(
                f"INSERT INTO documents ({columns}) VALUES ({placeholders})",
                {c: document.get(c) for c in _DOCUMENT_COLUMNS},
            )
            self._conn.commit()

    def list_documents(self, user_id: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_document(self, user_id: str, document_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM documents WHERE user_id = ? AND id = ?",
                (user_id, document_id),
            ).fetchone()
        return dict(row) if row else None

    def update_document(self, document_id: str, **fields) -> None:
        if not fields:
            return
        assignments = ", ".join(f"{key} = :{key}" for key in fields)
        params = {**fields, "id": document_id}
        with self._lock:
            self._conn.execute(
                f"UPDATE documents SET {assignments} WHERE id = :id", params
            )
            self._conn.commit()

    def delete_document(self, user_id: str, document_id: str) -> bool:
        with self._lock:
            cursor = self._conn.execute(
                "DELETE FROM documents WHERE user_id = ? AND id = ?",
                (user_id, document_id),
            )
            self._conn.commit()
            return cursor.rowcount > 0

    def count_documents(self, user_id: str) -> int:
        with self._lock:
            row = self._conn.execute(
                "SELECT COUNT(*) AS n FROM documents WHERE user_id = ?", (user_id,)
            ).fetchone()
        return int(row["n"])

    def list_ready_document_ids(self, user_id: str) -> list[str]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id FROM documents WHERE user_id = ? AND status = 'ready'",
                (user_id,),
            ).fetchall()
        return sorted(row["id"] for row in rows)

    # --- answer cache ------------------------------------------------------

    def get_cached_answer(self, key: str) -> str | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT answer FROM answer_cache WHERE key = ?", (key,)
            ).fetchone()
        return row["answer"] if row else None

    def set_cached_answer(
        self, key: str, user_id: str, question: str, answer: str
    ) -> None:
        with self._lock:
            self._conn.execute(
                """
                INSERT INTO answer_cache (key, user_id, question, answer, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET answer = excluded.answer
                """,
                (key, user_id, question, answer, now_ms()),
            )
            self._conn.commit()
