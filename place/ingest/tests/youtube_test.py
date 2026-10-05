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


def _fake_youtube(monkeypatch, first: list[str], second: list[str], views: dict[str, int], shorts: set[str] = frozenset()):
    """1순위(카테고리+반경)·보충 검색 응답, 조회수, 쇼츠 여부를 정해 두고 보낸 검색 요청을 모은다."""
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

    def video(i):
        short = i in shorts
        return {"id": i, "statistics": {"viewCount": str(views.get(i, 0))},
                "contentDetails": {"duration": "PT40S" if short else "PT12M"},
                "player": {"embedWidth": 360 if short else 640, "embedHeight": 640 if short else 360}}

    def fake_urlopen(req, timeout=0):
        q = parse_qs(urlparse(req.full_url).query)
        if "/search" in req.full_url:
            sent.append(q)
            ids = first if "videoCategoryId" in q else second
            return Reply({"items": [_item(i) for i in ids]})
        return Reply({"items": [video(i) for i in q["id"][0].split(",")]})

    monkeypatch.setattr(youtube.urllib.request, "urlopen", fake_urlopen)
    return sent


def test_each_format_fills_to_ten_travel_near_first(monkeypatch):
    # 1순위는 거의 쇼츠라 합쳐서 10개를 세면 롱폼이 비었다(경복궁 쇼츠 9 · 롱폼 1) — 형태마다 10개를 채운다.
    # 제한 없는 검색만 쓰면 이름만 스친 1,090만 회 영상이 맨 앞에 섰다 — 형태 안에서 1순위가 앞선다
    first = ["s1", "s2", "l1"]
    second = ["s2", "big"] + [f"l{i}" for i in range(2, 14)] + [f"s{i}" for i in range(3, 6)]
    sent = _fake_youtube(monkeypatch, first, second, views={"l1": 10, "big": 9_000_000, "l2": 500, "s1": 5, "s2": 7},
                         shorts={"s1", "s2", "s3", "s4", "s5"})
    links = youtube.search("k", "경복궁", "ko", "경복궁", 37.58, 126.97)
    longs = [l["externalId"] for l in links if not youtube.is_short(l)]
    shorts = [l["externalId"] for l in links if youtube.is_short(l)]

    assert longs[:3] == ["l1", "big", "l2"] and len(longs) == 10
    assert shorts == ["s2", "s1", "s3", "s4", "s5"]
    first_q, second_q = sent
    assert first_q["videoCategoryId"] == ["19"] and first_q["location"] == ["37.58,126.97"] and first_q["locationRadius"] == ["10km"]
    assert not {"videoCategoryId", "location", "locationRadius"} & second_q.keys()


def test_no_fill_search_when_both_formats_have_ten(monkeypatch):
    ids = [f"l{i}" for i in range(12)] + [f"s{i}" for i in range(11)]
    sent = _fake_youtube(monkeypatch, first=ids, second=["x"], views={}, shorts={f"s{i}" for i in range(11)})
    links = youtube.search("k", "경복궁", "ko", None, 37.58, 126.97)

    assert len(sent) == 1
    assert len(links) == 20


def test_fills_long_form_even_when_first_pass_has_ten_shorts(monkeypatch):
    # 경복궁 모양: 1순위가 쇼츠 12 · 롱폼 1 — 합쳐 10개가 넘어도 롱폼이 모자라 보충 검색을 한다
    first = [f"s{i}" for i in range(12)] + ["l0"]
    sent = _fake_youtube(monkeypatch, first, second=[f"l{i}" for i in range(1, 12)], views={},
                         shorts={f"s{i}" for i in range(12)})
    links = youtube.search("k", "경복궁", "ko", None, 37.58, 126.97)

    assert len(sent) == 2
    assert sum(1 for l in links if not youtube.is_short(l)) == 10
    assert sum(1 for l in links if youtube.is_short(l)) == 10


def test_short_rule_matches_place_video_format():
    # place VideoFormatTest 와 같은 값 — 두 언어의 규칙이 갈리면 보충 판단과 저장되는 형태가 어긋난다
    case = lambda d, w, h: youtube.is_short({"duration": d, "embedWidth": w, "embedHeight": h})  # noqa: E731
    assert case("PT58S", 360, 640) and case("PT3M", 360, 640)
    assert not case("PT3M1S", 360, 640)
    assert not case("PT45S", 640, 360) and not case("PT44M15S", 640, 360)
    assert not case(None, 360, 640) and not case("PT58S", None, 640) and not case("58초", 360, 640)


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
