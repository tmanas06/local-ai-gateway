"""
AI Gateway — main FastAPI application.

Start with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import connect_db, close_db
from redis_client import connect_redis, close_redis
from request_logs.service import ensure_indexes
from gateway.router import router as gateway_router
from admin.router import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    await connect_db()
    await connect_redis()
    from database import get_db
    await ensure_indexes(get_db())
    print("✅  MongoDB + Redis connected. Indexes ensured.")
    yield
    # ── Shutdown ──
    await close_db()
    await close_redis()
    print("🔌  Connections closed.")


app = FastAPI(
    title="AI Gateway",
    description="Self-hosted, provider-agnostic AI Gateway with analytics and model routing.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(gateway_router)
app.include_router(admin_router)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": app.version}


@app.get("/", tags=["health"])
async def root():
    return {
        "name": "AI Gateway",
        "version": app.version,
        "docs": "/docs",
    }
