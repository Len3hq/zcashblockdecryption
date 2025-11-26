#!/bin/bash

BASE_URL="http://localhost:3005"

echo "Testing Health Endpoint..."
curl -s "$BASE_URL/health" | jq .
echo -e "\n"

echo "Testing Scan Endpoint (Valid Request)..."
curl -s -X POST "$BASE_URL/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [1000000],
    "ufvk": "uviewtest1dummyufvkforverificationpurposesonly"
  }' | jq .
echo -e "\n"

echo "Testing Scan Endpoint (Invalid UFVK)..."
curl -s -X POST "$BASE_URL/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [1000000],
    "ufvk": "invalid_ufvk"
  }' | jq .
echo -e "\n"

echo "Testing Scan Endpoint (Invalid Block Heights)..."
curl -s -X POST "$BASE_URL/scan" \
  -H "Content-Type: application/json" \
  -d '{
    "blockHeights": [],
    "ufvk": "uviewtest1dummy"
  }' | jq .
echo -e "\n"
