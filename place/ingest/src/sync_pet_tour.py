"""반려동물 동반 정보 수집 (`/detailPetTour2`).

`detailIntro2` 의 `chkpet` 은 국문 44,924건 중 3건만 채워져 있다 — 원천이 이 축을
**별도 오퍼레이션으로 옮겼기** 때문이다. 그쪽은 **contentId 없이 목록으로** 준다
(국문 9,691건) — 건당 1콜인 개요·이용정보와 달리 100건씩 페이징이라 약 100콜이면 전량이다.

그래서 예산 인자를 두지 않는다. 전량을 받아 한 번에 반영한다.
"""
from __future__ import annotations

import json

from src import place_client
from src.sync_tour import SERVICES, TourApiError, tour_get

PAGE_SIZE = 100


def log(msg: str) -> None:
    print(f"[pet] {msg}", flush=True)


def _items(body: dict) -> list[dict]:
    items = body.get("items") or {}
    item = items.get("item") if isinstance(items, dict) else None
    if not item:
        return []
    return [item] if isinstance(item, dict) else item


def fetch(key: str, svc_key: str) -> dict[str, dict]:
    """contentId → 응답 원문. 같은 contentId 가 여러 번 오면 마지막이 이긴다."""
    service, _ = SERVICES[svc_key]
    out: dict[str, dict] = {}
    page = 1
    while True:
        body = tour_get(key, service, "detailPetTour2",
                        {"numOfRows": PAGE_SIZE, "pageNo": page})
        rows = _items(body)
        if not rows:
            break
        for r in rows:
            cid = str(r.get("contentid") or "").strip()
            if cid:
                out[cid] = r
        total = int(body.get("totalCount") or 0)
        if page * PAGE_SIZE >= total:
            break
        page += 1
    return out


def run(key: str, langs: tuple[str, ...] = ("ko", "en")) -> bool:
    rows = place_client.fetch_attractions()
    loaded = False

    for lang in langs:
        svc_key = {"ko": "kor", "en": "eng"}[lang]
        try:
            pet = fetch(key, svc_key)
        except TourApiError as e:
            log(f"[{lang}] 실패: {e}")
            continue
        log(f"[{lang}] 원천 {len(pet):,}건")
        if not pet:
            continue

        records = []
        for rec in rows:
            if rec.get("lang") != lang:
                continue
            hit = pet.get(str(rec.get("contentId")))
            if not hit:
                continue
            # **전체 동기화 경로다** — 받은 레코드를 통째로 되돌려 보내야 나머지 필드가 안 지워진다.
            rec["petAcmpyType"] = (hit.get("acmpyTypeCd") or "").strip() or None
            rec["petRaw"] = json.dumps(hit, ensure_ascii=False)
            rec["petSyncedAt"] = _now()
            records.append(rec)

        if not records:
            log(f"[{lang}] 맞는 관광지 없음")
            continue
        created, updated = place_client.bulk_upsert(records)
        log(f"[{lang}] 반영 {len(records):,}건 (생성 {created} · 갱신 {updated})")
        loaded = True

    return loaded


def _now() -> str:
    from datetime import datetime
    return datetime.now().replace(microsecond=0).isoformat()
