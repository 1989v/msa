"""역·정류장 — 도시철도 역사정보(국가철도공단 KRIC) XLSX · 전국 버스정류장 위치정보(국토교통부, data.go.kr 15067528) CSV.

주 1회 두 파일을 받아 원천 행을 **원천 컬럼 전부** 그대로 place 에 적재하고(data-sources.md §0 ①), 좌표 검사값·날짜는 파생 컬럼으로 둔다(②).
원천 교체는 회차 단위다 — 새 회차 id 로 2,000행 묶음을 쌓고, 다 들어가면 활성화 호출 한 번으로 회차를 바꾼다. 중간에 실패하면
활성 회차가 그대로라 화면에 나가는 값이 반쯤 바뀐 채로 남지 않는다.

적재가 둘 다 끝나면 관광지마다 가까운 역 2곳(직선 2,000m 안) · 정류장 2곳(500m 안)을 계산해 보낸다(`attraction_access`).
도보 시간은 계산하지 않는다 — 길 경로 자료가 없어 직선거리로 시간을 내면 근거가 없다.

받기 거부(이전 행 보존, Job 실패): https 아님 · 크기 상한 초과 · 헤더가 `*_EXPECTED_COLUMNS` 와 다름(빠짐·늘어남 모두) · 0행 ·
무효 좌표 비율 5% 초과 · 행 수가 이전 활성 회차보다 ±20% 넘게 변함.
"""
from __future__ import annotations

import csv
import io
import math
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Iterable, Iterator, NamedTuple

from src import place_client
from src.sync_tour import KST

RAIL = "RAIL"
BUS = "BUS"

#: 원천 헤더 원문 → place 적재 필드. 순서는 원천 열 순서다. 필드 목록은 여기 한 곳에서만 관리한다(전체 동기화 — 빠지면 그 칸이 지워진다).
RAIL_COLUMNS: tuple[tuple[str, str], ...] = (
    ("역번호", "stationNo"), ("역사명", "stationName"), ("노선번호", "lineNo"), ("노선명", "lineName"),
    ("영문역사명", "stationNameEn"), ("한자역사명", "stationNameHanja"), ("환승역구분", "transferType"),
    ("환승노선번호", "transferLineNo"), ("환승노선명", "transferLineName"), ("역위도", "latRaw"), ("역경도", "lngRaw"),
    ("운영기관명", "operatorName"), ("역사도로명주소", "roadAddress"), ("역사전화번호", "phone"), ("데이터기준일자", "baseDateRaw"),
)
BUS_COLUMNS: tuple[tuple[str, str], ...] = (
    ("정류장번호", "stopNo"), ("정류장명", "stopName"), ("위도", "latRaw"), ("경도", "lngRaw"), ("정보수집일", "collectedDateRaw"),
    ("모바일단축번호", "mobileShortNo"), ("도시코드", "cityCode"), ("도시명", "cityName"), ("관리도시명", "manageCityName"),
)
#: 원천 헤더 원문(2026-10-11 받은 파일, verifications/source-sample.md). 집합이 다르면 받지 않는다.
RAIL_EXPECTED_COLUMNS = tuple(h for h, _ in RAIL_COLUMNS)
BUS_EXPECTED_COLUMNS = tuple(h for h, _ in BUS_COLUMNS)

#: 받기 크기 상한 = 2026-10-11 실측 크기 × 3 (철도 313,132 B · 버스 20,735,435 B).
RAIL_MAX_BYTES = 313_132 * 3
BUS_MAX_BYTES = 20_735_435 * 3
TIMEOUT_SEC = 300
#: 버스 CSV 인코딩 — UTF-8 로 읽으면 첫 바이트에서 실패한다(2026-10-11 실측).
BUS_ENCODING = "cp949"

#: 한반도(+ 백령도·울릉도·독도·마라도) 범위. 밖이면 `validCoord=false` 로 저장하고 계산에서 뺀다.
KOREA_LAT = (33.0, 39.0)
KOREA_LNG = (124.0, 132.0)
INVALID_RATIO_MAX = 0.05
ROW_CHANGE_MAX = 0.20

