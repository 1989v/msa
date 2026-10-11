#!/usr/bin/env bash
# place 속성 랜딩(/regions/{code}/{attr})·편집 페이지(/guides)의 nginx 계약을 실제 nginx 로 확인한다.
#
# 랜딩과 편집 페이지는 프리렌더 파일이 있을 때만 200 이고, 없으면 SPA 셸 200(빈 페이지)이 아니라 404 다.
# 광주(29)·전남(46) 옛 코드의 랜딩 주소는 옛 지역 주소와 같이 통합시 허브로 301 한다.
#
#   ① 목록에 있는 랜딩(파일 있음) → 200 · 프리렌더 본문 · Cache-Control no-cache (국·영)
#   ② 목록 밖 조합 · 영문 pet · 모르는 속성 · 모르는 시군구 → 404 (SPA 셸 아님)
#   ③ 지역 페이지 /regions/11110 은 그대로 200, 옛 /regions/29110 은 그대로 301
#   ④ 옛 코드 랜딩 /regions/29110/parking · /en/regions/46230/free → 301 시도 허브(/regions/12 · /en/regions/12)
#   ⑤ /guides/x(파일 있음) 200 · /guides/none 404 · /guides(목록 파일 없음) 404
#   ⑥ 색인하지 않는 랜딩·초안(prerender/_noindex/ 아래 파일) → 200 · X-Robots-Tag "noindex, follow" (국·영·편집),
#      색인을 연 랜딩(원래 자리) → 200 · X-Robots-Tag 없음, _noindex 파일 직접 경로 → 404
#   ⑦ 같은 URL 에서 파일 위치만 바꾸면 헤더가 따라 바뀐다(원래 자리 → _noindex → 양쪽). 양쪽이면 원래 자리가 이긴다
#   ⑧ 핵심 sitemap /sitemap-places-core.xml 200
#
# 픽스처 파일 경로는 프리렌더(prerenderFile)와 같은 식이다: 색인 = prerender${pathname}.html,
# 색인 안 함 = prerender/_noindex${pathname}.html.
#
# portal-fe/nginx.conf 를 이미지와 같은 방식(템플릿 + 기동 때 resolver 치환)으로 nginx:1.27-alpine 에 올리고,
# 판정은 nginx 가 내놓은 상태·Location·헤더·본문으로 한다.
# 회귀 주입은 설정 사본을 NGINX_CONF 로 넘겨서 한다 — 예: 랜딩 location 을 지우면 ② 의 /regions/11110/foo 가
# SPA 셸 200 이 되어 빨간불, 랜딩 location 을 옛 지역 301 블록 앞으로 옮기면 ④ 가 404 로 빨간불.
# CI·훅에 걸지 않는다(사람이 태스크 검증 때 돌린다).
# 도커가 없으면 검사하지 못했다는 뜻으로 2 로 끝난다(통과로 세지 않는다).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NGINX_CONF="${NGINX_CONF:-$ROOT/nginx.conf}"
NGINX_IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"

if ! docker info >/dev/null 2>&1; then
  echo "SKIP: 도커 데몬이 없어 nginx 계약을 검사하지 못했다" >&2
  exit 2
fi

