"""지역 방문자 — 시군구 코드 연결 · 원문 보존 · 수집 창 · 백필 · 단위별 실패 격리."""
from __future__ import annotations

import json
from datetime import date
from urllib.parse import parse_qs, urlparse

import pytest

from src import datagokr, place_client, visitors
from tests.datagokr_test import LIMIT_XML, Recorder, ok_body
from tests.fixture_rows import load

SAMPLE = load("phase2-visitors.json")
BASIC = SAMPLE["basicRows"]
METRO = SAMPLE["metroRows"]


def _query(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def _client(replies, budget=visitors.DAILY_BUDGET) -> tuple[datagokr.Client, Recorder]:
    fake = Recorder(replies)
    return datagokr.Client(key="K", api=visitors.API, budget=budget, gap_sec=0, fetch=fake), fake


def test_all_269_sigungu_codes_of_the_source_are_our_administrative_regions():
    """실측(2026-10-02): 기초 한 날 807행의 시군구 코드 269개가 운영 administrative_regions 시군구 269개와 같다."""
    source = {r["signguCode"] for r in BASIC}
    ours = {r["code"] for r in SAMPLE["administrativeRegions"] if r["level"] == "SIGUNGU"}
    assert len(source) == 269 and SAMPLE["_meta"]["basicTotal"] == 807
    assert source == ours


def test_metro_codes_are_our_sido_except_the_old_gwangju_jeonnam_codes():
    source = {r["areaCode"] for r in METRO}
    ours = {r["code"] for r in SAMPLE["administrativeRegions"] if r["level"] == "SIDO"}
    # 통합(12) 이전 코드 29·46 이 2026-08-18 까지 한 행씩 더 온다 — 원천 전부 적재라 저장은 하고, 허브는 그 코드를 묻지 않는다
    assert source - ours == {"29", "46"}
    assert ours <= source


def test_record_keeps_every_source_key_and_value_verbatim():
    for level, rows in (("SIGUNGU", BASIC), ("SIDO", METRO)):
        for row in rows:
            rec = visitors.record(level, row)
            assert rec["regionLevel"] == level
            assert {k: rec[k] for k in row} == row
    # 부동소수 표기를 고치지 않는다 — 파생(반올림)은 place 가 따로 둔다
    floaty = next(r for r in BASIC if len(r["touNum"].split(".")[-1]) > 5)
    assert visitors.record("SIGUNGU", floaty)["touNum"] == floaty["touNum"]


def test_record_rejects_a_row_without_a_number_or_code():
    with pytest.raises(ValueError):
        visitors.record("SIGUNGU", {**BASIC[0], "touNum": "N/A"})
    with pytest.raises(ValueError):
        visitors.record("SIDO", BASIC[0])  # 광역 행에 있어야 할 areaCode 가 없다


def test_daily_window_asks_both_operations_for_the_published_range_and_pushes_sorted_records(monkeypatch):
    pushed: list[list[dict]] = []
    monkeypatch.setattr(place_client, "put_region_visitors",
                        lambda records: pushed.append(records) or {"applied": len(records), "regions": 0})
    client, fake = _client([(200, ok_body(list(reversed(BASIC)))), (200, ok_body(METRO))])

    summary = visitors.run_daily("K", today=date(2026, 10, 2), client=client)

    q_basic, q_metro = (_query(u) for u in fake.sent)
    assert "locgoRegnVisitrDDList" in fake.sent[0] and "metcoRegnVisitrDDList" in fake.sent[1]
    # 공개 지연 30일(실측) — 창은 D-37 ~ D-28 열흘, 한 쪽(10000행)에 들어간다
    assert (q_basic["startYmd"], q_basic["endYmd"]) == ("20260826", "20260904")
    assert (q_metro["startYmd"], q_metro["endYmd"]) == ("20260826", "20260904")
    assert q_basic["numOfRows"] == "10000"
    assert summary["calls"] == 2 and summary["failed"] is False
    basic_codes = [r["signguCode"] for r in pushed[0]]
    assert basic_codes == sorted(basic_codes)
    assert summary["levels"]["SIGUNGU"]["latest"] == "20260901"


def test_a_failed_level_does_not_stop_the_other_and_marks_the_run_failed(monkeypatch):
    pushed: list[str] = []
    monkeypatch.setattr(place_client, "put_region_visitors",
                        lambda records: pushed.append(records[0]["regionLevel"]) or {"applied": len(records)})
    client, _ = _client([(500, "upstream"), (200, ok_body(METRO))])
    summary = visitors.run_daily("K", today=date(2026, 10, 2), client=client)
    assert pushed == ["SIDO"] and summary["failed"] is True


def test_an_empty_window_pushes_nothing_and_is_a_failure(monkeypatch):
    """창 안에 공개된 날이 없다 = 공개 지연이 창보다 길어졌다. 조용히 0건 성공으로 끝나면 아무도 모른다."""
    called = []
    monkeypatch.setattr(place_client, "put_region_visitors", lambda records: called.append(records))
    client, _ = _client([(200, ok_body([], total=0)), (200, ok_body([], total=0))])
    summary = visitors.run_daily("K", today=date(2026, 10, 2), client=client)
    assert called == [] and summary["failed"] is True


def test_quota_stops_the_api_and_keeps_what_was_received(monkeypatch):
    pushed = []
    monkeypatch.setattr(place_client, "put_region_visitors", lambda records: pushed.append(records) or {"applied": 0})
    client, fake = _client([(200, ok_body(BASIC)), (200, LIMIT_XML)])
    summary = visitors.run_daily("K", today=date(2026, 10, 2), client=client)
    assert len(pushed) == 1 and len(fake.sent) == 2
    assert summary["stopped"] and summary["failed"] is False


def test_backfill_walks_months_and_pages_until_the_total_is_read(monkeypatch):
    pushed: list[tuple[str, int]] = []
    monkeypatch.setattr(place_client, "put_region_visitors",
                        lambda records: pushed.append((records[0]["regionLevel"], len(records))) or {"applied": len(records)})
    # 9월: 기초 두 쪽(합계 2만 남짓이라 가정) · 광역 한 쪽 / 10월: 아직 공개 전이라 0건
    replies = [
        (200, ok_body(BASIC, total=10_000 + len(BASIC))), (200, ok_body(BASIC, total=10_000 + len(BASIC))),
        (200, ok_body(METRO)),
        (200, ok_body([], total=0)), (200, ok_body([], total=0)),
    ]
    client, fake = _client(replies, budget=visitors.BACKFILL_BUDGET)
    summary = visitors.run_backfill("K", "2026-09", today=date(2026, 10, 2), client=client)

    pages = [_query(u) for u in fake.sent]
    assert [(p["startYmd"], p["endYmd"], p["pageNo"]) for p in pages] == [
        ("20260901", "20260930", "1"), ("20260901", "20260930", "2"), ("20260901", "20260930", "1"),
        ("20261001", "20261001", "1"), ("20261001", "20261001", "1"),
    ]
    assert pushed == [("SIGUNGU", 2 * len(BASIC)), ("SIDO", len(METRO))]
    assert summary["calls"] == 5 and summary["failed"] is False


def test_months_between_is_inclusive_and_rejects_a_bad_month():
    assert visitors.months("2025-11", date(2026, 2, 3)) == [date(2025, 11, 1), date(2025, 12, 1), date(2026, 1, 1), date(2026, 2, 1)]
    with pytest.raises(ValueError):
        visitors.months("2026-13", date(2026, 10, 2))


def test_records_serialize_to_json_without_loss():
    rec = visitors.record("SIGUNGU", BASIC[0])
    assert json.loads(json.dumps(rec, ensure_ascii=False)) == rec