#: 직선거리 반경(m)과 종류마다 붙이는 수. place 도메인 `AttractionAccess` 의 PUT 검사가 같은 값을 갖는다(테스트가 대조한다).
RAIL_RADIUS_M = 2_000
BUS_RADIUS_M = 500
PER_KIND = 2
#: 같은 이름(끝 「역」 뗌) 역의 노선별 행을 한 역으로 묶는 거리. 행끼리 이어 붙인다 — 한 행이라도 이 안이면 같은 역.
#: 2026-10-11 원천에서 같은 이름 행의 가장 가까운 짝까지 거리는 394m(잠실 2·8호선) 이하이거나 2km 이상으로 갈린다.
#: 스펙 초안의 200m 로는 서울역(1호선 ↔ 4호선 302m) · 시청 · 잠실 등 38행이 따로 남아 한 관광지에 「서울역」이 두 번 붙는다.
STATION_MERGE_M = 500
#: 후보를 좁히는 격자 칸(도). 이웃 칸 수는 반경 / 그 위도의 칸 폭으로 정한다 — 위도 37° 의 경도 칸 폭은 약 1,776m 라 2,000m 는 3×3 밖으로 나간다.
GRID_DEG = 0.02
EARTH_RADIUS_M = 6_371_000
M_PER_LAT_DEG = EARTH_RADIUS_M * math.pi / 180

#: 이 시군구로 이어진 원천 정류장이 이 수 이상이면 버스 「연계 지역」이다. 2026-10-11 분포에서 100 미만 최댓값 63(인제군)과
#: 그다음 116(울릉군) 사이에 둔 값 — 근거는 분포의 빈틈뿐이다. 미만이면 화면이 「이 지역은 버스정류장 위치 자료가 없습니다」를 낸다.
BUS_COVERED_MIN_STOPS = 100
#: 버스 원천 `도시명` 첫 낱말 → 우리 시도 코드. 원천에 옛 이름(전라북도 등)이 남아 있다.
SOURCE_SIDO = {
    "서울특별시": "11", "부산광역시": "26", "대구광역시": "27", "인천광역시": "28", "광주광역시": "12", "대전광역시": "30",
    "울산광역시": "31", "세종특별자치시": "36", "경기도": "41", "강원특별자치도": "51", "강원도": "51", "충청북도": "43",
    "충청남도": "44", "전라북도": "52", "전북특별자치도": "52", "전라남도": "12", "경상북도": "47", "경상남도": "48",
    "제주특별자치도": "50",
}
#: 광주·전남 통합(12) 뒤 「광주광역시」 는 옛 광주 자치구 다섯만 뜻한다.
GWANGJU_DISTRICTS = ("12210", "12240", "12270", "12300", "12330")
#: 옛 시·군 이름 → 지금 이름. None 은 세종 전체(충청남도 연기군).
OLD_CITY = {"청원군": "청주시", "연기군": None, "마산시": "창원시", "진해시": "창원시"}
SEJONG = "36"

_EXCEL_EPOCH = date(1899, 12, 30)


class SourceRejected(Exception):
    """원천을 받지 않는다 — 이전 활성 회차를 그대로 두고 Job 을 실패시킨다."""


class Stop(NamedTuple):
    """계산용 지점. 역은 노선별 행을 묶어 [points] 가 여럿일 수 있다. [key] 는 원천 자연 키(묶인 역은 첫 행)."""
    key: str
    name: str
    name_en: str | None
    lines: str | None
    points: tuple[tuple[float, float], ...]
    base_date: str | None


def log(msg: str) -> None:
    print(f"[transit-stops] {msg}", flush=True)


# ---------------------------------------------------------------- 받기


def download(url: str, max_bytes: int, dest: Path, opener=urllib.request.urlopen) -> Path:
    """https 만, 시간 제한 [TIMEOUT_SEC], [max_bytes] 를 넘으면 받다가 멈춘다. 파일에 바로 쓴다(버스 원천을 메모리에 통째로 두지 않는다)."""
    if not url.startswith("https://"):
        raise SourceRejected(f"https 주소만 받는다: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": place_client._UA})
    total = 0
    with opener(req, timeout=TIMEOUT_SEC) as r, open(dest, "wb") as out:
        final = r.geturl() if hasattr(r, "geturl") else url
        if not str(final).startswith("https://"):
            raise SourceRejected(f"https 가 아닌 주소로 넘어갔다: {final}")
        while chunk := r.read(1 << 20):
            total += len(chunk)
            if total > max_bytes:
                raise SourceRejected(f"최대 {max_bytes} B 를 넘는다: {url}")
            out.write(chunk)
    return dest


