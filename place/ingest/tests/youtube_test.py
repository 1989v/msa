"""유튜브 영상 정보 — videos.list 항목에서 조회수·길이·플레이어 크기를 원문대로 꺼낸다."""
from __future__ import annotations

import io
import json
import urllib.error

import pytest
from urllib.parse import parse_qs, urlparse

from src import youtube


def test_details_keep_source_values():
    # 2026-10-04 운영 응답 모양(maxWidth=640) — 쇼츠는 세로, 일반 영상은 가로로 온다
    items = [
        {"id": "short1", "statistics": {"viewCount": "1200"}, "contentDetails": {"duration": "PT58S"},
         "player": {"embedWidth": "360", "embedHeight": "640"}},
        {"id": "long1", "statistics": {"viewCount": "98"}, "contentDetails": {"duration": "PT44M15S"},
         "player": {"embedWidth": "640", "embedHeight": "360"}},
    ]
    assert youtube.details_from_items(items) == {
        "short1": {"viewCount": 1200, "duration": "PT58S", "embedWidth": 360, "embedHeight": 640},
        "long1": {"viewCount": 98, "duration": "PT44M15S", "embedWidth": 640, "embedHeight": 360},
    }


def test_missing_values_are_none_not_dropped():
    # 통계를 숨긴 영상 · 플레이어 크기가 없는 응답도 영상은 남긴다
    assert youtube.details_from_items([{"id": "x", "statistics": {}, "player": {}}]) == {
        "x": {"viewCount": None, "duration": None, "embedWidth": None, "embedHeight": None},
    }


def test_video_details_asks_player_size_by_width(monkeypatch):
    # maxHeight 만 주면 전부 세로(360x640)로 와서 쇼츠를 가를 수 없었다 — 보낸 요청을 본다
    sent = []

    class Reply:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps({"items": [{"id": "v1", "contentDetails": {"duration": "PT30S"},
                                          "player": {"embedWidth": 360, "embedHeight": 640}}]}).encode()

    def fake_urlopen(req, timeout=0):
        sent.append(parse_qs(urlparse(req.full_url).query))
        return Reply()

    monkeypatch.setattr(youtube.urllib.request, "urlopen", fake_urlopen)
    found = youtube.video_details("k", [f"id{i}" for i in range(60)])

    assert [len(q["id"][0].split(",")) for q in sent] == [50, 10]  # 50개 묶음 1 unit
    assert sent[0]["maxWidth"] == ["640"] and "maxHeight" not in sent[0]
    assert set(sent[0]["part"][0].split(",")) == {"statistics", "contentDetails", "player"}
    assert found["v1"]["embedHeight"] == 640


class _Ledger:
    """쿼터 장부 대역 — 몇 단위를 적었는지와 허용 여부만 본다."""

    def __init__(self, allow: bool = True):
        self.allow = allow
        self.costs: list[int] = []

    def try_acquire(self, provider, cost=1):
        assert provider == "youtube-data"
        self.costs.append(cost)
        return self.allow


def test_search_records_100_units_per_call_in_ledger(monkeypatch):
    # 장부에 안 적으면 place 가 매시 10곳씩 하루 240번을 내준다(2026-10-03 한도 초과)
    ledger = _Ledger()
    monkeypatch.setattr(youtube, "_ledger", ledger)

    class Reply:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps({"items": []}).encode()

    monkeypatch.setattr(youtube.urllib.request, "urlopen", lambda req, timeout=0: Reply())
    youtube.search("k", "경복궁", "ko")
    # 1순위가 비어 보충 검색까지 2콜 — 결과가 없으면 영상 정보 조회는 없다
    assert ledger.costs == [100, 100]


def _item(vid: str) -> dict:
    return {"id": {"videoId": vid}, "snippet": {"title": f"경복궁 {vid}", "description": "", "channelTitle": "c", "thumbnails": {}}}


