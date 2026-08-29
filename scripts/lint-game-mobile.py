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
from html.parser import HTMLParser
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

# 뷰포트를 덮는다고 볼 상자 — 이 안의 absolute 자식은 화면 모서리와 같은 자리에 온다
_FULL_BLEED = re.compile(
    r"inset:\s*0|"
    r"(?=.*top:\s*0)(?=.*left:\s*0)(?=.*right:\s*0)(?=.*bottom:\s*0)|"
    r"width:\s*100(%|vw)[^;]*;[^}]*height:\s*100(%|vh)", re.S)

_POSITIONED = ("relative", "absolute", "fixed", "sticky")


class _Dom(HTMLParser):
    """게임 index.html 을 훑어 (태그·id·class·부모) 만 남긴 얕은 트리."""

    VOID = {"br", "img", "input", "meta", "link", "hr", "source", "track", "area", "base", "col"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.nodes: list[dict] = []
        self._stack: list[int] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        a = dict(attrs)
        node = {
            "tag": tag,
            "id": (a.get("id") or "").strip(),
            "cls": set((a.get("class") or "").split()),
            "parent": self._stack[-1] if self._stack else -1,
            "interactive": tag in ("button", "a") or "onclick" in a or a.get("role") == "button",
        }
        self.nodes.append(node)
        if tag not in self.VOID:
            self._stack.append(len(self.nodes) - 1)

    def handle_startendtag(self, tag: str, attrs: list) -> None:
        self.handle_starttag(tag, attrs)
        if self._stack and self.nodes[self._stack[-1]]["tag"] == tag:
            self._stack.pop()

    def handle_endtag(self, tag: str) -> None:
        for i in range(len(self._stack) - 1, -1, -1):
            if self.nodes[self._stack[i]]["tag"] == tag:
                del self._stack[i:]
                return


def _css_rules(html: str, game_dir: Path) -> list[tuple[str, str]]:
    """
    (선택자, 선언) 을 **문서 순서대로**. 미디어 블록은 모바일 조건인 것만 편다 —
    나중 규칙이 앞 규칙을 이기므로 순서가 규칙의 일부다 (deadline 이 가드를
    `@media (pointer:coarse) and (orientation:portrait)` 에서 도로 취소하고 있었다).
    """
    css = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S | re.I))
    for href in re.findall(r'<link[^>]+href=["\']([^"\']+\.css)["\']', html, re.I):
        f = game_dir / href
        if f.exists():
            css += "\n" + f.read_text(encoding="utf-8", errors="ignore")

    # **주석을 먼저 걷는다.** 안 걷으면 규칙 앞의 `/* … */` 가 선택자에 딸려 들어가고,
    # 그 선택자에는 태그·id·class 가 하나도 없어 **모든 요소에 매칭된다** —
    # deadline 에서 `right:8px` 가 `#fps`·`#topbar` 로 새어 오탐 셋이 났다 (2026-08-29).
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)

    out: list[tuple[str, str]] = []

    def flat(text: str) -> None:
        for m in re.finditer(r"([^{}@]+)\{([^{}]*)\}", text):
            out.append((m.group(1).strip(), m.group(2)))

    pos = 0
    for m in re.finditer(r"@media([^{]+)\{", css):
        flat(css[pos:m.start()])
        depth, i = 1, m.end()
        while i < len(css) and depth:
            if css[i] == "{":
                depth += 1
            elif css[i] == "}":
                depth -= 1
            i += 1
        cond = m.group(1).lower()
        if any(k in cond for k in ("coarse", "portrait", "max-width")):
            flat(css[m.end():i - 1])
        pos = i
    flat(css[pos:])
    return out


def _matches(sel: str, idx: int, nodes: list[dict]) -> bool:
    """`#id` · `.cls` · `tag` 와 그 자손 조합만 본다 — 게임 CSS 는 이 범위 안이다."""
    parts = sel.split()
    if not parts:
        return False

    def simple(part: str, n: dict) -> bool:
        part = part.split(":")[0]
        if not part:
            return True
        # 태그·id·class 가 하나도 없는 조각은 선택자가 아니다 — 아무거나 맞다고 하면 안 된다
        if not re.search(r"^[a-zA-Z*]|[#.][\w-]", part):
            return False
        ok = True
        head = re.match(r"^[a-zA-Z][\w-]*", part)
        if head:
            ok = ok and n["tag"] == head.group(0)
        for cid in re.findall(r"#([\w-]+)", part):
            ok = ok and n["id"] == cid
        for ccl in re.findall(r"\.([\w-]+)", part):
            ok = ok and ccl in n["cls"]
        return ok

    if not simple(parts[-1], nodes[idx]):
        return False
    cur = nodes[idx]["parent"]
    for part in reversed(parts[:-1]):
        while cur >= 0 and not simple(part, nodes[cur]):
            cur = nodes[cur]["parent"]
        if cur < 0:
            return False
        cur = nodes[cur]["parent"]
    return True


