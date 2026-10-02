"""날씨 단위 — 기상청 격자 변환 · 시군구 → 고유 격자 · 시군구 → 중기 구역(Q-P2-MIDREG)."""
from __future__ import annotations

from collections import Counter

import pytest

from src import weather_grid
from tests.fixture_rows import load

SAMPLE = load("phase2-weather.json")
REGIONS = SAMPLE["administrativeRegions"]
SIGUNGU = [r for r in REGIONS if r["level"] == "SIGUNGU"]


def test_seoul_jongno_lands_on_the_grid_of_the_production_sample():
    """운영 표본(getVilageFcst nx=60 ny=127)과 같은 격자 — 서울시청 · 우리 종로구 대표점 둘 다."""
    assert weather_grid.to_grid(37.5665, 126.9780) == (60, 127)
    jongno = next(r for r in SIGUNGU if r["code"] == "11110")
    assert weather_grid.to_grid(jongno["latitude"], jongno["longitude"]) == (60, 127)
    assert {(i["nx"], i["ny"]) for i in SAMPLE["shortForecast0500"]} == {(60, 127)}


def test_formula_reproduces_the_kma_grid_table():
    """기상청 격자_위경도 표(2607) 1·2단계 274행. 시도 16행은 전부, 나머지는 기상청 표 자신이 좌표와 어긋난 4행만 다르다:
    청송군(x=96.509 경계) · 창원시진해구(2015 위치 갱신 뒤 격자 미갱신) · 이어도 둘(표의 좌표가 이어도가 아니다)."""
    table = SAMPLE["kmaGridTable"]
    assert len(table) == 274
    mismatched = {code for code, _, lat, lon, nx, ny in table if weather_grid.to_grid(lat, lon) != (nx, ny)}
    assert mismatched == {"4775000000", "4812900000", "5019000000", "5019099000"}
    sido_rows = [row for row in table if row[0].endswith("00000000")]
    assert len(sido_rows) == 16                      # 시도 16 (이어도 행은 시도가 아니다)
    assert all(weather_grid.to_grid(lat, lon) == (nx, ny) for _, _, lat, lon, nx, ny in sido_rows)


def test_production_sigungu_collapse_to_243_grids():
    """운영 대표점(2026-10-02): 시군구 269 중 좌표 있는 267 → 고유 격자 243 = 단기 한 회차 243콜."""
    assert len(SIGUNGU) == 269
    areas = weather_grid.assign(REGIONS)
    assert len(areas) == 267
    assert len({(a["nx"], a["ny"]) for a in areas}) == 243
    missing = {r["name"] for r in SIGUNGU if r["latitude"] is None}
    assert missing == {"부천시", "안산시"}          # 자치구 행이 따로 있다


def test_every_mapped_sigungu_gets_a_land_and_temperature_region():
    """Q-P2-MIDREG 실측: 267 전부 매핑. 이름 193 · 자치구 70 · 광역시 소속 군 4 · 최근접 0, 기온 regId 163개(중기 하루 10 + 163 = 173콜)."""
    areas = weather_grid.assign(REGIONS)
    assert all(a["landRegId"] in weather_grid.MID_LAND and a["taRegId"] for a in areas)
    assert Counter(a["taMatch"] for a in areas) == {"NAME": 193, "METRO": 70, "METRO_COUNTY": 4}
    assert len({a["taRegId"] for a in areas}) == 163
    assert len({a["landRegId"] for a in areas}) == 10


@pytest.mark.parametrize("code, ta, land", [
    ("51820", "11D20402", "11D20000"),   # 강원 고성군 → 강원 고성(영동) — 경남 고성과 갈린다
    ("48820", "11H20404", "11H20000"),   # 경남 고성군 → 경남 고성
    ("41610", "11B20702", "11B00000"),   # 경기 광주시 → 경기 광주 — 전남 광주와 갈린다
    ("12150", "11F20405", "11F20000"),   # 순천시 → 표의 「순천시」(「순천」과 다른 코드)
    ("47940", "11E00101", "11H10000"),   # 울릉군 → 울릉도, 권역은 경북
    ("36110", "11C20404", "11C20000"),   # 세종특별자치시 → 세종
    ("11110", "11B10101", "11B00000"),   # 서울 종로구 → 서울(자치구)
    ("26710", "11H20201", "11H20000"),   # 기장군 → 부산(광역시 소속 군) — 최근접이면 양산
    ("28720", "11B20201", "11B00000"),   # 옹진군 → 인천(광역시 소속 군) — 최근접이면 강화
    ("27710", "11H10701", "11H10000"),   # 달성군 → 대구
    ("31710", "11H20101", "11H20000"),   # 울주군 → 울산
    ("28710", "11B20101", "11B00000"),   # 강화군 → 강화 — 이름 일치가 광역시 소속 군 규칙보다 앞
    ("12710", "11F20504", "11F20000"),   # 전남 담양군 → 담양 — 통합특별시의 군은 광주로 보내지 않는다
    ("41111", "11B20601", "11B00000"),   # 수원시 장안구 → 수원
    ("51150", "11D20501", "11D20000"),   # 강릉시 → 영동 / 아래 춘천은 영서 — 강원은 시도로 못 정한다
    ("51110", "11D10301", "11D10000"),
])
def test_known_sigungu_map_to_the_expected_regions(code, ta, land):
    area = next(a for a in weather_grid.assign(REGIONS) if a["sigunguCode"] == code)
    assert (area["taRegId"], area["landRegId"]) == (ta, land)


def test_gwangju_districts_under_the_merged_sido_use_gwangju():
    """전남광주통합특별시(12)의 자치구 다섯은 광주 기온 regId — 「동구」 같은 이름으로는 안 잇는다."""
    gwangju = {a["sigunguCode"]: a for a in weather_grid.assign(REGIONS) if a["sigunguCode"].startswith("12")}
    districts = [r["code"] for r in SIGUNGU if r["parentCode"] == "12" and r["name"].endswith("구")]
    assert len(districts) == 5
    assert {gwangju[c]["taRegId"] for c in districts} == {"11F20501"}


def test_mid_region_seed_is_the_kma_code_table():
    seed = weather_grid.mid_regions()
    assert Counter(r["kind"] for r in seed) == {"LAND": 10, "TA": 176}
    # 북한 구역(11I·11J·11K·11L)은 넣지 않는다 — 어느 시군구에도 안 붙는다
    assert not any(r["regId"][:3] in {"11I", "11J", "11K", "11L"} for r in seed)
    assert all(weather_grid.land_of(r["regId"]) in weather_grid.MID_LAND for r in seed if r["kind"] == "TA")
