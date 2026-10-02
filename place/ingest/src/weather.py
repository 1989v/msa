"""날씨 수집 — 기상청 단기예보 `VilageFcstInfoService_2.0` (data.go.kr 15084084) · 중기예보 `MidFcstInfoService` (15059468).

화면 단위는 시군구다(`weather_grid`). 회차마다 place 의 시군구 대표점을 읽어 격자·중기 구역을 다시 계산해 보내고
(`/internal/weather/areas`), 그 단위로 예보를 받는다.

- 단기 `getVilageFcst`: 발표 05시·17시(02·05·…·23시 중 예보 기간이 가장 긴 둘)에 고유 격자마다 1콜. 2026-10-02 실측으로
  05시 발표는 907행(오늘 06시 ~ 글피), 17시 발표는 1,052행이다 — 설계의 쪽 크기 1,000 이면 17시 발표가 두 쪽이 되므로
  쪽 크기를 1,500 으로 둔다(1,500 으로 한 콜에 1,052행 전부가 온다). 원천 행(범주별 한 행)을 고치지 않고 격자마다 통째로 보낸다.
- 중기 `getMidLandFcst`(육상 권역 10) · `getMidTa`(기온 regId, 시군구가 쓰는 것만): 06시 발표 하루 1번. 06시 발표만
  4일 뒤부터 준다(18시 발표는 5일 뒤부터 — 활용가이드 2024-11-28 개정). 원천 항목 하나를 통째로 보낸다.

새 발표본이 옛 발표본을 바꾼다(place 가 발표 시각이 같거나 새로울 때만 덮는다). 한 단위가 실패해도 다음 단위는 받고,
실패한 단위의 이전 발표본은 그대로 둔다. 한도 초과(429 · resultCode=22)면 그 API 를 그날 멈추고 받은 몫만 보낸다.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from src import datagokr, place_client, weather_grid

SHORT_API = "VilageFcstInfoService_2.0"
MID_API = "MidFcstInfoService"
SHORT_PATH = f"1360000/{SHORT_API}/getVilageFcst"
MID_PATHS = {"LAND": f"1360000/{MID_API}/getMidLandFcst", "TA": f"1360000/{MID_API}/getMidTa"}

#: 단기예보 발표 시각(시). 한 회차가 고유 격자 수만큼 부르므로 하루 2회 × 243 = 486콜.
SHORT_BASE_HOURS = (5, 17)
#: 발표 뒤 API 에 실리기까지의 여유 — 기상청 안내는 발표 10분 뒤 제공.
PUBLISH_DELAY = timedelta(minutes=10)
#: 한 격자 한 발표의 행 수(실측 최대 1,052)보다 넉넉하게 — 한 콜에 한 발표가 다 온다.
SHORT_PAGE_ROWS = 1500
#: 한 회차 상한 = 고유 격자 243 + 여유. 하루 2회차 540 < 한도 1,000.
SHORT_BUDGET = 270
#: 한 회차 상한 = 육상 10 + 기온 regId(2026-10-02 매핑 163) + 여유. 하루 1회.
MID_BUDGET = 200
#: 중기 발표 시각 — 06시 발표만 4일 뒤 값을 준다.
MID_BASE_HOUR = 6
#: place 로 한 번에 보내는 격자 수 — 격자 하나가 약 1,000행(JSON 약 110KB)이다.
PUSH_GRIDS = 10


def log(msg: str) -> None:
    print(f"[weather] {msg}", flush=True)


def short_base(now: datetime) -> datetime:
    """`now` 에 받을 수 있는 가장 최근 단기 발표(05시·17시). 발표 10분 전까지는 그 앞 발표다."""
    ready = now - PUBLISH_DELAY
    day = ready.replace(minute=0, second=0, microsecond=0)
    for back in (0, 1):
        d = day - timedelta(days=back)
        for hour in sorted(SHORT_BASE_HOURS, reverse=True):
            base = d.replace(hour=hour)
            if base <= ready:
                return base
    raise AssertionError("unreachable")


def mid_tm_fc(now: datetime) -> datetime:
    """`now` 에 받을 수 있는 가장 최근 06시 중기 발표."""
    ready = now - PUBLISH_DELAY
    base = ready.replace(hour=MID_BASE_HOUR, minute=0, second=0, microsecond=0)
    return base if base <= ready else base - timedelta(days=1)


def short_record(items: list[dict]) -> dict:
    """한 격자 한 발표의 원천 행 전부 → place 적재 항목. 행은 고치지 않고 원문 JSON 배열로 싣는다.

    격자·발표가 섞이면 [ValueError] — 다른 격자의 값이 이 격자 이름으로 저장되는 것을 막는다.
    """
    if not items:
        raise ValueError("단기예보 행이 없다")
    keys = {(str(i.get("nx")), str(i.get("ny")), str(i.get("baseDate")), str(i.get("baseTime"))) for i in items}
    if len(keys) != 1:
        raise ValueError(f"한 항목에 격자·발표가 섞였다: {sorted(keys)[:3]}")
    first = items[0]
    return {"nx": int(first["nx"]), "ny": int(first["ny"]), "baseDate": str(first["baseDate"]),
            "baseTime": str(first["baseTime"]),
            "itemsRaw": json.dumps(items, ensure_ascii=False, separators=(",", ":"))}


def mid_record(kind: str, tm_fc: datetime, item: dict) -> dict:
    """중기 항목 하나(육상 23키 · 기온 43키) → place 적재 항목. 원천 키·값을 그대로 원문 JSON 으로 싣는다."""
    if kind not in MID_PATHS:
        raise ValueError(f"모르는 중기 종류: {kind}")
    reg_id = str(item.get("regId") or "").strip()
    if not reg_id:
        raise ValueError(f"중기 항목에 regId 가 없다: {item}")
    return {"regId": reg_id, "kind": kind, "tmFc": tm_fc.strftime("%Y%m%d%H%M"),
            "itemRaw": json.dumps(item, ensure_ascii=False, separators=(",", ":"))}


def fetch_short(client: datagokr.Client, nx: int, ny: int, base: datetime) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        body = client.get(SHORT_PATH,
                          {"dataType": "JSON", "numOfRows": SHORT_PAGE_ROWS, "pageNo": page,
                           "base_date": base.strftime("%Y%m%d"), "base_time": base.strftime("%H%M"), "nx": nx, "ny": ny},
                          f"단기 ({nx},{ny}) {base:%Y%m%d%H%M} p{page}")
        got = datagokr.items(body)
        rows.extend(got)
        if not got or page * SHORT_PAGE_ROWS >= int(body.get("totalCount") or 0):
            return rows
        page += 1


def fetch_mid(client: datagokr.Client, kind: str, reg_id: str, tm_fc: datetime) -> dict:
    body = client.get(MID_PATHS[kind],
                      {"dataType": "JSON", "numOfRows": 10, "pageNo": 1, "regId": reg_id, "tmFc": tm_fc.strftime("%Y%m%d%H%M")},
                      f"중기 {kind} {reg_id} {tm_fc:%Y%m%d%H%M}")
    got = datagokr.items(body)
    if len(got) != 1:
        raise datagokr.DataGoKrError(f"중기 {kind} {reg_id}: 항목 {len(got)}개 (하나여야 한다)")
    return got[0]


def load_areas() -> list[dict]:
    """place 시군구 대표점 → 날씨 단위를 계산해 place 에 보낸다(매핑표 · 중기 구역 시드). 계산한 단위를 돌려준다."""
    areas = weather_grid.assign(place_client.fetch_sigungu_regions())
    applied = place_client.put_weather_areas(weather_grid.mid_regions(), areas)
    log(f"단위: 시군구 {len(areas)} · 고유 격자 {len({(a['nx'], a['ny']) for a in areas})} · "
        f"기온 regId {len({a['taRegId'] for a in areas if a['taRegId']})} · 적재 {applied}")
    return areas


def _push_short(records: list[dict]) -> dict:
    total = {"applied": 0, "sigungu": 0}
    for i in range(0, len(records), PUSH_GRIDS):
        got = place_client.put_weather_short(records[i:i + PUSH_GRIDS])
        total["applied"] += int(got.get("applied") or 0)
        total["sigungu"] += int(got.get("sigungu") or 0)
    return total


def run_short(key: str, now: datetime, client: datagokr.Client | None = None, areas: list[dict] | None = None) -> dict:
    client = client or datagokr.Client(key=key, api=SHORT_API, budget=SHORT_BUDGET)
    areas = areas if areas is not None else load_areas()
    base = short_base(now)
    grids = sorted({(a["nx"], a["ny"]) for a in areas})
    log(f"단기 발표 {base:%Y-%m-%d %H:%M} · 격자 {len(grids)}")
    run = datagokr.run_units(grids, lambda g: short_record(fetch_short(client, g[0], g[1], base)), log)
    records = [r for r in run.results.values() if r]
    pushed = _push_short(records) if records else {"applied": 0, "sigungu": 0}
    summary = {"api": SHORT_API, "calls": client.calls, "units": len(grids), "received": len(records),
               "applied": pushed["applied"], "sigungu": pushed["sigungu"], "failed": bool(run.failed),
               "stopped": run.stopped, "base": base.strftime("%Y%m%d%H%M")}
    log(f"API {SHORT_API} · 호출 {client.calls} · 격자 {len(records)}/{len(grids)} · 적재 {pushed['applied']} · "
        f"캐시 갱신 시군구 {pushed['sigungu']}" + (f" · 실패 {run.failed}" if run.failed else "")
        + (f" · 멈춤 {run.stopped}" if run.stopped else ""))
    return summary


def run_mid(key: str, now: datetime, client: datagokr.Client | None = None, areas: list[dict] | None = None) -> dict:
    client = client or datagokr.Client(key=key, api=MID_API, budget=MID_BUDGET)
    areas = areas if areas is not None else load_areas()
    tm_fc = mid_tm_fc(now)
    units = ([("LAND", r) for r in sorted({a["landRegId"] for a in areas if a["landRegId"]})]
             + [("TA", r) for r in sorted({a["taRegId"] for a in areas if a["taRegId"]})])
    log(f"중기 발표 {tm_fc:%Y-%m-%d %H:%M} · 육상 {sum(1 for k, _ in units if k == 'LAND')} · "
        f"기온 {sum(1 for k, _ in units if k == 'TA')}")
    run = datagokr.run_units(units, lambda u: mid_record(u[0], tm_fc, fetch_mid(client, u[0], u[1], tm_fc)), log)
    records = [r for r in run.results.values() if r]
    pushed = place_client.put_weather_mid(records) if records else {"applied": 0, "sigungu": 0}
    summary = {"api": MID_API, "calls": client.calls, "units": len(units), "received": len(records),
               "applied": int(pushed.get("applied") or 0), "sigungu": int(pushed.get("sigungu") or 0),
               "failed": bool(run.failed), "stopped": run.stopped, "tmFc": tm_fc.strftime("%Y%m%d%H%M")}
    log(f"API {MID_API} · 호출 {client.calls} · 구역 {len(records)}/{len(units)} · 적재 {summary['applied']} · "
        f"캐시 갱신 시군구 {summary['sigungu']}" + (f" · 실패 {run.failed}" if run.failed else "")
        + (f" · 멈춤 {run.stopped}" if run.stopped else ""))
    return summary
