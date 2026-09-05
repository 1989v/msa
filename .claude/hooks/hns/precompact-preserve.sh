#!/usr/bin/env bash
# PreCompact(manual|auto): 컴팩션 요약이 반드시 보존해야 할 항목을 지시한다. 차단하지 않는다.
set -u
. "$(dirname "$0")/_lib.sh"
hns_input
trigger=$(hns_field trigger)
progress=$(ls -t "$HNS_PROJECT"/docs/specs/*/context/progress.md 2>/dev/null | head -1)

{
  echo "hns 컴팩션 보존 지시 (trigger: ${trigger:-unknown})"
  echo "요약에 반드시 남길 것: (1) 진행 중 스펙 경로와 현재 task group/step (2) 이번 세션의 결정과 그 이유 (3) 열린 질문·블로커 (4) 마지막으로 실행한 검증 명령과 결과 줄 (5) 다음에 할 구체적 단계."
  if [ -n "$progress" ]; then
    echo "진행 노트 원본: ${progress#"$HNS_PROJECT"/} — 요약보다 파일이 원본이다. 최신이 아니면 컴팩션 후 첫 행동으로 갱신한다."
  else
    echo "진행 노트 파일이 없다. 컴팩션 후 첫 행동으로 docs/specs/{feature}/context/progress.md 를 만들어 위 항목을 적는다."
  fi
} | hns_emit PreCompact additionalContext
exit 0
