#!/usr/bin/env bash
# Run pip-audit on all backend services and npm audit on the web UI
set -e

SERVICES=(api-gateway groups-service events-service ratings-service activities-service enrichment-service)

echo "=== Python dependency audit ==="
for svc in "${SERVICES[@]}"; do
    req="backend/services/$svc/requirements.txt"
    if [ -f "$req" ]; then
        echo "--- $svc ---"
        pip-audit -r "$req" --progress-spinner off || true
    fi
done

echo ""
echo "=== Node.js dependency audit ==="
if [ -d "web" ]; then
    (cd web && npm audit --audit-level=moderate) || true
fi
