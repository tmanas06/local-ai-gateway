from datetime import datetime, UTC
from pydantic import BaseModel, Field
from bson import ObjectId


class RequestLog(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Identity
    api_key_id: str
    api_key_name: str
    org: str

    # Routing
    requested_model: str          # what the client asked for
    routed_model: str             # what the gateway actually used
    provider: str
    routing_reason: str

    # Content (truncated for storage efficiency)
    prompt_preview: str           # first 500 chars of last user message
    response_preview: str         # first 500 chars of response

    # Metrics
    input_tokens: int
    output_tokens: int
    latency_ms: int

    # Status
    success: bool
    error: str | None = None
    status_code: int

    # Network
    client_ip: str
    stream: bool

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}
