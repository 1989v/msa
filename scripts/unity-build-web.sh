#!/usr/bin/env bash
# source: docs/standards/unity-game-pipeline.md
#
# Unity WebGL 게임을 굽고 서빙 폴더에 넣는다.
#
#   scripts/unity-build-web.sh <slug> [--skip-font]
#
# 원본은 portal-fe/public/games/_src/<slug>/, 산출물은 portal-fe/public/games/<slug>/ 다.
# 캔버스 게임과 같은 레포에 두되 폴더는 갈린다.
#
# **원본을 산출물 폴더 안에 두면 안 된다.** 유니티는 빌드할 때 출력 폴더를 통째로 비우므로,
# 그 안에 프로젝트가 있으면 첫 빌드에서 Assets 째로 지워진다 (2026-08-28 실제로 날렸다).
# 산출물 폴더가 프로젝트의 상위여도 유니티가 거부한다(SIGABRT).
#
# 게임이 ../lib/*.js 를 상대경로로 싣기 때문에 다른 곳에 구우면 랭킹·세이브·가상패드가 전부 죽는다.
# _src 는 .dockerignore 로 이미지에서 빠지므로 서비스에는 산출물만 나간다.
#
# CI 에서 돌리지 않는다. Unity 라이선스 활성화를 GitHub Actions 에 넣으면 시크릿·좌석 관리가
# 붙고, 실패하면 images.yml 테스트 게이트처럼 그 커밋의 다른 서비스 이미지까지 막는다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-}"
[ -n "$SLUG" ] || { echo "사용법: scripts/unity-build-web.sh <slug> [--skip-font]"; exit 2; }
shift || true

PROJECT="$ROOT/portal-fe/public/games/_src/$SLUG"
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

# 산출물 폴더가 프로젝트 폴더의 **상위**라 유니티에 그대로 넘기면 거부한다 —
# 출력 안에 프로젝트가 들어가는 모양이 되기 때문이다(SIGABRT). 임시 폴더에 굽고 옮긴다.
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/kgd-unity-XXXXXX")/$SLUG"
trap 'rm -rf "$(dirname "$STAGE")"' EXIT

echo "▸ WebGL 빌드 → $OUTPUT"
UNITY_CLI="$HOME/.unity/bin/unity"
if [ -x "$UNITY_CLI" ]; then
  "$UNITY_CLI" --no-banner --non-interactive build "$PROJECT" \
    --target WebGL --execute-method Kgd.Editor.WebBuild.Build \
    -o "$STAGE" --log-file "$LOGDIR/build.log"
else
  "$EDITOR" -batchmode -nographics -projectPath "$PROJECT" -buildTarget WebGL \
    -executeMethod Kgd.Editor.WebBuild.Build -buildOutput "$STAGE" \
    -quit -logFile "$LOGDIR/build.log"
fi

# 산출물만 게임 폴더로 옮긴다. 원본(_src)과 폴더가 갈려 있어 서로 지우지 않는다.
mkdir -p "$OUTPUT"
rm -rf "$OUTPUT/Build"
cp -R "$STAGE/." "$OUTPUT/"

echo
echo "── 전송량 (게임 하나 상한 15MB) ──"
du -sh "$OUTPUT"
find "$OUTPUT/Build" -type f -exec ls -l {} + | awk '{ s+=$5; printf "  %8.2f MB  %s\n", $5/1048576, $NF } END { printf "  ─────────\n  %8.2f MB  Build 합계\n", s/1048576 }'

echo
echo "── 정적 검사 ──"
python3 "$ROOT/scripts/lint-game-mobile.py" "$SLUG" --strict
