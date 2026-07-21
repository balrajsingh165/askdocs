from pydantic_settings import BaseSettings, SettingsConfigDict

"""Centralised configuration, validated once from the environment / .env.

The only module that reads configuration. Everything else imports ``settings``.
When run from ``backend/`` it reads ``backend/.env`` then the repo-root ``.env``
(so a single root ``.env`` with ``GEMINI_API_KEY`` works for both dev and
docker-compose). Real OS environment variables always take precedence.
"""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Google Gemini (generation + embeddings)
    gemini_api_key: str | None = None
    google_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_embed_model: str = "gemini-embedding-001"
    embed_dim: int = 768
    gemini_max_tokens: int = 1024

    # Qdrant vector store
    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str | None = None
    qdrant_collection: str = "askdocs_chunks"

    # Metadata store + developer identity
    sqlite_path: str = "data/askdocs.db"
    developer_name: str = "Developer"

    # Upload + retrieval tuning
    max_file_size_mb: int = 20
    max_documents: int = 20
    top_k: int = 8
    similarity_threshold: float = 0.5

    # Answer cache + prompt version (part of the cache key)
    answer_cache_enabled: bool = True
    prompt_version: str = "1"

    # Comma-separated list of allowed CORS origins (the web app)
    cors_origins: str = "http://localhost:3000"

    @property
    def resolved_gemini_key(self) -> str | None:
        """The Gemini key, accepting either GEMINI_API_KEY or GOOGLE_API_KEY."""
        return self.gemini_api_key or self.google_api_key

    @property
    def max_file_size_bytes(self) -> int:
        return self.max_file_size_mb * 1024 * 1024

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
