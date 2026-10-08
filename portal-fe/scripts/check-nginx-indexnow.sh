#!/usr/bin/env bash
# IndexNow 키 파일의 nginx 계약을 실제 nginx 로 확인한다.
#
# 이미지와 같은 방식으로 올린다 — portal-fe/nginx.conf 를 템플릿으로, 레포의 실제 엔트리포인트 스크립트
# (docker-entrypoint.d/15-indexnow-key.sh)를 실행 권한째 /docker-entrypoint.d/ 에 넣고 INDEXNOW_KEY 만 바꿔 띄운다.
# 판정은 nginx 가 내놓은 응답(상태·헤더·본문)과 컨테이너가 떴는지로 한다.
#
#   ① 키 미설정 → 기동 · 임의 /{hex}.txt 는 키 본문 아님
#   ② `;` 포함 · 여러 줄(첫 줄은 정상 키) · 끝 개행 → 조각 없음 · 기동 · 첫 줄 키로도 키 본문 아님
#   ③ 정상 32자 hex → place 호스트 200 · 본문 = 키 · Cache-Control 한 벌 · apex·blog 404 · /.txt·틀린 키는 키 본문 아님
#
# 회귀 주입은 사본을 ENTRYPOINT_SCRIPT·NGINX_CONF 로 넘겨서 한다 — 예: 검사를 줄 단위 grep 으로 바꾸면 ② 가 빨간불.
# 도커가 없으면 검사하지 못했다는 뜻으로 2 로 끝난다(통과로 세지 않는다).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONF="${NGINX_CONF:-$ROOT/nginx.conf}"
ENTRYPOINT_SCRIPT="${ENTRYPOINT_SCRIPT:-$ROOT/docker-entrypoint.d/15-indexnow-key.sh}"
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"

if ! docker info >/dev/null 2>&1; then
  echo "SKIP: 도커 데몬이 없어 nginx 계약을 검사하지 못했다" >&2
  exit 2
fi
if [ ! -x "$ENTRYPOINT_SCRIPT" ]; then
  echo "FAIL 엔트리포인트 스크립트가 없거나 실행 권한이 없다: $ENTRYPOINT_SCRIPT" >&2
  exit 1
fi

ID="idxn-$$-$RANDOM"
WORK="$(mktemp -d)"
cleanup() {
  docker rm -f "$ID" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

KEY="0123456789abcdef0123456789abcdef"
OTHER="fedcba9876543210fedcba9876543210"
SHELL_MARKER="SPA-SHELL-MARKER"
mkdir -p "$WORK/html"
echo "<html><body>$SHELL_MARKER</body></html>" >"$WORK/html/index.html"
cp "$NGINX_CONF" "$WORK/default.conf.template"
cp -p "$ENTRYPOINT_SCRIPT" "$WORK/15-indexnow-key.sh"
chmod -R a+rX "$WORK"

FAIL=0
pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1" >&2; FAIL=1; }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 — 기대 [$3] 실제 [$2]"; fi; }

BASE=""
# 컨테이너를 INDEXNOW_KEY 값(없으면 미설정)으로 띄운다. 떴으면 0.
start() { # [key]
  docker rm -f "$ID" >/dev/null 2>&1 || true
  local env_args=()
  if [ $# -gt 0 ]; then env_args=(-e "INDEXNOW_KEY=$1"); fi
  docker run -d --name "$ID" -p 127.0.0.1::80 \
    -e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 -e NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS \
    ${env_args[@]+"${env_args[@]}"} \
    -v "$WORK/15-indexnow-key.sh:/docker-entrypoint.d/15-indexnow-key.sh:ro" \
    -v "$WORK/default.conf.template:/etc/nginx/templates/default.conf.template:ro" \
    -v "$WORK/html:/usr/share/nginx/html:ro" "$NGINX_IMAGE" >/dev/null
  local port=""
  for _ in $(seq 1 50); do
    port="$(docker port "$ID" 80/tcp 2>/dev/null | head -1 | sed 's/.*://')"
    if [ -n "$port" ] && curl -s -o /dev/null "http://127.0.0.1:$port/"; then
      BASE="http://127.0.0.1:$port"
      return 0
    fi
    [ "$(docker inspect -f '{{.State.Running}}' "$ID" 2>/dev/null)" = "true" ] || break
    sleep 0.2
  done
  docker logs "$ID" 2>&1 | tail -5 >&2
  return 1
}
fetch() { # host path
  curl -s -o "$WORK/body" -D "$WORK/headers" -w '%{http_code}' -H "Host: $1" "$BASE$2"
}
header_values() { grep -i "^$1:" "$WORK/headers" | sed 's/^[^:]*:[[:space:]]*//' | tr -d '\r'; }
fragment_exists() { docker exec "$ID" sh -c 'ls /etc/nginx/conf.d/indexnow/*.conf' >/dev/null 2>&1; }
not_key_body() { # label key
  if [ "$(cat "$WORK/body")" = "$2" ]; then fail "$1 — 키 본문이 나갔다"; else pass "$1 — 키 본문 아님"; fi
}
# 요청 전에 본다 — 요청을 보내면 access 로그에 경로(=키)가 남는다.
log_has_no_key() { # label key
  if docker logs "$ID" 2>&1 | grep -qF "$2"; then fail "$1 — 기동 로그에 키 값이 찍혔다"; else pass "$1 — 기동 로그에 키 값 없음"; fi
}

echo "nginx IndexNow 키 파일 계약 — $(basename "$NGINX_CONF") + $(basename "$ENTRYPOINT_SCRIPT")"

echo "① 키 미설정"
if start; then
  pass "기동"
  check "조각 없음" "$(fragment_exists && echo yes || echo no)" no
  fetch place.1989v.com "/$KEY.txt" >/dev/null
  not_key_body "/{hex}.txt" "$KEY"
else
  fail "기동 실패"
fi

echo "② 형식이 틀린 키"
NL='
'
for case_ in semicolon multiline trailing-newline; do
  case "$case_" in
    semicolon)        value="0123456789abcdef0123456789abcd;f" ;;
    multiline)        value="$KEY${NL}location / { return 200 x; }" ;;
    trailing-newline) value="$KEY${NL}" ;;
  esac
  if start "$value"; then
    pass "$case_ — 기동"
    log_has_no_key "$case_" "$(printf '%s\n' "$value" | head -1)"
    check "$case_ — 조각 없음" "$(fragment_exists && echo yes || echo no)" no
    fetch place.1989v.com "/$KEY.txt" >/dev/null
    not_key_body "$case_ — /{첫 줄 키}.txt" "$KEY"
  else
    fail "$case_ — 기동 실패"
  fi
done

echo "③ 정상 키"
if start "$KEY"; then
  pass "기동"
  log_has_no_key "정상 키" "$KEY"
  check "place 상태 200" "$(fetch place.1989v.com "/$KEY.txt")" 200
  check "본문 = 키" "$(cat "$WORK/body")" "$KEY"
  check "Cache-Control 한 벌" "$(header_values Cache-Control | paste -sd'|' -)" "public, max-age=300"
  check "apex 404" "$(fetch 1989v.com "/$KEY.txt")" 404
  check "blog 404" "$(fetch blog.1989v.com "/$KEY.txt")" 404
  fetch place.1989v.com "/.txt" >/dev/null
  not_key_body "/.txt" "$KEY"
  fetch place.1989v.com "/$OTHER.txt" >/dev/null
  not_key_body "틀린 키" "$KEY"
else
  fail "기동 실패"
fi

if [ "$FAIL" -ne 0 ]; then
  echo "FAILED" >&2
  exit 1
fi
echo "PASSED"
