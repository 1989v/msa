"""역·정류장 — 원천 컬럼 보존 · 좌표 검사 · 받기 거부 조건 · 최근접 사전 계산 · 회차 단위 적재."""
from __future__ import annotations

import csv
import io
import math
import re
import zipfile
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

import pytest

from src import place_client, transit_stops as ts
from tests.fixture_rows import load

SAMPLE = load("transit-stops.json")
RAIL_HEADER = SAMPLE["railHeader"]
BUS_HEADER = SAMPLE["busHeader"]
RAIL_ROWS = SAMPLE["railRows"]
BUS_ROWS = SAMPLE["busRows"]
#: 좌표가 성한 버스 표본 4행 — 표본 8행 중 4행은 일부러 고른 무효 좌표라 전체로 돌리면 무효 비율 검사에 걸린다
BUS_VALID = [r for r in BUS_ROWS if r[0] in ("ADB354000001", "ADB354000002", "GGB123000289", "GGB277104580")]
#: 위도 1도의 대권 거리(m) — 지구 반지름 6,371km
M_PER_LAT_DEG = 6_371_000 * math.pi / 180


def _xlsx(rows: list[list[str]]) -> bytes:
    """행 목록 → 시트 하나짜리 XLSX(공유 문자열표). 원천 파일과 같은 모양으로 숫자 칸은 <v> 로 둔다."""
    shared: list[str] = []
    cells = []
    for i, row in enumerate(rows, start=1):
        out = []
        for j, value in enumerate(row):
            ref = f"{chr(65 + j)}{i}"
            if value == "":
                continue
            if re.fullmatch(r"-?\d+(\.\d+)?", value):
                out.append(f'<c r="{ref}"><v>{value}</v></c>')
            else:
                shared.append(value)
                out.append(f'<c r="{ref}" t="s"><v>{len(shared) - 1}</v></c>')
        cells.append(f'<row r="{i}">{"".join(out)}</row>')
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/sharedStrings.xml", f'<sst {ns}>' + "".join(f"<si><t>{escape(s)}</t></si>" for s in shared) + "</sst>")
        z.writestr("xl/worksheets/sheet1.xml", f'<worksheet {ns}><sheetData>{"".join(cells)}</sheetData></worksheet>')
    return buf.getvalue()


def _bus_csv(header: list[str], rows: list[list[str]]) -> bytes:
    text = io.StringIO()
    csv.writer(text, lineterminator="\r\n").writerows([header, *rows])
    return text.getvalue().encode("cp949")


def _north(lat: float, lng: float, meters: float) -> tuple[float, float]:
    return lat + meters / M_PER_LAT_DEG, lng


def _east(lat: float, lng: float, meters: float) -> tuple[float, float]:
    return lat, lng + meters / (M_PER_LAT_DEG * math.cos(math.radians(lat)))


# ---------------------------------------------------------------- 원천 파싱


def test_rail_rows_keep_every_source_column_and_derive_coords_and_dates():
    records, dropped = ts.rail_records(ts.read_xlsx(_xlsx([RAIL_HEADER, *RAIL_ROWS])))
    by_key = {(r["stationNo"], r["lineNo"], r["lineName"]): r for r in records}
    sinsa = by_key[("D004", "I11D1", "신분당선")]
    # 원천 15열 전부가 원문 문자열 그대로
    source = dict(zip(RAIL_HEADER, next(r for r in RAIL_ROWS if r[0] == "D004")))
    assert {h: sinsa[f] for h, f in ts.RAIL_COLUMNS} == source
    assert sinsa["stationNameEn"] == "Sinsa" and sinsa["stationNameHanja"] == "新沙" and sinsa["phone"] == "02) 810-5870"
    # 파생: 좌표 · 엑셀 일련번호 기준일(46191 → 2026-06-18)
    assert (sinsa["latValue"], sinsa["lngValue"], sinsa["validCoord"]) == (37.516125263312901, 127.019760916726, True)
    assert sinsa["baseDateRaw"] == "46191" and sinsa["baseDate"] == "2026-06-18"
    assert by_key[("0133", "I4101", "1호선")]["baseDate"] == "2024-12-31"
    # 기준일 빈 칸 → 파일 전체 최빈 기준일, 원문 칸은 빈 값 그대로
    blank = next(r for r in records if r["baseDateRaw"] == "")
    assert blank["baseDate"] == "2024-12-31"


