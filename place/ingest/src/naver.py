"""네이버 블로그 검색 커넥터 (ADR-0070).

일 25,000콜이라 유튜브(하루 100건)와 달리 사실상 제약이 없다. 그래도 예산은 place 가
세도록 같은 경로를 쓴다 — 소스마다 다른 규칙을 만들면 어느 쪽이 기준인지 사라진다.

썸네일이 없다. 블로그 검색 응답에 이미지가 없어서 화면은 글 링크 줄로 그린다.
"""
from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request

from src.linkmatch import matches, strip_tags
from src.title_parse import parse_title

SEARCH_URL = "https://openapi.naver.com/v1/search/blog.json"
DISPLAY = 5


class AuthMissing(RuntimeError):
    """Client ID/Secret 미설정 — 이 소스는 건너뛴다."""


def _post_date(raw: str) -> str | None:
    """`YYYYMMDD` → place 가 받는 LocalDateTime."""
    raw = (raw or "").strip()
    if len(raw) != 8 or not raw.isdigit():
        return None
    return f"{raw[:4]}-{raw[4:6]}-{raw[6:]}T00:00:00"


def _query(title: str, lang: str) -> str:
    """네이버는 국문 코퍼스다 — 영문 행은 국문명(로컬명)으로 물어야 결과가 있다.

    `Dosan Park(도산공원)` 를 통째로 묻던 것을 가른다: en 행은 `도산공원`, ko 행은
    표시명(지역 구분자 뗀 이름). 매칭은 어느 표기든 통과한다 (linkmatch.matches).
    """
    display, local = parse_title(title)
    return local if (lang == "en" and local) else display


def search(client_id: str, client_secret: str, title: str, lang: str) -> list[dict]:
    if not client_id or not client_secret:
        raise AuthMissing("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 가 필요합니다")

    params = {"query": _query(title, lang), "display": DISPLAY, "sort": "sim"}
    req = urllib.request.Request(
        f"{SEARCH_URL}?{urllib.parse.urlencode(params)}",
        headers={
            "Accept": "application/json",
            "X-Naver-Client-Id": client_id,
            "X-Naver-Client-Secret": client_secret,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read().decode())

    links = []
    for item in body.get("items") or []:
        link = (item.get("link") or "").strip()
        item_title = strip_tags(item.get("title") or "").strip()
        description = strip_tags(item.get("description") or "")
        if not link.startswith("https://") or not item_title:
            continue
        if not matches(title, item_title, description):
            continue
        links.append({
            # 블로그 URL 은 길어서 external_id(100자)에 그대로 담기지 않는다 — 해시로 고정 길이.
            "externalId": hashlib.sha1(link.encode()).hexdigest(),
            "title": item_title[:300],
            "url": link,
            "thumbnailUrl": None,
            "author": (strip_tags(item.get("bloggername") or "").strip()[:100]) or None,
            "publishedAt": _post_date(item.get("postdate") or ""),
        })
    return links
