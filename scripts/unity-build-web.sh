#!/usr/bin/env bash
# source: docs/standards/unity-game-pipeline.md
#
# Unity WebGL 게임을 굽고 서빙 폴더에 넣는다.
#
#   scripts/unity-build-web.sh <slug> [--skip-font]
#
# 산출물은 portal-fe/public/games/<slug>/ 다. 게임이 ../lib/*.js 를 상대경로로 싣기 때문에
# 다른 곳에 구우면 랭킹·세이브·가상패드가 전부 죽는다 — 경로를 옮기지 마라.
#
# CI 에서 돌리지 않는다. Unity 라이선스 활성화를 GitHub Actions 에 넣으면 시크릿·좌석 관리가
# 붙고, 실패하면 images.yml 테스트 게이트처럼 그 커밋의 다른 서비스 이미지까지 막는다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"
[ -n "$SLUG" ] || { echo "사용법: scripts/unity-build-web.sh <slug> [--skip-font]"; exit 2; }
shift || true

PROJECT="$ROOT/unity/games/$SLUG"
OUTPUT="$ROOT/portal-fe/public/games/$SLUG"
EDITOR="$(ls -d /Applications/Unity/Hub/Editor/*/Unity.app/Contents/MacOS/Unity 2>/dev/null | sort | tail -1)"
LOGDIR="$PROJECT/Logs"

[ -d "$PROJECT" ] || { echo "프로젝트가 없다: $PROJECT"; exit 1; }
[ -x "$EDITOR" ] || { echo "Unity Editor 를 못 찾았다 — Unity Hub 로 설치하라"; exit 1; }
mkdir -p "$LOGDIR"

run_method() {  # run_method <메서드> <로그이름>
  echo "▸ $1"
  if ! "$EDITOR" -batchmode -nographics -projectPath "$PROJECT" \
       -executeMethod "$1" -quit -logFile "$LOGDIR/$2.log"; then
    echo "실패 — $LOGDIR/$2.log"
    grep -iE "error|exception" "$LOGDIR/$2.log" | head -20 || true
    exit 1
  fi
}

if [ "${1:-}" != "--skip-font" ]; then
  # 문자열을 새로 쓰면 그 글자는 아틀라스에 없다 — 빌드 전에 항상 다시 굽는다.
  run_method Kgd.Editor.FontBake.Bake font-bake
fi

echo "▸ WebGL 빌드 → $OUTPUT"
UNITY_CLI="$HOME/.unity/bin/unity"
if [ -x "$UNITY_CLI" ]; then
  "$UNITY_CLI" --no-banner --non-interactive build "$PROJECT" \
    --target WebGL --execute-method Kgd.Editor.WebBuild.Build \
    -o "$OUTPUT" --log-file "$LOGDIR/build.log"
else
  "$EDITOR" -batchmode -nographics -projectPath "$PROJECT" -buildTarget WebGL \
    -executeMethod Kgd.Editor.WebBuild.Build -buildOutput "$OUTPUT" \
    -quit -logFile "$LOGDIR/build.log"
fi

echo
echo "── 전송량 (게임 하나 상한 15MB) ──"
du -sh "$OUTPUT"
find "$OUTPUT/Build" -type f -exec ls -l {} + | awk '{ s+=$5; printf "  %8.2f MB  %s\n", $5/1048576, $NF } END { printf "  ─────────\n  %8.2f MB  Build 합계\n", s/1048576 }'

echo
echo "── 정적 검사 ──"
python3 "$ROOT/scripts/lint-game-mobile.py" "$SLUG" --strict
