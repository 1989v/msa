"""관광지 집중률 수집 — 한국관광공사 빅데이터 `TatsCnctrRateService`.

원천 행은 (관광지 이름 × 예측일)이고 오늘부터 앞 30일이다. 시군구를 주지 않으면 0건이라(`areaCd` 만 줘도 0건)
시군구마다 1콜 — 전국 269콜이다. 가장 큰 시군구(제주시 7,320행)도 `numOfRows=10000` 한 콜에 온다.

- 관광지 이름 하나의 30행을 원문 그대로 한 레코드에 싣는다(`ratesRaw`). 예측일 범위와 매칭 결과가 파생 값이다.
- 매칭은 `name_match` — 같은 시군구 국문 행 제목과 정확 → 정규화 → 포함. 어떤 방법을 화면에 쓸지는 place 가 정한다.
- place 는 받은 시군구의 행을 통째로 바꾼다(새 예측이 옛 예측을 대체한다). 0건이거나 실패한 시군구는 보내지 않는다 —
  그 시군구의 이전 값은 남고, 화면은 오늘 이후 날짜만 그리므로 30일이 지나면 저절로 사라진다.
- 0건 시군구 목록을 로그에 남긴다. 2026-10-02 실측으로 광주·전남은 통합 코드 12xxx 와 옛 29·46 코드 모두 0건이었다
  (여수 · 순천 · 목포 · 광주 동구 각 두 체계, Q-P2-CODE12). 모든 시군구가 0건이면 실패로 끝낸다(원천이 통째로 빈 날).
"""
from __future__ import annotations

import json
from collections import Counter
from decimal import Decimal, InvalidOperation

from src import datagokr, name_match, place_client

API = "TatsCnctrRateService"
PATH = f"B551011/{API}/tatsCnctrRatedList"
PAGE_ROWS = 10_000
_COMMON = {"MobileOS": "ETC", "MobileApp": "msa-seed", "_type": "json"}
#: 시군구 269 + 쪽이 넘칠 때의 여유. 한도는 API 하나당 하루 1,000.
DAILY_BUDGET = 290
#: 0건 시군구를 로그에 몇 개까지 적을지 — 전부 적으면 한 줄이 1KB 를 넘는다.
EMPTY_LOG = 40


def log(msg: str) -> None:
    print(f"[congestion] {msg}", flush=True)


def _iso(ymd: str) -> str:
    if len(ymd) != 8 or not ymd.isdigit():
        raise ValueError(f"baseYmd 가 yyyyMMdd 가 아니다: {ymd!r}")
    return f"{ymd[:4]}-{ymd[4:6]}-{ymd[6:]}"


def record(rows: list[dict], matched: name_match.Match) -> dict:
    """관광지 이름 하나의 원천 행(예측일마다 한 행) → place 적재 항목. 원천 행은 키·값 그대로 예측일 순으로 싣는다.

    이름·시군구가 섞였거나 집중률이 수가 아니면 [ValueError] — 다른 관광지의 값이 이 이름으로 저장되지 않게.
    """
    if not rows:
        raise ValueError("집중률 행이 없다")
    keys = {(str(r.get("signguCd")), str(r.get("tAtsNm"))) for r in rows}
    if len(keys) != 1:
        raise ValueError(f"한 항목에 관광지·시군구가 섞였다: {sorted(keys)[:3]}")
    for r in rows:
        try:
            Decimal(str(r.get("cnctrRate")))
        except InvalidOperation as e:
            raise ValueError(f"cnctrRate 가 수가 아니다: {r.get('cnctrRate')!r}") from e
    ordered = sorted(rows, key=lambda r: str(r.get("baseYmd")))
    first = ordered[0]
    return {
        "tAtsNm": first["tAtsNm"],
        "areaCd": str(first.get("areaCd") or ""),
        "areaNm": first.get("areaNm"),
        "signguNm": first.get("signguNm"),
        "ratesRaw": json.dumps(ordered, ensure_ascii=False, separators=(",", ":")),
        "firstYmd": _iso(str(first["baseYmd"])),
        "lastYmd": _iso(str(ordered[-1]["baseYmd"])),
        "attractionId": matched.attraction_id,
        "matchMethod": matched.method,
    }


