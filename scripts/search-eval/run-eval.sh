#!/bin/bash
# 관광지 검색 3구성 nDCG@10 — OCI 노드에서 돌린다 (OpenSearch·인코더 사이드카가 클러스터 안에만 있다).
#
#   scp -r scripts/search-eval msa-oci:/tmp/ && ssh msa-oci bash /tmp/search-eval/run-eval.sh
#
# 결과는 노드 /tmp/eval-result.json 에 남는다 — 남길 값이면 results/<날짜>.json 으로 가져온다.
set -uo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
OS=$(sudo -E kubectl -n commerce get pod --no-headers -o custom-columns=N:.metadata.name | grep opensearch | head -1)
# 라벨로 고른다 — 이름 패턴 '^search-…' 은 search-consumer 도 잡아서, 그 파드로 포트포워드가 걸리면
# 인코더(8099)가 없어 하이브리드 구성(B)이 전부 connection refused 로 죽는다 (2026-09-22 실측)
SP=$(sudo -E kubectl -n commerce get pod -l app.kubernetes.io/name=search --field-selector=status.phase=Running \
     --no-headers -o custom-columns=N:.metadata.name | head -1)
echo "opensearch=$OS  search=$SP"
sudo -E kubectl -n commerce port-forward "pod/$OS" 19200:9200 >/tmp/pf1.log 2>&1 &
PF1=$!
sudo -E kubectl -n commerce port-forward "pod/$SP" 18099:8099 >/tmp/pf2.log 2>&1 &
PF2=$!
sleep 6
curl -s -o /dev/null -w '  opensearch %{http_code}\n' http://127.0.0.1:19200/
curl -s -o /dev/null -w '  encoder    %{http_code}\n' http://127.0.0.1:18099/healthz
python3 "$DIR/live-eval.py" "$DIR/judgments-attractions-2026-09-13.json" "${1:-/tmp/eval-result.json}"
kill $PF1 $PF2 2>/dev/null
