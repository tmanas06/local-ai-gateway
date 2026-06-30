import hashlib
import secrets
from datetime import datetime, UTC

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from auth.models import APIKey, APIKeyPublic, APIKeyCreate, APIKeyCreateResponse


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _generate_raw_key() -> str:
    return "aigw_" + secrets.token_urlsafe(32)


async def create_api_key(db: AsyncIOMotorDatabase, payload: APIKeyCreate) -> APIKeyCreateResponse:
    raw_key = _generate_raw_key()
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:10] + "..."

    doc = {
        "_id": str(ObjectId()),
        "name": payload.name,
        "org": payload.org,
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "rate_limit_rpm": payload.rate_limit_rpm,
        "created_at": datetime.now(UTC),
        "last_used_at": None,
        "revoked": False,
    }
    await db.api_keys.insert_one(doc)

    return APIKeyCreateResponse(
        id=doc["_id"],
        name=doc["name"],
        org=doc["org"],
        key_prefix=doc["key_prefix"],
        rate_limit_rpm=doc["rate_limit_rpm"],
        created_at=doc["created_at"],
        last_used_at=None,
        revoked=False,
        raw_key=raw_key,
    )


async def get_api_key_by_hash(db: AsyncIOMotorDatabase, raw_key: str) -> APIKey | None:
    key_hash = _hash_key(raw_key)
    doc = await db.api_keys.find_one({"key_hash": key_hash, "revoked": False})
    if doc is None:
        return None
    return APIKey(**doc)


async def list_api_keys(db: AsyncIOMotorDatabase) -> list[APIKeyPublic]:
    cursor = db.api_keys.find({}).sort("created_at", -1)
    keys = []
    async for doc in cursor:
        keys.append(
            APIKeyPublic(
                id=doc["_id"],
                name=doc["name"],
                org=doc["org"],
                key_prefix=doc["key_prefix"],
                rate_limit_rpm=doc["rate_limit_rpm"],
                created_at=doc["created_at"],
                last_used_at=doc.get("last_used_at"),
                revoked=doc["revoked"],
            )
        )
    return keys


async def revoke_api_key(db: AsyncIOMotorDatabase, key_id: str) -> bool:
    result = await db.api_keys.update_one(
        {"_id": key_id}, {"$set": {"revoked": True}}
    )
    return result.modified_count > 0


async def touch_api_key(db: AsyncIOMotorDatabase, key_id: str) -> None:
    """Update last_used_at timestamp."""
    await db.api_keys.update_one(
        {"_id": key_id}, {"$set": {"last_used_at": datetime.now(UTC)}}
    )
