"""이용시간·휴무·요금·주차 수집 — TourAPI detailIntro2.

개요(detailCommon2)와 같은 모양이다: **건당 1콜**이라 전량이 며칠 걸리고, 하루 예산만큼
잘라서 매일 채운다. 한도는 (서비스 × 오퍼레이션)별로 따로라 국문·영문을 병행한다.

**전 유형·전 레코드를 받는다.** 유형을 골라 받지 않는다 — 호출이 비용이라 나중에 필요해지면
그 한도를 다시 써야 한다 (data-sources.md §0 ①).

원천이 주는 필드는 유형마다 다르고 **같은 개념의 키 이름도 다르다.** 그래서 응답을 통째로
`introRaw` 에 남기고, 화면이 쓰는 값만 아래 표로 모아 파생 컬럼에 넣는다 (§0 ②).
"""
from __future__ import annotations

import json
import time
from datetime import datetime

from src import place_client
from src.backfill_overview import UPSERT_FIELDS, log
from src.sync_tour import SERVICES, tour_get

# 파생 컬럼 ← 원천 키 후보. 유형별 접미사(culture/leports/…)가 붙은 것을 한 자리로 모은다.
# 순서대로 찾아 **처음 값이 있는 것**을 쓴다.
DERIVED: dict[str, tuple[str, ...]] = {
    "useTime": ("usetime", "usetimeculture", "usetimeleports", "usetimefestival",
                "usetimeshopping", "opentimefood", "opentime"),
    "restDate": ("restdate", "restdateculture", "restdateleports",
                 "restdateshopping", "restdatefood"),
    "useFee": ("usefee", "usetimefestival"),
    "parking": ("parking", "parkingculture", "parkingleports", "parkingshopping",
                "parkingfood", "parkinglodging"),
    "parkingFee": ("parkingfee", "parkingfeeculture", "parkingfeeleports"),
    "infoCenter": ("infocenter", "infocenterculture", "infocenterleports",
                   "infocentershopping", "infocenterfood", "infocenterlodging",
                   "sponsor1tel", "tel"),
}

# 항상 있고 값이 아닌 것 — 이것만 있으면 "원천이 준 게 없다" 로 본다.
_META_KEYS = {"contentid", "contenttypeid"}


def derive(item: dict) -> dict:
    """원천 응답 → 파생 컬럼. 규칙이 바뀌면 introRaw 로 다시 계산할 수 있다."""
    out: dict[str, str] = {}
    for column, candidates in DERIVED.items():
        for key in candidates:
            value = str(item.get(key) or "").strip()
            if value:
                out[column] = value
                break
    return out


def has_payload(item: dict) -> bool:
    return any(str(v or "").strip() for k, v in item.items() if k not in _META_KEYS)


def pick(rows: list[dict], lang: str, budget: int) -> list[dict]:
    """아직 안 받은 것부터. `introSyncedAt` 이 없는 레코드가 대상이다.

    값이 아니라 **받은 시각**으로 판정한다 — 원천이 빈 응답을 준 레코드를 값으로 재면
    매일 같은 것을 다시 부르게 된다.
    """
    todo = [r for r in rows if r.get("lang") == lang and not r.get("introSyncedAt")]
    # 관광 분류 → 사진 있는 것 순. 화면에 먼저 보이는 것부터 채운다.
    todo.sort(key=lambda r: (
        0 if r.get("category") in ("nature", "history", "culture", "leisure") else 1,
        0 if (r.get("imageUrl") or "").strip() else 1,
        r["contentId"],
    ))
    return todo[:budget]


def collect(api_key: str, targets: list[dict]) -> list[dict]:
    """적재할 레코드. 일시적 실패(429·네트워크)는 담지 않아 다음 회차가 다시 시도한다."""
    records: list[dict] = []
    for i, row in enumerate(targets, 1):
        service, _ = SERVICES["kor" if row["lang"] == "ko" else "eng"]
        try:
            body = tour_get(api_key, service, "detailIntro2", {
                "contentId": row["contentId"],
                "contentTypeId": row.get("contentTypeId") or "",
            })
            item = (body.get("items") or {}).get("item")
            if isinstance(item, list):
                item = item[0] if item else None
        except Exception as e:
            log(f"  {row['contentId']} 스킵: {e}")
            continue

        rec = {k: row.get(k) for k in UPSERT_FIELDS if row.get(k) is not None}
        # 원천이 빈 응답을 줘도 **받았다는 사실**은 남긴다 — 안 남기면 영원히 재시도한다.
        rec["introSyncedAt"] = datetime.now().replace(microsecond=0).isoformat()
        if item and has_payload(item):
            rec["introRaw"] = json.dumps(item, ensure_ascii=False, separators=(",", ":"))
            rec.update(derive(item))
        records.append(rec)
        if i % 100 == 0:
            log(f"  {i}/{len(targets)}")
        time.sleep(0.15)
    return records


def run(api_key: str, budget: int, langs: tuple[str, ...] = ("ko", "en")) -> bool:
    """하루치 수집 → 적재. 무언가 적재됐으면 True (재색인 신호)."""
    rows = place_client.fetch_attractions()
    done = sum(1 for r in rows if r.get("introSyncedAt"))
    log(f"이용정보 수집 {done:,}/{len(rows):,}건")

    loaded = False
    for lang in langs:
        targets = pick(rows, lang, budget)
        if not targets:
            log(f"[{lang}] 채울 대상이 없습니다")
            continue
        log(f"[{lang}] 수집 시작 (예산 {budget}, 대상 {len(targets):,})")
        records = collect(api_key, targets)
        if records:
            created, updated = place_client.bulk_upsert(records)
            filled = sum(1 for r in records if r.get("introRaw"))
            log(f"[{lang}] 적재 {len(records)}건 (내용 있음 {filled} · 신규 {created} · 갱신 {updated})")
            loaded = True
    return loaded
