"""왕복 — place 목록 응답의 행사 날짜·목록 원문이 보강 잡의 bulk 레코드에 그대로 실린다.

bulk 는 전체 동기화라 UPSERT_FIELDS 에서 빠진 원천 컬럼은 보강 한 번에 사라질 수 있다(§0 ③).
"""
from __future__ import annotations

import json

import pytest

from src import backfill_intro, backfill_media, backfill_overview, place_client
from src import sync_tour
from src.sync_tour import normalize_row, parse_event_date
from tests.fixture_rows import rows

NEW_FIELDS = ("eventStartDate", "eventEndDate", "listRaw")


def _festival_rows() -> list[dict]:
    out = []
    for i, it in enumerate(rows("sample-searchFestival2-ko.json", "itemsWindowToday")):
        rec = normalize_row(it, "ko")
        rec.update(id=i + 1, status="ACTIVE",
                   eventStartDate=parse_event_date(it["eventstartdate"]),
                   eventEndDate=parse_event_date(it["eventenddate"]),
                   listRaw=json.dumps(it, ensure_ascii=False, separators=(",", ":")))
        out.append(rec)
    return out


@pytest.fixture
def fake_place(monkeypatch):
    """place API 를 흉내 낸다 — 목록은 표본 행사, bulk 는 받은 레코드를 모은다."""
    stored = _festival_rows()
    posted: list[dict] = []

    def request(method, path, body=None, timeout=120):
        if method == "GET" and path.startswith("/api/places/attractions/overview-probes"):
            return {"data": {"keys": []}}
        if method == "GET" and path.startswith("/api/places/attractions?"):
            return {"data": {"attractions": [dict(r) for r in stored], "totalElements": len(stored)}}
        if method == "POST" and path.endswith("/bulk"):
            posted.extend(body["attractions"])
            return {"data": {"created": 0, "updated": len(body["attractions"])}}
        if method == "POST" and path.endswith("/overview-probes"):
            return {"data": {"recorded": len(body["probes"])}}
        raise AssertionError(f"모르는 호출 {method} {path}")

    monkeypatch.setattr(place_client, "_request", request)
    for module in (backfill_overview, backfill_intro, backfill_media):
        monkeypatch.setattr(module, "REQUEST_GAP_SEC", 0, raising=False)
    return stored, posted


def _detail(op: str) -> dict:
    item = {"detailCommon2": {"overview": "개요"}, "detailIntro2": {"contentid": "1", "usetimefestival": "무료"},
            "detailImage2": {"originimgurl": "u"}, "detailInfo2": {"infoname": "n"}}[op]
    return {"items": {"item": [item]}}


@pytest.mark.parametrize("job", ["overview", "intro", "media"])
def test_backfill_round_trip_keeps_new_fields(fake_place, monkeypatch, job):
    stored, posted = fake_place
    module = {"overview": backfill_overview, "intro": backfill_intro, "media": backfill_media}[job]
    monkeypatch.setattr(module, "tour_get", lambda key, service, op, params: _detail(op))
    module.run("k", 10, ("ko",))
    assert len(posted) == len(stored)
    by_id = {r["contentId"]: r for r in stored}
    for rec in posted:
        for field in NEW_FIELDS:
            assert rec[field] == by_id[rec["contentId"]][field], (job, field)

