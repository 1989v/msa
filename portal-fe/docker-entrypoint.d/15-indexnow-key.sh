#!/bin/sh
# IndexNow 키 파일 — INDEXNOW_KEY 가 32자 소문자 hex 일 때만 place 호스트 /{key}.txt 를 여는 nginx 조각을 쓴다.
#
# nginx.conf 본문에 ${INDEXNOW_KEY} 를 두지 않는 이유: envsubst 는 정의된 변수만 치환해서, 키가 없으면
# 그 자리가 nginx 변수로 남아 기동이 실패하고 모든 호스트가 내려간다. 그래서 키가 맞을 때만 조각 파일을 쓰고
# nginx.conf 는 하위 디렉터리를 글롭으로 include 한다(0건이어도 오류 아님).
#
# 조각은 conf.d/ 바로 아래가 아니라 indexnow/ 에 둔다 — conf.d/*.conf 는 http 블록이 읽어 location 이
# server 밖에 놓이고 기동이 실패한다.
#
# 검사는 값 전체를 본다: 길이 32 + 허용 밖 문자 하나라도 있으면 거부. 줄 단위 grep 은 여러 줄 값의 첫 줄만
# 맞춰 보고 통과시키므로 쓰지 않는다(둘째 줄부터가 nginx 설정으로 들어간다). 키 값은 로그에 찍지 않는다.
set -eu

ME=$(basename "$0")
DIR=/etc/nginx/conf.d/indexnow
OUT="$DIR/indexnow.conf"

mkdir -p "$DIR"
rm -f "$OUT"

k="${INDEXNOW_KEY:-}"
if [ -z "$k" ]; then
    echo "$ME: INDEXNOW_KEY 없음 — 키 파일 없이 기동"
    exit 0
fi
valid=1
[ "${#k}" -eq 32 ] || valid=0
case "$k" in
    *[!0-9a-f]*) valid=0 ;;
esac
if [ "$valid" -ne 1 ]; then
    echo "$ME: 경고 — INDEXNOW_KEY 가 32자 소문자 hex 가 아니다(길이 ${#k}) — 키 파일 없이 기동"
    exit 0
fi

cat >"$OUT" <<EOF
location = /$k.txt {
    if (\$host != "place.1989v.com") {
        return 404;
    }
    default_type text/plain;
    add_header Cache-Control "public, max-age=300";
    return 200 "$k";
}
EOF
echo "$ME: IndexNow 키 파일 조각을 썼다"
