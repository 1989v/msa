"""대기 수집 — 에어코리아 대기오염정보 `ArpltnInforInqireSvc` (data.go.kr 15073861) · 측정소정보 `MsrstnInfoInqireSvc` (15073877).

- 실시간 측정 `getCtprvnRltmMesureDnsty` `sidoName=전국`: **한 콜에 측정소 672곳 전부**(2026-10-02). 매시 1콜 = 하루 24콜(한도 500).
  측정소마다 행 하나를 원문 그대로 보낸다. 한 응답에 측정 시각이 섞이므로(21시 612 · 22시 54 · 없음 6) 측정소마다 자기 `dataTime` 을 싣는다.
- 측정소 목록 `getMsrstnList` (addr 생략 = 전국 672): 주 1회 1콜. 좌표는 **필드 이름과 반대로 `dmX` 가 위도, `dmY` 가 경도**다
  (서울 중구 37.564639 / 126.975961). 한반도 범위 검사가 뒤바뀜을 잡는다 — 원천이 순서를 고치면 전부 범위 밖이 되어 잡이 실패한다.
  목록을 받으면 시군구마다 **측정소 후보**를 정해 함께 보낸다 — 그 시군구 관광지 하나하나의 최근접 측정소 + 대표점의 최근접 측정소
  (`station_candidates`). 화면은 후보 가운데 그 관광지에서 가장 가까운 것을 고르므로, 전국 672곳 중 최근접과 같다.
  대표점 하나로 측정소 하나만 이으면 관광지 → 측정소 거리가 중앙값 5.1km · 20km 초과 8.2% 였고, 관광지별 최근접은 2.2km · 1.7% 다
  (2026-10-02 운영 국문 관광지 48,725곳). 후보는 시군구당 중앙값 6 · 최대 21곳이다.

이용허락이 공공누리 제3유형(출처표시 · 변경금지)이다. 여러 측정소 값을 평균하거나 등급을 다시 매기지 않는다 —
화면은 측정소 하나의 값·등급을 측정소 이름 · 측정 시각과 함께 낸다(place `GET /api/places/air`).
원천 시간 초과(`SERVICETIMEOUT_ERROR` 05 · HTTP 504)가 잦아 그 자리에서 [RETRIES] 번까지 다시 부르고, 다시 부른 것도 예산에서 뺀다.
"""
from __future__ import annotations

import json

from src import datagokr, place_client, weather_grid

MEASURE_API = "ArpltnInforInqireSvc"
STATION_API = "MsrstnInfoInqireSvc"
MEASURE_PATH = f"B552584/{MEASURE_API}/getCtprvnRltmMesureDnsty"
STATION_PATH = f"B552584/{STATION_API}/getMsrstnList"

#: 한 쪽 행 수 — 전국 672곳이 한 콜에 온다.
PAGE_ROWS = 1000
#: 원천 시간 초과를 다시 부르는 횟수.
RETRIES = 2
#: 회차 상한 = 1콜 + 재시도. 매시 회차라 하루 상한 24 × 3 = 72 < 한도 500.
MEASURE_BUDGET = 1 + RETRIES
#: 주 1회 목록 1콜 + 재시도.
STATION_BUDGET = 1 + RETRIES
#: 원천 응답이 느리다(시간 초과가 잦다) — 소켓 시간 제한을 길게.
TIMEOUT_SEC = 120
#: 한반도(+ 백령도·울릉도·독도·마라도) 범위. 2026-10-02 측정소 672곳은 위도 33.23~38.56 · 경도 124.65~130.90.
KOREA_LAT = (33.0, 39.0)
KOREA_LNG = (124.0, 132.0)
#: place 로 한 번에 보내는 측정 행 수 — 672 가 한 요청이다.
PUSH_ROWS = 1000


def log(msg: str) -> None:
    print(f"[air] {msg}", flush=True)


def _raw(item: dict) -> str:
    return json.dumps(item, ensure_ascii=False, separators=(",", ":"))


def station_record(item: dict) -> dict:
    """측정소 목록 행 → place 적재 항목. 좌표는 dmX → 위도, dmY → 경도(원천 필드 이름과 반대). 원문은 통째로 싣는다.

    좌표가 없거나 한반도 밖이면 [ValueError] — 뒤바뀐 좌표로 최근접을 고르면 전국이 엉뚱한 측정소에 붙는다.
    """
    name = str(item.get("stationName") or "").strip()
    if not name:
        raise ValueError(f"측정소 이름이 없다: {item}")
    try:
        lat, lng = float(item["dmX"]), float(item["dmY"])
    except (KeyError, TypeError, ValueError) as e:
        raise ValueError(f"{name}: 좌표가 없다 dmX={item.get('dmX')!r} dmY={item.get('dmY')!r}") from e
    if not _in_korea(lat, lng):
        raise ValueError(f"{name}: 한반도 밖 좌표 위도 {lat} 경도 {lng} — dmX(위도)·dmY(경도) 순서가 바뀌었는지 본다")
    return {"stationName": name, "latitude": lat, "longitude": lng, "itemRaw": _raw(item)}


