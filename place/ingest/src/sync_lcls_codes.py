"""TourAPI 분류체계 코드표 수집 (`/lclsSystmCode2`).

`attractions` 는 `lclsSystm1~3` 을 코드로만 갖고 있다. 이 잡이 코드→이름을 채워
필터 이름과 질의 사전의 근거를 만든다.

**호출 수는 1 + (대분류 수) + (중분류 수)** — 전량이 400회 아래라 하루 한도를 걱정할 크기가 아니다.
소분류를 받으려면 상위 코드를 인자로 줘야 해서 트리를 내려가며 부른다.
"""
from __future__ import annotations

from src import place_client
from src.sync_tour import SERVICES, TourApiError, tour_get

# 원천이 한 번에 주는 최대. 소분류가 가장 많은 가지도 이 안에 들어온다.
PAGE_SIZE = 200


def log(msg: str) -> None:
    print(f"[lcls] {msg}", flush=True)


def _items(body: dict) -> list[dict]:
    items = body.get("items") or {}
    item = items.get("item") if isinstance(items, dict) else None
    if not item:
        return []
    return [item] if isinstance(item, dict) else item


def _fetch_level(key: str, service: str, parent: dict[str, str]) -> list[dict]:
    """한 단계를 받는다. `parent` 는 상위 코드 인자(`lclsSystm1`/`lclsSystm2`)."""
    body = tour_get(key, service, "lclsSystmCode2",
                    {"numOfRows": PAGE_SIZE, "pageNo": 1, **parent})
    return _items(body)


def fetch(key: str, svc_key: str) -> list[dict]:
    """한 언어의 전 depth 를 트리로 내려가며 받는다."""
    service, lang = SERVICES[svc_key]
    rows: list[dict] = []

    for d1 in _fetch_level(key, service, {}):
        c1 = str(d1.get("code") or "").strip()
        if not c1:
            continue
        rows.append({"lang": lang, "code": c1, "name": (d1.get("name") or "").strip()})

        for d2 in _fetch_level(key, service, {"lclsSystm1": c1}):
            c2 = str(d2.get("code") or "").strip()
            if not c2:
                continue
            rows.append({"lang": lang, "code": c2, "name": (d2.get("name") or "").strip(),
                         "parentCode": c1})

            for d3 in _fetch_level(key, service, {"lclsSystm1": c1, "lclsSystm2": c2}):
                c3 = str(d3.get("code") or "").strip()
                if not c3:
                    continue
                rows.append({"lang": lang, "code": c3, "name": (d3.get("name") or "").strip(),
                             "parentCode": c2})

    # 이름이 빈 행은 코드→이름을 못 잇는다 = 이 표의 존재 이유가 없다.
    return [r for r in rows if r["name"]]


def run(key: str, langs: tuple[str, ...] = ("kor", "eng")) -> int:
    applied = 0
    for svc_key in langs:
        try:
            rows = fetch(key, svc_key)
        except TourApiError as e:
            # 한 언어가 실패해도 다른 언어는 받는다 — 코드표는 언어별로 독립이다.
            log(f"{svc_key} 실패: {e}")
            continue
        if not rows:
            log(f"{svc_key} 받은 코드 없음")
            continue
        applied += place_client.upsert_category_codes(rows)
        depths = {}
        for r in rows:
            d = len(r["code"])
            depths[d] = depths.get(d, 0) + 1
        log(f"{svc_key} {len(rows)}건 (대 {depths.get(2, 0)} · 중 {depths.get(4, 0)} · 소 {depths.get(8, 0)})")
    return applied
