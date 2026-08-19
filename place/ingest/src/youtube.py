"""YouTube Data API v3 커넥터 (ADR-0070).

`search.list` 는 **건당 100 units** 이고 일일 쿼터가 10,000 units 라 하루 100 관광지가 상한이다.
그래서 전량 사전수집을 하지 않고, 실제로 열어본 곳부터(place 의 우선순위 큐) 채운다.

**쿼터 소진은 403(reason=quotaExceeded)이지 429 가 아니다.** 이걸 일반 실패로 흘리면 남은
큐를 계속 두드리며 로그만 쌓이므로, 만나는 즉시 그 실행을 멈춘다.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

from src.linkmatch import matches

SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
WATCH_URL = "https://www.youtube.com/watch?v="
MAX_RESULTS = 5


class QuotaExceeded(RuntimeError):
    """일일 쿼터 소진 — 남은 큐를 더 두드려도 답이 같다."""


def search(api_key: str, title: str, lang: str) -> list[dict]:
    """관광지명으로 영상을 찾는다. 반환은 place `/internal/.../bulk` 의 link 스키마."""
    params = {
        "part": "snippet",
        "q": title,
        "type": "video",
        "maxResults": MAX_RESULTS,
        "regionCode": "KR",
        "relevanceLanguage": lang,
        "safeSearch": "strict",
        "key": api_key,
    }
    req = urllib.request.Request(
        f"{SEARCH_URL}?{urllib.parse.urlencode(params)}",
        headers={"Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        if e.code == 403 and "quotaExceeded" in detail:
            raise QuotaExceeded(detail[:200]) from e
        raise

    links = []
    for item in body.get("items") or []:
        video_id = ((item.get("id") or {}).get("videoId") or "").strip()
        snippet = item.get("snippet") or {}
        if not video_id or not matches(title, snippet.get("title", ""), snippet.get("description", "")):
            continue
        thumbnails = snippet.get("thumbnails") or {}
        thumb = (thumbnails.get("medium") or thumbnails.get("default") or {}).get("url")
        links.append({
            "externalId": video_id,
            "title": (snippet.get("title") or "").strip()[:300],
            "url": f"{WATCH_URL}{video_id}",
            "thumbnailUrl": thumb,
            "author": (snippet.get("channelTitle") or "").strip()[:100] or None,
            # RFC3339(Z) → place 가 받는 LocalDateTime
            "publishedAt": (snippet.get("publishedAt") or "").rstrip("Z") or None,
        })
    return links
