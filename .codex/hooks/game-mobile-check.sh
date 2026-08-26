#!/bin/bash
# PostToolUse hook: 게임 산출물을 건드리면 모바일 배선을 즉시 되돌려 준다.
#
# 왜 훅인가: 게임은 정적 자산이라 빌드가 잡아주는 것이 없고, 규격이 문서에만 있으면
# 지켜지지 않는다 (실측 — 3부 한글 라벨 준수 4/48, rank.js 누락 4종이 몇 주 방치).
# adr-check.sh 와 같은 방식으로 **막지 않고 알린다** — 판단은 에이전트가 한다.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

PROJECT_ROOT="/Users/gideok-kwon/IdeaProjects/msa"
GAMES_ROOT="portal-fe/public/games"
REL_PATH="${FILE_PATH#$PROJECT_ROOT/}"

# 게임 폴더 밖이면 조용히 빠진다
case "$REL_PATH" in
  "$GAMES_ROOT"/*) ;;
  *) exit 0 ;;
esac

# lib/ · thumbs/ 는 게임이 아니라 공용 자산이다
SLUG="${REL_PATH#$GAMES_ROOT/}"
SLUG="${SLUG%%/*}"
case "$SLUG" in
  lib|thumbs|"") exit 0 ;;
esac

GAME_DIR="$PROJECT_ROOT/$GAMES_ROOT/$SLUG"
[ -f "$GAME_DIR/index.html" ] || exit 0

LINT=$(python3 "$PROJECT_ROOT/scripts/lint-game-mobile.py" "$SLUG" 2>&1)

# jq 로 문자열을 만들어 이스케이프를 맡긴다 — 린트 출력에 따옴표·개행이 섞인다
jq -n --arg slug "$SLUG" --arg lint "$LINT" '
{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: (
      "[게임 모바일 체크] \($slug) 수정 감지.\n\n" +
      "scripts/lint-game-mobile.py \($slug):\n\($lint)\n" +
      "모바일이 1순위 타겟이다 (docs/standards/game-cleanroom-pipeline.md 전역 가드레일 G5).\n" +
      "완성/통합 선언 전에 확인할 것:\n" +
      "  1. CDP 디바이스 에뮬레이션으로 세로 390x844 와 가로 844x390 을 **둘 다** 실측했는가\n" +
      "  2. 크기를 레터박스 배율 포함 CSS px 로 쟀는가 (터치 타깃 >=44 / 조작 대상 >=28 / 라벨 >=11)\n" +
      "  3. 조작 방식(네이티브 터치 / 가상패드)을 골라 근거를 문서에 남겼는가\n" +
      "  4. 정보 패널이 접히고, 가리는 면적이 세로에서 25% 이하인가\n" +
      "  5. 최대 축소에서 맵 전모(또는 구조)가 읽히는가 — 아니면 미니맵이 그 역할을 하는가\n" +
      "통합 시에는 --strict 로 돌려 경고까지 없앤다."
    )
  }
}'
