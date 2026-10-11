#!/bin/bash
# 사용: CLAUDE_SCRATCHPAD=<세션 스크래치패드> run.sh <이름> <driver.mjs> <출력 디렉토리> [원천 주소]
# cdp-chrome.sh start → 드라이버 → stop → list 를 한 명령으로 (fe-visual-verification.md §6)
: "${CLAUDE_SCRATCHPAD:?CLAUDE_SCRATCHPAD 를 지정하라}"
export CLAUDE_SCRATCHPAD
HERE=$(cd "$(dirname "$0")" && pwd)
CDP=$(git -C "$HERE" rev-parse --show-toplevel)/scripts/cdp-chrome.sh
NAME=$1; shift; DRV=$1; shift
PORT=$($CDP start "$NAME") || { echo "start 실패"; exit 1; }
case "$DRV" in /*) ;; *) DRV="$HERE/$DRV" ;; esac
node "$DRV" "$PORT" "$@"; RC=$?
$CDP stop "$NAME"
echo "driver rc=$RC"
$CDP list | sed -n '1,6p'
