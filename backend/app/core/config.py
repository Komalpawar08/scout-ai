"""Application settings loaded from environment variables.

All credentials stay on the backend; nothing here is ever sent to the browser.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM (xAI Grok, OpenAI-compatible API)
    grok_api_key: str = ""
    grok_model: str = "grok-4"
    grok_base_url: str = "https://api.x.ai/v1"
    llm_max_concurrency: int = 3
    llm_timeout_seconds: float = 90.0
    # "auto" -> grok when a key exists, otherwise heuristic mode. "heuristic" forces offline mode.
    llm_mode: str = "auto"

    # Search
    search_provider: str = "tavily"  # tavily | brave | none
    search_api_key: str = ""

    # Runtime limits
    frontend_origin: str = "http://localhost:5173"
    max_source_count: int = 10
    max_pdf_size_mb: int = 15
    max_pdf_files: int = 5
    request_timeout_seconds: float = 15.0
    max_response_bytes: int = 5 * 1024 * 1024
    max_redirects: int = 5
    max_chars_per_source: int = 40_000
    chunk_chars: int = 9_000
    max_chunks_per_source: int = 4
    fetch_concurrency: int = 5

    @property
    def llm_enabled(self) -> bool:
        if self.llm_mode.lower() == "heuristic":
            return False
        return bool(self.grok_api_key.strip())

    @property
    def search_enabled(self) -> bool:
        return self.search_provider.lower() != "none" and bool(self.search_api_key.strip())

    @property
    def allowed_origins(self) -> list[str]:
        origins: list[str] = []
        for o in self.frontend_origin.split(","):
            cleaned = o.strip().rstrip("/")
            if cleaned:
                origins.append(cleaned)
        return origins or ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Allow tests to override without touching the cache semantics elsewhere.
def reset_settings_cache() -> None:
    get_settings.cache_clear()
