"""YouTube Data API v3 커넥터 (ADR-0070).

`search.list`(관련성 순)로 후보를 찾고 `videos.list`로 조회수·길이·플레이어 비율을 받아 **인기순으로 정렬**한다.
길이와 비율은 쇼츠/일반 영상을 가르는 원천 값이다 — 판정은 place 도메인(`VideoFormat`)이 한다.

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
from src.title_parse import parse_title

SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
WATCH_URL = "https://www.youtube.com/watch?v="
# 후보 25개를 받는다 — search.list 는 1개를 받든 50개를 받든 같은 100 units 라 공짜다.
# 인기 결과의 약 4할이 쇼츠라(2026-10-04 표본 30건 중 12건) 10개로는 화면이 일반 영상 5개와
# 쇼츠 줄을 따로 채우지 못한다. 이름 매칭 필터가 후보를 걸러낸 뒤에도 남게 넉넉히 받는다.
MAX_RESULTS = 25
# videos.list 는 id 를 50개까지 묶어 **1 unit** 이다(받는 part 수와 무관). search.list(건당 100 units)
# 옆에서는 사실상 공짜라 조회수를 받아 정렬한다 — 안 받으면 관련성 순이지 '인기 영상'이 아니다.
STATS_BATCH = 50
# 플레이어 크기는 maxWidth 를 줘야 영상 비율대로 온다. maxHeight 만 주면 전부 세로(360×640)로 와서
# 쇼츠를 가를 수 없었다(2026-10-04 운영 표본 49건 전부 세로, 44분짜리 포함).
EMBED_MAX_WIDTH = 640
# Travel & Events. "도산공원" 일반 검색 1위가 재테크 영상이던 문제의 1차 방어선 —
# 이름 매칭 필터는 이름이 스친 무관 영상까지는 못 거르므로, 후보군 자체를 여행으로 좁힌다.
TRAVEL_CATEGORY_ID = "19"
# 여행 카테고리 결과가 이보다 적을 때만 일반 검색 1콜을 보충한다.
BACKFILL_THRESHOLD = 3
LOCATION_RADIUS = "10km"


class QuotaExceeded(RuntimeError):
    """일일 쿼터 소진 — 남은 큐를 더 두드려도 답이 같다."""


def search(
    api_key: str,
    title: str,
    lang: str,
    latitude: float | None = None,
    longitude: float | None = None,
) -> list[dict]:
    """관광지명으로 영상을 찾는다. 반환은 place `/internal/.../bulk` 의 link 스키마.

    검색어는 원천 제목이 아니라 **표시명**이다 — `Dosan Park(도산공원)` 을 그대로 물으면
    두 표기가 붙은 질의가 되어 관련성이 무너진다 (이름 매칭도 title_parse 기준으로 한다).

    쿼터 트레이드오프: search.list 는 건당 100 units 라 무조건 2콜(여행 + 일반)이면
    하루 100곳 예산이 50곳으로 준다. 그래서 보충 콜은 여행 카테고리 결과가
    BACKFILL_THRESHOLD 미만일 때만 나간다 — 대부분의 관광지는 1콜로 끝난다.
    최악(전부 보충)엔 쿼터가 실행 중간에 끝나지만, QuotaExceeded 는 그때까지의 수집분을
    적재하고 멈추는 신호라 남은 큐는 내일로 넘어간다 (main._collect_source).
    """
    display, _ = parse_title(title)
    links = _search_page(
        api_key, _params(api_key, display, lang, latitude, longitude, TRAVEL_CATEGORY_ID), title,
    )
    if len(links) < BACKFILL_THRESHOLD:
        try:
            extra = _search_page(
                api_key, _params(api_key, display, lang, latitude, longitude, None), title,
            )
        except QuotaExceeded:
            extra = []   # 1차 결과는 이미 100 units 를 냈다 — 버리지 않는다
        seen = {link["externalId"] for link in links}
        links += [link for link in extra if link["externalId"] not in seen]

    if not links:
        return links
    details = video_details(api_key, [l["externalId"] for l in links])
    for link in links:
        found = details.get(link["externalId"]) or {}
        link["viewCount"] = found.get("viewCount")
        link["duration"] = found.get("duration")
        link["embedWidth"] = found.get("embedWidth")
        link["embedHeight"] = found.get("embedHeight")
    # 조회수 내림차순. 못 받은 것(None)은 뒤로 — 순서를 뒤집을 근거가 없다.
    links.sort(key=lambda l: (l["viewCount"] is None, -(l["viewCount"] or 0)))
    return links


def _params(
    api_key: str,
    query: str,
    lang: str,
    latitude: float | None,
    longitude: float | None,
    category_id: str | None,
) -> dict:
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": MAX_RESULTS,
        "regionCode": "KR",
        "relevanceLanguage": lang,
        "safeSearch": "strict",
        "key": api_key,
    }
    if category_id:
        params["videoCategoryId"] = category_id
    # 좌표가 있으면 그 근방으로 치우친다 — 동명이지·무관 지역 영상을 내린다.
    # 큐가 좌표를 항상 실어 준다 (PendingLinkItem.latitude/longitude).
    if latitude is not None and longitude is not None:
        params["location"] = f"{latitude},{longitude}"
        params["locationRadius"] = LOCATION_RADIUS
    return params


def _search_page(api_key: str, params: dict, title: str) -> list[dict]:
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


def video_details(api_key: str, video_ids: list[str]) -> dict[str, dict]:
    """영상별 조회수·길이·플레이어 크기. **못 받아도 영상은 버리지 않는다** — 정렬·형태 근거가 없을 뿐이다.

    지워진 영상은 응답에서 빠진다 — 빠진 id 는 결과에 없다.
    """
    found: dict[str, dict] = {}
    for i in range(0, len(video_ids), STATS_BATCH):
        params = {"part": "statistics,contentDetails,player", "maxWidth": EMBED_MAX_WIDTH,
                  "id": ",".join(video_ids[i:i + STATS_BATCH]), "key": api_key}
        req = urllib.request.Request(
            f"{VIDEOS_URL}?{urllib.parse.urlencode(params)}",
            headers={"Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            if e.code == 403 and "quotaExceeded" in detail:
                raise QuotaExceeded(detail[:200]) from e
            # 부수 정보다. 못 받으면 정렬·형태만 포기하고 영상은 그대로 쓴다.
            return found
        found.update(details_from_items(body.get("items") or []))
    return found


def details_from_items(items: list[dict]) -> dict[str, dict]:
    """`videos.list` 항목 → id 별 원천 값. 길이는 원문(ISO-8601) 그대로 둔다."""
    out: dict[str, dict] = {}
    for item in items:
        video_id = item.get("id")
        if not video_id:
            continue
        raw = ((item.get("statistics") or {}).get("viewCount") or "").strip()
        player = item.get("player") or {}
        out[video_id] = {
            "viewCount": int(raw) if raw.isdigit() else None,
            "duration": ((item.get("contentDetails") or {}).get("duration") or "").strip() or None,
            "embedWidth": _int(player.get("embedWidth")),
            "embedHeight": _int(player.get("embedHeight")),
        }
    return out


def _int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