def measurement_record(item: dict) -> dict:
    """실시간 측정 행 하나 → place 적재 항목. 값·등급·Flag 는 고치지 않고 원문 JSON 으로, 측정 시각은 원천 표기 그대로 싣는다."""
    name = str(item.get("stationName") or "").strip()
    sido = str(item.get("sidoName") or "").strip()
    if not name or not sido:
        raise ValueError(f"측정소·시도 이름이 없다: {item}")
    return {"sidoName": sido, "stationName": name, "dataTime": item.get("dataTime") or None, "itemRaw": _raw(item)}


def measurement_records(items: list[dict]) -> list[dict]:
    """응답 전부 → 적재 항목. 측정소 이름이 겹치면 [ValueError] — 이름이 저장 키라(전국 유일, 2026-10-02 672/672) 겹치면 한쪽이 덮인다."""
    records = [measurement_record(i) for i in items]
    names = [r["stationName"] for r in records]
    dup = sorted({n for n in names if names.count(n) > 1})
    if dup:
        raise ValueError(f"측정소 이름이 겹친다: {dup[:5]}")
    return records


def _in_korea(lat, lng) -> bool:
    return lat is not None and lng is not None and KOREA_LAT[0] <= lat <= KOREA_LAT[1] and KOREA_LNG[0] <= lng <= KOREA_LNG[1]


def nearest_station(point: tuple[float, float], stations: list[dict]) -> tuple[dict, float]:
    """672곳 전부와 견준다(관광지 6만 곳에 약 20초, 주 1회라 색인을 두지 않는다). (측정소, km)."""
    best = min(stations, key=lambda s: weather_grid.distance_km(point, (s["latitude"], s["longitude"])))
    return best, weather_grid.distance_km(point, (best["latitude"], best["longitude"]))


def station_candidates(regions: list[dict], attractions: list[dict], stations: list[dict]) -> list[dict]:
    """시군구마다 측정소 후보 → place `air_station_sigungu` 행.

    후보 = 그 시군구 관광지(언어 무관, 같은 좌표는 한 번) 각각의 최근접 측정소 ∪ 시군구 대표점의 최근접 측정소.
    `attractions` 는 그 측정소가 최근접인 관광지 좌표 수(대표점만의 후보면 0), `distanceM` 은 대표점 → 측정소(대표점이 없으면 None).
    좌표가 한반도 밖인 관광지(원천 오기)는 건너뛴다.
    """
    counts: dict[tuple[str, str], int] = {}
    seen: set[tuple[str, float, float]] = set()
    for a in attractions:
        regn, signgu = a.get("ldongRegnCd"), a.get("ldongSignguCd")
        lat, lng = a.get("latitude"), a.get("longitude")
        if not regn or not signgu or not _in_korea(lat, lng) or (f"{regn}{signgu}", lat, lng) in seen:
            continue
        seen.add((f"{regn}{signgu}", lat, lng))
        best, _ = nearest_station((lat, lng), stations)
        key = (f"{regn}{signgu}", best["stationName"])
        counts[key] = counts.get(key, 0) + 1
    centers = {r["code"]: (r["latitude"], r["longitude"]) for r in regions
               if r.get("level", "SIGUNGU") == "SIGUNGU" and _in_korea(r.get("latitude"), r.get("longitude"))}
    for code, point in centers.items():
        counts.setdefault((code, nearest_station(point, stations)[0]["stationName"]), 0)
    by_name = {s["stationName"]: s for s in stations}
    out = []
    for (code, name), n in sorted(counts.items()):
        station = (by_name[name]["latitude"], by_name[name]["longitude"])
        distance = round(weather_grid.distance_km(centers[code], station) * 1000) if code in centers else None
        out.append({"sigunguCode": code, "stationName": name, "distanceM": distance, "attractions": n})
    return out


def fetch_all(client: datagokr.Client, path: str, params: dict, label: str) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        body = client.get(path, {"returnType": "json", "numOfRows": PAGE_ROWS, "pageNo": page, **params}, f"{label} p{page}")
        got = datagokr.items(body)
        rows.extend(got)
        if not got or page * PAGE_ROWS >= int(body.get("totalCount") or 0):
            return rows
        page += 1


