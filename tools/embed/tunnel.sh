#!/usr/bin/env bash
# 도구 → 클러스터 내부 API 통로 (ADR-0090).
#
# `/internal/**` 은 게이트웨이가 라우팅하지 않는다 — 게이트웨이는 `/api`·`/sse`·`/ws`·`/actuator` 만 받는다.
# 그래서 인터넷에서 닿지 않고, 도구는 port-forward 로 직접 들어온다. **인증이 없는 대신 경로가 없는 것**이
# 방어라, 이 통로를 열어 둔 채 자리를 비우지 않는다.
#
#   tools/embed/tunnel.sh                 # place(8096) + search(8083), Ctrl-C 로 둘 다 닫는다
#   tools/embed/tunnel.sh place           # 하나만
#   NS=commerce tools/embed/tunnel.sh     # 네임스페이스 바꾸기
#
# 열린 뒤:
#   python -m embed.docs    run --model arctic-ko --internal http://localhost:8096
#   python -m embed.queries seed --model arctic-ko --internal http://localhost:8083 --intents docs/specs/2026-09-05-unified-search/intents.yml
set -uo pipefail

NS="${NS:-commerce}"
declare -a PIDS=()

# 포트는 서비스 포트를 그대로 로컬에 쓴다 — 명령줄에 적는 주소가 한 벌이면 헷갈리지 않는다.
port_of() {
  case "$1" in
    place)  echo 8096 ;;
    search) echo 8083 ;;
    *) echo "  ✗ 모르는 서비스: $1 (place | search)" >&2; return 1 ;;
  esac
}

cleanup() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  echo "  · 통로를 닫았다"
}
trap cleanup EXIT INT TERM

command -v kubectl >/dev/null || { echo "  ✗ kubectl 이 없다" >&2; exit 1; }
kubectl -n "$NS" get svc >/dev/null 2>&1 || {
  echo "  ✗ 네임스페이스 '$NS' 에 닿지 못한다 — kubeconfig 컨텍스트를 확인하라" >&2; exit 1; }

targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(place search)

for svc in "${targets[@]}"; do
  port="$(port_of "$svc")" || exit 1
  # 포트가 이미 물려 있으면 조용히 실패해서, 여는 것 자체를 확인한다 (안 그러면 옛 통로로 재는 사고가 난다)
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  ✗ 로컬 :$port 이 이미 물려 있다 — 옛 통로를 닫고 다시 실행하라" >&2
    exit 1
  fi
  kubectl -n "$NS" port-forward "svc/$svc" "$port:$port" >/dev/null 2>&1 &
  PIDS+=("$!")
  echo "  · $svc → http://localhost:$port"
done

# 실제로 열렸는지 확인한다 — port-forward 는 대상이 없어도 백그라운드에서 조용히 죽는다
sleep 2
for svc in "${targets[@]}"; do
  port="$(port_of "$svc")"
  if ! curl -sf -m 3 "http://localhost:$port/actuator/health" >/dev/null; then
    echo "  ✗ $svc :$port 이 응답하지 않는다 — 파드가 떠 있는지 확인하라" >&2
    exit 1
  fi
done

echo "  · 열렸다. Ctrl-C 로 닫는다"
wait