def test_rail_natural_key_duplicates_keep_the_latest_dated_row_and_count_the_drop():
    """주안역 경인선 두 행은 기준일만 다르다 → 하나만(46022 = 2025-12-31). 광운대역 경의중앙선·경춘선은 노선명이 달라 둘 다 남는다."""
    records, dropped = ts.rail_records(ts.read_xlsx(_xlsx([RAIL_HEADER, *RAIL_ROWS])))
    juan = [r for r in records if r["stationNo"] == "1809"]
    assert len(juan) == 1 and juan[0]["baseDateRaw"] == "46022" and juan[0]["baseDate"] == "2025-12-31"
    assert sorted(r["lineName"] for r in records if r["stationNo"] == "1019") == ["경의중앙선", "경춘선"]
    assert dropped == 1
    assert len({r["sourceKey"] for r in records}) == len(records) == len(RAIL_ROWS) - 1


def test_bus_rows_from_cp949_keep_every_column_and_flag_bad_coords():
    path_rows = list(ts.bus_records(io.TextIOWrapper(io.BytesIO(_bus_csv(BUS_HEADER, BUS_ROWS)), encoding="cp949", newline="")))
    by_no = {r["stopNo"]: r for r in path_rows}
    ok = by_no["ADB354000001"]
    assert {h: ok[f] for h, f in ts.BUS_COLUMNS} == dict(zip(BUS_HEADER, BUS_ROWS[[r[0] for r in BUS_ROWS].index("ADB354000001")]))
    assert (ok["latValue"], ok["lngValue"], ok["validCoord"]) == (36.458658, 128.891228, True)
    assert ok["sourceKey"] == "37040:ADB354000001" and ok["collectedDate"] == "2025-10-31"
    # 위경도가 뒤바뀐 행(대전·제주) · 위도=경도(세종) · 빈 좌표(세종) → 저장은 하되 계산에서 뺀다
    assert by_no["DJB3064513"]["validCoord"] is False and by_no["DJB3064513"]["latValue"] == 127.2822
    assert by_no["JEB406002082"]["validCoord"] is False
    assert by_no["SJB286071003"]["validCoord"] is False
    empty = by_no["SJB286071112"]
    assert (empty["latValue"], empty["lngValue"], empty["validCoord"], empty["latRaw"]) == (None, None, False, "")


@pytest.mark.parametrize("lat,lng,valid", [
    ("33.0", "124.0", True), ("39.0", "132.0", True), ("32.99", "126.5", False), ("37.5", "132.01", False),
    ("127.0", "37.5", False), ("36.448721", "36.448721", False), ("", "127", False), ("abc", "127", False),
])
def test_coordinate_check_range_and_swap(lat, lng, valid):
    assert ts.coord(lat, lng)[2] is valid


def test_renamed_column_is_rejected_before_any_put(monkeypatch, tmp_path):
    header = ["정류장ID" if h == "정류장번호" else h for h in BUS_HEADER]
    with pytest.raises(ts.SourceRejected, match="헤더"):
        list(ts.bus_records(io.StringIO(_bus_csv(header, BUS_ROWS).decode("cp949"))))
    with pytest.raises(ts.SourceRejected, match="헤더"):
        ts.rail_records([[*RAIL_HEADER[:-1], "기준일"], *RAIL_ROWS])
    summary = _run(monkeypatch, tmp_path, bus=_bus_csv(header, BUS_VALID))
    assert summary["failed"] and summary["sources"]["BUS"]["failed"]
    assert not any(c[0] == "put_transit_bus" for c in summary["_calls"])
    assert not any(c[0] == "put_attraction_access" for c in summary["_calls"])


