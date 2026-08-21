"""원천 관광지명 → (표시명, 로컬명) 분리 — place:domain `AttractionTitle` 과 같은 규칙.

원천 제목은 꼬리 괄호에 다른 표기를 얹어 온다: 영문 행은 국문명(`Dosan Park(도산공원)`),
국문 행은 지역 구분자(`청룡사(서울)`). 이 문자열을 그대로 검색어·매칭 바늘로 쓰면
`dosanpark도산공원` 같은 어디에도 없는 질의가 된다 — 실제로 도산공원은 영상 0건에
무관 콘텐츠만 걸렸다.

꼬리 괄호에 **한글이 있을 때만** 가른다. `(Sunrise Peak)` 영문 병기·한자 병기는 이름의
일부로 본다. 규칙 원본은 place:domain `AttractionTitle` — 바꾸면 이 파일과 V9 백필
마이그레이션을 같이 바꾼다.
"""
from __future__ import annotations

import re

_TRAILING_LOCAL = re.compile(r"^(.*\S)\s*[(（]([^()（）]*[가-힣][^()（）]*)[)）]\s*$")


def parse_title(raw: str) -> tuple[str, str | None]:
    """(표시명, 로컬명|None). 가를 수 없으면 표시명 = 원문(trim)."""
    title = (raw or "").strip()
    m = _TRAILING_LOCAL.match(title)
    if not m:
        return title, None
    return m.group(1).strip(), m.group(2).strip()
