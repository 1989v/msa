#!/bin/bash
set -e

CONNECT_URL="${KAFKA_CONNECT_URL:-http://localhost:8083}"

echo "Waiting for Kafka Connect to be ready..."
until curl -s "$CONNECT_URL/" > /dev/null 2>&1; do
    sleep 2
done
echo "Kafka Connect is ready."

# envsubst로 환경변수 치환 후 등록
echo "Registering inventory-outbox-connector..."
envsubst < /connectors/inventory-outbox-connector.json | \
  curl -X POST "$CONNECT_URL/connectors" \
    -H "Content-Type: application/json" \
    -d @-

echo ""
echo "Registering fulfillment-outbox-connector..."
envsubst < /connectors/fulfillment-outbox-connector.json | \
  curl -X POST "$CONNECT_URL/connectors" \
    -H "Content-Type: application/json" \
    -d @-

echo ""
echo "All connectors registered."