ID="landing-$$-$RANDOM"
WORK="$(mktemp -d)"
cleanup() {
  docker rm -f "$ID" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

SHELL_MARKER="SPA-SHELL-MARKER"
LANDING_MARKER="PRERENDER-LANDING-11110-PARKING"
LANDING_EN_MARKER="PRERENDER-LANDING-EN-11110-PARKING"
NOINDEX_MARKER="PRERENDER-LANDING-11110-FREE"
NOINDEX_EN_MARKER="PRERENDER-LANDING-EN-11110-FREE"
REGION_MARKER="PRERENDER-REGION-11110"
GUIDE_MARKER="PRERENDER-GUIDE-X"
DRAFT_MARKER="PRERENDER-GUIDE-DRAFT"
H="$WORK/html"

# 프리렌더 prerenderFile 과 같은 식: indexed → prerender${pathname}.html, 아니면 prerender/_noindex${pathname}.html
prerender_file() { # pathname indexed(1|0)
  if [ "$2" = 1 ]; then echo "$H/prerender$1.html"; else echo "$H/prerender/_noindex$1.html"; fi
}
place_page() { # pathname indexed marker
  local f
  f="$(prerender_file "$1" "$2")"
  mkdir -p "$(dirname "$f")"
  echo "<html><body>$3</body></html>" >"$f"
}

mkdir -p "$H/seo/place.1989v.com"
echo "<html><body>$SHELL_MARKER</body></html>" >"$H/index.html"
place_page /regions/11110/parking 1 "$LANDING_MARKER"
place_page /en/regions/11110/parking 1 "$LANDING_EN_MARKER"
place_page /regions/11110/free 0 "$NOINDEX_MARKER"
place_page /en/regions/11110/free 0 "$NOINDEX_EN_MARKER"
place_page /regions/11110 1 "$REGION_MARKER"
place_page /guides/x 1 "$GUIDE_MARKER"
place_page /guides/draft-x 0 "$DRAFT_MARKER"
echo '<?xml version="1.0" encoding="UTF-8"?><urlset/>' >"$H/seo/place.1989v.com/sitemap-places-core.xml"
cp "$NGINX_CONF" "$WORK/default.conf.template"
chmod -R a+rwX "$WORK"

docker run -d --name "$ID" -p 127.0.0.1::80 \
  -e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 -e NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS \
  -v "$WORK/default.conf.template:/etc/nginx/templates/default.conf.template:ro" \
  -v "$H:/usr/share/nginx/html:ro" "$NGINX_IMAGE" >/dev/null

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
header() { grep -i "^$1:" "$WORK/headers" | sed 's/^[^:]*:[[:space:]]*//' | tr -d '\r'; }
body_has() { grep -q "$1" "$WORK/body"; }

serves() { # path marker
  check "$1 200" "$(fetch place.1989v.com "$1")" 200
  if body_has "$2"; then pass "$1 은 프리렌더 파일"; else fail "$1 가 프리렌더 파일이 아니다"; fi
}
missing() { # path
  check "$1 404" "$(fetch place.1989v.com "$1")" 404
  if body_has "$SHELL_MARKER"; then fail "$1 가 SPA 셸을 낸다"; else pass "$1 은 SPA 셸이 아니다"; fi
}
redirects() { # path expected-location
  check "$1 → 301" "$(fetch place.1989v.com "$1")" 301
  check "$1 → Location" "$(header location)" "$2"
}

echo "nginx place 속성 랜딩·편집 페이지 계약 — $(basename "$NGINX_CONF")"

echo "① 목록에 있는 랜딩"
serves /regions/11110/parking "$LANDING_MARKER"
check "/regions/11110/parking Cache-Control" "$(header cache-control)" "no-cache, must-revalidate"
serves /en/regions/11110/parking "$LANDING_EN_MARKER"

echo "② 파일 없는 조합은 404"
missing /regions/11110/foo
missing /en/regions/11110/pet
missing /regions/99999/parking

echo "③ 지역 페이지는 그대로"
serves /regions/11110 "$REGION_MARKER"
redirects /regions/29110 https://place.1989v.com/regions/12

echo "④ 옛 코드 랜딩은 시도 허브로"
redirects /regions/29110/parking https://place.1989v.com/regions/12
redirects /en/regions/46230/free https://place.1989v.com/en/regions/12

echo "⑤ 편집 페이지"
serves /guides/x "$GUIDE_MARKER"
missing /guides/none
missing /guides

noindexed() { # path marker — 200 · 프리렌더 본문 · noindex 헤더 · Cache-Control
  serves "$1" "$2"
  check "$1 X-Robots-Tag" "$(header x-robots-tag)" "noindex, follow"
  check "$1 Cache-Control" "$(header cache-control)" "no-cache, must-revalidate"
}
indexed() { # path marker — 200 · 프리렌더 본문 · X-Robots-Tag 없음
  serves "$1" "$2"
  check "$1 X-Robots-Tag 없음" "$(header x-robots-tag)" ""
}

echo "⑥ 색인 안 하는 랜딩·초안은 헤더로도 noindex"
indexed /regions/11110/parking "$LANDING_MARKER"
indexed /en/regions/11110/parking "$LANDING_EN_MARKER"
indexed /guides/x "$GUIDE_MARKER"
noindexed /regions/11110/free "$NOINDEX_MARKER"
noindexed /en/regions/11110/free "$NOINDEX_EN_MARKER"
noindexed /guides/draft-x "$DRAFT_MARKER"
check "/prerender/_noindex/regions/11110/free.html 직접 경로 404" \
  "$(fetch place.1989v.com /prerender/_noindex/regions/11110/free.html)" 404
if body_has "$NOINDEX_MARKER"; then fail "_noindex 파일이 직접 경로로 나간다"; else pass "_noindex 파일은 직접 경로로 나가지 않는다"; fi
check "/prerender/_noindex/guides/draft-x.html 직접 경로 404" \
  "$(fetch place.1989v.com /prerender/_noindex/guides/draft-x.html)" 404

echo "⑦ 같은 URL — 파일 위치만 바꾸면 헤더가 따라 바뀐다"
SWAP=/regions/11140/swap
SWAP_ON="$(prerender_file "$SWAP" 1)"
SWAP_OFF="$(prerender_file "$SWAP" 0)"
place_page "$SWAP" 1 "SWAP-INDEXED"
indexed "$SWAP" "SWAP-INDEXED"
rm -f "$SWAP_ON"
place_page "$SWAP" 0 "SWAP-NOINDEX"
noindexed "$SWAP" "SWAP-NOINDEX"
place_page "$SWAP" 1 "SWAP-INDEXED"
# 양쪽에 다 있으면 원래 자리가 이긴다(헤더 없음)
indexed "$SWAP" "SWAP-INDEXED"
rm -f "$SWAP_ON" "$SWAP_OFF"
missing "$SWAP"

echo "⑧ 핵심 sitemap"
check "/sitemap-places-core.xml 200" "$(fetch place.1989v.com /sitemap-places-core.xml)" 200

if [ "$FAIL" -ne 0 ]; then
  echo "FAILED" >&2
  exit 1
fi
echo "PASSED"
