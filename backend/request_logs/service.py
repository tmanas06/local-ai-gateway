from datetime import datetime, UTC, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from request_logs.models import RequestLog


async def save_log(db: AsyncIOMotorDatabase, log: RequestLog) -> None:
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
