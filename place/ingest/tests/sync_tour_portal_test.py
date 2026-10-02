"""행사·숙박·코스 목록 수집 — 정규화 분리 · 세 오퍼레이션 · 날짜 · 제외 건수 · 실패 격리."""
from __future__ import annotations

import json
from datetime import date

import pytest

from src import main, place_client, sync_tour
from src.fix_legacy_en_type import corrected
from tests.fixture_rows import all_rows, load, rows

TODAY = date(2026, 10, 2)


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(sync_tour.time, "sleep", lambda s: None)


def _source(monkeypatch, pages: list[list[dict]], total: int | None = None) -> list[tuple]:
    """tour_get 을 표본 응답으로 바꾼다. 호출 기록 (service, op, params) 를 돌려준다."""
    calls: list[tuple] = []

    def fake(key, service, op, params):
        calls.append((service, op, dict(params)))
        page = pages[params["pageNo"] - 1] if params["pageNo"] <= len(pages) else []
        return {"items": {"item": page} if page else "",
                "totalCount": total if total is not None else sum(len(p) for p in pages)}

    monkeypatch.setattr(sync_tour, "tour_get", fake)
    return calls


def test_area_based_sync_output_is_unchanged_for_all_sample_rows(monkeypatch):
    """분리 전 fetch_area_based 가 표본 전량에 낸 결과와 같다. 바뀌는 것은 새 유형의 category 뿐이다."""
    before = load("sync_area_based_before.json")
    new_type = {"15": "festival", "85": "festival", "32": "stay", "80": "stay", "25": "course"}
    for svc, service, lang in (("kor", "KorService2", "ko"), ("eng", "EngService2", "en")):
        _source(monkeypatch, [all_rows(service)])
        got = sync_tour.fetch_area_based("k", svc, "attraction", None, 200000, False)
        want = [dict(r) for r in before[lang]["rows"]]
        for r in want:
            if r["contentTypeId"] in new_type:
                r["category"] = new_type[r["contentTypeId"]]
        assert got == want
        assert all("listRaw" not in r and "eventStartDate" not in r for r in got)


def test_festival_window_is_kst_today_minus_365_and_pages_to_the_end(monkeypatch):
    items = rows("sample-searchFestival2-ko.json", "itemsWindowToday")
    calls = _source(monkeypatch, [items, items, items[:1]], total=250)
    recs, counts = sync_tour.fetch_portal("k", "kor", "festival", TODAY)
    assert [(s, op) for s, op, _ in calls] == [("KorService2", "searchFestival2")] * 3
    assert {p["eventStartDate"] for _, _, p in calls} == {"20251002"}
    assert [p["pageNo"] for _, _, p in calls] == [1, 2, 3]
    assert counts["calls"] == 3 and counts["loaded"] == len(recs) == 7


def test_stay_and_course_operations(monkeypatch):
    calls = _source(monkeypatch, [rows("sample-searchStay2-ko.json", "items")])
    sync_tour.fetch_portal("k", "kor", "stay", TODAY)
    assert calls[0][1] == "searchStay2" and "contentTypeId" not in calls[0][2]

    calls = _source(monkeypatch, [rows("sample-course-ko.json", "items")])
    recs, _ = sync_tour.fetch_portal("k", "kor", "course", TODAY)
    assert calls[0][1] == "areaBasedList2" and calls[0][2]["contentTypeId"] == "25"
    assert {r["contentTypeId"] for r in recs} == {"25"} and len(recs) == 3


@pytest.mark.parametrize("raw,expected", [
    ("20261005", "2026-10-05"), ("", None), (None, None), ("0", None), ("2026100", None), ("20261340", None),
])
def test_event_date_conversion(raw, expected):
    assert sync_tour.parse_event_date(raw) == expected


