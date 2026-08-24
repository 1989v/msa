#!/usr/bin/env python3
# source: docs/standards/game-cleanroom-pipeline.md
"""게임 산출물의 모바일·플랫폼 배선 검사 (외부 의존성 없음).

게임은 정적 자산이라 빌드가 잡아주는 것이 없다 — 컴파일도 타입 검사도 없다.
그래서 규격이 문서에만 있으면 지켜지지 않는다. 실측: 가상패드 3부 한글 라벨은
touch.js 를 실은 48종 중 4종만 지켰고, rank.js 누락으로 4종이 몇 주 동안 점수를
한 건도 못 올렸다. 이 스크립트가 그 층을 정적으로 잡는다.

검증 항목 (docs/standards/game-cleanroom-pipeline.md 전역 가드레일 G5 · 통합 절차):
  F1 platform.js 를 실으면서 rank.js 를 안 싣거나 순서가 뒤바뀜
     → runEnd 가 조용히 반환해 점수가 한 건도 안 올라간다 (2026-08-24 4종 사고)
  F2 viewport meta 부재 — 모바일에서 데스크톱 폭으로 렌더된다
  W1 data-actions 라벨이 3부 한글(code:아이콘:라벨) 형식이 아님
  W2 touch.js 를 fit 활성(기본)으로 싣는데 게임이 canvas.style.width 를 직접 씀
     → fitCanvas 와 서로 덮어쓴다. data-fit="0" 이 필요하다
  W3 16:9 이상 가로 캔버스 — 세로 폰에서 레터박스되면 조작 대상이 손톱만 해진다
     (세로 레이아웃을 주거나 가로 전용으로 선언해야 한다)
  W4 platform.js 를 싣는데 PlatformAdapter.init 호출이 없음
  W5 조작 방식 미선언 — touch.js 도 없고 네이티브 터치 선언 주석도 없다
     (`<!-- mobile: native-touch -->` 또는 `<!-- mobile: virtual-pad -->`)

F 와 W 의 경계는 "지금 실제로 깨져 있는가" 다. F1(점수가 안 올라감) · F2(모바일이 데스크톱
폭으로 렌더됨)는 그 자체로 고장이고, W 는 규격 미준수다. 기존 70종 다수가 W 를 안고 있어
(소급은 후속 작업 큐) 기본 실행에서는 통과시키고, **신작·수정 게임은 통합 절차에서
--strict 로 돌려** 규격까지 강제한다.

사용:
  scripts/lint-game-mobile.py bee-guard              # 슬러그
  scripts/lint-game-mobile.py portal-fe/public/games/bee-guard
  scripts/lint-game-mobile.py --all                  # 전 게임
  scripts/lint-game-mobile.py bee-guard --strict     # warn 도 실패로
  scripts/lint-game-mobile.py --all --quiet          # 위반만 출력
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

GAMES_DIR = Path(__file__).resolve().parent.parent / "portal-fe" / "public" / "games"

# 게임이 아닌 폴더 — lib 은 공용 자산, thumbs 는 이미지
NOT_GAMES = {"lib", "thumbs"}

# 한글 음절 한 자 이상이면 3부 라벨로 인정한다 (라벨은 한글 1~3자가 규격)
HANGUL = re.compile(r"[가-힣]")


class Finding:
    def __init__(self, code: str, message: str, hint: str = "") -> None:
        self.code = code
        self.message = message
        self.hint = hint

    @property
    def fatal(self) -> bool:
        return self.code.startswith("F")


def script_srcs(html: str) -> list[str]:
    """<script src="..."> 를 문서 순서대로. 순서가 규칙의 일부라 순서를 보존한다."""
    return re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', html)


def loads(html: str, lib: str) -> bool:
    """실제로 script 태그로 싣는가.

    본문 문자열 검색으로 판정하면 안 된다 — "가상패드(lib/touch.js)를 붙이지 않는다"
    같은 **주석**이 로드로 오인된다(bee-guard 실측 오탐).
    """
    return any(lib in src for src in script_srcs(html))


def check_platform_wiring(html: str) -> list[Finding]:
    srcs = script_srcs(html)
    idx_platform = next((i for i, s in enumerate(srcs) if "lib/platform.js" in s), -1)
    idx_rank = next((i for i, s in enumerate(srcs) if "lib/rank.js" in s), -1)

    out: list[Finding] = []
    if idx_platform < 0:
        return out  # 플랫폼 미통합 게임 — 랭킹/세이브를 안 쓰는 것은 정상 상태다

    if idx_rank < 0:
        out.append(Finding(
            "F1", "platform.js 를 싣는데 rank.js 가 없다 — 점수가 한 건도 안 올라간다",
            'index.html 에 <script src="../lib/rank.js"></script> 를 platform.js 앞에 넣어라',
        ))
    elif idx_rank > idx_platform:
        out.append(Finding(
            "F1", "rank.js 가 platform.js 뒤에 있다 — init 시점에 GameRank 가 없다",
            "두 script 태그의 순서를 바꿔라",
        ))

    if "PlatformAdapter.init" not in html:
        out.append(Finding(
            "W4", "platform.js 를 싣는데 PlatformAdapter.init 호출이 없다",
            "slug · title · saveKeys(있으면) · boards(모드가 여럿이면) 를 넘겨 init 하라",
        ))
    return out


def check_viewport(html: str) -> list[Finding]:
    if re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I):
        return []
    return [Finding(
        "F2", "viewport meta 가 없다 — 모바일이 데스크톱 폭으로 렌더된다",
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"> 를 넣어라',
    )]


def check_control_mode(html: str) -> list[Finding]:
    """조작 방식은 골라서 근거를 남기는 것이 규칙이다 (G5-3). 암묵이면 매번 다시 논쟁한다.

    2026-08-24 신설 컨벤션이라 기존 게임은 구조적으로 가질 수 없다 — 그래서 W 다.
    신작은 통합 절차의 --strict 실행에서 걸린다.
    """
    has_touch = loads(html, "lib/touch.js")
    declared = re.search(r"<!--\s*mobile:\s*(native-touch|virtual-pad)\b", html, re.I)
    if has_touch or declared:
        return []
    return [Finding(
        "W5", "조작 방식이 선언돼 있지 않다 — 가상패드도 없고 네이티브 터치 선언도 없다",
        '패드가 필요 없으면 index.html 에 <!-- mobile: native-touch --> 와 그 이유를 적어라. '
        '필요하면 lib/touch.js 를 배선하라',
    )]


def check_action_labels(html: str) -> list[Finding]:
    m = re.search(r'data-actions=["\']([^"\']+)["\']', html)
    if not m:
        return []
    bad = [a.strip() for a in m.group(1).split(",")
           if a.strip() and (a.count(":") < 2 or not HANGUL.search(a.split(":")[-1]))]
    if not bad:
        return []
    return [Finding(
        "W1", f"3부 한글 라벨이 아닌 액션 {len(bad)}개: {', '.join(bad[:5])}",
        "code:아이콘:라벨 형식에 한글 1~3자 라벨을 붙여라 — 아이콘만 있으면 무슨 버튼인지 모른다",
    )]


def check_scale_conflict(html: str, game_dir: Path) -> list[Finding]:
    if not loads(html, "lib/touch.js"):
        return []
    if re.search(r'data-fit=["\']0["\']', html):
        return []
    # 게임 스크립트가 캔버스 CSS 크기를 직접 쓰면 fitCanvas 와 충돌한다
    pattern = re.compile(r"\.style\.(width|height)\s*=")
    for js in sorted(game_dir.rglob("*.js")):
        text = js.read_text(encoding="utf-8", errors="replace")
        for line in text.splitlines():
            if pattern.search(line) and re.search(r"\b(canvas|cv|cvs|cnv|c)\b\s*\.style", line):
                rel = js.relative_to(game_dir)
                return [Finding(
                    "W2", f"게임이 캔버스 CSS 크기를 직접 쓴다 ({rel}) — fitCanvas 와 서로 덮어쓴다",
                    'touch.js 태그에 data-fit="0" 을 붙이고 GameTouch.on("layout") 으로 맞춰라',
                )]
    return []


def check_canvas_orientation(html: str) -> list[Finding]:
    m = re.search(r"<canvas[^>]*\bwidth=[\"']?(\d+)[\"']?[^>]*\bheight=[\"']?(\d+)[\"']?", html)
    if not m:
        return []
    w, h = int(m.group(1)), int(m.group(2))
    if h == 0 or w / h < 16 / 9 - 0.01:
        return []
    if re.search(r"<!--\s*mobile:\s*landscape-only\b", html, re.I):
        return []
    return [Finding(
        "W3", f"가로 캔버스 {w}×{h} — 390px 세로 화면에서 약 390×{round(390 * h / w)} CSS px 로 줄어든다",
        "세로 레이아웃을 주거나, 가로 전용이면 <!-- mobile: landscape-only --> 를 적고 "
        "시드에 orientation=LANDSCAPE 를 채워라",
    )]


def lint_game(game_dir: Path) -> list[Finding]:
    index = game_dir / "index.html"
    if not index.exists():
        return [Finding("F0", "index.html 이 없다", "게임 폴더가 맞는지 확인하라")]
    html = index.read_text(encoding="utf-8", errors="replace")
    return (
        check_platform_wiring(html)
        + check_viewport(html)
        + check_control_mode(html)
        + check_action_labels(html)
        + check_scale_conflict(html, game_dir)
        + check_canvas_orientation(html)
    )


def resolve(target: str) -> Path:
    p = Path(target)
    if p.is_dir():
        return p.resolve()
    return (GAMES_DIR / target).resolve()


def main() -> int:
    ap = argparse.ArgumentParser(description="게임 모바일·플랫폼 배선 검사")
    ap.add_argument("target", nargs="?", help="게임 슬러그 또는 폴더 경로")
    ap.add_argument("--all", action="store_true", help="모든 게임 검사")
    ap.add_argument("--strict", action="store_true", help="warn 도 실패로 취급")
    ap.add_argument("--quiet", action="store_true", help="위반이 있는 게임만 출력")
    args = ap.parse_args()

    if args.all:
        targets = sorted(d for d in GAMES_DIR.iterdir()
                         if d.is_dir() and d.name not in NOT_GAMES and (d / "index.html").exists())
    elif args.target:
        targets = [resolve(args.target)]
    else:
        ap.error("게임 슬러그를 주거나 --all 을 쓰세요")

    fatal = warn = clean = 0
    for game in targets:
        findings = lint_game(game)
        if not findings:
            clean += 1
            if not args.quiet:
                print(f"  ✅ {game.name}")
            continue
        f = sum(1 for x in findings if x.fatal)
        w = len(findings) - f
        fatal += f
        warn += w
        mark = "❌" if f else "⚠️ "
        print(f"  {mark} {game.name}")
        for x in findings:
            print(f"       [{x.code}] {x.message}")
            if x.hint:
                print(f"            → {x.hint}")

    print(f"\n  게임 {len(targets)}종 · 통과 {clean} · 실패 {fatal} · 경고 {warn}")
    if fatal:
        return 1
    if warn and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
