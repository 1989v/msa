"""연관 관광지 수집 — 한국관광공사 빅데이터 `TarRlteTarService1`(내비게이션 이동 기반, 월 단위).

원천 행은 (출발 관광지 × 연관 대상)이고 출발 관광지당 최대 50(순위 `rlteRank`), 대상 분류는 관광지 · 음식 · 숙박이다.
시군구를 주지 않으면 0건이라 시군구마다 1콜 — 한 달치 전국은 269콜이다(제주시 5,786행도 `numOfRows=10000` 한 콜).

- 출발 관광지 하나의 행(최대 50)을 원문 그대로 한 레코드에 싣는다(`relatedRaw`). 출발 매칭과 대상별 매칭이 파생 값이다.
- 매칭은 집중률과 같은 `name_match` — 출발은 자기 시군구, 대상은 **대상 시군구**(`rlteSignguCd`)의 국문 행과 견준다.
  분류와 상관없이 전부 매칭해 남기고, 무엇을 화면에 쓸지(우리 행으로 정확·정규화로 이어진 대상)는 place 가 정한다.
- 식별자 `tAtsCd`·`rlteTatsCd` 는 32자 해시라 TourAPI contentId 와 이어지지 않는다.
- place 는 받은 시군구의 행을 통째로 바꾼다(새 달이 옛 달을 대체). 0건이거나 실패한 시군구는 보내지 않는다.

**전달 자료는 언제 나오나(Q-P2-RELATED-LAG):** 2026-10-02 KST 에 `baseYm=202609` 는 0건, `202608` 은 있었다.
그래서 잡은 매달 12일부터 28일까지 매일 돈다 — 이미 받은 달이면 호출 없이 끝나고, 아직이면 지난달 행이 있던 시군구
하나만 물어(1콜) 0건이면 다음 날로 넘긴다. 28일까지 안 나오면 실패로 끝내 알린다.
"""
from __future__ import annotations

import json
from collections import Counter
from datetime import date

from src import datagokr, name_match, place_client

API = "TarRlteTarService1"
PATH = f"B551011/{API}/areaBasedList1"
PAGE_ROWS = 10_000
_COMMON = {"MobileOS": "ETC", "MobileApp": "msa-seed", "_type": "json"}
#: 시군구 269 + 쪽이 넘칠 때의 여유. 한도는 API 하나당 하루 1,000.
DAILY_BUDGET = 290
#: 수집 창의 마지막 날(KST, CronJob 이 12~28일에 돈다). 이날까지 전달 자료가 안 나오면 실패로 끝낸다.
LAST_DAY = 28
EMPTY_LOG = 40


def log(msg: str) -> None:
    print(f"[related] {msg}", flush=True)


def target_month(today: date) -> str:
    """받을 달 — 오늘(KST)의 전달 `yyyyMM`."""
    year, month = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
    return f"{year}{month:02d}"


def _rank(row: dict) -> int:
    try:
        return int(str(row.get("rlteRank")))
    except ValueError as e:
        raise ValueError(f"rlteRank 가 수가 아니다: {row.get('rlteRank')!r}") from e


def record(rows: list[dict], start: name_match.Match, targets: list[name_match.Match]) -> dict:
    """출발 관광지 하나의 원천 행 → place 적재 항목. 원천 행은 키·값 그대로 순위 순으로 싣는다.

    [targets] 는 [rows] 를 **순위 순으로 줄 세운 순서**의 대상 매칭이다. 출발이 섞였거나 순위가 수가 아니거나
    겹치면 [ValueError] — 다른 관광지의 목록이 이 이름으로 저장되지 않게.
    """
    if not rows:
        raise ValueError("연관 행이 없다")
    starts = {(str(r.get("tAtsCd")), str(r.get("tAtsNm")), str(r.get("signguCd")), str(r.get("baseYm"))) for r in rows}
    if len(starts) != 1:
        raise ValueError(f"한 항목에 출발 관광지가 섞였다: {sorted(starts)[:3]}")
    ordered = sorted(rows, key=_rank)
    ranks = [_rank(r) for r in ordered]
    if len(set(ranks)) != len(ranks):
        raise ValueError(f"순위가 겹친다: {ordered[0].get('tAtsNm')}")
    if len(targets) != len(ordered):
        raise ValueError(f"대상 매칭 수({len(targets)})가 행 수({len(ordered)})와 다르다")
    first = ordered[0]
    return {
        "tAtsCd": first["tAtsCd"],
        "tAtsNm": first["tAtsNm"],
        "relatedRaw": json.dumps(ordered, ensure_ascii=False, separators=(",", ":")),
        "attractionId": start.attraction_id,
        "matchMethod": start.method,
        "targets": [
            {"rank": rank, "name": r.get("rlteTatsNm"), "lcls": r.get("rlteCtgryLclsNm"), "mcls": r.get("rlteCtgryMclsNm"),
             "scls": r.get("rlteCtgrySclsNm"), "signguCd": r.get("rlteSignguCd"),
             "attractionId": m.attraction_id, "matchMethod": m.method}
            for rank, r, m in zip(ranks, ordered, targets)
        ],
    }


def records_for(rows: list[dict], candidates: dict[str, list[name_match.Candidate]]) -> list[dict]:
    """한 시군구의 원천 행 → 출발 관광지별 레코드(출발 이름 순). 출발은 자기 시군구, 대상은 대상 시군구 후보에 견준다."""
    by_start: dict[str, list[dict]] = {}
    for r in rows:
        by_start.setdefault(str(r.get("tAtsCd") or "").strip(), []).append(r)
    by_start.pop("", None)
    out = []
    for group in by_start.values():
        ordered = sorted(group, key=_rank)
        start = name_match.match(str(ordered[0].get("tAtsNm") or ""), candidates.get(str(ordered[0].get("signguCd")), []))
        targets = [name_match.match(str(r.get("rlteTatsNm") or ""), candidates.get(str(r.get("rlteSignguCd")), []))
                   for r in ordered]
        out.append(record(ordered, start, targets))
    return sorted(out, key=lambda rec: (rec["tAtsNm"], rec["tAtsCd"]))


