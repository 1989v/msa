#!/usr/bin/env bash
# TG-16 — 가벼운 SSE 부하 테스트 (k6 미설치 시 대안).
#
# 사용:
#   N=1000 DURATION=60 URL=http://localhost:8094/api/v1/charts/stream/BTC/YAHOO ./scripts/perf/sse-load.sh
#
# curl -N (no buffer) + --max-time 으로 SSE 연결 N 개 동시 spawn → 60초 후 자연 종료.
# 출력: 성공 카운트 + HTTP 코드 분포.
set -u

URL="${URL:-http://localhost:8094/api/v1/charts/stream/BTC/YAHOO}"
N="${N:-100}"
DURATION="${DURATION:-30}"
TMPDIR="${TMPDIR:-/tmp}"
LOG_DIR="$(mktemp -d "$TMPDIR/sse-load.XXXXXX")"

echo "→ URL=$URL"
echo "→ Concurrency=$N, Duration=${DURATION}s"
echo "→ Logs at $LOG_DIR"
echo

start=$(date +%s)
for i in $(seq 1 "$N"); do
  curl -sN --max-time "$DURATION" \
    -H "Accept: text/event-stream" \
    -o "$LOG_DIR/conn-$i.log" \
    -w "%{http_code}\n" \
    "$URL" > "$LOG_DIR/code-$i.txt" 2>&1 &
done
wait
end=$(date +%s)

elapsed=$((end - start))
echo "Elapsed: ${elapsed}s"
echo
echo "HTTP code distribution:"
cat "$LOG_DIR"/code-*.txt 2>/dev/null | sort | uniq -c | sort -rn

# tick 카운트 (event: tick line)
tick_count=$(grep -h '^event: tick' "$LOG_DIR"/conn-*.log 2>/dev/null | wc -l | awk '{print $1}')
hb_count=$(grep -h ':heartbeat' "$LOG_DIR"/conn-*.log 2>/dev/null | wc -l | awk '{print $1}')
echo
echo "Total ticks received: $tick_count"
echo "Total heartbeats: $hb_count"

# 정리: --keep-logs 환경변수 시 보존
if [ -z "${KEEP_LOGS:-}" ]; then
  rm -rf "$LOG_DIR"
fi
