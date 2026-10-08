"""IndexNow 제출 — 스위치 꺼짐 · 본문 모양 · 10,000건 분할 · 응답 코드별 문구(잡은 성공) · 0건 · 조회 창 · 페이지 순회 · 로그에 키·본문 없음.

가짜는 `urllib.request.urlopen` 하나다 — place 내부 조회와 IndexNow 송신이 둘 다 실제 코드 경로를 탄다.
"""
from __future__ import annotations

import io
import json
import socket
import urllib.error
from datetime import datetime
from urllib.parse import parse_qs, urlparse

import pytest

from src import indexnow

KEY = "0123456789abcdef0123456789abcdef"
NOW = datetime(2026, 10, 10, 7, 30, 5)


class _Resp:
    def __init__(self, status: int, body: bytes):
        self.status = status
        self._body = body

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeNet:
    """place 조회는 `items` 를 `page` 개씩 키셋으로 내주고, IndexNow 송신은 `status` 로 답한다."""

    def __init__(self, items: list[dict], page: int = 1000, status: int | str = 200):
        self.items = items
        self.page = page
        self.status = status
        self.place_queries: list[dict] = []
        self.posts: list[dict] = []

    def __call__(self, req, timeout=None):
        url = req.full_url
        if "/internal/attractions/content-updated" in url:
            q = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
            self.place_queries.append(q)
            after = int(q["afterId"])
            rest = [it for it in self.items if it["id"] > after]
            got = rest[:self.page]
            nxt = got[-1]["id"] if len(rest) > self.page else None
            return _Resp(200, json.dumps({"data": {"items": got, "nextAfterId": nxt}}).encode())
        assert url == indexnow.ENDPOINT, url
        self.posts.append({"body": json.loads(req.data.decode()), "timeout": timeout,
                           "headers": {k.lower(): v for k, v in req.header_items()}})
        if self.status == "timeout":
            raise socket.timeout("timed out")
        if self.status in (200, 202):
            return _Resp(self.status, b"")
        raise urllib.error.HTTPError(url, self.status, "x", {}, io.BytesIO(b""))


def _items(n: int) -> list[dict]:
    return [{"id": i, "lang": "ko" if i % 2 else "en"} for i in range(1, n + 1)]


def _run(monkeypatch, net: FakeNet, enabled: str | None = "true", key: str | None = KEY) -> int:
    monkeypatch.setattr("urllib.request.urlopen", net)
    for name, value in (("INDEXNOW_ENABLED", enabled), ("INDEXNOW_KEY", key)):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    return indexnow.run(now=NOW)


@pytest.mark.parametrize("enabled", [None, "false"])
def test_disabled_sends_nothing_and_reports_count(monkeypatch, capsys, enabled):
    net = FakeNet(_items(3))
    assert _run(monkeypatch, net, enabled=enabled) == 0
    assert net.posts == []
    assert "IndexNow 비활성 — 보낼 주소 3건" in capsys.readouterr().out


def test_enabled_posts_host_key_location_and_lang_urls(monkeypatch, capsys):
    net = FakeNet([{"id": 11, "lang": "ko"}, {"id": 12, "lang": "en"}])
    assert _run(monkeypatch, net) == 0
    assert len(net.posts) == 1
    post = net.posts[0]
    assert post["body"] == {
        "host": "place.1989v.com",
        "key": KEY,
        "keyLocation": f"https://place.1989v.com/{KEY}.txt",
        "urlList": ["https://place.1989v.com/attractions/11", "https://place.1989v.com/en/attractions/12"],
    }
    assert post["timeout"] == 30
    assert post["headers"]["content-type"].startswith("application/json")
    out = capsys.readouterr().out
    assert KEY not in out
    assert "attractions/11" not in out


def test_more_than_ten_thousand_urls_split_into_batches(monkeypatch):
    net = FakeNet(_items(10_001))
    assert _run(monkeypatch, net) == 0
    assert [len(p["body"]["urlList"]) for p in net.posts] == [10_000, 1]


@pytest.mark.parametrize("status, phrase", [
    (200, "성공"),
    (202, "키 검증 대기"),
    (400, "400"),
    (403, "키 불일치 — 키 파일 확인"),
    (422, "422"),
    (429, "429"),
    (500, "500"),
    ("timeout", "타임아웃"),
])
def test_each_response_is_logged_by_code_and_job_succeeds(monkeypatch, capsys, status, phrase):
    net = FakeNet(_items(2), status=status)
    assert _run(monkeypatch, net) == 0
    out = capsys.readouterr().out
    assert phrase in out
    assert KEY not in out
    assert "urlList" not in out and "attractions/1" not in out


def test_zero_changed_sends_nothing(monkeypatch, capsys):
    net = FakeNet([])
    assert _run(monkeypatch, net) == 0
    assert net.posts == []
    assert "IndexNow 대상 0건" in capsys.readouterr().out


def test_window_is_last_24h_kst_and_pages_follow_next_after_id(monkeypatch):
    net = FakeNet(_items(2_500), page=1000)
    assert _run(monkeypatch, net) == 0
    assert [q["afterId"] for q in net.place_queries] == ["0", "1000", "2000"]
    for q in net.place_queries:
        assert (q["since"], q["until"]) == ("2026-10-09T07:30:05", "2026-10-10T07:30:05")
        assert q["size"] == "1000"
    assert len(net.posts[0]["body"]["urlList"]) == 2_500


def test_enabled_without_key_sends_nothing(monkeypatch, capsys):
    net = FakeNet(_items(2))
    assert _run(monkeypatch, net, key=None) == 0
    assert net.posts == []
    assert "IndexNow 키 없음 — 보낼 주소 2건" in capsys.readouterr().out
