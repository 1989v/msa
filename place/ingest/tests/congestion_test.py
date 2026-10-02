"""관광지 집중률 — 원문 보존 · 이름별 묶음 · 시군구별 수집 · 0건 시군구 기록 · 단위별 실패 격리."""
from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse

import pytest

from src import congestion, datagokr, name_match, place_client
from tests.datagokr_test import LIMIT_XML, Recorder, ok_body
from tests.fixture_rows import load

SAMPLE = load("phase2-congestion.json")
ROWS = SAMPLE["sourceRows26350"]
SIGUNGU = [r for r in load("phase2-weather.json")["administrativeRegions"] if r["level"] == "SIGUNGU"]
OURS = [{"id": i, "title": t, "lang": "ko", "ldongRegnCd": sg[:2], "ldongSignguCd": sg[2:]}
        for sg, rows in SAMPLE["ours"].items() for i, t in rows]


def _query(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def test_record_keeps_every_source_row_verbatim_and_derives_the_window_and_match():
    rows = [r for r in ROWS if r["tAtsNm"] == ROWS[0]["tAtsNm"]]
    assert len(rows) == 30
    rec = congestion.record(list(reversed(rows)), name_match.Match(7, "EXACT", (7,)))
    raw = json.loads(rec["ratesRaw"])
    # 원천 행 30개를 키·값 그대로, 예측일 순으로
    assert raw == sorted(rows, key=lambda r: r["baseYmd"])
    assert (rec["firstYmd"], rec["lastYmd"]) == ("2026-10-02", "2026-10-31")
    assert (rec["tAtsNm"], rec["areaCd"], rec["signguNm"]) == (rows[0]["tAtsNm"], "26", "해운대구")
    assert (rec["attractionId"], rec["matchMethod"]) == (7, "EXACT")


def test_record_refuses_rows_of_two_places_or_a_broken_rate():
    a, b = ROWS[0], next(r for r in ROWS if r["tAtsNm"] != ROWS[0]["tAtsNm"])
    with pytest.raises(ValueError):
        congestion.record([a, b], name_match.Match(None, "NONE", ()))
    with pytest.raises(ValueError):
        congestion.record([{**a, "cnctrRate": "높음"}], name_match.Match(None, "NONE", ()))


def test_group_makes_one_record_per_place_with_its_thirty_days():
    records = congestion.records_for(ROWS, name_match.candidates_by_sigungu(OURS)["26350"])
    assert len(records) == 19
    assert {len(json.loads(r["ratesRaw"])) for r in records} == {30}
    # 해운대구 실측: 정확 14 · 정규화 0 · 포함(화면에 안 씀) 2 · 못 맞춤 3
    methods = sorted(r["matchMethod"] for r in records)
    assert methods.count("EXACT") == 14 and methods.count("CONTAINS") == 2 and methods.count("NONE") == 3


def _run(replies, monkeypatch, regions=None, budget=congestion.DAILY_BUDGET):
    pushed: dict[str, list[dict]] = {}
    monkeypatch.setattr(place_client, "put_congestion",
                        lambda sigungu, records: pushed.setdefault(sigungu, records) and {"applied": len(records), "removed": 0})
    fake = Recorder(replies)
    client = datagokr.Client(key="K", api=congestion.API, budget=budget, gap_sec=0, fetch=fake)
    summary = congestion.run("K", client=client, regions=regions or SIGUNGU, attractions=OURS)
    return summary, fake, pushed


def test_every_one_of_269_sigungu_is_asked_once_with_area_and_sigungu_codes(monkeypatch):
    replies = [(200, ok_body(ROWS)) if r["code"] == "26350" else (200, ok_body([])) for r in SIGUNGU]
    summary, fake, pushed = _run(replies, monkeypatch)

    assert len(fake.sent) == 269 == summary["calls"]
    q = _query(next(u for u in fake.sent if "signguCd=26350" in u))
    assert (q["areaCd"], q["signguCd"], q["numOfRows"]) == ("26", "26350", "10000")
    # 광주·전남은 통합 코드 12 로 묻는다(우리 administrative_regions 그대로)
    assert any(_query(u)["signguCd"].startswith("12") and _query(u)["areaCd"] == "12" for u in fake.sent)
    # 행이 온 시군구만 보낸다 — 0건 시군구는 place 에 아무것도 보내지 않아 이전 값이 남는다
    assert list(pushed) == ["26350"]
    assert len(summary["empty"]) == 268 and "12110" in summary["empty"]
    assert summary["methods"] == {"EXACT": 14, "CONTAINS": 2, "NONE": 3}
    assert summary["failed"] is False


def test_one_failed_sigungu_does_not_stop_the_rest_and_sends_nothing_for_it(monkeypatch):
    regions = [r for r in SIGUNGU if r["code"] in ("11110", "26350")]
    summary, _, pushed = _run([(500, "oops"), (200, ok_body(ROWS))], monkeypatch, regions=regions)
    assert list(pushed) == ["26350"]
    assert summary["failedUnits"] == ["11110"] and summary["failed"] is True


def test_quota_stop_keeps_what_was_received_and_is_not_a_failure(monkeypatch):
    regions = [r for r in SIGUNGU if r["code"] in ("26350", "11110", "50110")]
    # 시군구 코드 순 — 11110(0건) → 26350(받음) → 50110(한도 초과)
    summary, fake, pushed = _run([(200, ok_body([])), (200, ok_body(ROWS)), (200, LIMIT_XML)], monkeypatch, regions=regions)
    assert len(fake.sent) == 3
    assert list(pushed) == ["26350"]
    assert summary["stopped"] and summary["failed"] is False


def test_all_sigungu_empty_is_a_failure(monkeypatch):
    """원천이 통째로 빈 날 — 성공으로 끝나면 아무도 모른다."""
    regions = [r for r in SIGUNGU if r["code"] in ("11110", "26350")]
    summary, _, pushed = _run([(200, ok_body([])), (200, ok_body([]))], monkeypatch, regions=regions)
    assert pushed == {} and summary["failed"] is True
