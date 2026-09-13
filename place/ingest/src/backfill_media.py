"""부가 사진·반복정보 수집 — TourAPI detailImage2 · detailInfo2.

대표사진(`imageUrl`)은 목록이 주는 1장뿐인데 원천은 더 갖고 있다 — 오대호 아트팩토리는
17장이다. 반복정보는 관광지의 「내국인예약안내」·레포츠의 「코스안내」처럼 유형마다 다른 것이
같은 자리에 온다.

**원문을 그대로 남긴다** (data-sources.md §0 ①·②). 둘 다 레코드당 여러 건이고 키가 유형마다
달라, 지금 파생 컬럼으로 펴면 유형이 늘 때마다 마이그레이션이 따라붙는다. 화면이 무엇을 쓸지
정해지면 그때 늘린다 — 원문이 있으면 원천을 다시 부르지 않아도 된다.

**한 레코드에 두 콜을 쓴다.** 그래서 `budget` 은 호출 수가 아니라 **레코드 수**다.
"""
from __future__ import annotations

import json
import time
from datetime import datetime

from src import place_client
from src.backfill_overview import REQUEST_GAP_SEC, UPSERT_FIELDS, log, run_collect
from src.sync_tour import SERVICES, tour_get

#: 한 레코드가 가질 수 있는 최대 건수. 기본값(10)으로 부르면 17장짜리가 10장으로 잘린다.
PAGE_ROWS = "100"


def pick(rows: list[dict], lang: str, budget: int) -> list[dict]:
    """아직 안 받은 것부터. 값이 아니라 **받은 시각**(`extraSyncedAt`)으로 판정한다 —
    값으로 재면 원천이 빈 응답을 준 레코드를 매일 다시 부르게 된다."""
    todo = [r for r in rows if r.get("lang") == lang and not r.get("extraSyncedAt")]
    # 관광 분류 → 사진 있는 것 순. 화면에 먼저 보이는 것부터 채운다 (intro 와 같은 기준).
    todo.sort(key=lambda r: (
        0 if r.get("category") in ("nature", "history", "culture", "leisure") else 1,
        0 if (r.get("imageUrl") or "").strip() else 1,
        r["contentId"],
    ))
    return todo[:budget]


def _items(body: dict) -> list[dict]:
    """원천은 0건이면 빈 문자열, 1건이면 dict, 여러 건이면 list 로 준다."""
    items = (body.get("items") or {}).get("item") or []
    if isinstance(items, dict):
        return [items]
    return items if isinstance(items, list) else []


def collect(api_key: str, targets: list[dict]) -> int:
    """받는 대로 적재한다. 적재한 건수를 돌려준다."""

    def fetch(row: dict) -> tuple[dict | None, None]:
        service, _ = SERVICES["kor" if row["lang"] == "ko" else "eng"]
        # detailImage2 는 contentTypeId 를 받지 않는다 — 넣으면 INVALID_REQUEST_PARAMETER_ERROR.
        images = _items(tour_get(api_key, service, "detailImage2", {
            "contentId": row["contentId"], "imageYN": "Y", "numOfRows": PAGE_ROWS,
        }))
        # 반대로 detailInfo2 는 contentTypeId 가 필수다. 없는 레코드는 사진만 받는다.
        content_type = (row.get("contentTypeId") or "").strip()
        info = _items(tour_get(api_key, service, "detailInfo2", {
            "contentId": row["contentId"], "contentTypeId": content_type,
            "numOfRows": PAGE_ROWS,
        })) if content_type else []
        time.sleep(REQUEST_GAP_SEC)

        rec = {k: row.get(k) for k in UPSERT_FIELDS if row.get(k) is not None}
        # 원천이 빈 응답을 줘도 **받았다는 사실**은 남긴다 — 안 남기면 영원히 재시도한다.
        rec["extraSyncedAt"] = datetime.now().replace(microsecond=0).isoformat()
        if images:
            rec["imagesRaw"] = json.dumps(images, ensure_ascii=False, separators=(",", ":"))
        if info:
            rec["infoRaw"] = json.dumps(info, ensure_ascii=False, separators=(",", ":"))
        return rec, None

    loaded, _ = run_collect(targets, fetch)
    return loaded


def run(api_key: str, budget: int, langs: tuple[str, ...] = ("ko", "en")) -> bool:
    """하루치 수집 → 적재. 무언가 적재됐으면 True (재색인 신호)."""
    rows = place_client.fetch_attractions()
    done = sum(1 for r in rows if r.get("extraSyncedAt"))
    log(f"부가 사진·반복정보 수집 {done:,}/{len(rows):,}건")

    loaded = False
    for lang in langs:
        targets = pick(rows, lang, budget)
        if not targets:
            log(f"[{lang}] 채울 대상이 없습니다")
            continue
        log(f"[{lang}] 수집 시작 (예산 {budget}레코드 = 최대 {budget * 2:,}콜, 대상 {len(targets):,})")
        got = collect(api_key, targets)
        log(f"[{lang}] 적재 {got}건")
        loaded = loaded or got > 0
    return loaded
