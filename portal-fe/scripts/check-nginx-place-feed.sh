#!/usr/bin/env bash
# place 최근 갱신 피드(RSS)의 nginx 계약을 실제 nginx 로 확인한다.
#
# portal-fe/nginx.conf 를 이미지와 같은 방식(템플릿 + 기동 때 resolver 치환)으로 nginx:1.27-alpine 에 올리고,
# search 자리에는 요청을 기록하는 스텁을 같은 이름(search.commerce.svc.cluster.local:8083)으로 세운다.
# 스텁은 search 처럼 성공에 `Cache-Control: public, max-age=600`, 503 에 `no-store` 를 단다.
# 판정은 전부 nginx 가 내놓은 응답(상태·헤더·본문)과 스텁이 실제로 받은 요청으로 한다.
#
#   ① place 호스트 /feed.xml · /en/feed.xml → 각 언어 스텁 본문 200 · Cache-Control 한 벌 · 쿼리 없는 고정 경로
#   ② Cookie·Authorization 은 스텁에 닿지 않는다
#   ③ apex·blog 호스트 → 404, 스텁 호출 없음
#   ④ 스텁 503 → 503 그대로(SPA 셸 200 아님) · Cache-Control 은 no-store 한 벌
#   ⑤ 스텁이 죽어 있으면 5xx 그대로(SPA 셸 200 아님)
#
# 회귀 주입은 설정 사본을 NGINX_CONF 로 넘겨서 한다 — 예: 피드 location 에 add_header Cache-Control 을 더하면 ① 이 빨간불.
# 도커가 없으면 검사하지 못했다는 뜻으로 2 로 끝난다(통과로 세지 않는다).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONF="${NGINX_CONF:-$ROOT/nginx.conf}"
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"
STUB_IMAGE="${STUB_IMAGE:-python:3.11-slim}"

if ! docker info >/dev/null 2>&1; then
  echo "SKIP: 도커 데몬이 없어 nginx 계약을 검사하지 못했다" >&2
  exit 2
fi

