"""지역 방문자 수집 — 한국관광공사 빅데이터 `DataLabService` (data.go.kr 15101972).

기초(`locgoRegnVisitrDDList`, 시군구 269 × 현지인·외지인·외국인 = 하루 807행)와 광역(`metcoRegnVisitrDDList`,
시도 16 × 3 = 하루 48행)을 일자별로 쌓는다. 시군구 코드 269개는 우리 `administrative_regions` 와 전부 같다(2026-10-02 실측).
과거 실적이라 교체하지 않고 (지역, 날짜, 구분) 키로 upsert 한다 — 같은 날을 다시 받아도 행이 늘지 않는다.

공개 지연: 2026-10-02 18시(KST)에 받은 가장 최근 날은 2026-09-02 였다 — 30일. 매일 한 번 D-37 ~ D-28 열흘 창을
기초·광역 각 한 콜로 받는다(기초 열흘 8,070행 < 쪽 크기 10,000). 한 날이 공개된 뒤 여러 번 다시 받으므로 하루이틀
실패해도 메워지고, 지연이 이틀쯤 줄어도 창 안이다. 창 안에 공개된 날이 하나도 없으면 실패로 끝낸다(지연이 창보다 길어졌다).

백필은 `--from YYYY-MM` — 그 달부터 이번 달까지 월 단위로 받는다(달마다 기초 3쪽 + 광역 1쪽).

`touNum` 은 원천이 부동소수 표기(`24814.549999999996`)로 준다. 원문 문자열 그대로 보내고, 합산용 수치는 place 가 파생 컬럼으로 만든다.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from src import datagokr, place_client

API = "DataLabService"
PATH = f"B551011/{API}"
PAGE_ROWS = 10_000
_COMMON = {"MobileOS": "ETC", "MobileApp": "msa-seed", "_type": "json"}

#: 수준 → (오퍼레이션, 코드 키, 이름 키)
OPS = {
    "SIGUNGU": ("locgoRegnVisitrDDList", "signguCode", "signguNm"),
    "SIDO": ("metcoRegnVisitrDDList", "areaCode", "areaNm"),
}

#: 창의 가장 최근 날(며칠 전) — 실측 공개 지연 30일보다 이틀 앞이라 일찍 공개된 날도 받는다.
WINDOW_NEWEST_DAYS_AGO = 28
#: 창 길이. 기초 열흘이 한 쪽(10,000행)에 들어간다.
WINDOW_DAYS = 10
#: 매일 기초·광역 각 1콜 + 원천 행 수가 늘어 쪽이 넘칠 때의 여유. 한도는 API 하나당 하루 1,000.
DAILY_BUDGET = 4
#: 12개월 백필 = 달마다 기초 3쪽 + 광역 1쪽 = 48콜 + 이번 달·여유.
BACKFILL_BUDGET = 60


def log(msg: str) -> None:
    print(f"[visitors] {msg}", flush=True)


def record(level: str, row: dict) -> dict:
    """원천 행 → place 적재 항목. 원천 키·값을 그대로 싣고 수준만 더한다. 코드·수치가 없는 행은 [ValueError]."""
    _, code_key, _ = OPS[level]
    if not str(row.get(code_key) or "").strip():
        raise ValueError(f"{level} 행에 {code_key} 가 없다: {row}")
    try:
        Decimal(str(row.get("touNum")))
    except InvalidOperation as e:
        raise ValueError(f"touNum 이 수가 아니다: {row.get('touNum')!r}") from e
    return {"regionLevel": level, **row}


def fetch(client: datagokr.Client, level: str, start: date, end: date) -> list[dict]:
    op, _, _ = OPS[level]
    rows: list[dict] = []
    page = 1
    while True:
        body = client.get(f"{PATH}/{op}",
                          {**_COMMON, "numOfRows": PAGE_ROWS, "pageNo": page,
                           "startYmd": start.strftime("%Y%m%d"), "endYmd": end.strftime("%Y%m%d")},
                          f"방문자 {level} {start:%Y%m%d}~{end:%Y%m%d} p{page}")
        got = datagokr.items(body)
        rows.extend(got)
        if not got or page * PAGE_ROWS >= int(body.get("totalCount") or 0):
            return rows
        page += 1


def _push(level: str, rows: list[dict]) -> dict:
    """수준 하나의 행을 지역 순으로 보낸다 — place 가 요청마다 받은 지역의 캐시를 다시 채우므로, 지역이 여러 요청에
    흩어지지 않게 묶는다."""
    _, code_key, _ = OPS[level]
    records = sorted((record(level, r) for r in rows), key=lambda r: (r[code_key], r["baseYmd"], r["touDivCd"]))
    applied = place_client.put_region_visitors(records)
    dates = sorted({r["baseYmd"] for r in rows})
    return {"rows": len(rows), "applied": applied.get("applied"), "dates": len(dates),
            "first": dates[0], "latest": dates[-1], "regions": len({r[code_key] for r in rows})}


def _summary(client: datagokr.Client, run: datagokr.UnitRun, empty: list) -> dict:
    return {"api": API, "calls": client.calls, "failed": bool(run.failed or empty),
            "stopped": run.stopped, "levels": {}}


def run_daily(key: str, today: date, client: datagokr.Client | None = None) -> dict:
    client = client or datagokr.Client(key=key, api=API, budget=DAILY_BUDGET)
    end = today - timedelta(days=WINDOW_NEWEST_DAYS_AGO)
    start = end - timedelta(days=WINDOW_DAYS - 1)
    log(f"창 {start} ~ {end} (공개 지연 실측 30일)")
    empty: list[str] = []

    def one(level: str) -> dict | None:
        rows = fetch(client, level, start, end)
        if not rows:
            # 공개 지연이 창보다 길어졌거나 원천이 비었다 — 지울 것도 없으니 보내지 않고 실패로 남긴다
            log(f"[{level}] 창 안에 공개된 날이 없다 — 공개 지연이 {WINDOW_NEWEST_DAYS_AGO + WINDOW_DAYS - 1}일을 넘었는지 본다")
            empty.append(level)
            return None
        got = _push(level, rows)
        log(f"[{level}] 원천 {got['rows']:,}행 · 적재 {got['applied']} · 날짜 {got['dates']}({got['first']}~{got['latest']}) · "
            f"지역 {got['regions']} · 가장 최근 날의 지연 {(today - _ymd(got['latest'])).days}일")
        return got

    run = datagokr.run_units(OPS, one, log)
    summary = _summary(client, run, empty)
    summary["levels"] = {k: v for k, v in run.results.items() if v}
    log(f"API {API} · 호출 {client.calls}" + (f" · 실패 {run.failed + empty}" if run.failed or empty else ""))
    return summary


def months(from_month: str, today: date) -> list[date]:
    """`YYYY-MM` 부터 오늘이 속한 달까지 각 달의 1일."""
    year, month = (int(x) for x in from_month.split("-"))
    first = date(year, month, 1)  # 13월 등은 여기서 ValueError
    out = []
    while first <= today:
        out.append(first)
        first = (first + timedelta(days=32)).replace(day=1)
    return out


def run_backfill(key: str, from_month: str, today: date, client: datagokr.Client | None = None) -> dict:
    """한 번 돌리는 백필. 달 · 수준이 단위다 — 한 단위가 실패해도 나머지는 받고, 한도 초과면 받은 몫까지만."""
    client = client or datagokr.Client(key=key, api=API, budget=BACKFILL_BUDGET)
    yesterday = today - timedelta(days=1)
    units = [(m, level) for m in months(from_month, today) for level in OPS]
    empty: list = []

    def one(unit: tuple[date, str]) -> dict | None:
        first, level = unit
        last = min((first + timedelta(days=32)).replace(day=1) - timedelta(days=1), yesterday)
        rows = fetch(client, level, first, last)
        if not rows:
            # 아직 공개 전인 달은 0건이 정상이다 — 실패로 치지 않는다
            log(f"[{first:%Y-%m} {level}] 0건")
            return None
        got = _push(level, rows)
        log(f"[{first:%Y-%m} {level}] 원천 {got['rows']:,}행 · 적재 {got['applied']} · 날짜 {got['dates']}({got['first']}~{got['latest']})")
        return got

    run = datagokr.run_units(units, one, log)
    summary = _summary(client, run, empty)
    log(f"백필 API {API} · 호출 {client.calls} · 단위 {len(units)} · 받은 단위 {sum(1 for v in run.results.values() if v)}"
        + (f" · 실패 {run.failed}" if run.failed else ""))
    return summary


def _ymd(value: str) -> date:
    return date(int(value[:4]), int(value[4:6]), int(value[6:8]))
