#!/usr/bin/env python3
"""place-ingest 엔트리포인트 (ADR-0070).

K8s CronJob 이 본 모듈을 --job 으로 분기해 호출한다:
    python -m src.main --job=overview --budget=1000
    python -m src.main --job=stats            # 잔량만 (TourAPI 호출 0)
    python -m src.main --job=sync --content-type=attraction
    python -m src.main --job=admin-regions --file 법정동코드_전체자료.txt

외부 :443 을 부르는 것은 이 CronJob 파드뿐이다 — 상시 파드인 place 에는 egress 를 열지 않는다
(ADR-0031 §5.10 화이트리스트에 place-ingest 만 추가).

재색인은 여기서 트리거하지 않는다. Job 생성 권한(RBAC)을 얻는 대신 `attraction-reindex`
CronJob 을 이 잡 직후 시각에 돌린다 — 배치 하나를 위해 권한을 늘리지 않는다.
"""
from __future__ import annotations

import argparse
import os
import sys

from pathlib import Path

from src import admin_region, backfill_overview, naver, place_client, sync_tour, youtube


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


def _job_links(limit: int) -> int:
    """수집 대상만큼 외부 소스를 훑어 place 에 돌려준다. 일일 예산 관리는 place 가 한다."""
    youtube_key = os.environ.get("YOUTUBE_API_KEY")
    naver_id = os.environ.get("NAVER_CLIENT_ID")
    naver_secret = os.environ.get("NAVER_CLIENT_SECRET")

    sources = []
    # 큐 항목을 통째로 넘긴다 — 좌표(latitude/longitude)까지 소스가 쓴다 (유튜브 location 편향).
    if youtube_key:
        sources.append(("YOUTUBE", lambda item: youtube.search(
            youtube_key, item["title"], item.get("lang") or "ko",
            item.get("latitude"), item.get("longitude"))))
    if naver_id and naver_secret:
        sources.append(("NAVER_BLOG", lambda item: naver.search(
            naver_id, naver_secret, item["title"], item.get("lang") or "ko")))
    if not sources:
        raise SystemExit("YOUTUBE_API_KEY 또는 NAVER_CLIENT_ID/SECRET 중 하나는 필요합니다")

    for source, fetch in sources:
        _collect_source(source, fetch, limit)
    return 0


def _collect_source(source: str, fetch, limit: int) -> None:
    items = place_client.fetch_pending_links(source, limit)
    if not items:
        backfill_overview.log(f"[{source}] 수집 대상 없음 (큐가 비었거나 오늘 예산 소진)")
        return

    results = []
    for item in items:
        try:
            links = fetch(item)
        except youtube.QuotaExceeded as e:
            # 남은 큐를 더 두드려도 답이 같다. 이미 받은 결과만 돌려주고 멈춘다.
            backfill_overview.log(f"[{source}] 쿼터 소진 — 여기서 중단 ({e})")
            break
        except Exception as e:
            # 답을 못 받은 것과 "0건" 은 다르다. place 가 재시도 시점을 다르게 잡는다.
            backfill_overview.log(f"  [{source}] {item['title']} 실패: {e}")
            results.append({"attractionId": item["attractionId"], "failed": True})
            continue
        results.append({"attractionId": item["attractionId"], "links": links})

    applied = place_client.apply_link_results(source, results)
    backfill_overview.log(f"[{source}] 수집 {applied['collected']} · 결과없음 {applied['empty']} "
                          f"· 실패 {applied['failed']}")


def _job_admin_regions(file: str | None) -> int:
    """행정안전부 법정동코드 자료를 적재한다 (ADR-0071).

    자료 확보는 사용자 작업이다 — 다운로드가 세션·폼 파라미터에 묶여 있어 스크립트로 긁으면
    정부 포털의 내부 폼을 역공학하는 셈이 된다.
    """
    if not file:
        raise SystemExit("--file 로 법정동코드 전체자료 경로를 주세요")
    regions = admin_region.run(Path(file).expanduser())
    sido = sum(1 for r in regions if r["level"] == "SIDO")
    located = sum(1 for r in regions if r.get("latitude") is not None)
    named = sum(1 for r in regions if r.get("nameEn"))
    created, updated = admin_region.upsert(regions)
    backfill_overview.log(f"행정구역 {len(regions):,}건 (시도 {sido} · 시군구 {len(regions) - sido:,}) "
                          f"— 신규 {created} · 갱신 {updated}")
    # 못 채운 쪽을 같이 찍는다. 그 시군구는 영문 화면에서 한글명이 그대로 나온다.
    backfill_overview.log(f"  좌표 {located:,}/{len(regions):,} · 영문명 {named:,}/{len(regions):,}")
    _print_english_names(regions)
    return 0


def _print_english_names(regions: list[dict]) -> None:
    """뽑아낸 시군구 영문명을 시도별로 한 줄씩 찍는다 — **한 번은 눈으로 봐야 한다.**

    영문명은 관광지 주소에서 최빈값으로 뽑는데, 원천이 일관되게 틀린 경우가 있어 최빈값으로도
    안 걸러진다 (실측: 인천 서구가 137건 모두 `Seohae-gu` 로 온다. 맞는 표기는 `Seo-gu` 다).
    자동으로 고칠 방법이 없으므로 사람이 훑을 수 있게 내놓는다.
    """
    sido = {r["code"]: (r.get("nameEn") or r["name"]) for r in regions if r["level"] == "SIDO"}
    by_parent: dict[str, list[str]] = {}
    for region in regions:
        if region["level"] != "SIGUNGU":
            continue
        by_parent.setdefault(region["parentCode"], []).append(
            region.get("nameEn") or f'{region["name"]}(영문없음)'
        )
    backfill_overview.log("아래 영문명은 원천(관광지 주소)에서 뽑은 값이다 — 한 번 훑어볼 것:")
    for code in sorted(by_parent):
        names = ", ".join(sorted(by_parent[code]))
        backfill_overview.log(f"  [{code} {sido.get(code, '?')}] {names}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True,
                    choices=["overview", "stats", "sync", "links", "admin-regions"])
    ap.add_argument("--budget", type=int, default=int(os.environ.get("BUDGET", "1000")),
                    help="개요 수집 일일 예산 (언어별, detailCommon2 호출 상한)")
    ap.add_argument("--lang", choices=["ko", "en"], help="미지정 시 ko·en 둘 다")
    ap.add_argument("--content-type", default="attraction", choices=list(sync_tour.CONTENT_TYPES))
    ap.add_argument("--limit", type=int, default=200000, help="목록 동기화 상한 (사실상 무제한)")
    ap.add_argument("--file", help="법정동코드 전체자료 경로 (--job=admin-regions)")
    ap.add_argument("--link-limit", type=int, default=int(os.environ.get("LINK_LIMIT", "10")),
                    help="한 실행에서 훑을 관광지 수 (일일 예산은 place 가 따로 센다)")
    args = ap.parse_args()

    langs = (args.lang,) if args.lang else ("ko", "en")
    if args.job == "stats":
        return _job_stats()
    if args.job == "overview":
        return _job_overview(args.budget, langs)
    if args.job == "links":
        return _job_links(args.link_limit)
    if args.job == "admin-regions":
        return _job_admin_regions(args.file)
    return _job_sync(args.content_type, args.limit)


if __name__ == "__main__":
    sys.exit(main())