def test_added_column_is_rejected():
    with pytest.raises(ts.SourceRejected, match="헤더"):
        list(ts.bus_records(io.StringIO(_bus_csv([*BUS_HEADER, "비고"], [[*r, ""] for r in BUS_ROWS]).decode("cp949"))))
    with pytest.raises(ts.SourceRejected, match="헤더"):
        ts.rail_records([[*RAIL_HEADER, "비고"], *[[*r, ""] for r in RAIL_ROWS]])


def test_zero_rows_fail():
    with pytest.raises(ts.SourceRejected, match="0행"):
        ts.check_counts("BUS", total=0, invalid=0, previous=None)
    with pytest.raises(ts.SourceRejected, match="0행"):
        ts.rail_records([RAIL_HEADER])


def test_invalid_coordinate_ratio_above_5_percent_fails():
    ts.check_counts("BUS", total=20, invalid=1, previous=None)          # 5% — 통과
    with pytest.raises(ts.SourceRejected, match="무효 좌표"):
        ts.check_counts("BUS", total=20, invalid=2, previous=None)      # 10%


def test_row_count_change_beyond_20_percent_of_previous_active_run_fails():
    ts.check_counts("RAIL", total=120, invalid=0, previous=100)
    ts.check_counts("RAIL", total=80, invalid=0, previous=100)
    with pytest.raises(ts.SourceRejected, match="행 수"):
        ts.check_counts("RAIL", total=121, invalid=0, previous=100)
    with pytest.raises(ts.SourceRejected, match="행 수"):
        ts.check_counts("RAIL", total=79, invalid=0, previous=100)
    ts.check_counts("RAIL", total=5, invalid=0, previous=None)          # 첫 회차는 비교하지 않는다