# ---------------------------------------------------------------- 파싱


def coord(lat_raw: str, lng_raw: str) -> tuple[float | None, float | None, bool]:
    """원문 → (위도, 경도, 유효). 숫자가 아니면 None. 한반도 밖이거나 위경도가 바뀐 것으로 보이면 유효하지 않다."""
    try:
        lat = float(lat_raw)
        lng = float(lng_raw)
    except (TypeError, ValueError):
        return None, None, False
    if not (math.isfinite(lat) and math.isfinite(lng)):
        return None, None, False
    valid = KOREA_LAT[0] <= lat <= KOREA_LAT[1] and KOREA_LNG[0] <= lng <= KOREA_LNG[1]
    return lat, lng, valid


def source_date(raw: str) -> date | None:
    """원천 날짜 칸 → 날짜. `YYYY-MM-DD` · 엑셀 일련번호(1899-12-30 기준 일수) · `YYYYMMDD` 를 읽는다. 못 읽으면 None."""
    s = (raw or "").strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
            return date.fromisoformat(s)
        if re.fullmatch(r"\d{8}", s):
            return datetime.strptime(s, "%Y%m%d").date()
        if re.fullmatch(r"\d{4,5}(\.0+)?", s):
            return _EXCEL_EPOCH + timedelta(days=int(float(s)))
    except ValueError:
        return None
    return None


def check_header(header: list[str], expected: tuple[str, ...], source: str) -> list[str]:
    header = [h.strip().lstrip("﻿") for h in header]
    missing = [h for h in expected if h not in header]
    extra = [h for h in header if h not in expected]
    if missing or extra or len(header) != len(expected):
        raise SourceRejected(f"{source} 헤더가 다르다 — 빠짐 {missing} · 늘어남 {extra} · 열 {len(header)}/{len(expected)}")
    return header


def check_counts(source: str, total: int, invalid: int, previous: int | None) -> None:
    if total == 0:
        raise SourceRejected(f"{source} 원천이 0행이다")
    if invalid / total > INVALID_RATIO_MAX:
        raise SourceRejected(f"{source} 무효 좌표 {invalid}/{total} — {INVALID_RATIO_MAX:.0%} 를 넘는다")
    if previous and abs(total - previous) / previous > ROW_CHANGE_MAX:
        raise SourceRejected(f"{source} 행 수 {total} — 이전 활성 회차 {previous} 에서 {ROW_CHANGE_MAX:.0%} 넘게 변했다")


_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_xlsx(data: bytes | Path) -> list[list[str]]:
    """첫 시트 → 행 목록(칸은 원문 문자열). 표준 라이브러리만 쓴다 — 수집기 이미지에 openpyxl 이 없다."""
    raw = data.read_bytes() if isinstance(data, Path) else data
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall(f"{_NS}si"):
                # 발음 표기(rPh) 안의 <t> 는 빼고 본문(<t>, <r><t>)만 잇는다
                parts = [t.text or "" for t in si.findall(f"{_NS}t")] + [t.text or "" for t in si.findall(f"{_NS}r/{_NS}t")]
                shared.append("".join(parts))
        sheets = sorted(n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n))
        if not sheets:
            raise SourceRejected("XLSX 에 시트가 없다")
        root = ET.fromstring(z.read(sheets[0]))
    rows: list[list[str]] = []
    for r in root.iter(f"{_NS}row"):
        out: dict[int, str] = {}
        for c in r.findall(f"{_NS}c"):
            v = c.find(f"{_NS}v")
            kind = c.get("t")
            if kind == "s" and v is not None:
                value = shared[int(v.text)]
            elif kind == "inlineStr":
                value = "".join(t.text or "" for t in c.iter(f"{_NS}t"))
            else:
                value = v.text if v is not None and v.text is not None else ""
            out[_col(c.get("r") or "")] = value
        rows.append([out.get(i, "") for i in range(max(out) + 1)] if out else [])
    return rows


