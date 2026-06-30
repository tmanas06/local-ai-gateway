# AI Gateway Platform — Implementation Plan

A self-hosted, provider-agnostic AI Gateway for organizations. Replaces the bare `FastAPI → Ollama` shim with a full developer platform offering authentication, request routing, observability, usage analytics, and an admin dashboard — all behind a single OpenAI-compatible API surface.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│         (curl / SDK / your own frontend)                │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS  (OpenAI-compatible API)
┌────────────────────────▼────────────────────────────────┐
│                    AI Gateway  (FastAPI)                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Auth / Keys │  │ Rate Limiter │  │ Request Log  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └────────────┬────┘                 │           │
│                      ▼                      │           │
│              ┌──────────────┐               │           │
│              │ Model Router │               │           │
│              └──────┬───────┘               │           │
│         ┌───────────┼────────────┐          │           │
│         ▼           ▼            ▼          │           │
│    ┌─────────┐ ┌────────┐ ┌──────────┐     │           │
│    │  Ollama │ │ OpenAI │ │   Groq   │     │           │
│    └────┬────┘ └───┬────┘ └────┬─────┘     │           │
│         └──────────┴───────────┘           │           │
│                      ▼                     │           │
│              ┌──────────────┐              │           │
│              │  Token Count │              │           │
│              │  + Latency   │◄─────────────┘           │
│              └──────┬───────┘                          │
│                     ▼                                   │
│              ┌──────────────┐                          │
│              │   MongoDB    │   (request log)           │
│              └──────────────┘                          │
│              ┌──────────────┐                          │
│              │    Redis     │   (rate limits, cache)    │
│              └──────────────┘                          │
└─────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Admin Dashboard  (Next.js)                  │
│  Analytics · Model Health · API Keys · Live Requests    │
└─────────────────────────────────────────────────────────┘
```

---

## Proposed Changes

### Project Layout (new)

```
ai-server/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Settings (env vars)
│   ├── database.py              # MongoDB async client
│   ├── redis_client.py          # Redis async client
│   │
│   ├── auth/
│   │   ├── models.py            # APIKey document model
│   │   ├── service.py           # Key generation, hashing
│   │   └── dependencies.py      # FastAPI dependency (verify key)
│   │
│   ├── gateway/
│   │   ├── router.py            # /v1/chat/completions endpoint
│   │   ├── model_router.py      # Pick backend based on rules
│   │   └── providers/
│   │       ├── base.py          # Abstract provider interface
│   │       ├── ollama.py        # Ollama adapter
│   │       ├── openai.py        # OpenAI adapter
│   │       └── groq.py          # Groq adapter
│   │
│   ├── logging/
│   │   ├── models.py            # RequestLog document schema
│   │   └── service.py           # Write + query logs
│   │
│   ├── analytics/
│   │   └── service.py           # Aggregation queries for dashboard
│   │
│   ├── admin/
│   │   └── router.py            # Admin REST endpoints
│   │
│   └── requirements.txt
│
├── frontend/                    # Next.js admin dashboard
│   ├── app/
│   │   ├── page.tsx             # Overview / stats cards
│   │   ├── requests/page.tsx    # Request log table
│   │   ├── models/page.tsx      # Model health & routing
│   │   ├── keys/page.tsx        # API key management
│   │   └── layout.tsx
│   ├── components/
│   │   ├── StatsCard.tsx
│   │   ├── RequestsTable.tsx
│   │   ├── ModelStatus.tsx
│   │   ├── LiveChart.tsx        # Recharts area chart
│   │   └── Sidebar.tsx
│   └── package.json
│
├── docker-compose.yml
└── .env.example
```

---

### Backend — Key Components

#### [MODIFY] `backend/main.py`
- Wire up all routers (`gateway`, `admin`, `auth`)
- Add CORS, lifespan (DB connection init/teardown)
- Prometheus metrics middleware (`prometheus-fastapi-instrumentator`)

#### [NEW] `backend/config.py`
- Pydantic `Settings` loaded from `.env`
- Fields: `MONGODB_URL`, `REDIS_URL`, `JWT_SECRET`, `OLLAMA_URL`, `OPENAI_API_KEY`, `GROQ_API_KEY`

#### [NEW] `backend/auth/`
- API keys stored in MongoDB, hashed with SHA-256 (never stored in plain text)
- Each key carries: `name`, `org`, `rate_limit_rpm`, `created_at`, `revoked`
- FastAPI `Depends(verify_api_key)` used on every protected route
- Admin routes protected separately by a hard-coded `ADMIN_TOKEN` env var

#### [NEW] `backend/gateway/providers/`
- `BaseProvider` abstract class with `async def complete(messages, model, stream) -> AsyncGenerator`
- Each provider translates the gateway's internal format to its own API shape and back
- Streaming responses pass through via `StreamingResponse`

#### [NEW] `backend/gateway/model_router.py`
Routing rules (configurable via DB):
| Rule | Target |
|---|---|
| Contains code / `lang:` prefix | `qwen2.5-coder` via Ollama |
| Short prompt (< 100 tokens) | `phi4-mini` via Ollama |
| Default / long reasoning | `gemma3:4b` via Ollama |
| `model` explicitly set to `gpt-*` | OpenAI provider |
| `model` explicitly set to `llama*` on Groq | Groq provider |

#### [NEW] `backend/logging/models.py`
MongoDB document per request:
```json
{
  "timestamp": "2026-06-30T11:30:00Z",
  "user": "manas",
  "org": "default",
  "api_key_id": "...",
  "model": "gemma3:4b",
  "provider": "ollama",
  "prompt_preview": "Explain DNA...",
  "input_tokens": 42,
  "output_tokens": 180,
  "latency_ms": 942,
  "success": true,
  "error": null,
  "ip": "192.168.29.14",
  "stream": false
}
```

#### [NEW] `backend/analytics/service.py`
MongoDB aggregation pipelines for:
- Requests today / this week / this month
- Average latency (p50, p95, p99)
- Token usage (input + output)
- Most used model
- Top users by request count
- Error rate
- Requests-per-minute time series (for chart)

#### [NEW] `backend/admin/router.py`
REST endpoints consumed by the dashboard:
```
GET  /admin/stats/overview       → top-level cards
GET  /admin/stats/timeseries     → RPM chart data
GET  /admin/requests             → paginated log table
GET  /admin/models               → model health (ping Ollama)
POST /admin/keys                 → create API key
GET  /admin/keys                 → list keys
DELETE /admin/keys/{id}          → revoke key
```

---

### Frontend — Dashboard Pages

#### Overview Page
- 6 stat cards: Requests Today, Avg Latency, Input Tokens, Output Tokens, Error Rate, Active Users
- Requests-per-minute line chart (live-updating via polling every 5 s)
- Most-used models bar chart

#### Request Log Page
- Paginated table: timestamp, user, model, tokens, latency, status badge
- Filters: date range, model, user, success/error

#### Models Page
- Card per configured model: name, provider, status (green/red), last-used, avg latency
- Routing rules display

#### API Keys Page
- Table: name, org, created date, last used, rpm limit
- Create/revoke buttons

---

### Infrastructure

#### [NEW] `docker-compose.yml`
Services:
- `gateway` — FastAPI on port `8000`
- `dashboard` — Next.js on port `3000`
- `mongodb` — MongoDB 7 on port `27017`
- `redis` — Redis 7 on port `6379`
- `ollama` — Ollama on port `11434` (with GPU passthrough comment)

#### [NEW] `.env.example`
```env
MONGODB_URL=mongodb://mongodb:27017/aigateway
REDIS_URL=redis://redis:6379
ADMIN_TOKEN=change-me
JWT_SECRET=change-me-too
OLLAMA_URL=http://ollama:11434
OPENAI_API_KEY=           # optional
GROQ_API_KEY=             # optional
```

---

## Open Questions

> [!IMPORTANT]
> **Q1 — Streaming support priority?**
> Streaming (`stream: true`) requires `StreamingResponse` and SSE plumbing per provider. It's non-trivial but important for chat UIs. Should I implement streaming from day one, or ship non-streaming first and add it in a follow-up?

> [!IMPORTANT]
> **Q2 — Dashboard auth?**
> The admin dashboard will have API key management and full request logs (sensitive data). Should login be:
> - Simple `ADMIN_TOKEN` env var checked at the API level (simplest)
> - Username + password stored in MongoDB
> - SSO / OAuth (most complex)

> [!IMPORTANT]
> **Q3 — OpenAI / Groq providers now or later?**
> The Ollama provider is core. OpenAI and Groq adapters add real value but also secrets management overhead. Should I wire them up now (stubbed, activatable via env var) or focus purely on Ollama first?

> [!NOTE]
> **Q4 — Routing rules — static or dynamic?**
> I plan to ship static routing rules in code first (fast to build, easy to understand). A later iteration could store rules in MongoDB and expose a UI to edit them. Is that acceptable?

> [!NOTE]
> **Q5 — Rate limiting granularity?**
> Redis-based rate limiting per API key at requests-per-minute. Should this also cap total tokens-per-day per key, or is RPM sufficient for now?

---

## Verification Plan

### Automated
- `pytest` smoke tests: key creation, key verification, `/v1/chat/completions` returns 200 via mocked Ollama
- Health check endpoints for CI

### Manual
1. `docker compose up` → all 4 services healthy
2. Create an API key via `POST /admin/keys`
3. Send a chat request: `curl -H "Authorization: Bearer <key>" POST /v1/chat/completions`
4. Open `localhost:3000` → verify stats card incremented, request appears in log table
5. Revoke key → next request returns 401
6. Pull a second model in Ollama → verify model router dispatches correctly

---

## Estimated Scope

| Phase | What | Effort |
|---|---|---|
| 1 | Backend scaffolding, MongoDB/Redis wiring, API key auth | ~2 hrs |
| 2 | Gateway endpoint + Ollama provider + request logging | ~2 hrs |
| 3 | Analytics aggregations + admin REST API | ~1.5 hrs |
| 4 | Next.js dashboard (layout, charts, tables) | ~3 hrs |
| 5 | Docker Compose + env wiring + README | ~1 hr |
| 6 | OpenAI/Groq providers (optional) | ~1 hr |

**Total: ~10–11 hours of focused implementation.**