def test_bad_event_date_keeps_the_row_and_counts_it(monkeypatch):
    items = rows("sample-searchFestival2-ko.json", "itemsWindowToday")
    items[1]["eventenddate"] = "20261340"
    items[2]["eventstartdate"] = "0"
    _source(monkeypatch, [items])
    recs, counts = sync_tour.fetch_portal("k", "kor", "festival", TODAY)
    assert len(recs) == 3 and counts["dateFailures"] == 2
    assert (recs[0]["eventStartDate"], recs[0]["eventEndDate"]) == ("2026-11-07", "2026-11-08")
    assert (recs[1]["eventStartDate"], recs[1]["eventEndDate"]) == ("2026-10-19", None)
    assert recs[2]["eventStartDate"] is None and recs[2]["eventEndDate"] == "2026-10-18"
    assert json.loads(recs[1]["listRaw"])["eventenddate"] == "20261340"   # 원문은 남는다


def test_list_raw_is_the_whole_source_row(monkeypatch):
    items = rows("sample-searchStay2-ko.json", "items")
    _source(monkeypatch, [items])
    recs, _ = sync_tour.fetch_portal("k", "kor", "stay", TODAY)
    assert [json.loads(r["listRaw"]) for r in recs] == items
    assert all("eventStartDate" not in r for r in recs)


def test_excluded_rows_are_counted(monkeypatch):
    """영문 숙박: 다른 유형 76 두 건 · contentid 빈 85 한 건 · 좌표 없는 80 한 건을 버리고 센다."""
    items = (rows("sample-searchStay2-en.json", "items") + rows("sample-searchStay2-en.json", "itemsNotType80")
             + rows("sample-searchStay2-en.json", "itemsWithoutCoordinates"))
    _source(monkeypatch, [items])
    recs, counts = sync_tour.fetch_portal("k", "eng", "stay", TODAY)
    assert len(recs) == 3 and {r["contentTypeId"] for r in recs} == {"80"}
    assert (counts["otherType"], counts["noContentId"], counts["noCoordinates"]) == (2, 1, 1)
    assert counts["received"] == 7


def test_one_type_language_failure_does_not_stop_the_rest(monkeypatch):
    attempted, upserted = [], []

    def fake_fetch(key, service, content_type, today):
        attempted.append((service, content_type))
        if (service, content_type) == ("kor", "festival"):
            raise sync_tour.TourApiError("거부")
        return [{"contentId": f"{service}-{content_type}"}], {
            "calls": 1, "received": 1, "loaded": 1, "noCoordinates": 0, "dateFailures": 0,
            "otherType": 0, "noContentId": 0, "noTitle": 0}

    monkeypatch.setattr(sync_tour, "fetch_portal", fake_fetch)
    monkeypatch.setattr(place_client, "bulk_upsert", lambda recs: (upserted.extend(recs), (len(recs), 0))[1])
    code = main._job_tour_portal_sync("k", TODAY)
    # 코스는 영문 유형이 없어 부르지 않는다
    assert attempted == [("kor", "festival"), ("eng", "festival"), ("kor", "stay"), ("eng", "stay"),
                         ("kor", "course")]
    assert [r["contentId"] for r in upserted] == ["eng-festival", "kor-stay", "eng-stay", "kor-course"]
    assert code == 1


def test_legacy_en_fix_changes_only_type_and_ldong():
    """Q2 — detailCommon2 가 답한 값(2948191: 76 · 28/155)만 바꾸고 나머지 필드는 그대로 되돌려 보낸다."""
    row = {"contentId": "2948191", "lang": "en", "title": "Paradise City", "latitude": 0.0, "longitude": 0.0,
           "contentTypeId": None, "ldongRegnCd": None, "ldongSignguCd": None, "overview": "kept"}
    rec = corrected(row, {"contentid": "2948191", "contenttypeid": "76", "lDongRegnCd": "28", "lDongSignguCd": "155"})
    assert (rec["contentTypeId"], rec["ldongRegnCd"], rec["ldongSignguCd"]) == ("76", "28", "155")
    assert {k: v for k, v in rec.items() if k not in ("contentTypeId", "ldongRegnCd", "ldongSignguCd")} == \
        {k: v for k, v in row.items() if k not in ("contentTypeId", "ldongRegnCd", "ldongSignguCd")}
