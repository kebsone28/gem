#!/bin/bash
# GEM SAAS — Local Development Startup Script
# Usage: bash start-local.sh

set -e

echo "🚀 GEM SAAS — Starting Local Development"
echo ""

# Configuration
BACKEND_PORT=5008
FRONTEND_PORT=5174
DB_NAME="electrification"
API_URL="http://localhost:${BACKEND_PORT}/api"

echo "📋 Configuration:"
echo "  Frontend Port: $FRONTEND_PORT"
echo "  Backend Port: $BACKEND_PORT"
echo "  Database: $DB_NAME"
echo "  API URL: $API_URL"
echo ""

# Step 1: Check if backend is running
echo "1️⃣ Checking Backend..."
if curl -s http://localhost:${BACKEND_PORT}/api/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running on port $BACKEND_PORT"
else
    echo "   ⚠️ Backend not detected. Starting in separate terminal:"
    echo "   cd backend && npm start"
    echo "   (Keep this running)"
fi

echo ""

# Step 2: Start Frontend
echo "2️⃣ Starting Frontend..."
echo "   Port: $FRONTEND_PORT"
echo "   URL: http://localhost:$FRONTEND_PORT"
echo ""

cd frontend
npm run dev

echo ""
echo "🎉 Frontend running at http://localhost:$FRONTEND_PORT"
