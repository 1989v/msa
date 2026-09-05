#!/usr/bin/env bash
# PreToolUse(Bash, if: Bash(git commit *)): 커밋 전에 컴파일을 돌린다.
#   tier=reminder  → 아무것도 안 함
#   tier=feedback  → 실패해도 커밋은 진행, 결과를 컨텍스트로 알림
#   tier=enforce   → 실패 시 커밋 차단 (permissionDecision: deny)
set -u
. "$(dirname "$0")/_lib.sh"
hns_input
cmd=$(hns_field tool_input.command)
case "$cmd" in *"git commit"*) ;; *) exit 0 ;; esac

tier=$(hns_cfg HNS_HOOK_TIER reminder)
compile=$(hns_cfg HNS_COMPILE_CMD "")
[ "$tier" = "reminder" ] && exit 0
[ -z "$compile" ] && exit 0

out=$(cd "$HNS_PROJECT" && bash -c "$compile" 2>&1)
rc=$?
[ $rc -eq 0 ] && exit 0

tail_out=$(printf '%s\n' "$out" | tail -30)
if [ "$tier" = "enforce" ]; then
  printf '컴파일 실패 (exit %s) — 커밋 차단. 먼저 고친다.\n명령: %s\n%s' "$rc" "$compile" "$tail_out" | hns_deny
else
  printf '컴파일 실패 (exit %s) — 비차단 알림. 커밋 전에 고치는 것이 맞다.\n명령: %s\n%s' "$rc" "$compile" "$tail_out" | hns_emit PreToolUse additionalContext
fi
exit 0
