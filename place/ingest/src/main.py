#!/usr/bin/env python3
"""place-ingest 엔트리포인트 (ADR-0070).

K8s CronJob 이 본 모듈을 --job 으로 분기해 호출한다:
    python -m src.main --job=overview --budget=1000
    python -m src.main --job=stats            # 잔량만 (TourAPI 호출 0)
    python -m src.main --job=sync --content-type=attraction

외부 :443 을 부르는 것은 이 CronJob 파드뿐이다 — 상시 파드인 place 에는 egress 를 열지 않는다
(ADR-0031 §5.10 화이트리스트에 place-ingest 만 추가).

재색인은 여기서 트리거하지 않는다. Job 생성 권한(RBAC)을 얻는 대신 `attraction-reindex`
CronJob 을 이 잡 직후 시각에 돌린다 — 배치 하나를 위해 권한을 늘리지 않는다.
"""
from __future__ import annotations

import argparse
import os
import sys

from src import backfill_overview, place_client, sync_tour


def _api_key() -> str:
    key = os.environ.get("TOUR_API_KEY") or os.environ.get("DATA_GO_KR_KEY")
    if not key:
        raise SystemExit("TOUR_API_KEY 가 필요합니다")
    return key


def _job_stats() -> int:
    backfill_overview.stats(place_client.fetch_attractions())
    known = place_client.fetch_probe_keys()
    backfill_overview.log(f"제외 목록(원천 개요없음) {len(known):,}건")
    return 0


def _job_overview(budget: int, langs: tuple[str, ...]) -> int:
    loaded = backfill_overview.run(_api_key(), budget, langs)
    backfill_overview.log("적재 없음 — 재색인 불필요" if not loaded else "하루치 완료")
    return 0


def _job_sync(content_type: str, limit: int) -> int:
    key = _api_key()
    total = 0
    for service in ("kor", "eng"):
        # 전국은 무지정 페이징으로 받는다 — 지역 순회는 areaCode 없는 43% 를 놓친다.
        rows = sync_tour.fetch_area_based(key, service, content_type, None, limit, False)
        if not rows:
            continue
        created, updated = place_client.bulk_upsert(rows)
        backfill_overview.log(f"[{service}/{content_type}] {len(rows):,}건 "
                              f"(신규 {created} · 갱신 {updated})")
        total += len(rows)
    backfill_overview.log(f"목록 동기화 {total:,}건 — 개요는 목록 동기화로 지워지지 않는다")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True, choices=["overview", "stats", "sync"])
    ap.add_argument("--budget", type=int, default=int(os.environ.get("BUDGET", "1000")),
                    help="개요 수집 일일 예산 (언어별, detailCommon2 호출 상한)")
    ap.add_argument("--lang", choices=["ko", "en"], help="미지정 시 ko·en 둘 다")
    ap.add_argument("--content-type", default="attraction", choices=list(sync_tour.CONTENT_TYPES))
    ap.add_argument("--limit", type=int, default=200000, help="목록 동기화 상한 (사실상 무제한)")
    args = ap.parse_args()

    langs = (args.lang,) if args.lang else ("ko", "en")
    if args.job == "stats":
        return _job_stats()
    if args.job == "overview":
        return _job_overview(args.budget, langs)
    return _job_sync(args.content_type, args.limit)


if __name__ == "__main__":
    sys.exit(main())
