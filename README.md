# Self-Hosted AI Gateway

A self-hosted, local-only AI Gateway designed to route, manage, and log local LLM requests inside your organization.

```text
                Client
                   │
                   ▼ (OpenAI Chat API)
              AI Gateway (8000)
                   │
      ┌────────────┼─────────────┐
      ▼            ▼             ▼
 Authentication  Rate Limits  Logging
      │            │             │
      └────────────┼─────────────┘
                   ▼
             Model Router
                   │
         ┌──────────┴──────────┐
         ▼                     ▼
      Ollama (Local)     Local GPU / CPU
```

## Features

- **Standard API Surface**: Drop-in replacement for Ollama chat completions endpoint, providing a standard OpenAI-compatible `/v1/chat/completions` API.
- **Smart Model Routing**: Automatic heuristics that inspect last prompt contents (e.g. routes code queries to `qwen2.5-coder` or lightweight chats to `phi4-mini`) or explicit provider prefixing (e.g., `ollama/gemma3:4b`).
- **Organization-level Keys**: API keys with custom rate-limiting (requests per minute) tracked via Redis sliding window. Hashed using SHA-256 for secure DB storage.
- **Observability & Logging**: Details of every request (latency, prompt size, token output, success status, IP) logged asynchronously to MongoDB.
- **Admin Dashboard**: Interactive Next.js single-page application showcasing real-time request volume, model utilization charts, logs table, host system specs/health, and dynamic key creation/revocation.

---

## Tech Stack

### Backend
- **FastAPI** — high performance asynchronous web framework
- **MongoDB + Motor** — asynchronous storage of request logs and API keys
- **Redis** — sliding-window rate limiting cache
- **Httpx** — async client adapter requests for local Ollama backend

### Frontend
- **Next.js 16 (App Router)**
- **Tailwind CSS v4** — modern compiled styling system
- **Recharts** — SVG charts for timeseries and model breakdowns

---

## Local Quickstart

### Prerequisites
- Docker & Docker Compose
- Or local installations of Python 3.12+, Node 18+, MongoDB, and Redis.

### Run with Docker Compose

1. Clone or copy files.
2. Initialize environment:
   ```bash
   cp .env.example .env
   ```
3. Boot services:
   ```bash
   docker compose up --build
   ```

The containers will boot:
- **Admin Dashboard**: `http://localhost:3000`
- **FastAPI Gateway**: `http://localhost:8000` (docs at `http://localhost:8000/docs`)
- **Ollama**: `http://localhost:11434`
- **MongoDB**: `localhost:27017`
- **Redis**: `localhost:6379`

---

## Developer Guide (Local Run)

If running services locally:

### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run server
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Run Tests
```bash
cd backend
PYTHONPATH=. pytest tests/
```

---

## Using the Gateway

1. Open `http://localhost:3000/keys` in your browser.
2. Click **Create Key**, name it (e.g. `dev-key`), and click create.
3. **Copy the generated key** (it is only shown once).
4. Send an OpenAI-compatible request using curl:

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma3:4b",
    "messages": [
      {"role": "user", "content": "How do you count tokens in a string?"}
    ]
  }'
```

5. Go back to `http://localhost:3000` to inspect live usage charts and full request audits.
# local-ai-gateway
 ngrok config add-authtoken token
 ngrok http 8000