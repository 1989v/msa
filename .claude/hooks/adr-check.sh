#!/bin/bash
# PreToolUse hook: Lightweight architecture file detector
# Only checks if the file is architecture-sensitive, then injects ADR file list.
# The AI agent decides which ADRs to read and whether the change conflicts.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

PROJECT_ROOT="/Users/gideok-kwon/IdeaProjects/msa"
ADR_DIR="$PROJECT_ROOT/docs/adr"
REL_PATH="${FILE_PATH#$PROJECT_ROOT/}"

# Architecture-sensitive patterns
ARCH_PATTERNS=(
  "settings.gradle"
  "build.gradle"
  "docker-compose"
  "Dockerfile"
  "gateway/src/"
  "discovery/src/"
  "common/src/"
  "docker/backup/"
  "docker/ha/"
)

IS_ARCH=false
for pattern in "${ARCH_PATTERNS[@]}"; do
  if [[ "$REL_PATH" == *"$pattern"* ]]; then
    IS_ARCH=true
    break
  fi
done

if [ "$IS_ARCH" = false ]; then
  exit 0
fi

# Collect ADR titles (filename + first line only)
ADR_INDEX=""
for adr_file in "$ADR_DIR"/ADR-*.md; do
  [ -f "$adr_file" ] || continue
  name=$(basename "$adr_file" .md)
  title=$(head -1 "$adr_file" | sed 's/^# //')
  ADR_INDEX="${ADR_INDEX}  - ${name}: ${title}\n"
done

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "[ADR CHECK] 아키텍처 관련 파일 수정 감지: ${REL_PATH}\n\nCLAUDE.md 규칙: 구조 변경 시 ADR 필수, ADR 검토 후 구현, 충돌 시 중단 후 확인 요청.\n\n기존 ADR 목록:\n$(echo -e "$ADR_INDEX")\n이 수정과 관련될 수 있는 ADR을 Read 도구로 읽고 Decision 섹션을 확인하세요. 충돌이 있으면 수정을 중단하고 사용자에게 확인을 요청하세요. 관련 ADR이 없다면 사용자에게 ADR 작성 필요 여부를 확인하세요."
  }
}
EOF
