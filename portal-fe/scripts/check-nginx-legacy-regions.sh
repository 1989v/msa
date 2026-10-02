#!/usr/bin/env bash
# 광주(29)·전남(46) 옛 지역 주소의 nginx 계약을 실제 nginx 로 확인한다.
#
# 두 시도는 전남광주통합특별시(12)로 합쳐져 원천에 29·46 행이 없다. 옛 주소가 SPA 폴백으로
# 빈 지역 페이지를 200 으로 내지 않고 통합시 허브로 301 하는지 본다.
#
#   ① /regions/29 · /regions/46 → 301 https://<host>/regions/12
#   ② 시군구(29xxx·46xxx) → 시도 허브 /regions/12 (새 코드가 접두 치환으로 맞지 않는다)
#   ③ /en 경로는 /en/regions/12
#   대조: /regions/12 는 프리렌더 파일, /regions/12110·/regions/11 은 그대로 200 (리다이렉트 아님)
#
# portal-fe/nginx.conf 를 이미지와 같은 방식(템플릿 + 기동 때 resolver 치환)으로 nginx:1.27-alpine 에 올리고,
# 판정은 nginx 가 내놓은 상태·Location·본문으로 한다.
# 회귀 주입은 설정 사본을 NGINX_CONF 로 넘겨서 한다 — 예: 옛 주소 블록을 지역 location 뒤로 옮기면 ① 이 빨간불.
# 도커가 없으면 검사하지 못했다는 뜻으로 2 로 끝난다(통과로 세지 않는다).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONF="${NGINX_CONF:-$ROOT/nginx.conf}"
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"

if ! docker info >/dev/null 2>&1; then
  echo "SKIP: 도커 데몬이 없어 nginx 계약을 검사하지 못했다" >&2
  exit 2
fi

ID="legreg-$$-$RANDOM"
WORK="$(mktemp -d)"
cleanup() {
  docker rm -f "$ID" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

SHELL_MARKER="SPA-SHELL-MARKER"
PRERENDER_MARKER="PRERENDER-REGION-12"
mkdir -p "$WORK/html/prerender/regions"
echo "<html><body>$SHELL_MARKER</body></html>" >"$WORK/html/index.html"
echo "<html><body>$PRERENDER_MARKER</body></html>" >"$WORK/html/prerender/regions/12.html"
cp "$NGINX_CONF" "$WORK/default.conf.template"
chmod -R a+rwX "$WORK"

docker run -d --name "$ID" -p 127.0.0.1::80 \
  -e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 -e NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS \
  -v "$WORK/default.conf.template:/etc/nginx/templates/default.conf.template:ro" \
  -v "$WORK/html:/usr/share/nginx/html:ro" "$NGINX_IMAGE" >/dev/null

PORT="$(docker port "$ID" 80/tcp | head -1 | sed 's/.*://')"
BASE="http://127.0.0.1:$PORT"
for _ in $(seq 1 50); do
  curl -s -o /dev/null "$BASE/" && break
  sleep 0.2
done

FAIL=0
pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1" >&2; FAIL=1; }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 — 기대 [$3] 실제 [$2]"; fi; }

fetch() { # host path → 상태 코드, 헤더·본문은 파일로
  curl -s -o "$WORK/body" -D "$WORK/headers" -w '%{http_code}' -H "Host: $1" "$BASE$2"
}
location_header() { grep -i '^location:' "$WORK/headers" | sed 's/^[^:]*:[[:space:]]*//' | tr -d '\r'; }

redirects() { # path expected-location
  local status
  status=$(fetch place.1989v.com "$1")
  check "$1 → 301" "$status" 301
  check "$1 → Location" "$(location_header)" "$2"
}

echo "nginx 옛 광주·전남 지역 주소 계약 — $(basename "$NGINX_CONF")"

echo "① 시도"
redirects /regions/29 https://place.1989v.com/regions/12
redirects /regions/46 https://place.1989v.com/regions/12

echo "② 시군구는 시도 허브로"
redirects /regions/29110 https://place.1989v.com/regions/12
redirects /regions/46230 https://place.1989v.com/regions/12

echo "③ 영문"
redirects /en/regions/29 https://place.1989v.com/en/regions/12
redirects /en/regions/46890 https://place.1989v.com/en/regions/12

echo "대조: 통합시와 다른 지역은 리다이렉트하지 않는다"
check "/regions/12 200" "$(fetch place.1989v.com /regions/12)" 200
if grep -q "$PRERENDER_MARKER" "$WORK/body"; then pass "/regions/12 는 프리렌더 파일"; else fail "/regions/12 가 프리렌더 파일이 아니다"; fi
for path in /regions/12110 /regions/11 /en/regions/12330 /regions/2911 /regions/290001; do
  status=$(fetch place.1989v.com "$path")
  check "$path 200(셸)" "$status" 200
  if grep -q "$SHELL_MARKER" "$WORK/body"; then pass "$path 은 SPA 셸"; else fail "$path 가 SPA 셸이 아니다"; fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "FAILED" >&2
  exit 1
fi
echo "PASSED"