def _fake_youtube(monkeypatch, first: list[str], second: list[str], views: dict[str, int]):
    """1순위(카테고리+반경)·보충 검색 응답과 조회수를 정해 두고, 보낸 검색 요청을 모은다."""
    monkeypatch.setattr(youtube, "_ledger", _Ledger())
    sent = []

    class Reply:
        def __init__(self, data):
            self.data = data

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps(self.data).encode()

    def fake_urlopen(req, timeout=0):
        q = parse_qs(urlparse(req.full_url).query)
        if "/search" in req.full_url:
            sent.append(q)
            ids = first if "videoCategoryId" in q else second
            return Reply({"items": [_item(i) for i in ids]})
        ids = q["id"][0].split(",")
        return Reply({"items": [{"id": i, "statistics": {"viewCount": str(views.get(i, 0))}} for i in ids]})

    monkeypatch.setattr(youtube.urllib.request, "urlopen", fake_urlopen)
    return sent


def test_travel_category_near_the_place_first_then_fill_to_ten(monkeypatch):
    # 제한 없는 검색만 쓰면 이름만 스친 1,090만 회 영상이 맨 앞에 섰다(2026-10-05) — 그 장소의 여행 영상이 앞선다
    sent = _fake_youtube(monkeypatch, first=["a1", "a2"], second=["a2", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9"],
                         views={"a1": 10, "a2": 500, "b1": 9_000_000, "b9": 100})
    links = youtube.search("k", "경복궁", "ko", "경복궁", 37.58, 126.97)

    assert [l["externalId"] for l in links] == ["a2", "a1", "b1", "b9", "b2", "b3", "b4", "b5", "b6", "b7"]
    first, second = sent
    assert first["videoCategoryId"] == ["19"] and first["location"] == ["37.58,126.97"] and first["locationRadius"] == ["10km"]
    assert not {"videoCategoryId", "location", "locationRadius"} & second.keys()
    assert [q["q"][0] for q in sent] == ["경복궁", "경복궁"]


def test_no_fill_search_when_first_pass_has_ten(monkeypatch):
    sent = _fake_youtube(monkeypatch, first=[f"a{i}" for i in range(12)], second=["b1"], views={})
    links = youtube.search("k", "경복궁", "ko", None, 37.58, 126.97)

    assert len(sent) == 1
    assert len(links) == 10 and all(l["externalId"].startswith("a") for l in links)



def test_exhausted_ledger_stops_before_calling(monkeypatch):
    monkeypatch.setattr(youtube, "_ledger", _Ledger(allow=False))
    called = []
    monkeypatch.setattr(youtube.urllib.request, "urlopen", lambda *a, **k: called.append(1))
    with pytest.raises(youtube.QuotaExceeded):
        youtube.search("k", "경복궁", "ko")
    assert called == []


def test_daily_search_limit_429_stops_the_run(monkeypatch):
    # 프로젝트의 「Search Queries per day」 한도는 403 이 아니라 429 로 온다(2026-10-04 운영 응답)
    monkeypatch.setattr(youtube, "_ledger", _Ledger())
    body = json.dumps({"error": {"code": 429, "errors": [{"reason": "rateLimitExceeded"}],
                                 "message": "Quota exceeded for quota metric 'Search Queries'"}})

    def fake_urlopen(req, timeout=0):
        raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", {}, io.BytesIO(body.encode()))

    monkeypatch.setattr(youtube.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(youtube.QuotaExceeded):
        youtube.search("k", "경복궁", "ko")


def test_search_snippet_text_is_unescaped(monkeypatch):
    # search.list 는 제목·채널명을 HTML 이스케이프해서 준다 — 그대로 저장하면 화면에 &quot; 가 찍힌다(2026-10-05 경복궁)
    monkeypatch.setattr(youtube, "_ledger", _Ledger())
    body = {"items": [{"id": {"videoId": "v1"}, "snippet": {
        "title": "&quot;일본이 최고라더니...&quot; 한국 경복궁 보자마자 말문", "description": "",
        "channelTitle": "Tom &amp; Jerry&#39;s", "thumbnails": {}}}]}

    class Reply:
        def __init__(self, data):
            self.data = data

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return json.dumps(self.data).encode()

    monkeypatch.setattr(youtube.urllib.request, "urlopen",
                        lambda req, timeout=0: Reply(body if "search" in req.full_url else {"items": []}))
    [link] = youtube.search("k", "경복궁", "ko")
    assert link["title"] == '"일본이 최고라더니..." 한국 경복궁 보자마자 말문'
    assert link["author"] == "Tom & Jerry's"
