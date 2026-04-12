#!/bin/bash
# Test API Bbox Endpoint
# Tests the GET /households?bbox=... endpoint

# Configuration
API_URL="http://localhost:3001/api"
BBOX="2.3,48.8,2.4,48.9"  # Example bbox (near Paris)
PROJECT_ID="your-project-id"

echo "🧪 TESTING BBOX ENDPOINT"
echo "========================"
echo ""

# 1. Test without bbox (standard query)
echo "1️⃣  Testing standard query (no bbox)..."
curl -X GET "${API_URL}/households" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "2️⃣  Testing with bbox filter..."
curl -X GET "${API_URL}/households?bbox=${BBOX}&limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "3️⃣  Testing with bbox + status filter..."
curl -X GET "${API_URL}/households?bbox=${BBOX}&status=Livraison%20effectuée&limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "✅ Tests complete!"
