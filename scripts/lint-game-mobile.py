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


def check_panel_misuse(html: str) -> list[Finding]:
    """
    `.panel` 은 **화면을 덮는 메뉴·결과창 전용** 클래스다. lib/touch.js 가 이걸 보고
    가상패드를 숨기므로, 상시 HUD 에 붙이면 패드가 영영 안 뜬다.

    증상이 "패드가 안 보인다" 라 조작 코드를 파게 되는데 원인은 클래스 이름 하나다.
    """
    out: list[Finding] = []
    for m in re.finditer(r'<[^>]*class=["\'][^"\']*\bpanel\b[^"\']*["\'][^>]*>', html, re.I):
        tag = m.group(0)
        if re.search(r'\bid=["\'][^"\']*(hud|status|bar|score|top|overlay-hud)', tag, re.I):
            out.append(Finding(
                "F5", f"상시 HUD 로 보이는 요소에 .panel 이 붙어 있다 — {tag[:70]}",
                "`.panel` 은 화면을 덮는 창 전용이다. lib/touch.js 가 이 클래스를 보고 "
                "가상패드를 숨기므로 HUD 에 쓰면 패드가 영영 안 뜬다",
            ))
    return out


# 셸이 예약한 우상단 사각 (docs/standards/game-cleanroom-pipeline.md G5-6).
# 세로에서 전체화면 칩이 「⛶ 크게」라 띠가 112 쯤 된다 — 여유를 둬 120 으로 잡는다.
CHROME_TOP = 46
CHROME_RIGHT = 120


def check_reserved_corner(html: str, game_dir: Path) -> list[Finding]:
    """
    **우상단은 게임 것이 아니다.**

    플랫폼 셸(게임 상세 화면)이 iframe **바깥에서** 닫기 ✕ · 전체화면 ⛶ 을 그 자리에 띄운다.
    바깥 문서라 z-index 로 이길 수 없고, 거기 둔 버튼은 **눌리지 않는다.**

    2026-08-29 감사에서 게임 71종 중 55종이 걸렸다. 가장 컸던 것은 `lib/i18n.js` 가
    언어 전환 버튼을 `top:8px; right:8px` 에 심은 것으로, 게임 50종의 한/EN 전환이 죽어 있었다.
    규칙은 그때 문서에 넣었지만 **검사가 없어서** 새 게임이 같은 자리에 버튼을 두고도
    깨끗하게 통과할 수 있었다 — 이 검사가 그 구멍이다.

    잡는 것: 뷰포트에 고정(fixed)돼 우상단 예약 사각에 걸치는 **누를 수 있는** 요소.
    못 잡는 것: 캔버스에 그린 히트존(neon-drifter · random-tower-defense 가 그랬다).
    그건 좌표가 그림 코드 안에 있어 정적으로 못 읽는다 — 캔버스 HUD 를 우상단에 그리는
    게임은 `GameChrome.top` 을 읽는지 따로 본다.
    """
    out: list[Finding] = []

    css = html
    for src in (game_dir / p for p in re.findall(r'<link[^>]+href=["\']([^"\']+\.css)["\']', html, re.I)):
        if src.exists():
            css += "\n" + src.read_text(encoding="utf-8", errors="ignore")

    # 규칙 블록 단위로: position:fixed 이면서 top·right 가 둘 다 예약 사각 안
    for m in re.finditer(r"([^{}\n]{0,120})\{([^{}]{0,800})\}", css):
        sel, body = m.group(1).strip(), m.group(2)
        if not re.search(r"position:\s*fixed", body):
            continue
        if "--kgd-chrome" in body:
            continue                      # 예약 띠를 읽고 있으면 통과
        top = re.search(r"(?<![\w-])top:\s*([\d.]+)px", body)
        right = re.search(r"(?<![\w-])right:\s*([\d.]+)px", body)
        if not (top and right):
            continue
        if float(top.group(1)) >= CHROME_TOP or float(right.group(1)) >= CHROME_RIGHT:
            continue
        out.append(Finding(
            "F6", f"우상단 예약 자리에 고정 요소가 있다 — {sel[:60]} (top {top.group(1)} · right {right.group(1)})",
            f"거기는 플랫폼 셸의 닫기 ✕ · 전체화면 ⛶ 자리라 눌리지 않는다. "
            f"`top: calc(var(--kgd-chrome-top, {CHROME_TOP}px) + 8px)` 로 내리거나 "
            f"오른쪽으로 `var(--kgd-chrome-right, {CHROME_RIGHT}px)` 만큼 비켜라 "
            f"(규칙: docs/standards/game-cleanroom-pipeline.md G5-6)",
        ))

    # JS 가 인라인 스타일로 심는 경우 — i18n.js 가 정확히 이 모양이었다
    for js in [game_dir / s for s in script_srcs(html) if not s.startswith(("http", "../lib/"))]:
        if not js.exists():
            continue
        text = js.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"position:\s*fixed;[^'\"`]{0,160}", text):
            blob = m.group(0)
            if "--kgd-chrome" in blob or "GameChrome" in blob:
                continue
            top = re.search(r"top:\s*([\d.]+)px", blob)
            right = re.search(r"right:\s*([\d.]+)px", blob)
            if not (top and right):
                continue
            if float(top.group(1)) >= CHROME_TOP or float(right.group(1)) >= CHROME_RIGHT:
                continue
            out.append(Finding(
                "F6", f"{js.name} 이 우상단 예약 자리에 요소를 심는다 — top {top.group(1)} · right {right.group(1)}",
                "인라인 스타일이라 CSS 검색에 안 걸린다. `var(--kgd-chrome-top, 46px)` 를 써라 "
                "(규칙: docs/standards/game-cleanroom-pipeline.md G5-6)",
            ))
    return out


