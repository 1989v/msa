#!/usr/bin/env bash
# P0-4·P0-5 — 운영과 같은 이미지의 OpenSearch 를 로컬 Docker 로 띄워 재고, 끝나면 반드시 지운다.
#   HEAP=512m MEM=1536m DIMS="512 1024" DOCS=60000 QUERIES=80000 probes/run_probe.sh
#   SKIP_KNN=1 probes/run_probe.sh            # hybrid 스파이크만
# 컨테이너가 죽으면(OOM 등) 그 사실을 찍고 다음 조합으로 넘어간다 — 죽은 것 자체가 측정값이다.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="${PYTHON:-python3}"
NAME=kgd-os-probe
PORT="${PORT:-9250}"
HEAP="${HEAP:-512m}"; MEM="${MEM:-1536m}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
start() {
  cleanup
  docker run -d --name "$NAME" -m "$MEM" --memory-swap "$MEM" -p "$PORT:9200" \
    -e discovery.type=single-node -e DISABLE_SECURITY_PLUGIN=true -e DISABLE_INSTALL_DEMO_CONFIG=true \
    -e "OPENSEARCH_JAVA_OPTS=-Xms$HEAP -Xmx$HEAP" opensearchproject/opensearch:3.3.0 >/dev/null
  for i in $(seq 1 90); do
    if curl -fsS "localhost:$PORT/_cluster/health" >/dev/null 2>&1; then return 0; fi; sleep 2
  done
  echo "opensearch did not become healthy"; return 1
}
diagnose() {
  echo "container state: $(docker inspect --format 'running={{.State.Running}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}}' "$NAME" 2>/dev/null)"
  docker logs --tail 5 "$NAME" 2>&1 | cut -c1-300
}
start || exit 1
echo "config: heap=$HEAP mem=$MEM"
curl -fsS "localhost:$PORT/_cat/plugins?h=component" | grep -E "knn|neural" | tr '\n' ' '; echo
echo "== idle == $(docker stats --no-stream --format '{{.MemUsage}}' "$NAME")"
if [ "${SKIP_KNN:-}" != "1" ]; then
  for dim in ${DIMS:-512 1024}; do
    echo "== dim $dim =="
    if "$PY" "$HERE/knn_probe.py" --url "http://localhost:$PORT" --dim "$dim" --docs "${DOCS:-60000}" --queries "${QUERIES:-80000}" 2>&1 | tail -1; then
      echo "container mem after: $(docker stats --no-stream --format '{{.MemUsage}}' "$NAME")"
    else
      echo "PROBE FAILED at dim $dim"; diagnose; start || exit 1; continue
    fi
    "$PY" - "$PORT" "$dim" <<'PYX'
import sys, requests
port, dim = sys.argv[1], sys.argv[2]
for i in (f"probe_docs_{dim}", f"probe_qv_{dim}"):
    requests.delete(f"http://localhost:{port}/{i}", timeout=120)
PYX
  done
fi
echo "== hybrid spike =="
"$PY" "$HERE/hybrid_spike.py" --url "http://localhost:$PORT" || diagnose
