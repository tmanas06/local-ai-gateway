from datetime import datetime, UTC
from pydantic import BaseModel, Field
from bson import ObjectId


class APIKey(BaseModel):
    """Stored API key document (key_hash is stored, never the raw key)."""

    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    name: str
    org: str = "default"
    key_hash: str          # SHA-256 hex of the raw key
    key_prefix: str        # First 8 chars for display (e.g. "sk-ab12...")
    rate_limit_rpm: int = 60
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_used_at: datetime | None = None
    revoked: bool = False

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}


class APIKeyPublic(BaseModel):
    """Safe representation returned to the admin (no hash)."""

    id: str
    name: str
    org: str
    key_prefix: str
    rate_limit_rpm: int
    created_at: datetime
    last_used_at: datetime | None
    revoked: bool


class APIKeyCreate(BaseModel):
    name: str
    org: str = "default"
    rate_limit_rpm: int = 60


class APIKeyCreateResponse(APIKeyPublic):
    """Returned once on creation — includes the raw key."""
    raw_key: str
