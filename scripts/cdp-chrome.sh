#!/bin/bash
# source: docs/standards/fe-visual-verification.md
#
# CDP 검증용 헤드리스 크롬 — **띄우기·정리를 한 곳으로 모은다.**
#
# 왜 스크립트인가 (2026-08-25 실측):
#   표준에 "독립 프로필을 쓰고 끝나면 정리한다" 가 적혀 있었는데도, 한 세션이
#   **프로필 9개 · 크롬 67 프로세스 · 4.5GB** 를 쌓았다. 문서에만 있는 절차는 지켜지지 않는다.
#   더 나쁜 건 정리하다 `pkill -9` 범위를 잘못 잡아 **작업 중이던 크롬까지 죽인 것**이고,
#   그 뒤 프로세스를 잘못 세어 "사용자 크롬은 살아 있다" 고 오판했다.
#
# 이 스크립트가 강제하는 것:
#   1. 프로필은 **세션 스크래치패드 아래**에만 만든다 — 남의 것과 섞이지 않는다
#   2. 포트는 프로필 이름에서 결정론적으로 뽑는다 — 같은 이름이면 같은 포트, 충돌하면 알린다
#   3. `stop`/`clean` 은 **자기 세션 프로필만** 건드린다 — 사용자 크롬·MCP 프로필·남의 세션은 못 건드린다
#   4. 살아 있는 것을 `list` 로 먼저 보여준다 — 죽이기 전에 무엇을 죽이는지 안다
#
# 하면 안 되는 것 (표준 §1):
#   - MCP 프로필(`~/.cache/chrome-devtools-mcp/chrome-profile`) 의 락 파일을 지우기
#   - 사용자 크롬(기본 프로필) 을 종료하기
#   이 스크립트는 둘 다 **경로로 막는다**.
#
# 사용:
#   scripts/cdp-chrome.sh start <이름>     # 띄우고 포트를 출력한다 (이미 있으면 그 포트를 준다)
#   scripts/cdp-chrome.sh port  <이름>     # 포트만
#   scripts/cdp-chrome.sh list             # 이 세션이 띄운 것 전부 (+ 남의 것은 표시만)
#   scripts/cdp-chrome.sh stop  <이름>     # 하나 종료 + 프로필 삭제
#   scripts/cdp-chrome.sh clean            # 이 세션 것 전부 종료 + 삭제
set -uo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# 세션 스크래치패드 — 없으면 만들지 않고 실패한다(엉뚱한 곳에 프로필을 만들지 않기 위해)
ROOT="${CLAUDE_SCRATCHPAD:-}"
if [ -z "$ROOT" ]; then
  ROOT=$(ls -dt /private/tmp/claude-*/*/*/scratchpad 2>/dev/null | head -1)
fi
BASE="$ROOT/cdp"

die() { echo "  ✗ $*" >&2; exit 1; }
[ -n "$ROOT" ] && [ -d "$ROOT" ] || die "스크래치패드를 못 찾았다. CLAUDE_SCRATCHPAD 를 지정하라"

# 이름 → 포트 (9400~9499). 결정론적이라 같은 이름이면 늘 같은 포트다
port_of() {
  local n=0 i
  for ((i = 0; i < ${#1}; i++)); do n=$(( (n * 31 + $(printf '%d' "'${1:$i:1}")) % 100 )); done
  echo $((9400 + n))
}

alive() { curl -s -m 2 "http://127.0.0.1:$1/json/version" >/dev/null 2>&1; }

cmd_start() {
  local name="${1:?이름이 필요하다}" port dir
  safe_name "$name"
  port=$(port_of "$name"); dir="$BASE/$name"
  if alive "$port"; then echo "$port"; return 0; fi
  # 포트가 남의 것에 잡혀 있으면 비켜 간다 — 남의 크롬을 죽이지 않는다
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    die "포트 $port 이 이미 쓰이고 있다(다른 프로세스). 이름을 바꿔서 다시 시도하라"
  fi
  mkdir -p "$dir"
  # --disable-gpu 를 절대 붙이지 않는다 — SwiftShader 로 떨어져 fps 가 10~30 이 된다(표준 실측)
  "$CHROME" --headless=new --remote-debugging-port="$port" --user-data-dir="$dir" \
            --no-first-run --no-default-browser-check --window-size=1280,900 \
            about:blank >/dev/null 2>&1 &
  local i
  for i in $(seq 1 25); do alive "$port" && { echo "$port"; return 0; }; sleep 0.4; done
  die "크롬이 뜨지 않았다 (포트 $port)"
}

cmd_port() { safe_name "${1:?이름이 필요하다}"; port_of "$1"; }

cmd_list() {
  echo "이 세션 ($BASE):"
  local found=0 d name port
  for d in "$BASE"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d"); port=$(port_of "$name"); found=1
    printf "  %-22s 포트 %s  %s  %s\n" "$name" "$port" \
      "$(alive "$port" && echo '살아있음' || echo '죽음')" "$(du -sh "$d" 2>/dev/null | cut -f1)"
  done
  [ "$found" = 0 ] && echo "  (없음)"
  echo
  echo "다른 소유자 (건드리지 않는다):"
  ps aux | grep "[r]emote-debugging-port" | grep -oE "\-\-user-data-dir=[^ ]+" | sed 's/--user-data-dir=//' \
    | grep -v "^$BASE" | sort -u | sed 's/^/  /' || true
  ps aux | grep -c "[G]oogle Chrome.app/Contents/MacOS/Google Chrome" | xargs echo "  크롬 프로세스 총계:"
}

# 이름 검증 — `../` 로 빠져나가는 것을 **이름 단계에서** 막는다.
# 경로 문자열만 보고 막으면 "$BASE/../../etc" 이 case 패턴을 통과한다(실측으로 뚫렸다).
safe_name() {
  case "$1" in
    ""|*/*|*..*) die "프로필 이름에 / 나 .. 를 쓸 수 없다: $1" ;;
  esac
}

# **자기 세션 프로필 경로로만** 죽인다. 실제 경로(realpath)로 다시 확인한다.
kill_profile() {
  local dir="$1" real
  real=$(cd "$(dirname "$dir")" 2>/dev/null && pwd -P)/$(basename "$dir")
  case "$real" in "$BASE"/*) ;; *) die "이 스크립트는 $BASE 아래만 정리한다: $real" ;; esac
  dir="$real"
  pkill -f "user-data-dir=$dir" 2>/dev/null
  sleep 1
  pkill -9 -f "user-data-dir=$dir" 2>/dev/null
  rm -rf "$dir"
}

cmd_stop()  { safe_name "${1:?이름이 필요하다}"; kill_profile "$BASE/$1"; echo "  정리: $1"; }
cmd_clean() {
  local d
  for d in "$BASE"/*/; do [ -d "$d" ] && { kill_profile "$d"; echo "  정리: $(basename "$d")"; }; done
  rmdir "$BASE" 2>/dev/null
  echo "  남은 크롬 프로세스: $(ps aux | grep -c '[G]oogle Chrome.app/Contents/MacOS/Google Chrome')"
}

case "${1:-}" in
  start) shift; cmd_start "$@" ;;
  port)  shift; cmd_port  "$@" ;;
  list)  cmd_list ;;
  stop)  shift; cmd_stop  "$@" ;;
  clean) cmd_clean ;;
  *) sed -n '1,30p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
