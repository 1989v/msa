#!/usr/bin/env bash
# install-hooks.sh — repo 의 .githooks/ 디렉토리를 git hooks 경로로 활성화.
#
# Why: .git/hooks/ 는 추적되지 않아 다른 개발자/CI 가 공유 불가.
# .githooks/ 는 추적되며 core.hooksPath 로 활성화하면 모든 환경에서 동일하게 작동.
#
# Usage: scripts/install-hooks.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"
chmod +x .githooks/* 2>/dev/null || true
git config core.hooksPath .githooks
echo "✅ git hooks 활성화: core.hooksPath = .githooks"
ls -la .githooks/ | tail -n +2
