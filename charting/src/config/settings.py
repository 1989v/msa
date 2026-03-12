"""Application settings via Pydantic BaseSettings."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = "postgresql+psycopg://charting:charting@localhost:5433/charting"
    app_env: str = "development"
    log_level: str = "INFO"
    # CORS
    cors_origins: list[str] = ["http://localhost:3010", "http://localhost:5173"]
    # Similarity search defaults
    default_top_k: int = 20


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
