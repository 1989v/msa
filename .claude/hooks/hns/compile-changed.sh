#!/usr/bin/env bash
# 커밋 전 컴파일 (msa 모노레포용 HNS_COMPILE_CMD).
# 바뀐 파일이 속한 Gradle 모듈만 compileKotlin + compileTestKotlin, portal-fe 의 ts/tsx 는 `npx tsc -b`.
# 근거: docs/standards/agent-behavior.md — 시그니처 변경은 compileTestKotlin 이 잡고, FE 는 tsc -b 만 검사한다.
# HNS_FILES 로 파일 목록을 주면 그것만 본다(테스트용). HNS_DRY_RUN=1 이면 실행할 태스크만 출력한다.
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT" || exit 0
files="${HNS_FILES:-$( { git diff --cached --name-only; git diff --name-only; } | sort -u )}"
[ -z "$files" ] && exit 0
tasks=""
for f in $files; do
  case "$f" in
    *.kt|*.kts)
      d=$(dirname "$f")
      while [ "$d" != "." ] && [ ! -f "$d/build.gradle.kts" ]; do d=$(dirname "$d"); done
      [ "$d" = "." ] && continue
      [ -d "$d/src" ] || continue          # 집계 모듈(src 없음)에는 compileKotlin 태스크가 없다
      m=":$(printf '%s' "$d" | tr '/' ':')"
      case " $tasks " in *" $m:compileKotlin "*) ;; *) tasks="$tasks $m:compileKotlin $m:compileTestKotlin" ;; esac ;;
  esac
done
fe=0; printf '%s\n' "$files" | grep -Eq '^portal-fe/.*\.(ts|tsx)$' && fe=1
if [ "${HNS_DRY_RUN:-}" = "1" ]; then echo "gradle:${tasks:- (none)}"; echo "portal-fe tsc -b: $fe"; exit 0; fi
rc=0
[ -n "$tasks" ] && { ./gradlew -q $tasks || rc=$?; }
[ $fe -eq 1 ] && { (cd portal-fe && npx tsc -b) || rc=$?; }
exit $rc
