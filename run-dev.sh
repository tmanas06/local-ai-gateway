#!/usr/bin/env bash

# Exit immediately if any command in a pipeline fails
set -e

# Cleanup function to kill all child processes in the same process group
cleanup() {
    # Disable trap to avoid infinite loops during termination
    trap - EXIT SIGINT SIGTERM
    echo ""
    echo "============================================="
    echo "Stopping all services (Backend, Frontend, Ngrok)..."
    echo "============================================="
    # Kill the current process group
    kill 0
}

# Trap exit signals to ensure clean shutdown
trap cleanup EXIT SIGINT SIGTERM

echo "============================================="
echo "Starting Backend (FastAPI)..."
echo "============================================="
(
    cd backend
    if [ ! -d ".venv" ]; then
        echo "Creating python virtual environment (.venv)..."
        python3 -m venv .venv
    fi
    source .venv/bin/activate
    echo "Installing backend requirements..."
    pip install -r requirements.txt
    echo "Starting FastAPI gateway server..."
    exec uvicorn main:app --reload --port 8000
) &

echo "============================================="
echo "Starting Frontend (Next.js)..."
echo "============================================="
(
    cd frontend
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend packages..."
        npm install
    fi
    echo "Starting frontend dev server..."
    exec npm run dev
) &

# Give backend/frontend a moment to initialize before ngrok output
sleep 2

echo "============================================="
echo "Starting Ngrok http 8000..."
echo "============================================="
# Run ngrok in the foreground to keep the terminal active
exec ngrok http 8000