def check_canvas_stretch(html: str, game_dir: Path) -> list[Finding]:
    """
    캔버스를 `width:100%` 로 늘이면 전체화면·가로에서 **비율이 깨진다.**
    캔버스는 픽셀 크기가 곧 좌표계라 CSS 로 늘이는 순간 클릭 좌표와 그림이 어긋난다.
    """
    css = html
    for name in ("style.css", "css/style.css", "styles.css"):
        f = game_dir / name
        if f.exists():
            css += f.read_text(encoding="utf-8", errors="replace")

    out: list[Finding] = []
    for m in re.finditer(r"(canvas|#(?:game|unity)-?canvas)[^{}]*\{([^{}]*)\}", css, re.I):
        body = m.group(2)
        # `height:auto` 나 `max-width` 가 함께 있으면 비율이 유지된다 — 표준 반응형 패턴이고
        # 버그가 아니다. 둘 다 없이 폭만 늘이는 경우만 잡는다 (실측: 30건 중 대부분이 전자였다)
        if (re.search(r"\bwidth\s*:\s*100%", body)
                and not re.search(r"\bmax-width", body)
                and not re.search(r"\bheight\s*:\s*auto", body)):
            out.append(Finding(
                "W7", f"캔버스에 width:100% — {m.group(1)}",
                "전체화면·가로에서 비율이 깨진다. 크기는 스크립트가 정하고 CSS 는 "
                "max-width 로만 제한하라",
            ))
    return out


