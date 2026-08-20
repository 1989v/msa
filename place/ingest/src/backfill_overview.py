#!/usr/bin/env python3
"""개요(overview) 점진 수집 — detailCommon2 는 **건당 1콜**이라 일일 한도가 병목이다.

목록 조회(areaBasedList2)는 100건/콜이라 전량이 하루면 끝나지만, 개요는 레코드마다
한 번씩 불러야 해서 수만 건이면 며칠이 걸린다. 그래서 한 번에 다 받지 않고
**우선순위 + 일일 예산**으로 나눠 채운다.

place SSOT 에서 개요가 빈 레코드를 읽어 채운 뒤 bulk upsert 로 되돌린다 —
**부분 전송은 다른 필드를 지우므로 전체 레코드를 되돌려 보낸다** (개요만 보존 예외).

수집과 적재를 한 실행 단위로 묶는 이유: 중복 호출을 막는 기준이 "place SSOT 에 개요가
있는가" 하나뿐이라, 적재를 미루면 다음 실행이 같은 레코드를 그대로 다시 부른다
(실측: 시험분 30건이 다음 실행에서 30/30 재호출됐다).
"""
from __future__ import annotations

import sys
import time
from datetime import datetime, timezone

from src import place_client
from src.sync_tour import SERVICES, tour_get

# 관광 성격의 분류 — 음식/쇼핑/숙박보다 먼저 채운다.
# 건수로는 음식·쇼핑이 절반을 넘어서, 이미지 유무로만 정렬하면 첫 배치가 통째로
# 음식점으로 채워진다. 사이트가 보여주려는 건 관광지다.
SIGHT_CATEGORIES = ("nature", "history", "culture", "leisure")

# bulk upsert 가 받는 필드 (id·status 는 서버 소유라 되돌려 보내지 않는다)
UPSERT_FIELDS = ("contentId", "lang", "title", "latitude", "longitude", "address",
                 "areaCode", "sigunguCode", "ldongRegnCd", "ldongSignguCd",
                 "category", "imageUrl", "tel", "overview", "sourceModifiedAt")


def log(msg: str) -> None:
    print(f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} {msg}", file=sys.stderr, flush=True)


def stats(rows: list[dict]) -> None:
    for lg in ("ko", "en"):
        sub = [r for r in rows if r.get("lang") == lg]
        miss = [r for r in sub if not (r.get("overview") or "").strip()]
        with_img = sum(1 for r in miss if (r.get("imageUrl") or "").strip())
        sight = sum(1 for r in miss if r.get("category") in SIGHT_CATEGORIES)
        log(f"[{lg}] 전체 {len(sub):,} · 개요없음 {len(miss):,} "
            f"(관광지 {sight:,} · 이미지보유 {with_img:,})")


def pick(rows: list[dict], lang: str, budget: int, known_empty: set[str]) -> list[dict]:
    """개요가 빈 것만 — 관광지 우선, 그 안에서 이미지 보유분 우선."""
    missing = [r for r in rows
               if not (r.get("overview") or "").strip()
               and r.get("lang") == lang
               and f"{r.get('lang')}:{r['contentId']}" not in known_empty]
    missing.sort(key=lambda r: (
        0 if r.get("category") in SIGHT_CATEGORIES else 1,
        0 if (r.get("imageUrl") or "").strip() else 1,
        r["contentId"],
    ))
    return missing[:budget]


def collect(api_key: str, targets: list[dict]) -> tuple[list[dict], list[dict]]:
    """(적재할 전체 레코드, 원천이 빈 개요를 준 항목). 일시적 실패는 어느 쪽에도 담기지 않는다."""
    records: list[dict] = []
    empty: list[dict] = []
    for i, row in enumerate(targets, 1):
        service, _ = SERVICES["kor" if row["lang"] == "ko" else "eng"]
        try:
            body = tour_get(api_key, service, "detailCommon2", {"contentId": row["contentId"]})
            item = (body.get("items") or {}).get("item")
            if isinstance(item, list):
                item = item[0] if item else None
            overview = ((item or {}).get("overview") or "").strip()
        except Exception as e:
            # 일시적 실패(429/네트워크)는 negative cache 에 넣지 않는다 —
            # 넣으면 그 레코드는 영영 다시 시도되지 않는다.
            log(f"  {row['contentId']} 스킵: {e}")
            continue
        if not overview:
            # 원천이 빈 값을 준 것 — 다시 불러도 결과가 같다.
            empty.append({"contentId": row["contentId"], "lang": row["lang"]})
            continue
        rec = {k: row.get(k) for k in UPSERT_FIELDS if row.get(k) is not None}
        rec["overview"] = overview
        records.append(rec)
        if i % 100 == 0:
            log(f"  {i}/{len(targets)} (채움 {len(records)})")
        time.sleep(0.15)
    return records, empty


def run(api_key: str, budget: int, langs: tuple[str, ...] = ("ko", "en")) -> bool:
    """하루치 수집 → 적재 → probe 기록. 무언가 적재됐으면 True (재색인 필요 신호)."""
    rows = place_client.fetch_attractions()
    stats(rows)
    known_empty = place_client.fetch_probe_keys()
    log(f"제외 목록(원천 개요없음) {len(known_empty):,}건")

    loaded = False
    for lang in langs:
        targets = pick(rows, lang, budget, known_empty)
        if not targets:
            log(f"[{lang}] 채울 대상이 없습니다")
            continue
        log(f"[{lang}] 수집 시작 (예산 {budget}, 대상 {len(targets):,})")
        records, empty = collect(api_key, targets)
        if records:
            created, updated = place_client.bulk_upsert(records)
            log(f"[{lang}] 적재 {len(records)}건 (신규 {created} · 갱신 {updated})")
            loaded = True
        if empty:
            log(f"[{lang}] 원천 개요없음 {place_client.record_probes(empty)}건 기록")
    return loaded
