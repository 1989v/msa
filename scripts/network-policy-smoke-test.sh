#!/usr/bin/env bash
# ADR-0031 NetworkPolicy Phase 1 smoke test
#
# Run AFTER `kubectl apply -k k8s/overlays/k3s-lite` 가 완료되고
# CNI 가 NetworkPolicy 지원하는 상태에서 실행.
#
# 4 단계 검증:
#   1. NetworkPolicy 12개 적용 확인
#   2. gateway → product 허용 확인 (정상 트래픽)
#   3. 임시 debug pod → product 차단 확인 (default-deny 동작)
#   4. product → mysql 허용 확인 (인프라 접근)
#   5. product → 외부 https (예: example.com) 차단 확인 (egress 제한)
#
# 사용법:
#   ./scripts/network-policy-smoke-test.sh
#
# 실패 시 롤백:
#   k8s/overlays/k3s-lite/kustomization.yaml 의 `../../base/network-policy` 줄 제거 후 재적용
#   또는: kubectl delete -k k8s/base/network-policy

set -euo pipefail

NS="${NS:-commerce}"
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAILED=1; }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; }

FAILED=0

echo "=== ADR-0031 NetworkPolicy Smoke Test (ns=$NS) ==="

# 1. 12개 정책 존재
echo "[1/5] NetworkPolicy 적용 확인"
COUNT=$(kubectl -n "$NS" get networkpolicy --no-headers 2>/dev/null | wc -l | tr -d ' ')
if [ "$COUNT" -ge 12 ]; then
  pass "$COUNT NetworkPolicies in $NS (>=12)"
else
  fail "$COUNT NetworkPolicies — 기대 12개"
fi

# 2. gateway → product (named port http) 허용
echo "[2/5] gateway → product:8080 허용"
GATEWAY_POD=$(kubectl -n "$NS" get pod -l app.kubernetes.io/name=gateway -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "$GATEWAY_POD" ]; then
  if kubectl -n "$NS" exec "$GATEWAY_POD" -- timeout 3 wget -q -O- http://product:8081/actuator/health >/dev/null 2>&1; then
    pass "gateway → product 허용"
  else
    fail "gateway → product 차단됨 (정책 너무 엄격하거나 product 미동작)"
  fi
else
  warn "gateway pod 미발견 → skip"
fi

# 3. debug pod → product 차단 (label 없는 pod)
echo "[3/5] 임시 debug pod → product:8081 차단 (default-deny 검증)"
kubectl -n "$NS" run smoke-debug --rm -i --restart=Never --image=curlimages/curl:8.10.0 --quiet -- \
  sh -c 'timeout 5 curl -sf http://product:8081/actuator/health >/dev/null 2>&1 && echo OPEN || echo CLOSED' 2>/dev/null \
  | tee /tmp/np-smoke-3.log >/dev/null || true
if grep -q CLOSED /tmp/np-smoke-3.log 2>/dev/null; then
  pass "label 없는 pod → product 차단 (default-deny 동작)"
else
  fail "label 없는 pod 가 product 접근 가능 — default-deny 미동작"
fi

# 4. product → mysql 허용
echo "[4/5] product → mysql:3306 허용"
PRODUCT_POD=$(kubectl -n "$NS" get pod -l app.kubernetes.io/name=product -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
if [ -n "$PRODUCT_POD" ]; then
  if kubectl -n "$NS" exec "$PRODUCT_POD" -- timeout 3 sh -c 'echo > /dev/tcp/mysql/3306' 2>/dev/null; then
    pass "product → mysql 허용"
  else
    fail "product → mysql 차단됨 (mysql 접근 정책 점검)"
  fi
else
  warn "product pod 미발견 → skip"
fi

# 5. product → 외부 (example.com:443) 차단 (auth/quant/gifticon 만 허용 정책)
echo "[5/5] product → example.com:443 차단 (외부 egress 제한 검증)"
if [ -n "$PRODUCT_POD" ]; then
  if kubectl -n "$NS" exec "$PRODUCT_POD" -- timeout 5 sh -c 'echo > /dev/tcp/example.com/443' 2>/dev/null; then
    fail "product 가 외부 https 접근 가능 — egress 정책 점검 필요"
  else
    pass "product → 외부 https 차단 (정상)"
  fi
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}=== smoke test 전체 PASS ===${NC}"
  exit 0
else
  echo -e "${RED}=== smoke test 일부 FAIL — 위 결과 확인 후 롤백 검토 ===${NC}"
  exit 1
fi
