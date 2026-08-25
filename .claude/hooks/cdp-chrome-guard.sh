#!/bin/bash
# PreToolUse hook: 헤드리스 크롬을 **손으로** 띄우거나 죽이려 할 때 붙잡는다.
#
# 2026-08-25 실측: 표준에 "독립 프로필 · 끝나면 정리" 가 적혀 있는데도 한 세션이
# 프로필 9개 · 크롬 67 프로세스 · 4.5GB 를 쌓았고, 정리하다 pkill 범위를 잘못 잡아
# **작업 중이던 크롬까지 죽였다.** 그 뒤 사용자 크롬이 안 떠서 진단이 한 바퀴 헛돌았다.
#
# adr-check.sh 와 같은 방식으로 **막지 않고 알린다** — 판단은 에이전트가 한다.
# (막아 버리면 정당한 예외까지 못 하게 되고, 그러면 훅을 꺼 버린다)

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
[ -z "$CMD" ] && exit 0

RISK=""
HINT=""

# 1) 헤드리스 크롬 직접 기동
if echo "$CMD" | grep -qE 'Google Chrome.*--headless|--remote-debugging-port'; then
  if ! echo "$CMD" | grep -q 'cdp-chrome.sh'; then
    RISK="헤드리스 크롬을 직접 띄우려 한다"
    HINT="scripts/cdp-chrome.sh start <이름> 을 써라 — 포트가 이름에서 결정되어 중복 기동이 막히고, 프로필이 세션 스크래치패드 아래로 고정된다"
  fi
fi

# 2) 크롬을 죽이는 명령 — 범위가 넓으면 남의 것·사용자 크롬까지 간다
if echo "$CMD" | grep -qE 'pkill.*[Cc]hrome|killall.*[Cc]hrome'; then
  RISK="크롬을 종료하려 한다"
  HINT="scripts/cdp-chrome.sh clean 을 써라 — 자기 세션 프로필만 죽인다. 손으로 pkill 하면 범위를 잘못 잡아 작업 중인 크롬이나 사용자 크롬까지 죽인다(2026-08-25 실제 발생)"
elif echo "$CMD" | grep -qE 'pkill.*user-data-dir|pkill.*remote-debugging'; then
  if ! echo "$CMD" | grep -q 'cdp-chrome.sh'; then
    RISK="프로필 경로로 크롬을 죽이려 한다"
    HINT="scripts/cdp-chrome.sh stop <이름> / clean 을 써라 — 경로 검증(이름에 / .. 금지 + realpath)이 붙어 있어 자기 세션 밖은 못 죽인다"
  fi
fi

# 3) MCP 프로필 락 건드리기 — 표준이 명시로 금지한 것
if echo "$CMD" | grep -qE 'chrome-devtools-mcp.*(Singleton|rm )|rm.*Singleton'; then
  RISK="크롬 프로필 락 파일을 지우려 한다"
  HINT="지우지 마라 — 크롬이 프로필을 비정상 종료로 판단해 '프로필을 여는 동안 문제가 발생했습니다' 알럿을 계속 띄운다. 막혔으면 락을 지우지 말고 독립 프로필로 갈아타라 (docs/standards/fe-visual-verification.md §1)"
fi

[ -z "$RISK" ] && exit 0

jq -n --arg risk "$RISK" --arg hint "$HINT" '
{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    additionalContext: (
      "[CDP 크롬 가드] \($risk).\n\n\($hint)\n\n" +
      "규칙 원본: docs/standards/fe-visual-verification.md §6.\n" +
      "사용자 크롬(기본 프로필)과 MCP 프로필은 어떤 경우에도 종료하지 않는다 — " +
      "그 둘이 죽으면 사용자가 브라우저를 못 쓴다."
    )
  }
}'