def _client(key: str, api: str, budget: int) -> datagokr.Client:
    return datagokr.Client(key=key, api=api, budget=budget, timeout_sec=TIMEOUT_SEC, retries=RETRIES)


def run_measurements(key: str, client: datagokr.Client | None = None) -> dict:
    """전국 실시간 측정 1콜 → place 적재. 한도 초과면 보내지 않고 멈춘다(실패 아님), 시간 초과가 재시도를 넘기면 실패."""
    client = client or _client(key, MEASURE_API, MEASURE_BUDGET)
    summary = {"api": MEASURE_API, "calls": 0, "received": 0, "applied": 0, "sigungu": 0, "failed": False, "stopped": None}
    try:
        rows = fetch_all(client, MEASURE_PATH, {"sidoName": "전국", "ver": "1.0"}, "실시간 측정 전국")
        records = measurement_records(rows)
    except (datagokr.QuotaExceeded, datagokr.BudgetExhausted) as e:
        summary.update(calls=client.calls, stopped=str(e))
        log(f"API {MEASURE_API} · 호출 {client.calls} · 멈춤 {e}")
        return summary
    except Exception as e:                                  # noqa: BLE001 — 이전 측정값은 그대로 둔다
        summary.update(calls=client.calls, failed=True)
        log(f"API {MEASURE_API} · 호출 {client.calls} · 실패 {e}")
        return summary
    applied = sigungu = 0
    for i in range(0, len(records), PUSH_ROWS):
        got = place_client.put_air_measurements(records[i:i + PUSH_ROWS])
        applied += int(got.get("applied") or 0)
        sigungu += int(got.get("sigungu") or 0)
    times: dict[str | None, int] = {}
    for r in records:
        times[r["dataTime"]] = times.get(r["dataTime"], 0) + 1
    summary.update(calls=client.calls, received=len(records), applied=applied, sigungu=sigungu, failed=not records)
    log(f"API {MEASURE_API} · 호출 {client.calls} · 측정소 {len(records)} · 적재 {applied} · 캐시 갱신 시군구 {sigungu} · "
        f"측정 시각 {sorted(times.items(), key=lambda kv: kv[0] or '')}")
    return summary


def run_stations(key: str, client: datagokr.Client | None = None) -> dict:
    """측정소 목록 1콜 → 좌표 검사 → 시군구 측정소 후보 → place 적재. 좌표가 하나도 통과하지 못하면 보내지 않고 실패한다."""
    client = client or _client(key, STATION_API, STATION_BUDGET)
    summary = {"api": STATION_API, "calls": 0, "stations": 0, "rejected": 0, "mappings": 0, "failed": False, "stopped": None}
    try:
        rows = fetch_all(client, STATION_PATH, {}, "측정소 목록 전국")
    except (datagokr.QuotaExceeded, datagokr.BudgetExhausted) as e:
        summary.update(calls=client.calls, stopped=str(e))
        log(f"API {STATION_API} · 호출 {client.calls} · 멈춤 {e}")
        return summary
    except Exception as e:                                  # noqa: BLE001
        summary.update(calls=client.calls, failed=True)
        log(f"API {STATION_API} · 호출 {client.calls} · 실패 {e}")
        return summary
    stations, rejected = [], []
    for row in rows:
        try:
            stations.append(station_record(row))
        except ValueError as e:
            rejected.append(str(e))
    summary.update(calls=client.calls, rejected=len(rejected))
    if rejected:
        log(f"좌표 검사 탈락 {len(rejected)}: {rejected[:3]}")
    if not stations:
        summary["failed"] = True
        log(f"API {STATION_API} · 호출 {client.calls} · 받은 행 {len(rows)} · 쓸 수 있는 측정소 0 — 보내지 않는다")
        return summary
    mappings = station_candidates(place_client.fetch_sigungu_regions(), place_client.fetch_attractions(), stations)
    got = place_client.put_air_stations(stations, mappings)
    per_sigungu: dict[str, int] = {}
    for m in mappings:
        per_sigungu[m["sigunguCode"]] = per_sigungu.get(m["sigunguCode"], 0) + 1
    sizes = sorted(per_sigungu.values())
    summary.update(stations=int(got.get("stations") or 0), mappings=int(got.get("mappings") or 0))
    log(f"API {STATION_API} · 호출 {client.calls} · 측정소 {len(stations)} · 탈락 {len(rejected)} · 시군구 {len(per_sigungu)} · "
        f"후보 {len(mappings)}(시군구당 중앙값 {sizes[len(sizes) // 2] if sizes else '-'} · 최대 {sizes[-1] if sizes else '-'}) · "
        f"캐시 갱신 시군구 {got.get('sigungu')}")
    return summary
