#!/usr/bin/env bash
# 개요(overview) 하루치 수집 — 수집 → 적재 → 재색인을 **한 실행 단위**로 묶는다.
#
# 왜 묶어야 하나: 중복 호출을 막는 기준이 "place SSOT 에 개요가 있는가" 하나뿐이다.
# 수집만 하고 적재를 미루면 다음 실행이 같은 레코드를 그대로 다시 부른다
# (실측: 시험분 30건이 다음 실행에서 30/30 재호출됐다). 적재까지 끝나야 중복이 없다.
#
# 한도는 (서비스 × 오퍼레이션)별로 따로다 — KorService2 가 429 여도 EngService2 는 살아 있다.
# 그래서 ko/en 을 각각 하루 예산만큼 돌린다.
#
# Usage:
#   TOUR_API_KEY=... ./overview_daily.sh              # ko 1000 + en 1000
#   TOUR_API_KEY=... BUDGET=300 ./overview_daily.sh   # 예산 축소
#   ./overview_daily.sh --stats                       # 잔량만 확인 (API 호출 없음)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SSH_HOST="${OCI_SSH_HOST:-msa-oci}"
NS="${OCI_NS:-commerce}"
PF_PORT="${PF_PORT:-18096}"
BUDGET="${BUDGET:-1000}"

log() { echo -e "\033[1;34m▶\033[0m $*"; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }

if [[ "${1:-}" == "--stats" ]]; then
    exec python3 "$HERE/backfill_overview.py" --stats-only
fi

: "${TOUR_API_KEY:?TOUR_API_KEY 가 필요합니다}"

loaded_any=0
for lang in ko en; do
    out="/tmp/overview.$lang.jsonl"
    log "수집 $lang (예산 $BUDGET)"
    python3 "$HERE/backfill_overview.py" --lang "$lang" --budget "$BUDGET" --out "$out"
    n=$(wc -l < "$out" | tr -d ' ')
    [[ "$n" -gt 0 ]] || { log "  $lang 수집 0건 — 적재 생략"; continue; }

    # 부분 전송은 나머지 필드를 지운다 — backfill 이 전체 레코드를 되돌려 주므로 그대로 보낸다.
    jq -s '{attractions: .}' "$out" > "/tmp/overview.$lang.json"
    scp -q "/tmp/overview.$lang.json" "$SSH_HOST:/tmp/"
    log "적재 $lang ($n 건)"
    ssh "$SSH_HOST" "NS='$NS' PORT='$PF_PORT' LANG_TAG='$lang' bash -s" <<'REMOTE'
set -euo pipefail
POD=$(sudo k3s kubectl get pods -n "$NS" --no-headers | grep '^place-' | grep ' Running ' | awk '{print $1}' | head -1)
sudo k3s kubectl port-forward -n "$NS" "pod/$POD" "$PORT:8096" >/tmp/pf.log 2>&1 &
PF=$!; trap 'kill $PF 2>/dev/null || true' EXIT
sleep 6
code=$(curl -s -o /tmp/ov.resp -w '%{http_code}' --max-time 600 -X POST \
  "http://127.0.0.1:$PORT/api/places/attractions/bulk" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' -d @"/tmp/overview.$LANG_TAG.json")
echo "  $code $(jq -c '.data' /tmp/ov.resp 2>/dev/null || head -c 120 /tmp/ov.resp)"
[[ "$code" == "201" ]] || exit 1
rm -f "/tmp/overview.$LANG_TAG.json"
REMOTE
    loaded_any=1
done

if [[ "$loaded_any" == "1" && "${SKIP_REINDEX:-}" != "1" ]]; then
    log "재색인"
    ssh "$SSH_HOST" "NS='$NS' bash -s" <<'REMOTE'
set -euo pipefail
JOB="attraction-reindex-$(date +%H%M%S)"
sudo k3s kubectl create job -n "$NS" --from=cronjob/attraction-reindex "$JOB" >/dev/null
for _ in $(seq 1 40); do
  s=$(sudo k3s kubectl get job -n "$NS" "$JOB" -o jsonpath='{.status.succeeded}{"/"}{.status.failed}')
  case "$s" in 1/*) break;; */1) echo "  재색인 실패"; exit 1;; esac
  sleep 15
done
sudo k3s kubectl logs -n "$NS" "job/$JOB" 2>/dev/null | grep -E 'reindex complete' | tail -1
REMOTE
fi

ok "하루치 완료"
python3 "$HERE/backfill_overview.py" --stats-only
