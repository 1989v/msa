#!/usr/bin/env bash
# SessionStart(startup|resume|compact|clear): 진행 중인 스펙이 있으면 복구 컨텍스트를 주입한다.
# 진행 노트가 없으면 아무것도 내지 않는다 (성공은 조용히).
set -u
. "$(dirname "$0")/_lib.sh"
hns_input
reason=$(hns_field start_reason); [ -z "$reason" ] && reason=$(hns_field source)

progress=$(ls -t "$HNS_PROJECT"/docs/specs/*/context/progress.md 2>/dev/null | head -1)
kb=$(hns_cfg HNS_KB_PATH ""); kb_line=""
if [ -n "$kb" ] && [ -f "$kb/wiki/index.md" ]; then
  n=$(find "$kb/wiki" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
  last=$(grep '^## \[' "$kb/wiki/log.md" 2>/dev/null | tail -1 | sed -e 's/ *→.*$//' -e 's/^## \[[^]]*\] *[^|]*| *//' | cut -c1-120)
  kb_line="지식베이스: $(basename "$kb") ($n pages, 마지막 ingest: ${last:-없음}) — 질의·기능 요청을 받으면 kb-search 를 한 번 돌리고(hns:kb, 읽기 전용) 관련 페이지가 있을 때만 읽는다"
fi
[ -z "$progress" ] && [ -z "$kb_line" ] && exit 0
if [ -z "$progress" ]; then
  printf '%s' "$kb_line" | hns_emit SessionStart additionalContext; exit 0
fi
spec_dir=$(dirname "$(dirname "$progress")")
rel=${spec_dir#"$HNS_PROJECT"/}

{
  echo "## hns 진행 상태 복구 (SessionStart: ${reason:-unknown})"
  echo "활성 스펙: $rel"
  [ -n "$kb_line" ] && echo "$kb_line"
  echo
  echo "### progress.md"
  head -60 "$progress"
  if [ -f "$spec_dir/context/key-decisions.md" ]; then
    echo; echo "### key-decisions.md (최근 항목)"
    grep -E '^### ' "$spec_dir/context/key-decisions.md" | tail -3
  fi
  if [ -f "$spec_dir/context/open-questions.yml" ]; then
    open_pre=$(awk '/category: *pre-impl/{p=1} /status: *open/{if(p){c++}} /^- /{p=0} END{print c+0}' "$spec_dir/context/open-questions.yml")
    echo; echo "열린 pre-impl 질문: $open_pre 건 (0 이 아니면 구현 전에 해소)"
  fi
  echo; echo "### 최근 커밋"
  git -C "$HNS_PROJECT" log --oneline -5 2>/dev/null || echo "(git 없음)"
  echo
  echo "시작 루틴: 위 progress 의 다음 단계부터 이어간다. 이어가기 전에 이전 작업의 빌드/테스트를 한 번 돌려 깨진 상태가 아닌지 확인한다. 완료된 task group 을 다시 구현하지 않는다."
} | hns_emit SessionStart additionalContext
exit 0