def fetch(client: datagokr.Client, base_ym: str, area: str, sigungu: str) -> list[dict]:
    rows: list[dict] = []
    page = 1
    while True:
        body = client.get(PATH, {**_COMMON, "numOfRows": PAGE_ROWS, "pageNo": page, "baseYm": base_ym,
                                 "areaCd": area, "signguCd": sigungu}, f"연관 {base_ym} {sigungu} p{page}")
        got = datagokr.items(body)
        rows.extend(got)
        if not got or page * PAGE_ROWS >= int(body.get("totalCount") or 0):
            return rows
        page += 1


def run(key: str, today: date, base_ym: str | None = None, client: datagokr.Client | None = None,
        regions: list[dict] | None = None, attractions: list[dict] | None = None,
        state: dict[str, str] | None = None) -> dict:
    """한 달치 — 아직 그 달을 받지 않은 시군구만. 시군구 하나가 단위다(실패해도 다음 시군구는 받는다).

    [state] 는 place 가 가진 시군구별 최신 `baseYm` 이다. [base_ym] 을 주면 전달 대신 그 달을 받는다(수동 1회).
    """
    target = base_ym or target_month(today)
    stored = state if state is not None else place_client.related_state()
    regions = regions if regions is not None else place_client.fetch_sigungu_regions()
    units = sorted((r["code"], r.get("parentCode") or r["code"][:2]) for r in regions if len(str(r.get("code") or "")) == 5)
    done = {sg for sg, ym in stored.items() if ym >= target}
    summary = {"api": API, "baseYm": target, "calls": 0, "empty": [], "methods": {}, "targetMethods": {},
               "failedUnits": [], "stopped": None, "published": True, "skipped": False, "failed": False}
    if stored and len(done) == len(stored):
        log(f"{target} 은 이미 받았다(시군구 {len(done)}) — 호출하지 않는다")
        return {**summary, "skipped": True}

    client = client or datagokr.Client(key=key, api=API, budget=DAILY_BUDGET)
    pending = [u for u in units if u[0] not in done]
    # 아직 이 달을 하나도 못 받았으면, 지난달 행이 있던 시군구를 먼저 묻는다 — 0건이면 아직 공개 전이다
    probe = next((u for u in pending if u[0] in stored), None) if not done else None
    candidates = name_match.candidates_by_sigungu(attractions if attractions is not None else place_client.fetch_attractions())
    log(f"{target} · 시군구 {len(units)} 중 받을 곳 {len(pending)}" + (f" · 먼저 묻는 곳 {probe[0]}" if probe else ""))
    empty: list[str] = []
    starts: Counter = Counter()
    tourist: Counter = Counter()

    def one(unit: tuple[str, str]) -> dict | None:
        sigungu, area = unit
        rows = fetch(client, target, area, sigungu)
        if not rows:
            empty.append(sigungu)
            return None
        foreign = {(str(r.get("signguCd")), str(r.get("baseYm"))) for r in rows} - {(sigungu, target)}
        if foreign:
            raise datagokr.DataGoKrError(f"{sigungu} {target} 을 물었는데 다른 시군구·달 행이 왔다: {sorted(foreign)[:3]}")
        records = records_for(rows, candidates)
        applied = place_client.put_related(sigungu, target, records)
        starts.update(r["matchMethod"] for r in records)
        tourist.update(t["matchMethod"] for r in records for t in r["targets"])
        return {"rows": len(rows), "starts": len(records), "applied": applied.get("applied")}

    first = datagokr.run_units([probe], one, log) if probe else datagokr.UnitRun()
    not_public = probe is not None and probe[0] in empty
    if not_public:
        log(f"{target} 이 아직 없다({probe[0]} 0건) — 나머지는 묻지 않고 다음 날 다시 본다")
    rest = (datagokr.UnitRun() if not_public or first.stopped
            else datagokr.run_units([u for u in pending if u != probe], one, log))
    received = [u for run_ in (first, rest) for u, v in run_.results.items() if v]
    failed_units = [u[0] for run_ in (first, rest) for u in run_.failed]
    published = not not_public and (bool(received) or bool(done))
    stopped = first.stopped or rest.stopped
    log(f"0건 시군구 {len(empty)}" + (f": {' '.join(empty[:EMPTY_LOG])}" + (" …" if len(empty) > EMPTY_LOG else "") if empty else ""))
    log(f"API {API} · {target} · 호출 {client.calls} · 받은 시군구 {len(received)} · "
        f"출발 {' '.join(f'{k} {v:,}' for k, v in sorted(starts.items()))} · "
        f"대상 {' '.join(f'{k} {v:,}' for k, v in sorted(tourist.items()))}"
        + (f" · 실패 {failed_units}" if failed_units else "") + (f" · 멈춤 {stopped}" if stopped else "")
        + ("" if published else " · 아직 공개 전"))
    # 공개 전은 그날 실패가 아니다 — 다음 날 다시 묻는다. 창의 마지막 날이거나 수동으로 준 달이면 실패로 알린다
    late = not published and (base_ym is not None or today.day >= LAST_DAY)
    return {**summary, "calls": client.calls, "empty": empty, "methods": dict(starts), "targetMethods": dict(tourist),
            "failedUnits": failed_units, "stopped": stopped, "published": published,
            "failed": bool(failed_units or late)}
