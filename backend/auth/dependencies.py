import time
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.models import APIKey
from auth.service import get_api_key_by_hash, touch_api_key
from database import get_db
from redis_client import get_redis

bearer_scheme = HTTPBearer()


async def verify_api_key(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> APIKey:
    """
    FastAPI dependency that:
    1. Resolves the Bearer token → APIKey document
    2. Enforces per-key RPM rate limit via Redis sliding window
    3. Updates last_used_at (fire-and-forget)
    """
    raw_key = credentials.credentials
    db = get_db()

    api_key = await get_api_key_by_hash(db, raw_key)
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- Sliding-window rate limit ---
    redis = get_redis()
    window_key = f"rl:{api_key.id}:{int(time.time()) // 60}"
    count = await redis.incr(window_key)
    if count == 1:
        await redis.expire(window_key, 120)  # 2-minute TTL for the window

    if count > api_key.rate_limit_rpm:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({api_key.rate_limit_rpm} req/min).",
            headers={"Retry-After": "60"},
        )

    # Fire-and-forget touch (don't await in hot path)
    import asyncio
    asyncio.ensure_future(touch_api_key(db, api_key.id))

    return api_key
