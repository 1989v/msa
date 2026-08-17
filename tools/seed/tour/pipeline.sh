#!/usr/bin/env bash
# TourAPI 수집 → place 적재 → search 재색인 파이프라인 (ADR-0065)
#
# 수집·매핑·적재를 한 번에 돌린다. 중간 산출물은 /tmp 에만 두고 레포에 남기지 않는다
# (원천 응답 비커밋 원칙).
#
# 적재는 게이트웨이가 쓰기를 막으므로(401) OCI 호스트에서 파드로 port-forward 해 넣는다.
#
# Usage:
#   TOUR_API_KEY=... ./pipeline.sh attraction          # 관광지 전량 (ko+en)
#   TOUR_API_KEY=... ./pipeline.sh culture leisure     # 여러 타입 순차
#   SKIP_REINDEX=1 ./pipeline.sh attraction            # 적재까지만
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SSH_HOST="${OCI_SSH_HOST:-msa-oci}"
NS="${OCI_NS:-commerce}"
PF_PORT="${PF_PORT:-18096}"
LIMIT="${LIMIT:-200000}"   # 사실상 무제한 — totalCount 까지 받는다

: "${TOUR_API_KEY:?TOUR_API_KEY 가 필요합니다}"

log() { echo -e "\033[1;34m▶\033[0m $*"; }
ok()  { echo -e "\033[1;32m✓\033[0m $*"; }

TYPES=("$@")
[[ ${#TYPES[@]} -gt 0 ]] || TYPES=("attraction")

for type in "${TYPES[@]}"; do
    for svc in kor eng; do
        out="/tmp/tour.${type}.${svc}.jsonl"
        log "수집 ${type}/${svc}"
        python3 "$HERE/sync_tour.py" --service "$svc" --content-type "$type" \
            --limit "$LIMIT" --out "$out" 2>&1 | tail -1

        n=$(wc -l < "$out" | tr -d ' ')
        [[ "$n" -gt 0 ]] || { echo "  (0건 — 건너뜀)"; continue; }

        # place bulk 는 2000건/청크 제한.
        # 분할 결과와 JSON 산출물을 같은 글롭에 두면 `x.json.json` 이 생겨 400 을 맞는다 —
        # 디렉토리를 나눠 서로 안 걸리게 한다.
        work="/tmp/tourchunk.${type}.${svc}"
        rm -rf "$work" && mkdir -p "$work/raw"
        split -l 2000 "$out" "$work/raw/part."
        for c in "$work"/raw/part.*; do
            jq -s '{attractions: .}' "$c" > "$work/$(basename "$c").json"
        done

        log "적재 ${type}/${svc} (${n}건)"
        scp -q "$work"/*.json "$SSH_HOST:/tmp/tourbulk/" 2>/dev/null \
          || { ssh "$SSH_HOST" "mkdir -p /tmp/tourbulk"; scp -q "$work"/*.json "$SSH_HOST:/tmp/tourbulk/"; }
        ssh "$SSH_HOST" "NS='$NS' PORT='$PF_PORT' bash -s" <<'REMOTE'
set -euo pipefail
POD=$(sudo k3s kubectl get pods -n "$NS" --no-headers | grep '^place-' | awk '{print $1}' | head -1)
sudo k3s kubectl port-forward -n "$NS" "pod/$POD" "$PORT:8096" >/tmp/pf.log 2>&1 &
PF=$!
trap 'kill $PF 2>/dev/null || true' EXIT
sleep 6
for f in /tmp/tourbulk/*.json; do
  code=$(curl -s -o /tmp/bulk.resp -w '%{http_code}' --max-time 600 -X POST \
    "http://127.0.0.1:$PORT/api/places/attractions/bulk" \
    -H 'Content-Type: application/json' -H 'Accept: application/json' -d @"$f")
  echo "  $(basename "$f"): $code $(jq -c '.data' /tmp/bulk.resp 2>/dev/null || head -c 120 /tmp/bulk.resp)"
  rm -f "$f"
done
REMOTE
        rm -rf "$work"
    done
done

if [[ "${SKIP_REINDEX:-}" != "1" ]]; then
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
sudo k3s kubectl logs -n "$NS" "job/$JOB" 2>/dev/null | grep -E 'reindex complete|Alias' | tail -2
REMOTE
fi

ok "파이프라인 완료"
