#!/usr/bin/env bash
# 새 게임 폴더를 만든다: template/ 복사 → 슬롯 채우기 → git init → 게이트 봉인 → 마스터 프롬프트 출력(+클립보드).
#
#   new.sh --name thunder-edge --genre "2D 벨트스크롤 액션" --motif "던전앤파이터" \
#          --benchmark "원작 초반 5개 던전 분량: 방 5개 구조, 적 6종, 보스 2페이즈, 스킬 6개, 첫 클리어 20분" \
#          [--dir ~/games/thunder-edge] [--platform "PC 브라우저 + 모바일"] [--art procedural|comfyui]
#
# 그 뒤: cd <dir> && claude --dangerously-skip-permissions   (빈 폴더라 잃을 것이 없다 — 상한 없는 자율 실행)
#        프롬프트를 붙여 넣고 기다린다.
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
NAME="" GENRE="" MOTIF="없음" BENCHMARK="" DIR="" PLATFORM="PC 브라우저 + 모바일(세로·가로)" ART="procedural"
while [ $# -gt 0 ]; do
  case "$1" in
    --name) NAME="$2"; shift 2;; --genre) GENRE="$2"; shift 2;; --motif) MOTIF="$2"; shift 2;;
    --benchmark) BENCHMARK="$2"; shift 2;; --dir) DIR="$2"; shift 2;; --platform) PLATFORM="$2"; shift 2;;
    --art) ART="$2"; shift 2;; -h|--help) sed -n 2,10p "$0"; exit 0;;
    *) echo "모르는 인자: $1" >&2; exit 2;;
  esac
done
[ -n "$NAME" ] && [ -n "$GENRE" ] || { echo "--name 과 --genre 는 필수" >&2; exit 2; }
[ "$ART" = procedural ] || [ "$ART" = comfyui ] || { echo "--art 는 procedural | comfyui" >&2; exit 2; }
[ -n "$BENCHMARK" ] || BENCHMARK="별도 벤치마크 없음 — forge/thresholds.json 의 하한이 곧 기준이다. 그 위로 갈수록 좋다."
DIR="${DIR:-$HOME/games/$NAME}"
[ -e "$DIR" ] && { echo "이미 있다: $DIR (클린룸은 빈 폴더에서 시작한다)" >&2; exit 1; }
command -v node >/dev/null || { echo "node 가 필요하다 (22+)" >&2; exit 1; }

mkdir -p "$(dirname "$DIR")"
cp -R "$KIT/template" "$DIR"

# 슬롯 채우기 — 여러 줄 값이 있어 sed 대신 python
export NAME GENRE MOTIF BENCHMARK PLATFORM ART DIR
python3 - "$DIR" "$KIT/PROMPT.md" <<'PY'
import os, sys, pathlib
d, prompt_src = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
slots = {k: os.environ[k] for k in ['NAME', 'GENRE', 'MOTIF', 'BENCHMARK', 'PLATFORM', 'ART', 'DIR']}
def fill(text):
    for k, v in slots.items():
        text = text.replace('{{' + k + '}}', v)
    return text
for rel in ['CLAUDE.md', 'BRIEF.md']:
    p = d / rel
    p.write_text(fill(p.read_text()))
(d / 'PROMPT.txt').write_text(fill(prompt_src.read_text()))
PY

( cd "$DIR" && node forge/seal.mjs --init >/dev/null && git init -q && git add -A && git commit -qm "chore: game-forge scaffold — $NAME" )

echo "생성: $DIR"
echo "다음: cd \"$DIR\" && claude --dangerously-skip-permissions"
echo "그리고 아래 프롬프트(PROMPT.txt)를 붙여 넣는다."
if command -v pbcopy >/dev/null; then pbcopy < "$DIR/PROMPT.txt"; echo "(클립보드에 복사됨)"; fi
echo "-----"
cat "$DIR/PROMPT.txt"