def check_reserved_corner(html: str, game_dir: Path) -> list[Finding]:
    """
    **우상단은 게임 것이 아니다.**

    플랫폼 셸(게임 상세 화면)이 iframe **바깥에서** 닫기 ✕ · 전체화면 ⛶ 을 그 자리에 띄운다.
    바깥 문서라 z-index 로 이길 수 없고, 거기 둔 버튼은 **눌리지 않는다.**
    2026-08-29 감사에서 게임 71종 중 55종이 걸렸다.

    **`fixed` 만 보면 안 된다.** 이 게임들의 지배적 패턴은 뷰포트를 덮는 상자
    (`#hud{position:absolute; inset:0}`) 안에 자식을 `absolute` 로 놓는 것이라,
    `top:6px; right:6px` 가 화면 모서리와 같은 자리다. 처음 만든 검사가 `fixed` 만 봐서
    이 경로를 통째로 지나쳤다 — **회귀를 내 구현과 같은 모양으로 주입해서 증명했기 때문에**
    구멍을 못 봤다(2026-08-29, 동료 세션이 `absolute` 로 주입해 잡아냈다).

    그래서 조상 사슬을 따라간다: 위치 기준이 되는 조상이 없거나(= 초기 포함 블록 = 뷰포트),
    있어도 그것들이 전부 화면을 덮는 상자면 뷰포트 모서리로 친다.

    못 잡는 것: 캔버스에 그린 히트존. 좌표가 그림 코드 안이라 정적으로 못 읽는다
    (neon-drifter · random-tower-defense · drift-continent 가 그랬다).
    """
    out: list[Finding] = []
    dom = _Dom()
    dom.feed(html)
    nodes = dom.nodes
    if not nodes:
        return out

    rules = _css_rules(html, game_dir)
    computed: list[dict] = [{} for _ in nodes]
    for sel_list, body in rules:
        decls = dict(re.findall(r"([a-zA-Z-]+)\s*:\s*([^;]+)", body))
        for sel in sel_list.split(","):
            sel = sel.strip()
            if not sel or sel.startswith(("@", "%", "from", "to")):
                continue
            for i, _ in enumerate(nodes):
                if _matches(sel, i, nodes):
                    computed[i].update({k.lower(): v.strip() for k, v in decls.items()})
                    computed[i]["_raw"] = computed[i].get("_raw", "") + ";" + body

    def viewport_anchored(i: int) -> bool:
        pos = computed[i].get("position", "static")
        if pos == "fixed":
            return True
        if pos != "absolute":
            return False
        cur = nodes[i]["parent"]
        while cur >= 0:
            p = computed[cur].get("position", "static")
            if p in _POSITIONED:
                if not _FULL_BLEED.search(computed[cur].get("_raw", "")):
                    return False          # 화면을 안 덮는 상자 기준 — 카드 안쪽 좌표다
                if p == "fixed":
                    return True
            cur = nodes[cur]["parent"]
        return True                        # 위치 기준 조상이 없다 = 뷰포트

    for i, n in enumerate(nodes):
        c = computed[i]
        if "--kgd-chrome" in c.get("_raw", ""):
            # 가드를 썼더라도 **뒤에서 되돌렸는지** 본다 — 마지막 값이 이긴다
            pass
        top, right = c.get("top", ""), c.get("right", "")
        mt = re.match(r"^([\d.]+)px$", top)
        mr = re.match(r"^([\d.]+)px$", right)
        if not (mt and mr):
            continue
        if float(mt.group(1)) >= CHROME_TOP or float(mr.group(1)) >= CHROME_RIGHT:
            continue
        if not viewport_anchored(i):
            continue

        clickable = n["interactive"] or c.get("pointer-events", "") == "auto"
        name = f"#{n['id']}" if n["id"] else ("." + sorted(n["cls"])[0] if n["cls"] else n["tag"])
        if clickable:
            out.append(Finding(
                "F6", f"우상단 예약 자리에 누를 수 있는 요소가 있다 — {name} (top {top} · right {right})",
                f"거기는 플랫폼 셸의 닫기 ✕ · 전체화면 ⛶ 자리라 눌리지 않는다. "
                f"`top: calc(var(--kgd-chrome-top, {CHROME_TOP}px) + 8px)` 로 내리거나 "
                f"오른쪽으로 `var(--kgd-chrome-right, {CHROME_RIGHT}px)` 만큼 비켜라",
            ))
        else:
            out.append(Finding(
                "W6", f"우상단 예약 자리를 셸 칩이 가린다 — {name} (top {top} · right {right})",
                "누를 수는 없는 표시물이라 치명적이진 않지만 셸 칩에 덮여 안 읽힌다. "
                f"`var(--kgd-chrome-top, {CHROME_TOP}px)` 만큼 내려라",
            ))
    return out


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
