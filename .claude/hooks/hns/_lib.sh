#!/usr/bin/env bash
# hns 훅 공용 함수. 각 스크립트가 `. "$(dirname "$0")/_lib.sh"` 로 읽는다.
# 설정 우선순위: 환경변수 > .claude/hns-hooks.env > 기본값.
HNS_PROJECT="${CLAUDE_PROJECT_DIR:-$PWD}"
HNS_ENV_FILE="$HNS_PROJECT/.claude/hns-hooks.env"

hns_cfg() { # hns_cfg NAME DEFAULT
  local v
  eval "v=\${$1:-}"
  if [ -z "$v" ] && [ -f "$HNS_ENV_FILE" ]; then
    v=$(sed -n "s/^$1=//p" "$HNS_ENV_FILE" | head -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  fi
  printf '%s' "${v:-$2}"
}

hns_input() { # stdin JSON 을 변수에 담아 둔다
  HNS_INPUT=$(cat)
}

hns_field() { # hns_field 'a.b.c' → 값 (없으면 빈 문자열)
  printf '%s' "$HNS_INPUT" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit(0)
for k in sys.argv[1].split("."):
    d = d.get(k, "") if isinstance(d, dict) else ""
print(d if isinstance(d, str) else json.dumps(d, ensure_ascii=False))
' "$1"
}

hns_emit() { # hns_emit EVENT KEY TEXT  → {"hookSpecificOutput":{"hookEventName":EVENT, KEY:TEXT}}
  python3 -c '
import json, sys
ev, key, text = sys.argv[1], sys.argv[2], sys.stdin.read()
print(json.dumps({"hookSpecificOutput": {"hookEventName": ev, key: text}}, ensure_ascii=False))
' "$1" "$2"
}

hns_deny() { # hns_deny REASON  (PreToolUse 전용)
  python3 -c '
import json, sys
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse",
  "permissionDecision": "deny", "permissionDecisionReason": sys.stdin.read()}}, ensure_ascii=False))
'
}
