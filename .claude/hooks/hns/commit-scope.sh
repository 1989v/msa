#!/usr/bin/env bash
# PreToolUse(Bash, if: Bash(git commit *)): 커밋에 실제로 담기는 범위를 드러내고,
# 증명 가능한 사고 하나 — 스테이지된 서브모듈 포인터가 체크아웃과 다른 것 — 만 막는다.
#   tier=reminder → 아무것도 안 함
#   tier=feedback → 요약·경고를 컨텍스트로 알림 (차단 없음)
#   tier=enforce  → 서브모듈 포인터 불일치면 차단, 나머지는 알림
# 왜: `git add -A` 는 리베이스 뒤 뒤처진 서브모듈 워킹트리의 옛 포인터를 되담고,
#     빌드산출물·에디터 설정·자격증명까지 함께 쓸어담는다. 커밋 메시지는 그 사실을 말하지 않는다.
# 경계: "이번 작업과 무관한 변경"은 기계가 판정할 수 없다 → 차단하지 않고 **드러내기만** 한다.
set -u
. "$(dirname "$0")/_lib.sh"
hns_input
cmd=$(hns_field tool_input.command)
case "$cmd" in *"git commit"*) ;; *) exit 0 ;; esac

tier=$(hns_cfg HNS_HOOK_TIER reminder)
[ "$tier" = "reminder" ] && exit 0

cd "$HNS_PROJECT" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')

# 플래그 판정에서 따옴표 안(커밋 메시지)은 뺀다 — `-m "fix -a handling"` 이 -a 로 읽히지 않게
cmd_flags=$(printf '%s' "$cmd" | sed "s/'[^']*'//g; s/\"[^\"]*\"//g")
all_flag=0
printf '%s' "$cmd_flags" | grep -Eq '(^|[[:space:]])-[A-Za-z]*a[A-Za-z]*([[:space:]]|$)|--all' && all_flag=1

# 담길 게 없으면 조용히 — `-a` 는 커밋 시점에 스테이지하므로 예외
[ "$staged" = "0" ] && [ "$all_flag" = "0" ] && exit 0

notes=""; blockers=""

# 1) 스테이지된 서브모듈 포인터(gitlink) — HEAD 가 기록한 것보다 **뒤로 가는** 포인터를 잡는다.
#    리베이스는 서브모듈 워킹트리를 안 옮기고, 그 뒤 `git add -A` 가 옛 포인터를 되담는다.
#    이때 인덱스와 체크아웃은 서로 일치하므로 그 대조로는 안 잡힌다 — HEAD 와 비교해야 한다.
while read -r m1 m2 sha_old sha_new rest; do
  [ "${m2:-}" = "160000" ] || continue
  path=$(printf '%s' "$rest" | cut -f2-)
  [ -n "$path" ] || continue
  [ -d "$path/.git" ] || [ -f "$path/.git" ] || continue
  case "$sha_old" in *[!0]*) ;; *) continue ;; esac        # 신규 등록(0000…)은 회귀가 없다
  if [ "$sha_new" != "$sha_old" ] && git -C "$path" merge-base --is-ancestor "$sha_new" "$sha_old" >/dev/null 2>&1; then
    blockers="${blockers}  ${path}: ${sha_old:0:8} → ${sha_new:0:8} 로 되감긴다 (커밋 $(git -C "$path" rev-list --count "$sha_new..$sha_old" 2>/dev/null)개 소실)
"
  elif ! git -C "$path" merge-base --is-ancestor "$sha_new" "@{u}" >/dev/null 2>&1; then
    notes="${notes}  ${path}: 포인터 ${sha_new:0:8} 가 아직 원격에 없다 — 서브모듈을 먼저 푸시한다
"
  fi
done < <(git diff --cached --raw --abbrev=40 2>/dev/null | sed 's/^://')

# 2) 흔히 쓸려 들어가는 경로 — 표기만 (판정하지 않는다)
sus=$(git diff --cached --name-only 2>/dev/null \
  | grep -Ei '(^|/)(node_modules|build|dist|out|target|bin|\.vscode|\.idea)/|(^|/)[^/]*\.(env|pem|key|p12|keystore)$|(^|/)(id_rsa|credentials)' | head -5)
[ -n "$sus" ] && notes="${notes}  쓸려 들어갔을 수 있는 경로: $(printf '%s' "$sus" | tr '\n' ' ')
"
if [ "$all_flag" = "1" ]; then
  notes="${notes}  -a 커밋 — 스테이지 밖 수정분도 함께 담긴다. 담길 것을 먼저 확인한다
"
fi

if [ -n "$blockers" ] && [ "$tier" = "enforce" ]; then
  printf '서브모듈 포인터가 되감긴다 — 커밋 차단.\n%s그 서브모듈에서 의도한 커밋을 체크아웃(보통 `git submodule update`)한 뒤 다시 스테이지하거나, 그 경로를 unstage 한다.\n' "$blockers" | hns_deny
  exit 0
fi
[ -z "$blockers" ] && [ -z "$notes" ] && exit 0
printf '커밋 스코프 (스테이지 %s개)\n%s%s' "$staged" "$blockers" "$notes" | hns_emit PreToolUse additionalContext
exit 0
