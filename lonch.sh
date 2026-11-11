#!/usr/bin/env bash
# ==============================================================================
# AERIVA AI — One-Click Launch Script
# Starts Full-Stack Backend, Frontend, API & Opens the Web App in Your Browser
# ==============================================================================

# Move to the script's directory (aeriva-ai root)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================"
echo "         🚀 STARTING AERIVA AI APPLICATION             "
echo "========================================================"

# 1. Check and Load .env file with API Keys
if [ -f ".env" ]; then
    echo "✓ Loading API Keys from .env..."
    set -a
    source .env
    set +a
    if [ -n "$GROQ_API_KEY" ]; then
        echo "✓ GROQ_API_KEY detected (${GROQ_API_KEY:0:10}...)"
    else
        echo "⚠️ Warning: GROQ_API_KEY is empty in .env"
    fi
else
    echo "⚠️ .env file not found! Please create .env with your GROQ_API_KEY"
fi

# 2. Check Python Virtual Environment
if [ -d "venv" ]; then
    echo "✓ Activating Python virtual environment (venv)..."
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "✓ Activating Python virtual environment (.venv)..."
    source .venv/bin/activate
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing required dependencies..."
    pip install -r requirements.txt
fi

# 3. Check and free port 8000 if already occupied
PORT_PID=$(lsof -ti :8000 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    echo "ℹ Port 8000 is occupied by PID $PORT_PID. Freeing port..."
    kill -9 $PORT_PID 2>/dev/null
    sleep 1
fi

# 4. Open Web Page in Default Browser after 1.5 seconds in background
(
    sleep 1.5
    echo "🌐 Opening http://localhost:8000 in your browser..."
    if command -v open >/dev/null 2>&1; then
        open "http://localhost:8000"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:8000"
    fi
) &

echo "--------------------------------------------------------"
echo "  • Web Application : http://localhost:8000"
echo "  • Swagger API Docs: http://localhost:8000/docs"
echo "  • Press CTRL+C to stop the server anytime"
echo "--------------------------------------------------------"

# 5. Start Uvicorn Server with Live Hot-Reload
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
