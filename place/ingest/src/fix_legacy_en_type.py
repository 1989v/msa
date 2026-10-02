"""일회성 보정 — 유형 없는 옛 영문 행 2건의 유형·법정동을 detailCommon2 단건 응답으로 채운다.

    kubectl run ... --image=<place-ingest> --command -- python -m src.fix_legacy_en_type          # 미리보기
    kubectl run ... --image=<place-ingest> --command -- python -m src.fix_legacy_en_type --apply  # 반영

두 행(2948191 · 3112217)은 영문 숙박 목록(searchStay2)에도, 영문 관광지(76) 목록 동기화에도 잡히지 않는다 —
원천 좌표가 "0" 이라 목록 경로의 좌표 제외에 걸린다. 그래서 목록 대신 detailCommon2 로 **유형·법정동만** 고친다.
좌표 0 은 원천도 0 이라 고칠 값이 없다.

bulk 는 전체 동기화라 받아 온 행을 통째로 되돌려 보낸다(부분 레코드는 나머지 필드를 지운다).
"""
from __future__ import annotations

import argparse
import os
import sys

from src import place_client
from src.sync_tour import SERVICES, _ldong, tour_get

TARGETS = ("2948191", "3112217")
LANG = "en"


def corrected(row: dict, detail: dict) -> dict:
    """받아 온 행에서 유형·법정동 세 값만 원천 상세 값으로 바꾼다."""
    rec = dict(row)
    rec["contentTypeId"] = str(detail.get("contenttypeid") or "").strip() or row.get("contentTypeId")
    ldong = _ldong(detail)
    rec["ldongRegnCd"] = ldong["ldongRegnCd"] or row.get("ldongRegnCd")
    rec["ldongSignguCd"] = ldong["ldongSignguCd"] or row.get("ldongSignguCd")
    return rec


def run(key: str, apply: bool) -> int:
    rows = {r["contentId"]: r for r in place_client.fetch_attractions()
            if r.get("lang") == LANG and r.get("contentId") in TARGETS}
    service, _ = SERVICES["eng"]
    records = []
    for content_id in TARGETS:
        row = rows.get(content_id)
        if row is None:
            print(f"{content_id}: place 에 행이 없다 — 건너뜀")
            continue
        item = (tour_get(key, service, "detailCommon2", {"contentId": content_id}).get("items") or {}).get("item")
        if isinstance(item, list):
            item = item[0] if item else None
        if not item:
            print(f"{content_id}: 원천 상세가 비었다 — 건너뜀")
            continue
        rec = corrected(row, item)
        print(f"{content_id}: 유형 {row.get('contentTypeId')} → {rec['contentTypeId']} · "
              f"법정동 {row.get('ldongRegnCd')}/{row.get('ldongSignguCd')} → "
              f"{rec['ldongRegnCd']}/{rec['ldongSignguCd']}")
        records.append(rec)
    if apply and records:
        created, updated = place_client.bulk_upsert(records)
        print(f"반영 {len(records)}건 (신규 {created} · 갱신 {updated})")
    elif records:
        print("미리보기만 했다 — 반영하려면 --apply")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    key = os.environ.get("TOUR_API_KEY") or os.environ.get("DATA_GO_KR_KEY")
    if not key:
        raise SystemExit("TOUR_API_KEY 가 필요합니다")
    return run(key, args.apply)


if __name__ == "__main__":
    sys.exit(main())
