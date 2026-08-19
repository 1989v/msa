"""관광지명 매칭 (ADR-0070).

"경복궁" 으로 검색해도 무관한 결과가 섞여 오기 때문에 제목·설명에 이름이 없으면 버린다.
소스가 늘어도 이 판단은 하나여야 한다 — 유튜브와 블로그가 서로 다른 기준을 쓰면
같은 관광지에 붙는 콘텐츠의 품질이 소스마다 갈린다.

완벽한 필터는 아니고, 오탐률은 운영에서 재야 안다 (spec OQ-1).
"""
from __future__ import annotations

import re

_TAG = re.compile(r"<[^>]+>")


def strip_tags(text: str) -> str:
    """네이버 검색 API 는 매칭 구간을 <b> 로 감싸서 준다."""
    return _TAG.sub("", text or "")


def normalize(text: str) -> str:
    return "".join(ch for ch in (text or "").lower() if ch.isalnum())


def matches(title: str, *texts: str) -> bool:
    needle = normalize(title)
    if not needle:
        return False
    haystack = normalize(" ".join(texts))
    return needle in haystack
