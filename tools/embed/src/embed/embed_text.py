"""임베딩 텍스트 규칙 v1 + 해시 규약.

이 파일이 규칙의 **유일한** 구현이다(서버는 텍스트를 만들지 않는다 — embedding-entities.md §1-6, §5).
규칙을 바꾸면 모든 text_hash 가 어긋나 전부 pending 이 된다 — 그것이 곧 "규칙 변경 = 전량 재임베딩"의 강제다.
"""
from __future__ import annotations

import hashlib
import html
import re

OVERVIEW_MAX_CHARS = 1000
SEP = " · "

CATEGORY_KO = {
    "nature": "자연", "history": "역사", "culture": "문화", "leisure": "레저",
    "shopping": "쇼핑", "food": "음식", "stay": "숙박",
}

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def _clean(s: str | None) -> str:
    if not s:
        return ""
    s = html.unescape(_TAG.sub(" ", s))
    return _WS.sub(" ", s).strip()


def category_label(category: str | None, lang: str) -> str:
    if not category:
        return ""
    return CATEGORY_KO.get(category, category) if lang == "ko" else category


def attraction_text(*, title: str, title_local: str | None = None, category: str | None = None,
                    address: str | None = None, overview: str | None = None, lang: str = "ko") -> str:
    """규칙 v1(전체): `title (titleLocal) · 분류명 · address · overview[:1000]`. 빈 부분은 건너뛴다."""
    head = _clean(title)
    if not head:
        raise ValueError("title 은 비어있을 수 없습니다")
    local = _clean(title_local)
    if local:
        head = f"{head} ({local})"
    parts = [head]
    label = category_label(category, lang)
    if label:
        parts.append(label)
    addr = _clean(address)
    if addr:
        parts.append(addr)
    ov = _clean(overview)
    if ov:
        parts.append(ov[:OVERVIEW_MAX_CHARS])
    return SEP.join(parts)


def attraction_title_text(*, title: str, title_local: str | None = None, **_ignored) -> str:
    """규칙 A(비교용): 이름만. bake-off 에서 전체 규칙과 nDCG 를 나란히 본다."""
    head = _clean(title)
    if not head:
        raise ValueError("title 은 비어있을 수 없습니다")
    local = _clean(title_local)
    return f"{head} ({local})" if local else head


def text_hash(model_ref: str, text: str) -> str:
    """sha256(model_ref + LF + text) — 서버(place 도메인 EmbeddingText.hash)와 같은 규약."""
    return hashlib.sha256((model_ref + "\n" + text).encode("utf-8")).hexdigest()
