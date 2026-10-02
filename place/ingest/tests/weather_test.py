"""날씨 수집 — 발표 시각 규칙 · 원문 보존 · 회차당 호출 수 = 고유 격자 수 · 한도 초과 중단 · 단위별 실패 격리."""
from __future__ import annotations

import json
from datetime import datetime
from urllib.parse import parse_qs, urlparse

import pytest

from src import datagokr, place_client, weather, weather_grid
from tests.datagokr_test import LIMIT_XML, Recorder, ok_body
from tests.fixture_rows import load

SAMPLE = load("phase2-weather.json")
SHORT_0500 = SAMPLE["shortForecast0500"]
SHORT_1700 = SAMPLE["shortForecast1700"]
AREAS = weather_grid.assign(SAMPLE["administrativeRegions"])


def _query(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def _client(replies, api=weather.SHORT_API, budget=weather.SHORT_BUDGET) -> tuple[datagokr.Client, Recorder]:
    fake = Recorder(replies)
    return datagokr.Client(key="K", api=api, budget=budget, gap_sec=0, fetch=fake), fake


def _grid_items(nx: int, ny: int, rows=SHORT_0500) -> list[dict]:
    return [{**r, "nx": nx, "ny": ny} for r in rows]


@pytest.mark.parametrize("now, base", [
    ("2026-10-02 05:25", "2026-10-02 05:00"),   # 잡 시각 — 발표 25분 뒤
    ("2026-10-02 17:25", "2026-10-02 17:00"),
    ("2026-10-02 05:05", "2026-10-01 17:00"),   # 발표 10분 전까지는 아직 API 에 없다 — 앞 발표
    ("2026-10-02 23:59", "2026-10-02 17:00"),
    ("2026-10-03 00:30", "2026-10-02 17:00"),
])
def test_short_base_is_the_latest_0500_or_1700_already_published(now, base):
    assert weather.short_base(datetime.fromisoformat(now)) == datetime.fromisoformat(base)


@pytest.mark.parametrize("now, tm_fc", [
    ("2026-10-02 06:25", "2026-10-02 06:00"),
    ("2026-10-02 06:05", "2026-10-01 06:00"),   # 06시 발표가 API 에 실리기 전 — 어제 06시
    ("2026-10-02 19:00", "2026-10-02 06:00"),   # 18시 발표는 4일 뒤 값이 없어 쓰지 않는다
])
def test_mid_uses_the_0600_issue(now, tm_fc):
    assert weather.mid_tm_fc(datetime.fromisoformat(now)) == datetime.fromisoformat(tm_fc)


def test_short_record_keeps_every_source_row_verbatim():
    for rows in (SHORT_0500, SHORT_1700):
        rec = weather.short_record(rows)
        assert (rec["nx"], rec["ny"], rec["baseDate"]) == (60, 127, "20261002")
        assert json.loads(rec["itemsRaw"]) == rows
    # 범주 12종 + 일 최저·최고 — 원천이 주는 범주를 하나도 버리지 않는다
    assert {r["category"] for r in SHORT_0500} == {"TMP", "UUU", "VVV", "VEC", "WSD", "SKY", "PTY", "POP", "WAV", "PCP",
                                                   "REH", "SNO", "TMN", "TMX"}


def test_short_record_refuses_mixed_grids_or_issues():
    with pytest.raises(ValueError):
        weather.short_record(_grid_items(60, 127) + _grid_items(61, 127)[:1])
    with pytest.raises(ValueError):
        weather.short_record(SHORT_0500 + SHORT_1700[:1])
    with pytest.raises(ValueError):
        weather.short_record([])


def test_the_1700_issue_fits_one_page_at_1500_rows():
    """실측: 17시 발표는 1,052행 — 쪽 크기 1,000 이면 두 콜이 된다. 1,500 이면 한 콜."""
    assert SAMPLE["_meta"]["shortTotal1700"] == len(SHORT_1700) == 1052
    client, fake = _client([(200, ok_body(SHORT_1700, total=1052))])
    rows = weather.fetch_short(client, 60, 127, datetime(2026, 10, 2, 17))
    assert len(rows) == 1052 and len(fake.sent) == 1
    assert _query(fake.sent[0])["numOfRows"] == "1500"


def test_one_short_run_calls_once_per_unique_grid_and_pushes_in_chunks(monkeypatch):
    grids = sorted({(a["nx"], a["ny"]) for a in AREAS})
    assert len(grids) == 243
    pushed: list[list[dict]] = []
    monkeypatch.setattr(place_client, "put_weather_short",
                        lambda records: pushed.append(records) or {"applied": len(records), "sigungu": len(records)})
    client, fake = _client([(200, ok_body(_grid_items(nx, ny), total=907)) for nx, ny in grids])

    summary = weather.run_short("K", datetime(2026, 10, 2, 5, 25), client=client, areas=AREAS)

    queries = [_query(u) for u in fake.sent]
    assert len(fake.sent) == summary["calls"] == 243 <= weather.SHORT_BUDGET
    assert [(int(q["nx"]), int(q["ny"])) for q in queries] == grids
    assert {(q["base_date"], q["base_time"]) for q in queries} == {("20261002", "0500")}
    assert [len(c) for c in pushed] == [10] * 24 + [3]
    assert summary["applied"] == 243 and summary["failed"] is False and summary["stopped"] is None
    # 하루 두 회차가 한도 안이다
    assert 2 * summary["calls"] <= 1000


def test_a_failed_grid_does_not_stop_the_rest_and_its_old_issue_is_left_alone(monkeypatch):
    pushed: list[dict] = []
    monkeypatch.setattr(place_client, "put_weather_short", lambda records: pushed.extend(records) or {"applied": len(records)})
    areas = [a for a in AREAS if a["sigunguCode"] in ("11110", "26350", "50110")]
    grids = sorted({(a["nx"], a["ny"]) for a in areas})
    replies = [(500, "upstream")] + [(200, ok_body(_grid_items(nx, ny))) for nx, ny in grids[1:]]
    client, _ = _client(replies)
    summary = weather.run_short("K", datetime(2026, 10, 2, 17, 25), client=client, areas=areas)
    # 실패한 격자는 보내지 않는다 — place 는 받은 격자만 덮으므로 그 격자의 이전 발표본이 남는다
    assert {(r["nx"], r["ny"]) for r in pushed} == set(grids[1:])
    assert summary["failed"] is True


def test_quota_stops_the_short_api_and_pushes_what_was_received(monkeypatch):
    pushed: list[dict] = []
    monkeypatch.setattr(place_client, "put_weather_short", lambda records: pushed.extend(records) or {"applied": len(records)})
    grids = sorted({(a["nx"], a["ny"]) for a in AREAS})
    client, fake = _client([(200, ok_body(_grid_items(*grids[0]))), (200, LIMIT_XML)] + [(200, ok_body([]))] * 10)
    summary = weather.run_short("K", datetime(2026, 10, 2, 5, 25), client=client, areas=AREAS)
    assert len(fake.sent) == 2 and len(pushed) == 1
    assert summary["stopped"] and summary["failed"] is False


def test_one_mid_run_asks_10_land_regions_and_each_used_temperature_region(monkeypatch):
    land_item, ta_item = SAMPLE["midLand"][0], SAMPLE["midTa"][0]
    pushed: list[dict] = []
    monkeypatch.setattr(place_client, "put_weather_mid", lambda records: pushed.extend(records) or {"applied": len(records)})
    lands = sorted({a["landRegId"] for a in AREAS})
    tas = sorted({a["taRegId"] for a in AREAS})
    replies = ([(200, ok_body([{**land_item, "regId": r}])) for r in lands]
               + [(200, ok_body([{**ta_item, "regId": r}])) for r in tas])
    client, fake = _client(replies, api=weather.MID_API, budget=weather.MID_BUDGET)

    summary = weather.run_mid("K", datetime(2026, 10, 2, 6, 25), client=client, areas=AREAS)

    assert len(fake.sent) == summary["calls"] == 10 + 163 <= weather.MID_BUDGET
    assert sum("getMidLandFcst" in u for u in fake.sent) == 10
    assert {_query(u)["tmFc"] for u in fake.sent} == {"202610020600"}
    assert [(r["kind"], r["regId"]) for r in pushed] == [("LAND", r) for r in lands] + [("TA", r) for r in tas]
    # 원문 그대로 — 육상 23키 · 기온 43키
    assert json.loads(pushed[0]["itemRaw"]) == {**land_item, "regId": lands[0]}
    assert json.loads(pushed[-1]["itemRaw"]) == {**ta_item, "regId": tas[-1]}
    assert summary["failed"] is False


def test_mid_record_refuses_a_row_without_region_or_unknown_kind():
    with pytest.raises(ValueError):
        weather.mid_record("TA", datetime(2026, 10, 2, 6), {"taMin4": 10})
    with pytest.raises(ValueError):
        weather.mid_record("SEA", datetime(2026, 10, 2, 6), SAMPLE["midLand"][0])


def test_the_job_entry_runs_short_or_mid(monkeypatch):
    from src import main
    calls: list[str] = []
    monkeypatch.setattr(weather, "run_short", lambda key, now: calls.append("short") or {"failed": False})
    monkeypatch.setattr(weather, "run_mid", lambda key, now: calls.append("mid") or {"failed": True})
    assert main._job_weather("short", key="K") == 0
    assert main._job_weather("mid", key="K") == 1
    assert calls == ["short", "mid"]
