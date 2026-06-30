from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "aigateway"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Security
    admin_token: str = "change-me-admin-token"

    # Ollama
    ollama_url: str = "http://localhost:11434"


    # Default routing
    default_model: str = "gemma3:4b"
    default_provider: str = "ollama"

    # Rate limiting defaults (requests per minute)
    default_rate_limit_rpm: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
