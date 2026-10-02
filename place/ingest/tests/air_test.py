"""대기 수집 — 측정소 좌표 규칙(dmX=위도) · 전국 한 응답 672행 · 측정소별 측정 시각 보존 · 원문 그대로 · 시군구 측정소 후보 · 시간 초과 재시도."""
from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse

import pytest

from src import air, datagokr, place_client, weather_grid
from tests.datagokr_test import LIMIT_XML, Recorder
from tests.fixture_rows import load

SAMPLE = load("phase2-air.json")
STATIONS = SAMPLE["stations"]
MEASUREMENTS = SAMPLE["measurements"]
REGIONS = load("phase2-weather.json")["administrativeRegions"]


def airkorea_body(rows: list[dict], total: int | None = None, code: str = "00") -> str:
    """에어코리아 정상 봉투 — 2026-10-02 운영 응답과 같은 모양(`items` 가 행 배열 그 자체, 결과코드 00)."""
    return json.dumps({"response": {"body": {"totalCount": len(rows) if total is None else total, "items": rows,
                                             "pageNo": 1, "numOfRows": len(rows)},
                                    "header": {"resultMsg": "NORMAL_CODE", "resultCode": code}}}, ensure_ascii=False)


TIMEOUT_JSON = json.dumps({"response": {"header": {"resultMsg": "SERVICETIMEOUT_ERROR", "resultCode": "05"}}})


def _client(replies, api=air.MEASURE_API, budget=air.MEASURE_BUDGET) -> tuple[datagokr.Client, Recorder]:
    fake = Recorder(replies)
    return datagokr.Client(key="K", api=api, budget=budget, gap_sec=0, fetch=fake, retries=air.RETRIES, retry_wait_sec=0), fake


def test_station_coordinates_take_dmX_as_latitude_and_dmY_as_longitude():
    jung = next(s for s in STATIONS if s["stationName"] == "중구")
    rec = air.station_record(jung)
    # 서울 중구 측정소(덕수궁길 15) — 원천 필드 이름과 반대로 dmX 가 위도다
    assert (rec["latitude"], rec["longitude"]) == (37.564639, 126.975961)
    assert json.loads(rec["itemRaw"]) == jung
    assert len([air.station_record(s) for s in STATIONS]) == 672


def test_swapped_coordinates_fall_outside_korea_and_are_rejected():
    jung = next(s for s in STATIONS if s["stationName"] == "중구")
    with pytest.raises(ValueError, match="한반도"):
        air.station_record({**jung, "dmX": jung["dmY"], "dmY": jung["dmX"]})
    with pytest.raises(ValueError):
        air.station_record({**jung, "dmX": ""})


def test_one_national_call_loads_672_rows_raw_with_each_station_own_data_time(monkeypatch):
    pushed: list[list[dict]] = []
    monkeypatch.setattr(place_client, "put_air_measurements",
                        lambda recs: pushed.append(recs) or {"applied": len(recs), "sigungu": 0})
    client, fake = _client([(200, airkorea_body(MEASUREMENTS))])
    summary = air.run_measurements("K", client=client)

    assert len(fake.sent) == 1
    q = {k: v[0] for k, v in parse_qs(urlparse(fake.sent[0]).query).items()}
    assert (q["sidoName"], q["returnType"], q["ver"], q["numOfRows"]) == ("전국", "json", "1.0", str(air.PAGE_ROWS))
    records = [r for chunk in pushed for r in chunk]
    assert len(records) == 672 and summary["applied"] == 672 and not summary["failed"]
    # 한 응답에 측정 시각이 섞인다(21시 612 · 22시 54 · 없음 6) — 측정소마다 자기 시각을 그대로 싣는다
    by_name = {r["stationName"]: r for r in records}
    for row in MEASUREMENTS:
        rec = by_name[row["stationName"]]
        assert rec["dataTime"] == row["dataTime"]
        assert rec["sidoName"] == row["sidoName"]
        # 값·등급·Flag 를 바꾸지 않는다 — 원문 그대로
        assert json.loads(rec["itemRaw"]) == row
    assert {r["dataTime"] for r in records} == {"2026-10-02 21:00", "2026-10-02 22:00", None}