def test_download_is_https_only_and_capped(tmp_path):
    with pytest.raises(ts.SourceRejected, match="https"):
        ts.download("http://example.org/a.csv", 100, tmp_path / "a")

    class Body(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    with pytest.raises(ts.SourceRejected, match="최대"):
        ts.download("https://example.org/a.csv", 10, tmp_path / "b", opener=lambda req, timeout: Body(b"x" * 11))
    assert ts.download("https://example.org/a.csv", 10, tmp_path / "c", opener=lambda req, timeout: Body(b"x" * 10)).read_bytes() == b"x" * 10


def test_max_bytes_are_three_times_the_measured_files():
    assert ts.RAIL_MAX_BYTES == 313_132 * 3 and ts.BUS_MAX_BYTES == 20_735_435 * 3


# ---------------------------------------------------------------- 최근접 사전 계산


def test_haversine_one_degree_of_latitude():
    assert ts.distance_m((37.0, 127.0), (38.0, 127.0)) == pytest.approx(111_194.93, abs=0.05)


def _stop(key, name, lat, lng, lines=None, name_en=None):
    return ts.Stop(key, name, name_en, lines, ((lat, lng),), "2025-10-31")


def test_radius_boundary_rail_2000_and_bus_500_inclusive():
    a = (1, 37.5, 127.0)
    rail = [_stop("r1", "가", *_north(37.5, 127.0, 2000)), _stop("r2", "나", *_north(37.5, 127.0, 2001))]
    bus = [_stop("b1", "다", *_north(37.5, 127.0, 500)), _stop("b2", "라", *_north(37.5, 127.0, 501))]
    assert [s["sourceKey"] for s in ts.nearest_stops([a], rail, ts.RAIL)[1]] == ["r1"]
    assert [s["sourceKey"] for s in ts.nearest_stops([a], bus, ts.BUS)[1]] == ["b1"]
    got = ts.nearest_stops([a], rail, ts.RAIL)[1][0]
    assert got["distanceM"] == 2000 and got["rank"] == 1 and got["kind"] == "RAIL"


def test_same_name_pair_keeps_only_the_nearer_and_caps_at_two():
    a = (7, 37.5, 127.0)
    bus = [
        _stop("b1", "시청앞", *_north(37.5, 127.0, 30)),
        _stop("b2", "시청앞", *_north(37.5, 127.0, -60)),      # 길 건너 같은 이름
        _stop("b3", "도서관", *_north(37.5, 127.0, 100)),
        _stop("b4", "공원", *_north(37.5, 127.0, 150)),
    ]
    got = ts.nearest_stops([a], bus, ts.BUS)[7]
    assert [(s["sourceKey"], s["rank"]) for s in got] == [("b1", 1), ("b3", 2)]


def test_no_stop_in_range_makes_no_row():
    got = ts.nearest_stops([(1, 37.5, 127.0)], [_stop("b1", "멀리", *_north(37.5, 127.0, 900))], ts.BUS)
    assert got == {1: []}


def test_grid_neighbour_across_a_cell_boundary():
    # 0.02° 칸 경계 바로 남쪽 관광지, 경계 북쪽 300m 정류장
    lat = 37.52 - 0.00001
    got = ts.nearest_stops([(1, lat, 127.01)], [_stop("b1", "북쪽", *_north(lat, 127.01, 300))], ts.BUS)
    assert [s["sourceKey"] for s in got[1]] == ["b1"]


def test_station_1_9km_east_two_cells_away_at_latitude_37_is_found():
    """위도 37° 에서 칸 폭은 약 1,776m — 3×3 이웃만 보면 1.9km 동쪽 두 칸 너머 역을 놓친다."""
    lat, lng = 37.01, 126.99999                      # 경도 칸 6349 의 동쪽 끝
    station = _east(lat, lng, 1_900)                 # 경도 칸 6351
    assert math.floor(station[1] / ts.GRID_DEG) - math.floor(lng / ts.GRID_DEG) == 2
    got = ts.nearest_stops([(1, lat, lng)], [_stop("r1", "동쪽", *station)], ts.RAIL)
    assert [(s["sourceKey"], s["distanceM"]) for s in got[1]] == [("r1", 1900)]


def test_transfer_station_rows_become_one_station_with_lines_joined():
    records, _ = ts.rail_records(ts.read_xlsx(_xlsx([RAIL_HEADER, *RAIL_ROWS])))
    stations = ts.rail_stations(records)
    seoul = [s for s in stations if s.name.rstrip("역") == "서울"]
    assert len(seoul) == 1 and seoul[0].lines == "1·4호선" and seoul[0].name_en == "Seoul Station"
    jongno = [s for s in stations if s.name == "종로3가"]
    assert len(jongno) == 1 and jongno[0].lines == "1·3호선"
    gwangun = [s for s in stations if s.name.rstrip("역") == "광운대"]
    assert len(gwangun) == 1 and gwangun[0].lines == "경의중앙선·경춘선"
    # 서울역 1호선 ↔ 4호선 행은 약 300m 떨어져 있다 — 관광지 하나에 두 번 붙지 않는다
    got = ts.nearest_stops([(1, 37.5547, 126.9707)], stations, ts.RAIL)[1]
    assert [s["name"] for s in got].count("서울역") == 1
    assert got[0]["lines"] == "1·4호선"


def test_merge_distance_boundary_500m():
    def row(key, lat, line):
        return {"sourceKey": key, "stationName": "가", "stationNameEn": "Ga", "lineName": line,
                "latValue": lat, "lngValue": 127.0, "validCoord": True, "baseDate": "2024-12-31"}
    assert len(ts.rail_stations([row("a", 37.5, "1호선"), row("b", _north(37.5, 127.0, 500)[0], "2호선")])) == 1
    assert len(ts.rail_stations([row("a", 37.5, "1호선"), row("b", _north(37.5, 127.0, 501)[0], "2호선")])) == 2


def test_same_name_rows_far_apart_stay_two_stations():
    rows = [
        {"sourceKey": "a", "stationName": "신촌", "stationNameEn": "Sinchon", "lineName": "2호선",
         "latValue": 37.555, "lngValue": 126.936, "validCoord": True, "baseDate": "2024-12-31"},
        {"sourceKey": "b", "stationName": "신촌", "stationNameEn": "Sinchon", "lineName": "경의중앙선",
         "latValue": 37.560, "lngValue": 126.943, "validCoord": True, "baseDate": "2024-12-31"},   # 약 800m
    ]
    assert len(ts.rail_stations(rows)) == 2


def test_server_limits_match_ingest_constants():
    """access PUT 의 rank·거리 상한 검사는 place 도메인이 갖고, 규칙의 원본은 여기 상수다 — 두 값이 어긋나면 빨개진다."""
    kt = Path(__file__).resolve().parents[2] / "domain/src/main/kotlin/com/kgd/place/domain/attraction/model/AttractionAccess.kt"
    text = kt.read_text(encoding="utf-8")
    found = {k: int(v.replace("_", "")) for k, v in re.findall(r"const val (RAIL_MAX_DISTANCE_M|BUS_MAX_DISTANCE_M|MAX_RANK) = ([\d_]+)", text)}
    assert found == {"RAIL_MAX_DISTANCE_M": ts.RAIL_RADIUS_M, "BUS_MAX_DISTANCE_M": ts.BUS_RADIUS_M, "MAX_RANK": ts.PER_KIND}
    assert (ts.RAIL_RADIUS_M, ts.BUS_RADIUS_M, ts.PER_KIND) == (2000, 500, 2)


# ---------------------------------------------------------------- 버스 연계 지역


def test_every_source_city_maps_to_our_sigungu_and_coverage_needs_100_stops():
    cities = [(c, n, k) for c, n, k in SAMPLE["busCityCounts"]]
    coverage = {c["sigunguCode"]: c for c in ts.bus_coverage(cities, SAMPLE["sigunguRegions"])}
    assert len(coverage) == len(SAMPLE["sigunguRegions"]) == 269
    # TG0.8: 원천 도시가 없는 시군구 6 · 이어지지만 100개 미만 13 + 군위군(대구 광역 행에서 빼면 자기 행 56만 남는다)
    assert {c for c, v in coverage.items() if v["stops"] == 0} == {"12750", "12760", "12780", "44250", "51790", "51820"}
    low = {c for c, v in coverage.items() if 0 < v["stops"] < 100}
    assert len(low) == 14 and "51150" in low and "27720" in low      # 강릉시 20 (경기BIS 13 + TSBIS 7)
    assert all(v["covered"] is (v["stops"] >= 100) for v in coverage.values())
    # 대구 광역 코드는 원천에 따로 행이 있는 군위군을 빼고 편다 · 광주광역시는 광주 자치구 5개만
    assert coverage["27720"]["stops"] == dict(((n, k) for c, n, k in cities))["대구광역시 군위군"]
    assert coverage["12210"]["covered"] and coverage["12110"]["stops"] != coverage["12210"]["stops"]


def test_unmapped_source_city_fails():
    with pytest.raises(ts.SourceRejected, match="시군구로 잇지 못한"):
        ts.bus_coverage([("99999", "어딘가특별시 없는군", 10)], SAMPLE["sigunguRegions"])


def test_coverage_boundary_99_and_100():
    regions = [{"code": "41110", "parentCode": "41", "name": "수원시 장안구"}, {"code": "41130", "parentCode": "41", "name": "성남시 수정구"}]
    got = {c["sigunguCode"]: c["covered"] for c in ts.bus_coverage([("31010", "경기도 수원시", 100), ("31020", "경기도 성남시", 99)], regions)}
    assert got == {"41110": True, "41130": False}


# ---------------------------------------------------------------- 회차 단위 적재


def _run(monkeypatch, tmp_path, rail: bytes | None = None, bus: bytes | None = None, previous=None, fail_put_at=None):
    calls: list[tuple] = []
    rail = rail if rail is not None else _xlsx([RAIL_HEADER, *RAIL_ROWS])
    bus = bus if bus is not None else _bus_csv(BUS_HEADER, BUS_VALID)
    monkeypatch.setattr(ts, "download", lambda url, max_bytes, dest, opener=None: (dest.write_bytes(rail if "rail" in url else bus), dest)[1])
    monkeypatch.setattr(place_client, "fetch_sigungu_regions", lambda: SAMPLE["sigunguRegions"])
    monkeypatch.setattr(place_client, "fetch_attraction_points", lambda: [(1, 37.5547, 126.9707), (2, 36.4590, 128.8915)])
    monkeypatch.setattr(place_client, "transit_state", lambda source: {"source": source, "rows": (previous or {}).get(source)})

    def put(name):
        def f(run_id, items):
            calls.append((name, run_id, len(items)))
            if fail_put_at is not None and len([c for c in calls if c[0] == name]) == fail_put_at:
                raise RuntimeError("묶음 실패")
            return {"applied": len(items)}
        return f

    monkeypatch.setattr(place_client, "put_transit_rail", put("put_transit_rail"))
    monkeypatch.setattr(place_client, "put_transit_bus", put("put_transit_bus"))
    monkeypatch.setattr(place_client, "activate_transit", lambda source, run_id, expected, coverage=None:
                        calls.append(("activate", source, expected, len(coverage or []))) or {"rows": expected})
    monkeypatch.setattr(place_client, "put_attraction_access", lambda computed_at, items:
                        calls.append(("put_attraction_access", computed_at, items)) or {"applied": len(items)})
    monkeypatch.setattr(place_client, "prune_attraction_access", lambda computed_at:
                        calls.append(("prune", computed_at)) or {"removed": 0})
    summary = ts.run("https://rail.example/x", "https://bus.example/y", workdir=tmp_path)
    summary["_calls"] = calls
    return summary


def test_full_run_loads_both_sources_then_activates_then_sends_every_attraction_then_prunes(monkeypatch, tmp_path):
    s = _run(monkeypatch, tmp_path)
    names = [c[0] for c in s["_calls"]]
    assert names == ["put_transit_rail", "activate", "put_transit_bus", "activate", "put_attraction_access", "prune"]
    assert s["_calls"][1] == ("activate", "RAIL", len(RAIL_ROWS) - 1, 0)
    assert s["_calls"][3] == ("activate", "BUS", len(BUS_VALID), 269)
    items = {i["attractionId"]: i["stops"] for i in s["_calls"][4][2]}
    # 빈 목록인 관광지도 보낸다(안동 길안정류장 근처 관광지는 역이 없다)
    assert set(items) == {1, 2}
    assert [x["kind"] for x in items[2]] == ["BUS"] and items[2][0]["name"] == "길안정류장"
    assert items[1][0]["kind"] == "RAIL" and items[1][0]["name"] == "서울역"
    assert s["_calls"][5][1] == s["_calls"][4][1]
    assert not s["failed"]


def test_failed_chunk_does_not_activate_and_skips_access(monkeypatch, tmp_path):
    s = _run(monkeypatch, tmp_path, fail_put_at=1)
    names = [c[0] for c in s["_calls"]]
    assert names[0] == "put_transit_rail"
    assert ("activate", "RAIL") not in [(c[0], c[1]) for c in s["_calls"] if c[0] == "activate"]
    assert s["sources"]["RAIL"]["failed"]
    assert "put_attraction_access" not in names and "prune" not in names
    assert s["failed"]


def test_row_count_jump_against_previous_run_keeps_old_rows(monkeypatch, tmp_path):
    s = _run(monkeypatch, tmp_path, previous={"BUS": 100})
    names = [c[0] for c in s["_calls"]]
    assert "put_transit_bus" not in names and "put_attraction_access" not in names
    assert s["sources"]["BUS"]["failed"] and "행 수" in s["sources"]["BUS"]["error"]