def check_canvas_in_flexbox(html: str, game_dir: Path) -> list[Finding]:
    """
    캔버스가 flex/grid **아이템**이면 부모 레이아웃이 크기를 다시 정하면서 캔버스와 싸운다.

    증상이 "모바일에서 화면이 작다" 라 카메라·해상도 문제로 오진하기 딱 좋다 —
    원인은 CSS 한 줄이다 (2026-08-25 실측).
    """
    css = html
    for name in ("style.css", "css/style.css", "styles.css"):
        f = game_dir / name
        if f.exists():
            css += f.read_text(encoding="utf-8", errors="replace")

    # 부모가 flex 라도 **가운데 정렬**이면 캔버스를 늘이지 않는다 — 흔한 센터링 패턴이고
    # 문제가 아니다. 늘어나는 것은 정렬이 기본값(stretch)이거나 캔버스에 flex 가 걸린 경우다.
    parents = set()
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        body = m.group(2)
        if not re.search(r"display\s*:\s*(flex|grid|inline-flex|inline-grid)", body):
            continue
        # place-items / place-content 는 align 과 justify 를 한 번에 준다 — 센터링이면 늘어나지 않는다
        if re.search(r"(align-items|place-items|place-content)\s*:\s*"
                     r"(center|flex-start|flex-end|baseline|start|end)", body):
            continue
        for sel in m.group(1).split(","):
            sel = sel.strip().lstrip(".#")
            if sel and not sel.startswith("@"):
                parents.add(sel.split()[0].split(":")[0])

    for parent in parents:
        if not parent:
            continue
        pat = rf'<[^>]*(?:id|class)=["\'][^"\']*\b{re.escape(parent)}\b[^"\']*["\'][^>]*>\s*<canvas'
        if re.search(pat, html, re.I):
            return [Finding(
                "W8", f"캔버스가 flex/grid 아이템이다 — 부모 `{parent}`",
                "부모 레이아웃이 캔버스 크기를 다시 정하면서 서로 싸운다. 증상은 "
                "\"모바일에서 화면이 작다\" 로 나와 카메라 문제로 오진하기 쉽다. "
                "캔버스는 position:fixed/absolute 로 레이아웃 밖에 둔다",
            )]
    return []


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
        + check_panel_misuse(html)
        + check_canvas_stretch(html, game_dir)
        + check_canvas_in_flexbox(html, game_dir)
        + check_reserved_corner(html, game_dir)
    )


def resolve(target: str) -> Path:
    p = Path(target)
    if p.is_dir():
        return p.resolve()
    return (GAMES_DIR / target).resolve()


def check_shared_libs() -> list[Finding]:
    """
    **공유 라이브러리도 우상단을 침범하면 안 된다.**

    이번 사고가 정확히 이 모양이었다 — `lib/i18n.js` 한 줄이 언어 전환 버튼을
    `position:fixed; top:8px; right:8px` 에 심어서 **게임 50종의 한/EN 전환이 죽어 있었다.**
    게임별 검사만 두면 이걸 못 잡는다: lib 은 게임 폴더 밖이라 건너뛰고,
    건너뛰지 않으면 같은 위반이 72번 찍혀 아무도 안 읽는다. 그래서 한 번만 따로 본다.
    """
    out: list[Finding] = []
    lib = GAMES_DIR / "lib"
    if not lib.is_dir():
        return out
    for js in sorted(lib.glob("*.js")):
        text = js.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r"position:\s*fixed;[^'\"`]{0,200}", text):
            blob = m.group(0)
            if "--kgd-chrome" in blob or "GameChrome" in blob or "CHROME_" in blob:
                continue
            top = re.search(r"top:\s*([\d.]+)px", blob)
            right = re.search(r"right:\s*([\d.]+)px", blob)
            if not (top and right):
                continue
            if float(top.group(1)) >= CHROME_TOP or float(right.group(1)) >= CHROME_RIGHT:
                continue
            out.append(Finding(
                "F6", f"lib/{js.name} 이 우상단 예약 자리에 요소를 심는다 — top {top.group(1)} · right {right.group(1)}",
                "공유 라이브러리라 이걸 부르는 게임 전부가 같이 깨진다 "
                "(2026-08-29: i18n.js 하나로 50종). `var(--kgd-chrome-top, 46px)` 를 써라",
            ))
    return out


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

    # 공유 라이브러리는 게임과 무관하게 한 번만 본다 — 여기가 깨지면 전부가 깨진다
    if args.all:
        for x in check_shared_libs():
            fatal += 1
            print(f"  ❌ lib")
            print(f"       [{x.code}] {x.message}")
            if x.hint:
                print(f"            → {x.hint}")

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