def test_no_averaging_or_aggregate_helper_exists():
    """제3유형(변경금지) — 여러 측정소 값을 합치는 함수를 두지 않는다. 레코드는 측정소 하나의 원문뿐이다."""
    names = {n for n in dir(air) if not n.startswith("_")}
    assert not {n for n in names if any(w in n.lower() for w in ("avg", "average", "mean", "aggregate", "sido_value"))}
    rec = air.measurement_record(MEASUREMENTS[0])
    assert set(rec) == {"sidoName", "stationName", "dataTime", "itemRaw"}


def test_duplicate_station_names_in_one_response_fail_loudly():
    """측정소 이름이 전국에서 유일하다는 것(2026-10-02 672/672)이 저장 키다 — 깨지면 덮어쓰지 말고 멈춘다."""
    with pytest.raises(ValueError, match="측정소 이름이 겹친다"):
        air.measurement_records([MEASUREMENTS[0], dict(MEASUREMENTS[0])])


def test_source_timeout_is_retried_within_budget_then_loads(monkeypatch):
    monkeypatch.setattr(place_client, "put_air_measurements", lambda recs: {"applied": len(recs), "sigungu": 3})
    client, fake = _client([(200, TIMEOUT_JSON), (504, "Gateway Timeout"), (200, airkorea_body(MEASUREMENTS[:5]))])
    summary = air.run_measurements("K", client=client)
    assert len(fake.sent) == 3 and summary["calls"] == 3 and summary["applied"] == 5


def test_timeouts_beyond_retries_fail_without_pushing(monkeypatch):
    pushed = []
    monkeypatch.setattr(place_client, "put_air_measurements", lambda recs: pushed.append(recs))
    client, fake = _client([(200, TIMEOUT_JSON)] * (air.RETRIES + 1))
    summary = air.run_measurements("K", client=client)
    assert len(fake.sent) == air.RETRIES + 1 and summary["failed"] and pushed == []


def test_quota_stops_without_retry(monkeypatch):
    monkeypatch.setattr(place_client, "put_air_measurements", lambda recs: pytest.fail("한도 초과면 보내지 않는다"))
    client, fake = _client([(200, LIMIT_XML), (200, airkorea_body(MEASUREMENTS))])
    summary = air.run_measurements("K", client=client)
    assert len(fake.sent) == 1 and summary["stopped"] and not summary["failed"]


def test_daily_calls_stay_far_under_quota():
    # 매시 1콜(+ 시간 초과 재시도) × 24 — 회차 예산 상한으로도 하루 한도 500 의 1/4 미만
    assert air.MEASURE_BUDGET * 24 < 500 / 4
    assert air.PAGE_ROWS >= 672


def _attractions() -> list[dict]:
    """운영 국문 관광지 좌표(종로구 · 해운대구 · 평창군 · 진도군 전부) → place 목록 응답 모양. 같은 좌표의 영문 행도 하나씩 섞는다."""
    rows = [{"ldongRegnCd": sg[:2], "ldongSignguCd": sg[2:], "latitude": lat, "longitude": lng, "lang": "ko"}
            for sg, lat, lng in SAMPLE["attractionPoints"]]
    return rows + [{**r, "lang": "en"} for r in rows[::10]]


def test_candidates_contain_each_attraction_true_nearest_station():
    """화면은 후보 중 관광지에서 가장 가까운 측정소를 고른다 — 그것이 전국 672곳 중 최근접과 같아야 한다."""
    stations = [air.station_record(s) for s in STATIONS]
    candidates = air.station_candidates(REGIONS, _attractions(), stations)
    by_sigungu: dict[str, list[dict]] = {}
    for c in candidates:
        by_sigungu.setdefault(c["sigunguCode"], []).append(c)
    by_name = {s["stationName"]: s for s in stations}

    def km(point, name):
        return weather_grid.distance_km(point, (by_name[name]["latitude"], by_name[name]["longitude"]))

    # 진도군 둘 · 해운대구 하나는 원천 좌표가 한반도 밖(19.69, 117.99 — 셋 다 같은 값)이다. 후보 계산이 건너뛰고, 화면은 20km 넘는 측정소라 절을 숨긴다
    inside = [(sg, lat, lng) for sg, lat, lng in SAMPLE["attractionPoints"]
              if air.KOREA_LAT[0] <= lat <= air.KOREA_LAT[1] and air.KOREA_LNG[0] <= lng <= air.KOREA_LNG[1]]
    assert len(SAMPLE["attractionPoints"]) - len(inside) == 3
    for sg, lat, lng in inside:
        picked = min(by_sigungu[sg], key=lambda c: km((lat, lng), c["stationName"]))["stationName"]
        truth = min(stations, key=lambda s: weather_grid.distance_km((lat, lng), (s["latitude"], s["longitude"])))
        assert picked == truth["stationName"], (sg, lat, lng)
    # 같은 좌표(영문 행)는 한 번만 센다 — 후보의 관광지 수 합 = 고유 좌표 수
    points = set(inside)
    assert sum(c["attractions"] for c in candidates if c["sigunguCode"] in {p[0] for p in points}) == len(points)
    # 종로구는 관광지 844곳이 측정소 여럿으로 갈린다(대표점 하나면 「종로」 하나뿐이었다)
    assert len(by_sigungu["11110"]) > 1 and "종로" in {c["stationName"] for c in by_sigungu["11110"]}


