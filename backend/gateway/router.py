"""
/v1/chat/completions — OpenAI-compatible gateway endpoint.

Supports both streaming (SSE) and non-streaming responses.
Every request is logged asynchronously to MongoDB.
"""
import asyncio
import json
import time
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from auth.dependencies import verify_api_key
from auth.models import APIKey
from gateway.model_router import route
from gateway.providers.base import CompletionRequest, Message
from request_logs.models import RequestLog
from request_logs.service import save_log
from database import get_db

router = APIRouter(prefix="/v1", tags=["gateway"])


# ── Request / Response models ──────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str = "gemma3:4b"
    messages: list[ChatMessage]
    stream: bool = False
    temperature: float = 0.7
    max_tokens: int | None = None


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatMessage
    finish_reason: str


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage


# ── Helpers ────────────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _sse_line(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _make_chunk_id() -> str:
    import secrets
    return "chatcmpl-" + secrets.token_hex(12)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat/completions")
async def chat_completions(
    body: ChatCompletionRequest,
    request: Request,
    api_key: APIKey = Depends(verify_api_key),
):
    internal_request = CompletionRequest(
        messages=[Message(role=m.role, content=m.content) for m in body.messages],
        model=body.model,
        stream=body.stream,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
    )

    try:
        decision = route(internal_request)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        )
    internal_request.model = decision.model  # update to routed model

    last_user_msg = next(
        (m.content for m in reversed(body.messages) if m.role == "user"), ""
    )
    prompt_preview = last_user_msg[:500]
    chunk_id = _make_chunk_id()
    created_ts = int(time.time())
    db = get_db()
    client_ip = _client_ip(request)
    t_start = time.monotonic()

    if body.stream:
        return StreamingResponse(
            _stream_response(
                internal_request, decision, api_key, prompt_preview,
                chunk_id, created_ts, client_ip, db, t_start,
                body.model,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    # ── Non-streaming ──
    try:
        result = await decision.provider.complete(internal_request)
    except Exception as exc:
        latency_ms = int((time.monotonic() - t_start) * 1000)
        asyncio.ensure_future(save_log(db, RequestLog(
            api_key_id=api_key.id,
            api_key_name=api_key.name,
            org=api_key.org,
            requested_model=body.model,
            routed_model=decision.model,
            provider=decision.provider.name,
            routing_reason=decision.reason,
            prompt_preview=prompt_preview,
            response_preview="",
            input_tokens=0,
            output_tokens=0,
            latency_ms=latency_ms,
            success=False,
            error=str(exc),
            status_code=502,
            client_ip=client_ip,
            stream=False,
        )))
        raise HTTPException(status_code=502, detail=f"Provider error: {exc}")

    latency_ms = int((time.monotonic() - t_start) * 1000)

    asyncio.ensure_future(save_log(db, RequestLog(
        api_key_id=api_key.id,
        api_key_name=api_key.name,
        org=api_key.org,
        requested_model=body.model,
        routed_model=result.model,
        provider=result.provider,
        routing_reason=decision.reason,
        prompt_preview=prompt_preview,
        response_preview=result.content[:500],
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        latency_ms=latency_ms,
        success=True,
        status_code=200,
        client_ip=client_ip,
        stream=False,
    )))

    return ChatCompletionResponse(
        id=chunk_id,
        created=created_ts,
        model=result.model,
        choices=[
            ChatCompletionChoice(
                index=0,
                message=ChatMessage(role="assistant", content=result.content),
                finish_reason=result.finish_reason,
            )
        ],
        usage=ChatCompletionUsage(
            prompt_tokens=result.input_tokens,
            completion_tokens=result.output_tokens,
            total_tokens=result.input_tokens + result.output_tokens,
        ),
    )


async def _stream_response(
    internal_request, decision, api_key, prompt_preview,
    chunk_id, created_ts, client_ip, db, t_start, requested_model,
):
    """Generator that yields SSE chunks and logs after completion."""
    full_content = []
    input_tokens = 0
    output_tokens = 0
    success = True
    error_msg = None
    status_code = 200

    try:
        async for chunk in decision.provider.stream(internal_request):
            if chunk.delta:
                full_content.append(chunk.delta)
                output_tokens += max(1, len(chunk.delta) // 4)
                sse_payload = {
                    "id": chunk_id,
                    "object": "chat.completion.chunk",
                    "created": created_ts,
                    "model": internal_request.model,
                    "choices": [{
                        "index": 0,
                        "delta": {"content": chunk.delta},
                        "finish_reason": chunk.finish_reason,
                    }],
                }
                yield _sse_line(sse_payload)
        yield "data: [DONE]\n\n"
    except Exception as exc:
        success = False
        error_msg = str(exc)
        status_code = 502
        yield _sse_line({"error": {"message": str(exc), "type": "provider_error"}})

    latency_ms = int((time.monotonic() - t_start) * 1000)
    input_tokens = max(1, len(prompt_preview) // 4)

    asyncio.ensure_future(save_log(db, RequestLog(
        api_key_id=api_key.id,
        api_key_name=api_key.name,
        org=api_key.org,
        requested_model=requested_model,
        routed_model=internal_request.model,
        provider=decision.provider.name,
        routing_reason=decision.reason,
        prompt_preview=prompt_preview,
        response_preview="".join(full_content)[:500],
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        success=success,
        error=error_msg,
        status_code=status_code,
        client_ip=client_ip,
        stream=True,
    )))
