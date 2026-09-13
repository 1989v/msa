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

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from src import place_client
from src.sync_tour import SERVICES, tour_get

# 관광 성격의 분류 — 음식/쇼핑/숙박보다 먼저 채운다.
# 건수로는 음식·쇼핑이 절반을 넘어서, 이미지 유무로만 정렬하면 첫 배치가 통째로
# 음식점으로 채워진다. 사이트가 보여주려는 건 관광지다.
SIGHT_CATEGORIES = ("nature", "history", "culture", "leisure")

# bulk upsert 가 받는 필드 (id·status 는 서버 소유라 되돌려 보내지 않는다)
# bulk 는 전체 동기화라 여기 빠진 필드는 **매일 null 로 덮인다**. 원천 컬럼을 추가하면
# 반드시 여기에도 넣을 것 (ADR-0065).
UPSERT_FIELDS = ("contentId", "lang", "title", "latitude", "longitude", "address", "zipcode",
                 "areaCode", "sigunguCode", "ldongRegnCd", "ldongSignguCd",
                 "cat1", "cat2", "cat3", "lclsSystm1", "lclsSystm2", "lclsSystm3",
                 "contentTypeId", "copyrightDivCd", "mapLevel",
                 "category", "imageUrl", "thumbnailUrl", "tel", "overview", "googlePlaceId",
                 # detailIntro2 보강분 — 왕복에서 빠지면 다음 배치가 null 로 덮는다 (§0 ③)
                 "introRaw", "useTime", "restDate", "useFee", "parking", "parkingFee",
                 "infoCenter", "introSyncedAt",
                 "sourceModifiedAt", "sourceCreatedAt")


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


#: 이만큼 모이면 적재한다. 실행이 중간에 끊겨도 여기까지는 남는다.
FLUSH_EVERY = 500

#: 한도 거부가 이만큼 연속이면 그 회차를 끝낸다. 한 건짜리 튐과 한도 소진을 가르는 값이다.
QUOTA_STREAK_STOP = 20

#: 워커 하나가 다음 요청까지 쉬는 시간. 초당 호출 수는 WORKERS / (요청시간 + 이 값) 이다.
REQUEST_GAP_SEC = float(os.environ.get("REQUEST_GAP_SEC", "0.05"))

#: 동시 요청 수. **여기가 실제 상한을 정한다.**
#: 요청 1건은 약 0.14초인데 예전에는 한 번에 하나씩 불러 초당 7건이 천장이었다 — 원천 한도
#: (오퍼레이션당 10만/일)를 다 쓰기 한참 전에 activeDeadlineSeconds 에 먼저 걸렸다.
#: 대기 시간이지 계산이 아니라서 무료 단일 노드에서도 동시에 띄우는 값이 싸다.
WORKERS = int(os.environ.get("WORKERS", "6"))

#: 한도 소진을 알리는 신호. 원천이 HTTP 429 로 줄 때도 있고, 200 안에 결과코드로 줄 때도 있다.
_QUOTA_SIGNS = ("429", "LIMITED_NUMBER_OF_SERVICE_REQUESTS", "SERVICE_ACCESS_DENIED")


def is_quota_error(exc: BaseException) -> bool:
    """한도 때문에 거부당했나. 네트워크 오류와 갈라야 한다 —
    네트워크는 다음 건에서 회복되지만 한도는 그 회차 안에서 회복되지 않는다."""
    return any(sign in str(exc) for sign in _QUOTA_SIGNS)


def run_collect(targets: list[dict], fetch, label: str = "") -> tuple[int, list]:
    """동시에 훑어 **받는 대로 적재**한다. (적재 건수, 부수 기록)

    `fetch(row)` 는 `(적재할 레코드 | None, 부수 기록 | None)` 을 돌려준다.
    예외를 던지면 그 레코드는 건너뛰고 다음 회차가 다시 시도한다.

    셋이 지키는 것:
      - FLUSH_EVERY 마다 적재한다. 시간 제한에 잘려도 거기까지는 남는다.
      - 한도 거부가 한 묶음 안에서 QUOTA_STREAK_STOP 을 넘으면 그 회차를 끝낸다.
        한도는 회차 안에서 회복되지 않아 계속 두드려 봐야 시간만 버린다.
      - 네트워크 오류는 한도로 세지 않는다 — 그쪽은 다음 건에서 회복된다.
    """
    loaded = 0
    side: list = []
    done = 0

    for start in range(0, len(targets), FLUSH_EVERY):
        chunk = targets[start:start + FLUSH_EVERY]
        batch: list[dict] = []
        quota_hits = 0

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(fetch, row): row for row in chunk}
            for future in as_completed(futures):
                row = futures[future]
                try:
                    rec, extra = future.result()
                except Exception as e:                      # noqa: BLE001 — 건별 격리
                    log(f"  {row['contentId']} 스킵: {e}")
                    if is_quota_error(e):
                        quota_hits += 1
                    continue
                if rec is not None:
                    batch.append(rec)
                if extra is not None:
                    side.append(extra)

        if batch:
            place_client.bulk_upsert(batch)
            loaded += len(batch)
        done += len(chunk)
        log(f"  {done}/{len(targets)}{label} (적재 {loaded})")

        if quota_hits >= QUOTA_STREAK_STOP:
            log(f"  한도 도달로 중단 — 이번 묶음에서 거부 {quota_hits}회 ({done}/{len(targets)})")
            break

    return loaded, side


def collect(api_key: str, targets: list[dict]) -> tuple[int, list[dict]]:
    """(적재한 건수, 원천이 빈 개요를 준 항목)."""

    def fetch(row: dict) -> tuple[dict | None, dict | None]:
        service, _ = SERVICES["kor" if row["lang"] == "ko" else "eng"]
        body = tour_get(api_key, service, "detailCommon2", {"contentId": row["contentId"]})
        item = (body.get("items") or {}).get("item")
        if isinstance(item, list):
            item = item[0] if item else None
        overview = ((item or {}).get("overview") or "").strip()
        time.sleep(REQUEST_GAP_SEC)
        if not overview:
            # 원천이 빈 값을 준 것 — 다시 불러도 결과가 같다. 일시적 실패와 달리
            # negative cache 에 넣어야 다음 회차가 이 레코드를 또 부르지 않는다.
            return None, {"contentId": row["contentId"], "lang": row["lang"]}
        rec = {k: row.get(k) for k in UPSERT_FIELDS if row.get(k) is not None}
        rec["overview"] = overview
        return rec, None

    return run_collect(targets, fetch)


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
        got, empty = collect(api_key, targets)
        if got:
            log(f"[{lang}] 적재 {got}건")
            loaded = True
        if empty:
            log(f"[{lang}] 원천 개요없음 {place_client.record_probes(empty)}건 기록")
    return loaded