def test_every_sigungu_with_a_center_has_its_center_nearest_station_even_without_attractions():
    stations = [air.station_record(s) for s in STATIONS]
    candidates = air.station_candidates(REGIONS, [], stations)
    sigungu = [r for r in REGIONS if r["level"] == "SIGUNGU"]
    assert len(sigungu) == 269
    # 좌표 없는 부천시·안산시 행은 받을 측정소가 없다
    assert len(candidates) == 267 and all(c["attractions"] == 0 for c in candidates)
    jongno = next(c for c in candidates if c["sigunguCode"] == "11110")
    # 종로구 대표점(관광지 좌표 평균)에서는 「종로구」 측정소가 아니라 「종로」 측정소가 더 가깝다 — 이름이 아니라 거리로 고른다
    assert (jongno["stationName"], jongno["distanceM"]) == ("종로", 1310)
    distances = sorted(c["distanceM"] for c in candidates)
    assert distances[len(distances) // 2] < 5000          # 2026-10-02 실측 중앙값 2.5km


def test_attraction_coordinates_outside_korea_are_skipped():
    stations = [air.station_record(s) for s in STATIONS]
    bad = [{"ldongRegnCd": "11", "ldongSignguCd": "110", "latitude": 0.0, "longitude": 0.0, "lang": "ko"},
           {"ldongRegnCd": "11", "ldongSignguCd": "110", "latitude": None, "longitude": None, "lang": "ko"}]
    assert air.station_candidates([], bad, stations) == []


def test_station_job_pushes_stations_and_mapping(monkeypatch):
    sent = {}
    monkeypatch.setattr(place_client, "fetch_sigungu_regions", lambda: [r for r in REGIONS if r["level"] == "SIGUNGU"])
    monkeypatch.setattr(place_client, "fetch_attractions", _attractions)
    monkeypatch.setattr(place_client, "put_air_stations",
                        lambda stations, mappings: sent.update(stations=stations, mappings=mappings)
                        or {"stations": len(stations), "mappings": len(mappings), "sigungu": len(mappings)})
    client, fake = _client([(200, TIMEOUT_JSON), (200, airkorea_body(STATIONS))], api=air.STATION_API, budget=air.STATION_BUDGET)
    summary = air.run_stations("K", client=client)
    assert len(fake.sent) == 2
    assert "addr" not in parse_qs(urlparse(fake.sent[1]).query)       # addr 를 빼면 전국
    assert len(sent["stations"]) == 672
    assert {m["sigunguCode"] for m in sent["mappings"]} >= {"11110", "26350", "51760", "12860"}
    assert len({m["sigunguCode"] for m in sent["mappings"]}) == 267
    assert summary["stations"] == 672 and not summary["failed"]


def test_station_job_refuses_to_push_when_coordinates_look_swapped(monkeypatch):
    """원천이 dmX·dmY 를 바로잡아(위도·경도 순으로) 주기 시작하면 전부 한반도 밖이 된다 — 빈 목록을 보내지 않고 실패한다."""
    monkeypatch.setattr(place_client, "fetch_sigungu_regions", lambda: pytest.fail("측정소가 없으면 매핑하지 않는다"))
    monkeypatch.setattr(place_client, "put_air_stations", lambda *a: pytest.fail("보내지 않는다"))
    swapped = [{**s, "dmX": s["dmY"], "dmY": s["dmX"]} for s in STATIONS]
    client, _ = _client([(200, airkorea_body(swapped))], api=air.STATION_API, budget=air.STATION_BUDGET)
    summary = air.run_stations("K", client=client)
    assert summary["failed"] and summary["rejected"] == 672