ID="feed-$$-$RANDOM"
WORK="$(mktemp -d)"
cleanup() {
  docker rm -f "$ID-nginx" "$ID-stub" >/dev/null 2>&1 || true
  docker network rm "$ID" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

SHELL_MARKER="SPA-SHELL-MARKER"
mkdir -p "$WORK/html" "$WORK/stub"
echo "<html><body>$SHELL_MARKER</body></html>" >"$WORK/html/index.html"
cp "$NGINX_CONF" "$WORK/default.conf.template"
echo 200 >"$WORK/stub/mode"
: >"$WORK/stub/requests.jsonl"
chmod -R a+rwX "$WORK"

cat >"$WORK/stub/server.py" <<'PY'
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        with open("/stub/requests.jsonl", "a") as f:
            f.write(json.dumps({"path": self.path, "headers": {k.lower(): v for k, v in self.headers.items()}}) + "\n")
        mode = open("/stub/mode").read().strip()
        if mode == "503":
            body = b"feed unavailable"
            self.send_response(503)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Cache-Control", "no-store")
        else:
            lang = self.path.rsplit("/", 1)[-1].split(".")[0]
            body = ('<?xml version="1.0"?><rss version="2.0"><channel>STUB-FEED-%s</channel></rss>' % lang).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/rss+xml;charset=UTF-8")
            self.send_header("Cache-Control", "public, max-age=600")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass

HTTPServer(("0.0.0.0", 8083), Handler).serve_forever()
PY

docker network create "$ID" >/dev/null
docker run -d --name "$ID-stub" --network "$ID" --network-alias search.commerce.svc.cluster.local \
  -v "$WORK/stub:/stub" "$STUB_IMAGE" python /stub/server.py >/dev/null
docker run -d --name "$ID-nginx" --network "$ID" -p 127.0.0.1::80 \
  -e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 -e NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS \
  -v "$WORK/default.conf.template:/etc/nginx/templates/default.conf.template:ro" \
  -v "$WORK/html:/usr/share/nginx/html:ro" "$NGINX_IMAGE" >/dev/null

PORT="$(docker port "$ID-nginx" 80/tcp | head -1 | sed 's/.*://')"
BASE="http://127.0.0.1:$PORT"
for _ in $(seq 1 50); do
  curl -s -o /dev/null "$BASE/" && break
  sleep 0.2
done
for _ in $(seq 1 50); do
  docker exec "$ID-stub" python -c "import socket; socket.create_connection(('127.0.0.1', 8083), 1)" 2>/dev/null && break
  sleep 0.2
done

FAIL=0
pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1" >&2; FAIL=1; }
check() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 — 기대 [$3] 실제 [$2]"; fi; }

# 응답을 헤더·본문 파일로 받는다. 상태 코드만 돌려준다.
fetch() { # host path [extra curl args...]
  local host="$1" path="$2"; shift 2
  curl -s -o "$WORK/body" -D "$WORK/headers" -w '%{http_code}' -H "Host: $host" "$@" "$BASE$path"
}
header_values() { grep -i "^$1:" "$WORK/headers" | sed 's/^[^:]*:[[:space:]]*//' | tr -d '\r'; }
stub_count() { wc -l <"$WORK/stub/requests.jsonl" | tr -d ' '; }
last_request() { tail -1 "$WORK/stub/requests.jsonl"; }
req_field() { python3 -c 'import json,sys; r=json.loads(sys.argv[1]); print(eval(sys.argv[2]))' "$1" "$2"; }

echo "nginx place 피드 계약 — $(basename "$NGINX_CONF")"

for pair in "/feed.xml ko" "/en/feed.xml en"; do
  path="${pair% *}"; lang="${pair#* }"
  echo "① place 호스트 $path"
  before=$(stub_count)
  status=$(fetch place.1989v.com "$path?page=2&x=%2e%2e" \
    -H 'Cookie: access_token=SECRET-COOKIE' -H 'Authorization: Bearer SECRET-AUTH')
  check "상태 200" "$status" 200
  if grep -q "STUB-FEED-$lang" "$WORK/body"; then pass "본문은 search(스텁)의 $lang 피드"; else fail "본문이 스텁 $lang 피드가 아니다: $(head -c 120 "$WORK/body")"; fi
  check "Cache-Control 한 벌" "$(header_values Cache-Control | paste -sd'|' -)" "public, max-age=600"
  check "스텁 호출 1회" "$(( $(stub_count) - before ))" 1
  req=$(last_request)
  check "upstream 경로는 쿼리 없는 고정 문자열" "$(req_field "$req" 'r["path"]')" "/internal/render/feed/$lang.xml"

  echo "② 쿠키·인증 헤더 ($path)"
  check "Cookie 미전달" "$(req_field "$req" '"cookie" in r["headers"]')" False
  check "Authorization 미전달" "$(req_field "$req" '"authorization" in r["headers"]')" False
done
if grep -q "SECRET-" "$WORK/stub/requests.jsonl"; then fail "스텁 기록에 토큰 값이 있다"; else pass "스텁 기록에 토큰 값 없음"; fi

echo "③ 다른 호스트"
before=$(stub_count)
for path in /feed.xml /en/feed.xml; do
  check "apex $path 404" "$(fetch 1989v.com "$path")" 404
  check "blog $path 404" "$(fetch blog.1989v.com "$path")" 404
done
check "스텁 호출 없음" "$(( $(stub_count) - before ))" 0

echo "④ search 503"
echo 503 >"$WORK/stub/mode"
for path in /feed.xml /en/feed.xml; do
  status=$(fetch place.1989v.com "$path")
  check "$path 상태 503 그대로" "$status" 503
  if grep -q "$SHELL_MARKER" "$WORK/body"; then fail "$path SPA 셸이 나갔다"; else pass "$path SPA 셸 아님"; fi
  check "$path 성공용 캐시 헤더 없음(search 의 no-store 한 벌)" "$(header_values Cache-Control | paste -sd'|' -)" "no-store"
done
echo 200 >"$WORK/stub/mode"

echo "⑤ search 중단"
docker stop -t 0 "$ID-stub" >/dev/null
status=$(fetch place.1989v.com /feed.xml)
if [ "$status" = 502 ] || [ "$status" = 504 ]; then pass "상태 $status 그대로"; else fail "상태 5xx 기대, 실제 $status"; fi
if grep -q "$SHELL_MARKER" "$WORK/body"; then fail "SPA 셸이 나갔다"; else pass "SPA 셸 아님"; fi

if [ "$FAIL" -ne 0 ]; then
  echo "FAILED" >&2
  exit 1
fi
echo "PASSED"
