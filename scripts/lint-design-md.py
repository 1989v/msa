#!/usr/bin/env python3
# source: docs/standards/design-md.md §7
"""DESIGN.md 표준 검증 (외부 의존성 없음).

기본 대상: repo root `DESIGN.md`. 인자로 다른 경로 지정 가능.

검증 항목 (docs/standards/design-md.md §7):
  1. YAML front-matter 존재 + version 필드 SemVer
  2. 필수 8 섹션 존재 + 순서 (root 표준 §3)
  3. 본문 (front-matter / code block 제외) 에 hex 인라인 색상 없음
  4. Do's / Don'ts 항목 ≥ 5 개
  5. WCAG AA contrast (text_primary ↔ surface_0/1/2/3) ≥ 4.5:1   ※ hex 가 있는 토큰만

YAML 파서 의존성 없이 정규식으로 처리 (pyyaml / Python 3.14 expat 이슈 회피).

사용:
  scripts/lint-design-md.py                  # ./DESIGN.md
  scripts/lint-design-md.py path/to/X.md
  scripts/lint-design-md.py --strict         # warn 도 실패로
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


REQUIRED_SECTIONS = [
    "Overview",
    "Colors",
    "Typography",
    "Layout & Spacing",
    "Elevation & Depth",
    "Shapes",
    "Components",
    "Do's and Don'ts",
]

SEMVER_RE = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z\-.]+)?(?:\+[0-9A-Za-z\-.]+)?$")
HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
SECTION_RE = re.compile(r"^##\s+(?:\d+\.\s*)?(.+?)\s*$")
VERSION_RE = re.compile(r"^version\s*:\s*([^\s#]+)", re.M)
HEX_FIELD_RE = re.compile(
    r"^\s*([a-z_0-9]+)\s*:\s*\{[^}]*?\bhex\s*:\s*[\"']?(#[0-9a-fA-F]{3,8})[\"']?",
    re.M,
)


class Result:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


_HTML_COMMENT_RE = re.compile(r"<!--.*?-->\s*", re.S)


def split_frontmatter(text: str) -> tuple[str, str] | None:
    """text → (frontmatter_block, body) 또는 None.

    leading HTML 주석(<!-- ... -->)은 skip 후 `---` 매칭.
    """
    head = text
    while True:
        m = _HTML_COMMENT_RE.match(head)
        if not m:
            break
        head = head[m.end() :]
    if not head.startswith("---"):
        return None
    end_idx = head.find("\n---", 3)
    if end_idx == -1:
        return None
    fm = head[3:end_idx].strip("\n")
    body = head[end_idx + 4 :].lstrip("\n")
    return fm, body


def find_sections(body: str) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for i, line in enumerate(body.splitlines(), start=1):
        m = SECTION_RE.match(line)
        if m:
            out.append((i, m.group(1).strip()))
    return out


def section_match(actual: str, required: str) -> bool:
    return actual.lower().startswith(required.lower())


def check_version(fm: str, r: Result) -> None:
    m = VERSION_RE.search(fm)
    if not m:
        r.err("YAML 'version' 필드 누락 (표준 §6)")
        return
    v = m.group(1).strip().strip("\"'")
    if not SEMVER_RE.match(v):
        r.err(f"version='{v}' 가 SemVer 형식이 아님 (예: 1.0.0)")


def check_sections(sections: list[tuple[int, str]], r: Result) -> None:
    actual = [t for _, t in sections]
    idx = 0
    for required in REQUIRED_SECTIONS:
        found = None
        for j in range(idx, len(actual)):
            if section_match(actual[j], required):
                found = j
                break
        if found is None:
            r.err(f"필수 섹션 누락: '{required}' (표준 §3)")
        else:
            idx = found + 1


def check_hex_inline(body: str, r: Result) -> None:
    """본문에서 hex 인라인 검출. fenced code block (```) 안은 제외."""
    offending: list[tuple[int, str]] = []
    in_code = False
    for i, line in enumerate(body.splitlines(), start=1):
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        for m in HEX_RE.finditer(line):
            offending.append((i, m.group(0)))
    if offending:
        for ln, hx in offending[:8]:
            r.err(f"hex 인라인 사용 (토큰 참조로 교체) line {ln}: {hx}")
        if len(offending) > 8:
            r.err(f"... 외 {len(offending) - 8}건")


def check_dos_donts(body: str, r: Result) -> None:
    lines = body.splitlines()
    start = None
    for i, line in enumerate(lines):
        m = SECTION_RE.match(line)
        if m and "do" in m.group(1).lower() and "don" in m.group(1).lower():
            start = i + 1
            break
    if start is None:
        return
    end = len(lines)
    for j in range(start, len(lines)):
        if SECTION_RE.match(lines[j]):
            end = j
            break
    chunk = "\n".join(lines[start:end])
    bullets = len(re.findall(r"(?m)^\s*[-*]\s+\S", chunk))
    if bullets < 5:
        r.err(f"Do's and Don'ts 항목 {bullets}개 (≥ 5 필요)")


def hex_to_rgb(hx: str) -> tuple[int, int, int]:
    h = hx.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    def chan(v: int) -> float:
        s = v / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4
    r, g, b = (chan(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(hx1: str, hx2: str) -> float:
    l1 = relative_luminance(hex_to_rgb(hx1))
    l2 = relative_luminance(hex_to_rgb(hx2))
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


def extract_hex_tokens(fm: str) -> dict[str, str]:
    """`key: { ... hex: "#xxxxxx" ... }` 패턴에서 토큰명 → hex."""
    return {m.group(1): m.group(2) for m in HEX_FIELD_RE.finditer(fm)}


def check_contrast(fm: str, r: Result, strict: bool) -> None:
    tokens = extract_hex_tokens(fm)
    text_hex = tokens.get("text_primary")
    if not text_hex:
        return
    for key in ("surface_0", "surface_1", "surface_2", "surface_3"):
        s_hex = tokens.get(key)
        if not s_hex:
            continue
        ratio = contrast_ratio(text_hex, s_hex)
        if ratio < 4.5:
            msg = f"WCAG AA 미달: text_primary ↔ {key} = {ratio:.2f}:1 (≥ 4.5 필요)"
            (r.err if strict else r.warn)(msg)


def lint(path: Path, strict: bool = False) -> Result:
    r = Result()
    if not path.exists():
        r.err(f"파일 없음: {path}")
        return r

    text = path.read_text(encoding="utf-8")
    fm_split = split_frontmatter(text)
    if fm_split is None:
        r.err("YAML front-matter 누락 (--- ... ---)")
        return r
    fm, body = fm_split

    check_version(fm, r)
    sections = find_sections(body)
    check_sections(sections, r)
    check_hex_inline(body, r)
    check_dos_donts(body, r)
    check_contrast(fm, r, strict=strict)
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description="DESIGN.md 표준 lint")
    ap.add_argument("path", nargs="?", default="DESIGN.md")
    ap.add_argument("--strict", action="store_true", help="warn 도 실패로")
    args = ap.parse_args()

    target = Path(args.path)
    r = lint(target, strict=args.strict)

    print(f"=== lint {target} ===")
    for w in r.warnings:
        print(f"  WARN  {w}")
    for e in r.errors:
        print(f"  FAIL  {e}")

    if not r.errors and not r.warnings:
        print("  PASS  표준 §1-§7 통과")

    return 1 if r.errors else 0


if __name__ == "__main__":
    sys.exit(main())
