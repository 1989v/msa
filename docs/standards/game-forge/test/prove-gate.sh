#!/usr/bin/env bash
# 게이트가 "켜져 있다" 를 증명한다 — 회귀를 주입해 기대한 축이 실제로 빨간불을 내는지.
# 안 물리는 검사는 없는 것보다 나쁘다(있다고 믿게 만든다). 키트를 고치면 이 스크립트를 다시 돌린다.
#
#   test/prove-gate.sh [작업 디렉토리]      (기본: $CLAUDE_SCRATCHPAD/forge-prove 또는 /tmp/forge-prove)
set -uo pipefail
KIT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${1:-${CLAUDE_SCRATCHPAD:-/tmp}/forge-prove}"
rm -rf "$WORK"; mkdir -p "$WORK"
PASS=0; FAIL=0; ROWS=()
row() { ROWS+=("| $1 | $2 | $3 | $4 |"); if [ "$4" = "OK" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi; }

# 기준 게임: 템플릿 + 픽스처
BASE="$WORK/base"
"$KIT/new.sh" --name prove --genre "픽스처" --dir "$BASE" >/dev/null 2>&1
cp "$KIT/test/fixture-game/index.html" "$KIT/test/fixture-game/game.js" "$BASE/"

axis_status() { python3 -c "import json,sys; r=json.load(open('$1/verifications/gate-report.json')); print(next((a['status'] for a in r['axes'] if a['id']=='$2'),'MISSING'))"; }

# 1) 기준선: 전체 PASS 여야 한다 (통과 불가능한 게이트는 게이트가 아니다)
( cd "$BASE" && node forge/gate.mjs >/dev/null 2>&1 ); st=$(python3 -c "import json; print(json.load(open('$BASE/verifications/gate-report.json'))['status'])")
row "기준선(픽스처)" "-" "PASS" "$([ "$st" = PASS ] && echo OK || echo "NG($st)")"

# 2) 회귀 주입 — 각각 기준선의 사본에서. (이름, 기대 FAIL 축, --only, python 치환식)
mutate() { # name axis only py_expr
  local name="$1" axis="$2" only="$3" py="$4" dir="$WORK/m-$1"
  cp -R "$BASE" "$dir"; rm -rf "$dir/verifications"/*.png
  python3 - "$dir/game.js" "$py" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1]); s = p.read_text(); old, new = sys.argv[2].split('=>', 1)
assert old in s, 'mutation target not found: ' + old
p.write_text(s.replace(old, new, 1))
PY
  ( cd "$dir" && node forge/gate.mjs --only "$only" >/dev/null 2>&1 )
  local got; got=$(axis_status "$dir" "$axis")
  row "$name" "$axis" "FAIL" "$([ "$got" = FAIL ] && echo OK || echo "NG($got)")"
}
mutate no-forge      BOOT            BOOT            "window.__forge = {=>window.__forge_off = {"
mutate dead-key      CONTROLS_KEY    CONTROLS_KEY    "input.pressed.has('bolt') &&=>false &&"
mutate dead-touch    MOBILE_TOUCH    MOBILE          "input.pressed.has('bolt') &&=>false &&"
mutate no-buttons    MOBILE_PORTRAIT MOBILE_PORTRAIT "    buttons: [=>    buttons: [], _off: ["
mutate harmless      DIFF_IDLE       DIFF_IDLE       "function damagePlayer(dmg) { const p = game.player; if (p.inv > 0) return;=>function damagePlayer(dmg) { const p = game.player; if (true) return;"
mutate too-easy      DIFF_MASH       DIFF_MASH       "let dmg = p.action === 'spin' ? 2 : 10;=>let dmg = p.action === 'spin' ? 60 : 60;"
mutate same-stage    CONTENT_STAGES  CONTENT_STAGES  "sky: '#6b3d2a', ground: '#5a3a2a', far: '#4d2b1d'=>sky: '#2a3d6b', ground: '#4a5a3a', far: '#1d2b4d'"
mutate silent        AUDIO           AUDIO           "function tone(freq, ms, type = 'square', gain = 0.08, slide = 0) {=>function tone(freq, ms, type = 'square', gain = 0.08, slide = 0) { return;"
mutate uncaught      CONSOLE         CONSOLE         "resize(); reset(1);=>setTimeout(() => { throw new Error('boom'); }, 300); resize(); reset(1);"
mutate no-hit        HIT             HIT             "Math.abs(e.x - p.x) < 70=>Math.abs(e.x - p.x) < 0"
mutate leak          HEAP            HEAP            "function warp(id) {=>function warp(id) { (window.__leak ||= []).push(new Array(2e6).fill(0.5));"

# 3) Stop 훅 — 크롬 없이. 기준선(PASS 리포트) 위에서 순서대로.
hook() { ( cd "$BASE" && printf '{"cwd":"%s","stop_hook_active":false}' "$BASE" | CLAUDE_PROJECT_DIR="$BASE" node forge/stop-hook.mjs ); }
decision() { python3 -c "import json,sys; d=json.loads(sys.stdin.read() or '{}'); print(d.get('decision','allow'))"; }
rm -f "$BASE/verifications/.stop-state.json"
d=$(hook | decision); row "stop: 리뷰 없음" "visual-review" "block" "$([ "$d" = block ] && echo OK || echo "NG($d)")"
( cd "$BASE" && python3 -c "import json; r=json.load(open('verifications/gate-report.json')); open('verifications/visual-review.md','w').write('\n'.join(f'- {s}: 확인' for s in r['screenshots']))" )
d=$(hook | decision); row "stop: PASS+리뷰 완비" "-" "allow" "$([ "$d" = allow ] && echo OK || echo "NG($d)")"
echo "// touched" >> "$BASE/game.js"
d=$(hook | decision); row "stop: 소스 변경 후(옛 리포트)" "sourceHash" "block" "$([ "$d" = block ] && echo OK || echo "NG($d)")"
( cd "$BASE" && node forge/gate.mjs --only BOOT >/dev/null 2>&1 )
d=$(hook | decision); row "stop: 부분 실행 리포트" "partial" "block" "$([ "$d" = block ] && echo OK || echo "NG($d)")"
( cd "$BASE" && node forge/gate.mjs >/dev/null 2>&1 && python3 -c "import json; r=json.load(open('verifications/gate-report.json')); open('verifications/visual-review.md','w').write('\n'.join(f'- {s}: 확인' for s in r['screenshots']))" )
python3 -c "import json,pathlib; p=pathlib.Path('$BASE/forge/thresholds.json'); t=json.loads(p.read_text()); t['stages_min']=1; p.write_text(json.dumps(t))"
d=$(hook | decision); row "stop: 문턱 수정(봉인 깨짐)" "seal" "block" "$([ "$d" = block ] && echo OK || echo "NG($d)")"
( cd "$BASE" && node forge/seal.mjs --reason "prove: 문턱 변경 시험" >/dev/null && node forge/gate.mjs >/dev/null 2>&1 && python3 -c "import json; r=json.load(open('verifications/gate-report.json')); open('verifications/visual-review.md','w').write('\n'.join(f'- {s}: 확인' for s in r['screenshots']))" )
d=$(hook | decision); row "stop: 재봉인+사유 기록 후" "seal-log" "allow" "$([ "$d" = allow ] && grep -q 'prove: 문턱 변경 시험' "$BASE/verifications/seal-log.md" && echo OK || echo "NG($d)")"
echo "// touched2" >> "$BASE/game.js"; rm -f "$BASE/verifications/.stop-state.json"
d1=$(hook | decision); d2=$(hook | decision); d3=$(hook | decision)
row "stop: 같은 소스 3회 막힘 → 허용(막힘 감지기)" "valve" "block,block,allow" "$([ "$d1$d2$d3" = blockblockallow ] && echo OK || echo "NG($d1,$d2,$d3)")"
echo "외부 API 키 필요" > "$BASE/verifications/BLOCKED.md"
d=$(hook | decision); row "stop: BLOCKED.md" "blocked" "allow" "$([ "$d" = allow ] && echo OK || echo "NG($d)")"

# 4) 린트
lint() { ( cd "$BASE" && CLAUDE_PROJECT_DIR="$BASE" node forge/lint.mjs "$1" >/dev/null 2>&1 ); echo $?; }
printf 'alert("x")\n' > "$BASE/bad1.js";       row "lint: alert()" "F1" "exit 2" "$([ "$(lint bad1.js)" = 2 ] && echo OK || echo NG)"
printf 'const t = "3면 클리어"\n' > "$BASE/bad2.js"; row "lint: N면 표기" "F2" "exit 2" "$([ "$(lint bad2.js)" = 2 ] && echo OK || echo NG)"
printf '<html><meta charset="utf-8"><canvas></canvas></html>' > "$BASE/index2.html"; cp "$BASE/index2.html" "$BASE/x/index.html" 2>/dev/null || { mkdir -p "$BASE/x"; cp "$BASE/index2.html" "$BASE/x/index.html"; }
row "lint: viewport 없음" "F3" "exit 2" "$([ "$(lint x/index.html)" = 2 ] && echo OK || echo NG)"
row "lint: 정상 game.js" "-" "exit 0" "$([ "$(lint game.js)" = 0 ] && echo OK || echo NG)"

printf '\n| 검사 | 축 | 기대 | 결과 |\n|---|---|---|---|\n'; printf '%s\n' "${ROWS[@]}"
printf '\n%d OK / %d NG  (작업 디렉토리 %s)\n' "$PASS" "$FAIL" "$WORK"
pgrep -f forge-chrome >/dev/null && echo "경고: 크롬이 남아 있다" || echo "크롬 잔류 없음"
[ "$FAIL" = 0 ]
