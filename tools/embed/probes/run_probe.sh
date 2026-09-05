#!/usr/bin/env bash
# P0-4·P0-5 — 운영과 같은 이미지·heap·메모리 한도의 OpenSearch 를 로컬 Docker 로 띄워 재고, 끝나면 반드시 지운다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="${PYTHON:-python3}"
NAME=kgd-os-probe
PORT="${PORT:-9250}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run -d --name "$NAME" -m 1536m --memory-swap 1536m -p "$PORT:9200" \
  -e discovery.type=single-node -e DISABLE_SECURITY_PLUGIN=true -e DISABLE_INSTALL_DEMO_CONFIG=true \
  -e "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m" opensearchproject/opensearch:3.3.0 >/dev/null
for i in $(seq 1 90); do
  if curl -fsS "localhost:$PORT/_cluster/health" >/dev/null 2>&1; then break; fi; sleep 2
done
curl -fsS "localhost:$PORT/_cat/plugins?h=component" | grep -E "knn|neural" | tr '\n' ' '; echo
echo "== idle =="; docker stats --no-stream --format '{{.MemUsage}}' "$NAME"
for dim in ${DIMS:-512 1024}; do
  echo "== dim $dim =="
  "$PY" "$HERE/knn_probe.py" --url "http://localhost:$PORT" --dim "$dim" --docs "${DOCS:-60000}" --queries "${QUERIES:-80000}"
  echo "container mem: $(docker stats --no-stream --format '{{.MemUsage}}' "$NAME")"
  "$PY" - "$PORT" "$dim" <<'PYX'
import sys, requests
port, dim = sys.argv[1], sys.argv[2]
for i in (f"probe_docs_{dim}", f"probe_qv_{dim}"):
    requests.delete(f"http://localhost:{port}/{i}", timeout=60)
PYX
done
echo "== hybrid spike =="
"$PY" "$HERE/hybrid_spike.py" --url "http://localhost:$PORT"
