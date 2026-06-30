from datetime import datetime, UTC, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase


async def get_overview(db: AsyncIOMotorDatabase) -> dict:
    """Top-level dashboard stats."""
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    pipeline_today = [
        {"$match": {"timestamp": {"$gte": today_start}}},
        {"$group": {
            "_id": None,
            "total": {"$sum": 1},
            "success": {"$sum": {"$cond": ["$success", 1, 0]}},
            "errors": {"$sum": {"$cond": ["$success", 0, 1]}},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
            "avg_latency": {"$avg": "$latency_ms"},
            "p95_latency": {"$percentile": {"input": "$latency_ms", "p": [0.95], "method": "approximate"}},
        }},
    ]

    week_start = now - timedelta(days=7)
    pipeline_week = [
        {"$match": {"timestamp": {"$gte": week_start}}},
        {"$group": {"_id": None, "total": {"$sum": 1}}},
    ]

    # Active unique API keys used today
    pipeline_active_keys = [
        {"$match": {"timestamp": {"$gte": today_start}}},
        {"$group": {"_id": "$api_key_id"}},
        {"$count": "count"},
    ]

    pipeline_top_model = [
        {"$match": {"timestamp": {"$gte": today_start}}},
        {"$group": {"_id": "$routed_model", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1},
    ]

    today_results = await db.request_logs.aggregate(pipeline_today).to_list(1)
    week_results = await db.request_logs.aggregate(pipeline_week).to_list(1)
    active_keys = await db.request_logs.aggregate(pipeline_active_keys).to_list(1)
    top_model = await db.request_logs.aggregate(pipeline_top_model).to_list(1)

    t = today_results[0] if today_results else {}
    total_today = t.get("total", 0)
    errors_today = t.get("errors", 0)
    error_rate = round((errors_today / total_today * 100), 2) if total_today > 0 else 0.0
    p95 = t.get("p95_latency", [None])
    p95_val = p95[0] if p95 else None

    return {
        "requests_today": total_today,
        "requests_this_week": week_results[0].get("total", 0) if week_results else 0,
        "avg_latency_ms": round(t.get("avg_latency") or 0),
        "p95_latency_ms": round(p95_val) if p95_val else None,
        "input_tokens_today": t.get("input_tokens", 0),
        "output_tokens_today": t.get("output_tokens", 0),
        "error_rate_pct": error_rate,
        "active_keys_today": active_keys[0].get("count", 0) if active_keys else 0,
        "top_model": top_model[0]["_id"] if top_model else None,
    }


async def get_timeseries(db: AsyncIOMotorDatabase, hours: int = 24) -> list[dict]:
    """Requests-per-minute time series for the last N hours, bucketed by minute."""
    since = datetime.now(UTC) - timedelta(hours=hours)
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {
                "year": {"$year": "$timestamp"},
                "month": {"$month": "$timestamp"},
                "day": {"$dayOfMonth": "$timestamp"},
                "hour": {"$hour": "$timestamp"},
                "minute": {"$minute": "$timestamp"},
            },
            "count": {"$sum": 1},
            "errors": {"$sum": {"$cond": ["$success", 0, 1]}},
            "avg_latency": {"$avg": "$latency_ms"},
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1, "_id.minute": 1}},
    ]
    results = await db.request_logs.aggregate(pipeline).to_list(None)
    out = []
    for r in results:
        d = r["_id"]
        ts = datetime(d["year"], d["month"], d["day"], d["hour"], d["minute"], tzinfo=UTC)
        out.append({
            "timestamp": ts.isoformat(),
            "requests": r["count"],
            "errors": r["errors"],
            "avg_latency_ms": round(r["avg_latency"] or 0),
        })
    return out


async def get_model_breakdown(db: AsyncIOMotorDatabase) -> list[dict]:
    since = datetime.now(UTC) - timedelta(days=7)
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {"model": "$routed_model", "provider": "$provider"},
            "requests": {"$sum": 1},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
            "avg_latency": {"$avg": "$latency_ms"},
            "errors": {"$sum": {"$cond": ["$success", 0, 1]}},
        }},
        {"$sort": {"requests": -1}},
    ]
    results = await db.request_logs.aggregate(pipeline).to_list(None)
    return [
        {
            "model": r["_id"]["model"],
            "provider": r["_id"]["provider"],
            "requests": r["requests"],
            "input_tokens": r["input_tokens"],
            "output_tokens": r["output_tokens"],
            "avg_latency_ms": round(r["avg_latency"] or 0),
            "error_rate_pct": round(r["errors"] / r["requests"] * 100, 2) if r["requests"] else 0,
        }
        for r in results
    ]


async def get_top_users(db: AsyncIOMotorDatabase, limit: int = 10) -> list[dict]:
    since = datetime.now(UTC) - timedelta(days=7)
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {"key_id": "$api_key_id", "name": "$api_key_name", "org": "$org"},
            "requests": {"$sum": 1},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
        }},
        {"$sort": {"requests": -1}},
        {"$limit": limit},
    ]
    results = await db.request_logs.aggregate(pipeline).to_list(None)
    return [
        {
            "api_key_name": r["_id"]["name"],
            "org": r["_id"]["org"],
            "requests": r["requests"],
            "input_tokens": r["input_tokens"],
            "output_tokens": r["output_tokens"],
        }
        for r in results
    ]


async def get_location_breakdown(db: AsyncIOMotorDatabase, limit: int = 10) -> list[dict]:
    since = datetime.now(UTC) - timedelta(days=7)
    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {
                "country": "$client_location.country",
                "region": "$client_location.region",
                "city": "$client_location.city"
            },
            "requests": {"$sum": 1},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
        }},
        {"$sort": {"requests": -1}},
        {"$limit": limit},
    ]
    results = await db.request_logs.aggregate(pipeline).to_list(None)
    out = []
    for r in results:
        loc = r["_id"] or {}
        out.append({
            "country": loc.get("country") or "Local",
            "region": loc.get("region") or "Local",
            "city": loc.get("city") or "Local Network",
            "requests": r["requests"],
            "input_tokens": r["input_tokens"],
            "output_tokens": r["output_tokens"],
        })
    return out
