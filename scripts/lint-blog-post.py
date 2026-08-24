#!/usr/bin/env python3
# source: docs/conventions/blog-writing.md
"""블로그 글 초안 검증 (외부 의존성 없음).

발행 전 초안 마크다운을 검사한다. 본문은 DB 가 원본이므로 빌드가 잡을 수 없다 —
DB 에 넣기 전 이 단계가 유일한 게이트다.

검증 항목 (docs/conventions/blog-writing.md §4):
  F1 front-matter 필수 4필드 + DB 컬럼 상한 (title 200 / slug 80 / summary 300)
  F2 한 문장 100자 이하
  F3 한 문단 3문장 이하
  F4 리드 문단 2문장 이하
  F5 본문 산문에 물음표 없음 (설의 · 자문자답 금지)
  F6 금칙 표현 없음 (서사 도입어 · 1인칭 · 권유형 · 수사)
  W1 평균 문장 길이 60자 이하
  W2 산문 줄 비율 55% 이하
  W3 h2 구간당 산문 문장 8개 이하

코드 블록 · 표 · 인용은 산문에서 제외한다. 규칙은 산문에만 건다.

사용:
  scripts/lint-blog-post.py draft.md
  scripts/lint-blog-post.py draft.md --strict   # warn 도 실패로
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

MAX_SENTENCE_CHARS = 100
MAX_PARAGRAPH_SENTENCES = 3
MAX_LEAD_SENTENCES = 2
WARN_AVG_SENTENCE_CHARS = 60
WARN_PROSE_LINE_RATIO = 0.55
WARN_SENTENCES_PER_SECTION = 8

# DB 컬럼 상한 (V14__blog.sql). 넘으면 INSERT 가 잘리거나 실패한다.
LIMITS = {"title": 200, "slug": 80, "summary": 300}
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{2,79}$")

# 금칙 표현. 정보 전달을 늦추는 말버릇만 담는다 — 문체 취향은 넣지 않는다.
BANNED = [
    (r"필자|저자는|제가\s|저는\s", "1인칭 서술"),
    (r"(살펴|알아|짚어|따져|정리해|생각해)\s?보(자|겠)", "권유형 · 함께 가는 말투"),
    (r"(^|[\s.,—(])(사실은|실은|흥미롭게도|놀랍게도|재미있게도)([\s,]|$)", "수사 도입어"),
    (r"말하자면|다시\s?말해|쉽게\s?말해|한마디로|결론부터\s?말하면", "환언 도입어"),
    (r"(그렇다면|과연|하지만\s?말이다|그런데\s?말이다)([\s,]|$)", "설의 · 전환 수사"),
    (r"인\s?셈이다|라는\s?것이다|셈이\s?된다", "풀어 말하기"),
    (r"떠올(리|랐|려)|먼저\s?떠오|헛짚", "독자의 생각을 대신 서술"),
    (r"놀랍|당황|아쉽게도|다행히", "감상 표현"),
]

FENCE_RE = re.compile(r"^\s*(```|~~~)")
HEADING_RE = re.compile(r"^\s*#{1,6}\s")
TABLE_RE = re.compile(r"^\s*\|")
QUOTE_RE = re.compile(r"^\s*>")
LIST_RE = re.compile(r"^\s*([-*+]|\d+\.)\s")
INLINE_CODE_RE = re.compile(r"`[^`]*`")
LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")

# 한글 · 닫는 괄호 · 따옴표 뒤의 종결부호만 문장 끝으로 본다.
# 그래야 `v2.1.241` 이나 `settings.json` 이 문장으로 쪼개지지 않는다.
SENTENCE_END_RE = re.compile(r"(?<=[가-힣)\]\"'”’])\s*[.!?]+(?=\s|$)")


class Result:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def split_frontmatter(text: str) -> tuple[str, str] | None:
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    return text[3:end], text[end + 4 :].lstrip("\n")


def parse_frontmatter(fm: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in fm.splitlines():
        m = re.match(r"^([a-z_]+)\s*:\s*(.*)$", line.strip())
        if m:
            out[m.group(1)] = m.group(2).strip().strip("\"'")
    return out


def check_frontmatter(fm: dict[str, str], r: Result) -> None:
    for field in ("title", "slug", "category", "summary"):
        if not fm.get(field):
            r.err(f"F1 front-matter `{field}` 누락")

    for field, limit in LIMITS.items():
        value = fm.get(field, "")
        if len(value) > limit:
            r.err(f"F1 `{field}` {len(value)}자 — DB 상한 {limit}자 초과")

    slug = fm.get("slug", "")
    if slug and not SLUG_RE.match(slug):
        r.err(f"F1 `slug` 형식 오류 (영소문자·숫자·하이픈 3~80자): {slug}")

    category = fm.get("category", "")
    if category and not category.startswith("/"):
        r.err(f"F1 `category` 는 카테고리 path 다 (`/tech/server` 형식): {category}")


def prose_blocks(body: str) -> tuple[list[list[str]], list[str], int, int]:
    """산문 문단 목록, h2 제목 목록, 산문 줄 수, 전체 내용 줄 수."""
    paragraphs: list[list[str]] = []
    headings: list[str] = []
    current: list[str] = []
    prose_lines = 0
    content_lines = 0
    in_fence = False

    for raw in body.splitlines():
        line = raw.rstrip()

        if FENCE_RE.match(line):
            in_fence = not in_fence
            content_lines += 1
            continue
        if in_fence:
            content_lines += 1
            continue

        if not line.strip():
            if current:
                paragraphs.append(current)
                current = []
            continue

        content_lines += 1

        if HEADING_RE.match(line):
            if current:
                paragraphs.append(current)
                current = []
            if line.lstrip().startswith("## "):
                headings.append(line.lstrip()[3:])
            continue
        if TABLE_RE.match(line) or QUOTE_RE.match(line) or LIST_RE.match(line):
            if current:
                paragraphs.append(current)
                current = []
            continue

        prose_lines += 1
        current.append(line)

    if current:
        paragraphs.append(current)
    return paragraphs, headings, prose_lines, content_lines


def sentences_of(paragraph: list[str]) -> list[str]:
    text = " ".join(paragraph)
    text = INLINE_CODE_RE.sub("CODE", text)
    text = LINK_RE.sub(r"\1", text)
    parts = [p.strip() for p in SENTENCE_END_RE.split(text)]
    return [p for p in parts if p]


def check_prose(body: str, r: Result) -> None:
    paragraphs, headings, prose_lines, content_lines = prose_blocks(body)

    all_sentences: list[str] = []
    for idx, para in enumerate(paragraphs):
        sents = sentences_of(para)
        all_sentences.extend(sents)

        limit = MAX_LEAD_SENTENCES if idx == 0 else MAX_PARAGRAPH_SENTENCES
        code = "F4" if idx == 0 else "F3"
        label = "리드 문단" if idx == 0 else "문단"
        if len(sents) > limit:
            r.err(f"{code} {label} {len(sents)}문장 — {limit}문장 이하: {sents[0][:40]}…")

        for s in sents:
            if len(s) > MAX_SENTENCE_CHARS:
                r.err(f"F2 문장 {len(s)}자 — {MAX_SENTENCE_CHARS}자 이하: {s[:45]}…")

        # 물음표는 문단 원문에서 센다 — 문장 분할이 종결부호를 소비하므로
        # 쪼갠 결과만 보면 정작 문장 끝의 물음표를 놓친다.
        para_text = INLINE_CODE_RE.sub("CODE", " ".join(para))
        if "?" in para_text:
            r.err(f"F5 산문에 물음표 — 설의·자문자답 금지: {para_text[:45]}…")

    if not all_sentences:
        return

    avg = sum(len(s) for s in all_sentences) / len(all_sentences)
    if avg > WARN_AVG_SENTENCE_CHARS:
        r.warn(f"W1 평균 문장 {avg:.0f}자 — {WARN_AVG_SENTENCE_CHARS}자 이하 권장")

    if content_lines:
        ratio = prose_lines / content_lines
        if ratio > WARN_PROSE_LINE_RATIO:
            r.warn(
                f"W2 산문 줄 비율 {ratio:.0%} — {WARN_PROSE_LINE_RATIO:.0%} 이하 권장 "
                "(표·목록·코드로 옮길 것)"
            )

    if headings:
        per_section = len(all_sentences) / len(headings)
        if per_section > WARN_SENTENCES_PER_SECTION:
            r.warn(f"W3 h2 구간당 산문 {per_section:.0f}문장 — {WARN_SENTENCES_PER_SECTION}문장 이하 권장")


def check_banned(body: str, r: Result) -> None:
    in_fence = False
    for no, raw in enumerate(body.splitlines(), start=1):
        if FENCE_RE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence or TABLE_RE.match(raw):
            continue
        line = INLINE_CODE_RE.sub("CODE", raw)
        for pattern, why in BANNED:
            m = re.search(pattern, line)
            if m:
                r.err(f"F6 {why}: {no}행 `{m.group(0).strip()}`")


def lint(path: Path) -> Result:
    r = Result()
    if not path.exists():
        r.err(f"파일 없음: {path}")
        return r

    text = path.read_text(encoding="utf-8")
    split = split_frontmatter(text)
    if split is None:
        r.err("F1 front-matter 누락 (--- title/slug/category/summary ---)")
        return r

    fm_raw, body = split
    check_frontmatter(parse_frontmatter(fm_raw), r)
    check_prose(body, r)
    check_banned(body, r)
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description="블로그 글 초안 lint")
    ap.add_argument("path")
    ap.add_argument("--strict", action="store_true", help="warn 도 실패로")
    args = ap.parse_args()

    target = Path(args.path)
    r = lint(target)

    print(f"=== lint {target} ===")
    for w in r.warnings:
        print(f"  WARN  {w}")
    for e in r.errors:
        print(f"  FAIL  {e}")
    if not r.errors and not r.warnings:
        print("  PASS  blog-writing §4 통과")

    if r.errors:
        return 1
    return 1 if (args.strict and r.warnings) else 0


if __name__ == "__main__":
    sys.exit(main())