def records_for(rows: list[dict], candidates: list[name_match.Candidate]) -> list[dict]:
    """한 시군구의 원천 행 → 이름별 레코드(이름 순)."""
    by_name: dict[str, list[dict]] = {}
    for r in rows:
        by_name.setdefault(str(r.get("tAtsNm") or "").strip(), []).append(r)
    by_name.pop("", None)
    return [record(group, name_match.match(name, candidates)) for name, group in sorted(by_name.items())]


def fetch(client: datagokr.Client, area: str, sigungu: str) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        body = client.get(PATH, {**_COMMON, "numOfRows": PAGE_ROWS, "pageNo": page, "areaCd": area, "signguCd": sigungu},
                          f"집중률 {sigungu} p{page}")
        got = datagokr.items(body)
        rows.extend(got)
        if not got or page * PAGE_ROWS >= int(body.get("totalCount") or 0):
            return rows
        page += 1


def run(key: str, client: datagokr.Client | None = None, regions: list[dict] | None = None,
        attractions: list[dict] | None = None) -> dict:
    """하루치 — 시군구 전부를 한 번씩. 시군구 하나가 단위다(실패해도 다음 시군구는 받는다)."""
    client = client or datagokr.Client(key=key, api=API, budget=DAILY_BUDGET)
    regions = regions if regions is not None else place_client.fetch_sigungu_regions()
    candidates = name_match.candidates_by_sigungu(attractions if attractions is not None else place_client.fetch_attractions())
    units = sorted((r["code"], r.get("parentCode") or r["code"][:2]) for r in regions if len(str(r.get("code") or "")) == 5)
    log(f"시군구 {len(units)} · 국문 후보가 있는 시군구 {len(candidates)}")
    empty: list[str] = []
    methods: Counter = Counter()

    def one(unit: tuple[str, str]) -> dict | None:
        sigungu, area = unit
        rows = fetch(client, area, sigungu)
        if not rows:
            empty.append(sigungu)
            return None
        foreign = {str(r.get("signguCd")) for r in rows} - {sigungu}
        if foreign:
            raise datagokr.DataGoKrError(f"{sigungu} 을 물었는데 다른 시군구 행이 왔다: {sorted(foreign)[:3]}")
        records = records_for(rows, candidates.get(sigungu, []))
        applied = place_client.put_congestion(sigungu, records)
        counted = Counter(r["matchMethod"] for r in records)
        methods.update(counted)
        return {"rows": len(rows), "places": len(records), "applied": applied.get("applied"), "methods": dict(counted)}

    run_ = datagokr.run_units(units, one, log)
    received = [u for u, v in run_.results.items() if v]
    failed_units = [u[0] for u in run_.failed]
    log(f"0건 시군구 {len(empty)}" + (f": {' '.join(empty[:EMPTY_LOG])}" + (" …" if len(empty) > EMPTY_LOG else "") if empty else ""))
    places = sum(v["places"] for v in run_.results.values() if v)
    log(f"API {API} · 호출 {client.calls} · 받은 시군구 {len(received)} · 관광지 {places:,} · "
        f"매칭 {' '.join(f'{k} {v:,}' for k, v in sorted(methods.items()))}"
        + (f" · 실패 {failed_units}" if failed_units else "") + (f" · 멈춤 {run_.stopped}" if run_.stopped else ""))
    # 한도·예산으로 멈춘 것은 실패가 아니다(받은 몫은 반영했다). 원천이 통째로 빈 날은 실패다
    all_empty = not run_.stopped and units and len(empty) == len(units)
    return {"api": API, "calls": client.calls, "empty": empty, "methods": dict(methods), "failedUnits": failed_units,
            "stopped": run_.stopped, "failed": bool(failed_units or all_empty)}
