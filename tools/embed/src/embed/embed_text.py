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

# ── 규칙 변형 (P1 비교용) ───────────────────────────────────────────────────
# v1 이 최선이라는 근거가 아직 없다. 아래 변형을 같은 판정 세트로 재서 정한다.
# 무엇을 의심하는지: ① 전체 주소의 번지·건물번호는 의미 없는 토큰이다
#                  ② 개요 1000자가 이름 신호를 희석한다
#                  ③ 제목을 그대로 넣어 **상호명이 여행 어휘와 충돌한다**
#                     (영어 `island trip` 이 「Thursday Island」 매장 12곳에 무너졌다)

#: 주소에서 시·도 + 시·군·구 까지만 남긴다. 「서울특별시 종로구 자하문로17길 12-11」 → 「서울특별시 종로구」
_ADDR_HEAD = re.compile(r"^(\S+(?:특별시|광역시|특별자치시|특별자치도|도))\s+(\S+(?:시|군|구))")


def address_region(address: str | None) -> str:
    """주소를 시·구 수준으로 자른다. 못 맞추면 앞 두 어절."""
    a = _clean(address)
    if not a:
        return ""
    m = _ADDR_HEAD.match(a)
    if m:
        return f"{m.group(1)} {m.group(2)}"
    return " ".join(a.split()[:2])


def attraction_text_no_address(*, title: str, title_local: str | None = None, category: str | None = None,
                               overview: str | None = None, lang: str = "ko", **_ignored) -> str:
    """규칙 B — 주소를 뺀다. 지역 질의를 얼마나 잃는지 본다."""
    return attraction_text(title=title, title_local=title_local, category=category,
                           address=None, overview=overview, lang=lang)


def attraction_text_region(*, title: str, title_local: str | None = None, category: str | None = None,
                           address: str | None = None, overview: str | None = None, lang: str = "ko",
                           **_ignored) -> str:
    """규칙 C — 주소를 시·구까지만. 번지·건물번호는 의미 없는 토큰이라는 가설."""
    return attraction_text(title=title, title_local=title_local, category=category,
                           address=address_region(address), overview=overview, lang=lang)


def attraction_text_short(*, title: str, title_local: str | None = None, category: str | None = None,
                          address: str | None = None, overview: str | None = None, lang: str = "ko",
                          **_ignored) -> str:
    """규칙 D — 개요를 300자로. 긴 개요가 이름 신호를 희석하는지 본다."""
    ov = _clean(overview)
    return attraction_text(title=title, title_local=title_local, category=category,
                           address=address, overview=ov[:300] if ov else None, lang=lang)


def attraction_text_no_title(*, title: str, category: str | None = None, address: str | None = None,
                             overview: str | None = None, lang: str = "ko", **_ignored) -> str:
    """규칙 E — 제목을 뺀다. 상호명 충돌을 없애는 대신 이름 질의를 얼마나 잃는지 본다.

    제목이 없으면 남는 게 없는 문서(개요·주소 모두 빈 것)가 생기므로 분류명으로 대신한다 —
    빈 텍스트는 해시·업서트가 거부한다.
    """
    parts = [p for p in (category_label(category, lang), _clean(address),
                         (_clean(overview) or "")[:OVERVIEW_MAX_CHARS]) if p]
    return SEP.join(parts) if parts else category_label(category, lang) or _clean(title)
