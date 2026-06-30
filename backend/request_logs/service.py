from datetime import datetime, UTC, timedelta
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase
from request_logs.models import RequestLog


async def resolve_geoip(ip: str) -> dict:
    default_loc = {"country": "Local", "region": "Local", "city": "Local Network"}
    if not ip or ip in ("127.0.0.1", "localhost", "unknown") or ip.startswith(("192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.2", "172.3")):
        return default_loc
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    return {
                        "country": data.get("country", "Unknown"),
                        "region": data.get("regionName", "Unknown"),
                        "city": data.get("city", "Unknown")
                    }
    except Exception:
        pass
    return {"country": "Unknown", "region": "Unknown", "city": "Unknown"}


async def save_log(db: AsyncIOMotorDatabase, log: RequestLog) -> None:
    try:
        location = await resolve_geoip(log.client_ip)
        log.client_location = location
    except Exception:
        pass
    doc = log.model_dump(by_alias=True)
    await db.request_logs.insert_one(doc)


async def get_logs(
    db: AsyncIOMotorDatabase,
    *,
    skip: int = 0,
    limit: int = 50,
    model: str | None = None,
    org: str | None = None,
    success: bool | None = None,
    since: datetime | None = None,
    search: str | None = None,
) -> tuple[list[dict], int]:
    query: dict = {}
    if model:
        query["routed_model"] = model
    if org:
        query["org"] = org
    if success is not None:
        query["success"] = success
    if since:
        query["timestamp"] = {"$gte": since}
    if search:
        query["$or"] = [
            {"prompt_preview": {"$regex": search, "$options": "i"}},
            {"response_preview": {"$regex": search, "$options": "i"}},
            {"api_key_name": {"$regex": search, "$options": "i"}},
        ]

    total = await db.request_logs.count_documents(query)
    cursor = db.request_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    docs = [doc async for doc in cursor]
    return docs, total


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create MongoDB indexes for query performance."""
    await db.request_logs.create_index("timestamp")
    await db.request_logs.create_index("org")
    await db.request_logs.create_index("routed_model")
    await db.request_logs.create_index("api_key_id")
    await db.api_keys.create_index("key_hash", unique=True)