def _col(ref: str) -> int:
    n = 0
    for ch in re.match(r"[A-Z]*", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def rail_records(rows: list[list[str]]) -> tuple[list[dict], int]:
    """XLSX 행(첫 행 헤더) → 적재 항목. 반환 (항목, 자연 키가 겹쳐 뺀 행 수).

    자연 키 = (역번호, 노선번호, 역사명, 노선명). 역번호는 같은 역의 노선별 행이 공유하고(1,099행에 고유 907), (역번호, 노선번호, 역사명)도
    경의중앙선·경춘선이 같은 노선번호를 쓰는 역에서 겹친다 — 노선명까지 넣어야 갈린다. 그래도 겹치는 행(주안역 경인선 — 기준일만 다름)은
    기준일이 늦은 행 하나만 남긴다. 기준일 빈 칸은 파일 전체의 최빈 기준일로 채우고 원문 칸은 빈 값 그대로 둔다.
    """
    if not rows:
        raise SourceRejected(f"{RAIL} 원천이 0행이다")
    header = check_header(rows[0], RAIL_EXPECTED_COLUMNS, RAIL)
    index = {h: i for i, h in enumerate(header)}
    records: list[dict] = []
    for row in rows[1:]:
        if not any((c or "").strip() for c in row):
            continue
        cells = [*row, *[""] * (len(header) - len(row))]
        rec = {field: (cells[index[h]] or "") for h, field in RAIL_COLUMNS}
        lat, lng, valid = coord(rec["latRaw"], rec["lngRaw"])
        parsed = source_date(rec["baseDateRaw"])
        rec.update(latValue=lat, lngValue=lng, validCoord=valid, baseDate=parsed.isoformat() if parsed else None,
                   sourceKey="|".join(rec[k].strip() for k in ("stationNo", "lineNo", "stationName", "lineName")))
        records.append(rec)
    if not records:
        raise SourceRejected(f"{RAIL} 원천이 0행이다")
    dated = Counter(r["baseDate"] for r in records if r["baseDate"])
    mode = dated.most_common(1)[0][0] if dated else None
    for r in records:
        r["baseDate"] = r["baseDate"] or mode
    kept: dict[str, dict] = {}
    for r in records:
        prev = kept.get(r["sourceKey"])
        if prev is None or (r["baseDate"] or "") > (prev["baseDate"] or ""):
            kept[r["sourceKey"]] = r
    dropped = len(records) - len(kept)
    return [r for r in records if kept[r["sourceKey"]] is r], dropped


def bus_records(stream: Iterable[str]) -> Iterator[dict]:
    """CSV 텍스트 줄(첫 줄 헤더) → 적재 항목을 하나씩. 자연 키 = (도시코드, 정류장번호) — 2026-10-11 227,065행에서 겹침 0."""
    reader = csv.reader(stream)
    header = check_header(next(reader, []), BUS_EXPECTED_COLUMNS, BUS)
    index = {h: i for i, h in enumerate(header)}
    for n, row in enumerate(reader, start=2):
        if not row:
            continue
        if len(row) != len(header):
            raise SourceRejected(f"{BUS} {n}번째 줄 열 수 {len(row)} ≠ {len(header)}")
        rec = {field: row[index[h]] for h, field in BUS_COLUMNS}
        lat, lng, valid = coord(rec["latRaw"], rec["lngRaw"])
        parsed = source_date(rec["collectedDateRaw"])
        rec.update(latValue=lat, lngValue=lng, validCoord=valid, collectedDate=parsed.isoformat() if parsed else None,
                   sourceKey=f"{rec['cityCode'].strip()}:{rec['stopNo'].strip()}")
        yield rec


# ---------------------------------------------------------------- 최근접


def distance_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    """하버사인 직선거리(m)."""
    la1, lo1, la2, lo2 = (math.radians(v) for v in (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return EARTH_RADIUS_M * 2 * math.asin(math.sqrt(min(1.0, h)))


def _station_name_key(name: str) -> str:
    name = name.strip()
    return name[:-1] if len(name) > 1 and name.endswith("역") else name


def _join_lines(names: list[str]) -> str | None:
    seen = list(dict.fromkeys(n.strip() for n in names if n and n.strip()))
    if not seen:
        return None
    numbers = [re.fullmatch(r"(\d+)호선", n) for n in seen]
    if all(numbers):
        return "·".join(sorted((m.group(1) for m in numbers), key=int)) + "호선"
    return "·".join(seen)


def rail_stations(records: list[dict]) -> list[Stop]:
    """유효 좌표 행을 역으로 묶는다 — 끝의 「역」을 뗀 이름이 같고 [STATION_MERGE_M] 안에 한 행이라도 있으면 같은 역. 노선은 「1·4호선」처럼 합친다."""
    groups: list[list[dict]] = []
    by_name: dict[str, list[int]] = defaultdict(list)
    for r in sorted((r for r in records if r["validCoord"]), key=lambda r: r["sourceKey"]):
        point = (r["latValue"], r["lngValue"])
        name = _station_name_key(r["stationName"])
        for gi in by_name[name]:
            if any(round(distance_m(point, (m["latValue"], m["lngValue"]))) <= STATION_MERGE_M for m in groups[gi]):
                groups[gi].append(r)
                break
        else:
            by_name[name].append(len(groups))
            groups.append([r])
    stations = []
    for g in groups:
        first = g[0]
        stations.append(Stop(
            key=first["sourceKey"], name=first["stationName"].strip(),
            name_en=next((m["stationNameEn"].strip() for m in g if (m["stationNameEn"] or "").strip() not in ("", "-")), None),
            lines=_join_lines([m["lineName"] for m in g]),
            points=tuple((m["latValue"], m["lngValue"]) for m in g),
            base_date=max((m["baseDate"] for m in g if m["baseDate"]), default=None),
        ))
    return stations


def bus_stop(rec: dict) -> Stop | None:
    if not rec["validCoord"]:
        return None
    return Stop(rec["sourceKey"], rec["stopName"].strip(), None, None, ((rec["latValue"], rec["lngValue"]),), rec["collectedDate"])


def nearest_stops(attractions: Iterable[tuple[int, float, float]], stops: list[Stop], kind: str) -> dict[int, list[dict]]:
    """관광지 (id, 위도, 경도) 마다 반경 안 가까운 순 [PER_KIND] 곳. 범위 안에 없으면 빈 목록.

    정류장은 같은 이름(길 건너 쌍)이면 가까운 하나만 센다. 거리는 하버사인을 m 단위로 반올림한 값이고 반경은 그 값으로 포함 판정한다
    (place 의 PUT 검사가 같은 반올림 값을 본다).
    """
    radius = RAIL_RADIUS_M if kind == RAIL else BUS_RADIUS_M
    grid: dict[tuple[int, int], list[tuple[int, float, float]]] = defaultdict(list)
    for i, s in enumerate(stops):
        for lat, lng in s.points:
            grid[(math.floor(lat / GRID_DEG), math.floor(lng / GRID_DEG))].append((i, lat, lng))
    dlat = radius / M_PER_LAT_DEG
    n_lat = math.ceil(radius / (GRID_DEG * M_PER_LAT_DEG))
    out: dict[int, list[dict]] = {}
    for aid, lat, lng in attractions:
        # 칸 폭은 반경 끝의 더 높은 위도에서 가장 좁다 — 그 폭으로 이웃 칸 수를 정한다
        cos_far = math.cos(math.radians(min(abs(lat) + dlat, 89.0)))
        n_lng = math.ceil(radius / (GRID_DEG * M_PER_LAT_DEG * cos_far))
        dlng = radius / (M_PER_LAT_DEG * cos_far)
        ci, cj = math.floor(lat / GRID_DEG), math.floor(lng / GRID_DEG)
        best: dict[int, int] = {}
        for di in range(-n_lat, n_lat + 1):
            for dj in range(-n_lng, n_lng + 1):
                for i, slat, slng in grid.get((ci + di, cj + dj), ()):
                    if abs(slat - lat) > dlat * 1.01 or abs(slng - lng) > dlng * 1.01:
                        continue
                    d = round(distance_m((lat, lng), (slat, slng)))
                    if d <= radius and d < best.get(i, radius + 1):
                        best[i] = d
        chosen: list[dict] = []
        names: set[str] = set()
        for i, d in sorted(best.items(), key=lambda kv: (kv[1], stops[kv[0]].key)):
            s = stops[i]
            if kind == BUS and s.name in names:
                continue
            names.add(s.name)
            chosen.append({"kind": kind, "sourceKey": s.key, "name": s.name, "nameEn": s.name_en, "lines": s.lines,
                           "distanceM": d, "rank": len(chosen) + 1, "baseDate": s.base_date})
            if len(chosen) == PER_KIND:
                break
        out[aid] = chosen
    return out


# ---------------------------------------------------------------- 버스 연계 지역


def bus_coverage(city_counts: Iterable[tuple[str, str, int]], regions: list[dict]) -> list[dict]:
    """버스 원천 (도시코드, 도시명, 행 수) → 시군구마다 {sigunguCode, stops, covered}. 원천 도시를 하나라도 못 이으면 실패.

    원천 `도시코드` 는 TAGO 도시 코드라 시군구 코드와 다르다 — `도시명` 으로 잇는다. 광역·특별자치(이름이 한 낱말)는 그 시도의 시군구 전부로 펴되,
    원천에 따로 도시 행이 있는 시군구(대구광역시 군위군)는 뺀다.
    """
    sigungu = [r for r in regions if len(str(r["code"])) == 5]
    by_sido: dict[str, list[dict]] = defaultdict(list)
    for r in sigungu:
        by_sido[r.get("parentCode") or r["code"][:2]].append(r)
    cities = [(code, (name or "").strip(), int(n)) for code, name, n in city_counts]

    def city_targets(sido: str, city: str | None) -> list[str]:
        if city is None:
            return [r["code"] for r in by_sido[SEJONG]]
        return [r["code"] for r in by_sido[sido] if r["name"] == city or r["name"].startswith(city + " ")]

    resolved: list[tuple[str, int, list[str]]] = []
    unmapped: list[str] = []
    own: dict[str, set[str]] = defaultdict(set)              # 원천 시도 이름 → 따로 도시 행이 있는 시군구
    for code, name, n in cities:
        parts = name.split(" ", 1)
        sido = SOURCE_SIDO.get(parts[0])
        if sido is None:
            unmapped.append(name)
            continue
        if len(parts) == 2:
            city = OLD_CITY[parts[1]] if parts[1] in OLD_CITY else parts[1]
            targets = city_targets(sido, city)
            own[parts[0]].update(targets)
        else:
            targets = []
        resolved.append((name, n, targets))
    for i, (name, n, targets) in enumerate(resolved):
        if " " in name:
            continue
        sido = SOURCE_SIDO[name]
        pool = GWANGJU_DISTRICTS if name == "광주광역시" else [r["code"] for r in by_sido[sido]]
        resolved[i] = (name, n, [c for c in pool if c not in own[name]])
    unmapped += [name for name, _, targets in resolved if not targets]
    if unmapped:
        raise SourceRejected(f"{BUS} 원천 도시를 시군구로 잇지 못한다: {sorted(set(unmapped))[:10]}")
    stops: Counter[str] = Counter()
    for _, n, targets in resolved:
        for t in targets:
            stops[t] += n
    return [{"sigunguCode": r["code"], "stops": stops[r["code"]], "covered": stops[r["code"]] >= BUS_COVERED_MIN_STOPS}
            for r in sorted(sigungu, key=lambda r: r["code"])]


# ---------------------------------------------------------------- 회차


def _chunks(items: list, size: int) -> Iterator[list]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _load_rail(url: str, workdir: Path, run_id: str, summary: dict) -> list[Stop] | None:
    s = summary["sources"][RAIL] = {"rows": 0, "invalid": 0, "dropped": 0, "failed": False, "error": None}
    try:
        previous = place_client.transit_state(RAIL).get("rows")
        records, dropped = rail_records(read_xlsx(download(url, RAIL_MAX_BYTES, workdir / "rail.xlsx")))
        invalid = sum(1 for r in records if not r["validCoord"])
        s.update(rows=len(records), invalid=invalid, dropped=dropped)
        if dropped:
            log(f"철도 자연 키 겹침 {dropped}행 — 기준일이 늦은 행 하나만 남겼다")
        check_counts(RAIL, len(records), invalid, previous)
        for chunk in _chunks(records, place_client.BULK_CHUNK):
            place_client.put_transit_rail(run_id, chunk)
        place_client.activate_transit(RAIL, run_id, len(records))
        stations = rail_stations(records)
        log(f"철도 {len(records)}행(무효 좌표 {invalid}) · 이전 활성 {previous} · 역 {len(stations)} · 회차 {run_id} 활성")
        return stations
    except Exception as e:                                   # noqa: BLE001 — 이전 활성 회차를 그대로 둔다
        s.update(failed=True, error=str(e))
        log(f"철도 실패 — 이전 회차 유지: {e}")
        return None


def _load_bus(url: str, workdir: Path, run_id: str, regions: list[dict], summary: dict) -> list[Stop] | None:
    s = summary["sources"][BUS] = {"rows": 0, "invalid": 0, "failed": False, "error": None}
    try:
        previous = place_client.transit_state(BUS).get("rows")
        path = download(url, BUS_MAX_BYTES, workdir / "bus.csv")
        total = invalid = 0
        cities: Counter[tuple[str, str]] = Counter()
        stops: list[Stop] = []
        # 첫 번째 읽기: 검사와 계산용 지점만. 원천 전 컬럼은 들고 있지 않는다(묶음은 두 번째 읽기에서 보낸다)
        with open(path, encoding=BUS_ENCODING, newline="") as f:
            for rec in bus_records(f):
                total += 1
                cities[(rec["cityCode"], rec["cityName"])] += 1
                stop = bus_stop(rec)
                if stop is None:
                    invalid += 1
                else:
                    stops.append(stop)
        s.update(rows=total, invalid=invalid)
        check_counts(BUS, total, invalid, previous)
        coverage = bus_coverage([(c, n, k) for (c, n), k in cities.items()], regions)
        with open(path, encoding=BUS_ENCODING, newline="") as f:
            batch: list[dict] = []
            for rec in bus_records(f):
                batch.append(rec)
                if len(batch) == place_client.BULK_CHUNK:
                    place_client.put_transit_bus(run_id, batch)
                    batch = []
            if batch:
                place_client.put_transit_bus(run_id, batch)
        place_client.activate_transit(BUS, run_id, total, coverage)
        uncovered = [c["sigunguCode"] for c in coverage if not c["covered"]]
        log(f"버스 {total}행(무효 좌표 {invalid}) · 이전 활성 {previous} · 원천 도시 {len(cities)} · "
            f"미연계 시군구 {len(uncovered)} {uncovered} · 회차 {run_id} 활성")
        return stops
    except Exception as e:                                   # noqa: BLE001
        s.update(failed=True, error=str(e))
        log(f"버스 실패 — 이전 회차 유지: {e}")
        return None


def run(rail_url: str, bus_url: str, workdir: Path | None = None) -> dict:
    """두 원천 적재(각자 회차 전환) → 둘 다 성공하면 관광지 가는 법 계산 · 교체 → 이번 회차에 없는 관광지 행 정리."""
    summary: dict = {"sources": {}, "attractions": 0, "withRail": 0, "withBus": 0, "failed": False}
    own_dir = workdir is None
    tmp = tempfile.TemporaryDirectory(prefix="transit-") if own_dir else None
    base = Path(tmp.name) if tmp else Path(workdir)
    try:
        run_id = datetime.now(KST).strftime("%Y%m%d%H%M%S")
        regions = place_client.fetch_sigungu_regions()
        rail = _load_rail(rail_url, base, run_id, summary)
        bus = _load_bus(bus_url, base, run_id, regions, summary)
        if rail is None or bus is None:
            summary["failed"] = True
            log("원천 하나라도 실패해 가는 법 계산을 건너뛴다 — 지난 계산 결과를 그대로 둔다")
            return summary
        points = place_client.fetch_attraction_points()
        computed_at = datetime.now(KST).replace(tzinfo=None, microsecond=0).isoformat()
        near_rail = nearest_stops(points, rail, RAIL)
        near_bus = nearest_stops(points, bus, BUS)
        items = [{"attractionId": aid, "stops": near_rail[aid] + near_bus[aid]} for aid, _, _ in points]
        for chunk in _chunks(items, place_client.BULK_CHUNK):
            place_client.put_attraction_access(computed_at, chunk)
        removed = place_client.prune_attraction_access(computed_at).get("removed")
        summary.update(attractions=len(items), withRail=sum(1 for v in near_rail.values() if v),
                       withBus=sum(1 for v in near_bus.values() if v))
        n = max(1, len(items))
        log(f"가는 법 {computed_at} · 관광지 {len(items)} · 역 붙음 {summary['withRail']}({summary['withRail'] / n:.1%}) · "
            f"정류장 붙음 {summary['withBus']}({summary['withBus'] / n:.1%}) · 이번 회차에 없는 관광지 행 정리 {removed}")
        return summary
    finally:
        if tmp:
            tmp.cleanup()
