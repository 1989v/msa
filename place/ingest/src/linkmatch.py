"""관광지명 매칭 (ADR-0070).

"경복궁" 으로 검색해도 무관한 결과가 섞여 오기 때문에 제목·설명에 이름이 없으면 버린다.
소스가 늘어도 이 판단은 하나여야 한다 — 유튜브와 블로그가 서로 다른 기준을 쓰면
같은 관광지에 붙는 콘텐츠의 품질이 소스마다 갈린다.

완벽한 필터는 아니고, 오탐률은 운영에서 재야 안다 (spec OQ-1).
"""
from __future__ import annotations

import re

from src.title_parse import parse_title

_TAG = re.compile(r"<[^>]+>")


def strip_tags(text: str) -> str:
    """네이버 검색 API 는 매칭 구간을 <b> 로 감싸서 준다."""
    return _TAG.sub("", text or "")


def normalize(text: str) -> str:
    return "".join(ch for ch in (text or "").lower() if ch.isalnum())


def matches(title: str, *texts: str) -> bool:
    """제목·설명에 관광지 이름이 있는가 — **표시명 또는 로컬명** 중 하나면 된다.

    원천 제목을 통째로 정규화해 부분일치를 요구하면 영문 행(`Dosan Park(도산공원)`)은
    바늘이 `dosanpark도산공원` 이 되어 어떤 콘텐츠와도 맞지 않는다 — 그 관광지는 영영
    0건이고, 그 사이 무관 영상만 검색 상위에 남는다. 표기별로 바늘을 갈라 리콜을 살리되
    "이름이 통째로 들어있어야 한다"는 기준은 그대로다 — 이름이 없는 콘텐츠(도산공원의
    재테크 영상이 실제 사례)는 여전히 버린다.
    """
    display, local = parse_title(title)
    haystack = normalize(" ".join(texts))
    needles = (normalize(display), normalize(local or ""))
    return any(n and n in haystack for n in needles)
