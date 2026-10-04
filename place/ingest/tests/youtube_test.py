"""유튜브 영상 정보 — videos.list 항목에서 조회수·길이·플레이어 크기를 원문대로 꺼낸다."""
from __future__ import annotations

import json
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
