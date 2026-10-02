"""전량 스캔 — 키셋으로 바꿔도 받는 행 집합·순서(id 오름차순)가 OFFSET 때와 같다."""
from __future__ import annotations

import urllib.parse

import pytest

from src import place_client

SERVER_CAP = 200   # place 컨트롤러의 size 상한


def _fake_place(monkeypatch, stored: list[dict], max_calls: int = 1000):
    """place 목록 API 를 흉내 낸다 — 컨트롤러와 같은 규칙(id 정렬, size 상한, size+1 로 다음 유무 판정)."""
    stored = sorted(stored, key=lambda r: r["id"])
    calls: list[dict] = []

    def request(method, path, body=None, timeout=120):
        assert method == "GET" and path.startswith("/api/places/attractions?"), path
        q = {k: v[0] for k, v in urllib.parse.parse_qs(path.split("?", 1)[1]).items()}
        calls.append(q)
        if len(calls) > max_calls:
            raise AssertionError("호출이 끝나지 않는다")
        size = min(max(int(q["size"]), 1), SERVER_CAP)
        if "afterId" in q:
            after = int(q["afterId"])
            nxt = [r for r in stored if r["id"] > after][: size + 1]
            items = nxt[:size]
            return {"data": {"attractions": [dict(r) for r in items], "totalElements": -1,
                             "totalPages": -1, "currentPage": -1,
                             "nextAfterId": items[-1]["id"] if len(nxt) > size else None}}
        page = int(q["page"])
        items = stored[page * size:(page + 1) * size]
        return {"data": {"attractions": [dict(r) for r in items], "totalElements": len(stored)}}

    monkeypatch.setattr(place_client, "_request", request)
    return calls


def _rows(ids):
    return [{"id": i, "contentId": str(i), "lang": "ko"} for i in ids]


def test_키셋_결과가_id_오름차순_전량이다(monkeypatch):
    # id 에 구멍이 있고 저장 순서가 섞여 있어도 결과는 id 오름차순 전량
    ids = [i for i in range(1, 1300) if i % 7] + [5000, 4999]
    calls = _fake_place(monkeypatch, list(reversed(_rows(ids))))

    got = place_client.fetch_attractions()

    assert [r["id"] for r in got] == sorted(ids)
    assert all("page" not in c for c in calls), "OFFSET 페이지를 부르지 않는다"
    assert calls[0]["afterId"] == "0"


def test_size_로_딱_떨어져도_빈_요청을_더_하지_않는다(monkeypatch):
    calls = _fake_place(monkeypatch, _rows(range(1, SERVER_CAP * 2 + 1)))

    got = place_client.fetch_attractions()

    assert len(got) == SERVER_CAP * 2
    assert len(calls) == 2


def test_totalElements_를_믿지_않는다(monkeypatch):
    # 키셋 응답의 totalElements 는 -1 — 그걸 보고 첫 페이지에서 멈추면 안 된다
    _fake_place(monkeypatch, _rows(range(1, 501)))

    assert len(place_client.fetch_attractions()) == 500


def test_빈_테이블이면_한_번만_부르고_끝난다(monkeypatch):
    calls = _fake_place(monkeypatch, [])

    assert place_client.fetch_attractions() == []
    assert len(calls) == 1


def test_커서가_앞으로_가지_않으면_멈춘다(monkeypatch):
    calls = []

    def request(method, path, body=None, timeout=120):
        # 서버가 매번 같은 페이지·같은 nextAfterId 를 준다
        calls.append(path)
        if len(calls) > 100:
            raise AssertionError("가드 없이 무한히 되읽는다")
        return {"data": {"attractions": _rows([1, 2]), "nextAfterId": 2}}

    monkeypatch.setattr(place_client, "_request", request)
    with pytest.raises(RuntimeError, match="앞으로 가지 않는다"):
        place_client.fetch_attractions()
