#!/usr/bin/env bash
# PostToolUse(Write|Edit): 바뀐 파일 하나만 린트한다. PostToolUse 는 차단할 수 없으므로 결과는 컨텍스트로만.
#   HNS_LINT_CMD 에 {file} 자리표시자. 비어 있으면 아무것도 안 함.
#   HNS_LINT_GLOB: 공백 구분 basename 패턴 (기본 "*.kt *.ts *.tsx *.js *.py")
set -u
. "$(dirname "$0")/_lib.sh"
hns_input
file=$(hns_field tool_input.file_path)
[ -z "$file" ] && exit 0

tier=$(hns_cfg HNS_HOOK_TIER reminder)
lint=$(hns_cfg HNS_LINT_CMD "")
[ "$tier" = "reminder" ] && exit 0
[ -z "$lint" ] && exit 0

globs=$(hns_cfg HNS_LINT_GLOB "*.kt *.ts *.tsx *.js *.py")
base=$(basename "$file"); match=0
for g in $globs; do case "$base" in $g) match=1 ;; esac; done
[ $match -eq 0 ] && exit 0

out=$(cd "$HNS_PROJECT" && bash -c "${lint//\{file\}/$file}" 2>&1)
rc=$?
[ $rc -eq 0 ] && exit 0
printf '린트 실패 (exit %s): %s\n%s' "$rc" "$file" "$(printf '%s\n' "$out" | tail -20)" | hns_emit PostToolUse additionalContext
exit 0
