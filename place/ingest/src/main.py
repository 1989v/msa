#!/usr/bin/env python3
"""place-ingest 엔트리포인트 (ADR-0070).

K8s CronJob 이 본 모듈을 --job 으로 분기해 호출한다:
    python -m src.main --job=overview --budget=1000
    python -m src.main --job=intro --budget=1000   # 이용시간·휴무·요금·주차 (ko·en 병행)
    python -m src.main --job=media --budget=1000   # 부가 사진·반복정보 (레코드당 2콜)
    python -m src.main --job=stats            # 잔량만 (TourAPI 호출 0)
    python -m src.main --job=sync --content-type=attraction
    python -m src.main --job=tour-portal-sync      # 행사·숙박·여행코스 목록 (국·영, 하루 약 56콜)
    python -m src.main --job=administrative-regions --file 법정동코드_전체자료.txt
    python -m src.main --job=lcls-codes            # 분류체계 코드→이름 (호출 400회 미만)
    python -m src.main --job=pet-tour              # 반려동물 동반 (목록형, 약 100회)
    python -m src.main --job=attraction-attrs      # 무장애(목록 1 + 상세 ≤ 899) · 웰니스(월요일만 2콜)
    python -m src.main --job=visitors              # 지역 방문자 열흘 창 (기초·광역 하루 2콜)
    python -m src.main --job=visitors --from=2025-09   # 지역 방문자 백필 1회 (달마다 4콜)
    python -m src.main --job=weather-short         # 단기예보 최근 발표(05·17시) — 고유 격자마다 1콜 (회차당 243)
    python -m src.main --job=weather-mid           # 중기예보 06시 발표 — 육상 10 + 기온 regId (하루 약 173콜)
    python -m src.main --job=congestion            # 관광지 집중률 앞 30일 — 시군구마다 1콜 (하루 269콜)
    python -m src.main --job=related               # 연관 관광지 전달 — 받은 달이면 0콜, 공개 전이면 1콜, 받는 날 269콜
    python -m src.main --job=related --base-ym=202608   # 그 달을 1회 받는다
    python -m src.main --job=air                   # 대기 실시간 측정 전국 1콜 (매시, 하루 24콜)
    python -m src.main --job=air-stations          # 대기 측정소 목록 전국 1콜 + 시군구 최근접 매핑 (주 1회)

외부 :443 을 부르는 것은 이 CronJob 파드뿐이다 — 상시 파드인 place 에는 egress 를 열지 않는다
(ADR-0031 §5.10 화이트리스트에 place-ingest 만 추가).

재색인은 여기서 트리거하지 않는다. Job 생성 권한(RBAC)을 얻는 대신 `attraction-reindex`
CronJob 을 이 잡 직후 시각에 돌린다 — 배치 하나를 위해 권한을 늘리지 않는다.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime

from pathlib import Path

from src import (gocamping, administrative_region, air, backfill_intro, backfill_overview, barrier_free, congestion, google_place, naver,
                 place_client, related,
                 backfill_media, popularity, quota, sync_lcls_codes, sync_pet_tour,
                 sync_tour,
                 visitors, weather, wellness, youtube)


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


def _job_intro(budget: int, langs: tuple[str, ...]) -> int:
    """이용시간·휴무·요금·주차 하루치. 개요와 오퍼레이션이 달라 한도를 따로 쓴다."""
    loaded = backfill_intro.run(_api_key(), budget, langs)
    backfill_overview.log("적재 없음 — 재색인 불필요" if not loaded else "하루치 완료")
    return 0


def _job_lcls_codes(langs: tuple[str, ...]) -> int:
    """분류체계 코드표. 호출 400회 미만이라 예산 인자를 두지 않는다."""
    svc = tuple({"ko": "kor", "en": "eng"}[x] for x in langs)
    applied = sync_lcls_codes.run(_api_key(), svc)
    sync_lcls_codes.log(f"적재 {applied}건")
    return 0


def _job_pet_tour(langs: tuple[str, ...]) -> int:
    """반려동물 동반. 목록형이라 건당 1콜이 아니고 약 100콜이면 전량이라 예산이 없다."""
    loaded = sync_pet_tour.run(_api_key(), langs)
    sync_pet_tour.log("적재 없음 — 재색인 불필요" if not loaded else "전량 반영")
    return 0


def _job_attraction_attrs(budget: int, with_wellness: bool | None = None, key: str | None = None, today=None) -> int:
    """관광지에 붙는 값 — 무장애(매일) · 웰니스(주 1회, 월요일 KST). 둘은 API 가 달라 한도도 따로다.

    한 API 가 실패해도 다른 쪽은 받는다. 하나라도 실패했으면 1 로 끝난다(빠진 것이 성공 기록에 묻히지 않게).
    한도 초과·예산 소진으로 멈춘 것은 실패가 아니다 — 받은 몫을 반영했고 다음 날 이어 받는다.
    """
    key = key or _api_key()
    failed = []
    try:
        if barrier_free.run(key, budget)["failed"]:
            failed.append(barrier_free.API)
    except Exception as e:                                  # noqa: BLE001 — API 별 격리
        backfill_overview.log(f"[{barrier_free.API}] 실패 — 웰니스는 계속 받는다: {e}")
        failed.append(barrier_free.API)
    if with_wellness is None:
        with_wellness = (today or sync_tour.kst_today()).weekday() == 0
    if with_wellness:
        try:
            if wellness.run(key)["failed"]:
                failed.append(wellness.API)
        except Exception as e:                              # noqa: BLE001
            backfill_overview.log(f"[{wellness.API}] 실패: {e}")
            failed.append(wellness.API)
    else:
        backfill_overview.log(f"[{wellness.API}] 월요일만 받는다 — 건너뜀")
    if failed:
        backfill_overview.log(f"관광지 부가 정보 실패: {' '.join(failed)}")
        return 1
    return 0


def _job_visitors(from_month: str | None, key: str | None = None, today=None) -> int:
    """지역 방문자 — 매일 열흘 창, `--from` 이 있으면 그 달부터 백필 한 번. 한도 초과로 멈춘 것은 실패가 아니다."""
    key = key or _api_key()
    today = today or sync_tour.kst_today()
    summary = visitors.run_backfill(key, from_month, today) if from_month else visitors.run_daily(key, today)
    return 1 if summary["failed"] else 0


def _job_weather(kind: str, key: str | None = None, now=None) -> int:
    """날씨 — 단기(회차마다 최근 발표) 또는 중기(06시 발표). 한도 초과로 멈춘 것은 실패가 아니다."""
    key = key or _api_key()
    now = now or datetime.now(sync_tour.KST).replace(tzinfo=None)
    summary = weather.run_short(key, now) if kind == "short" else weather.run_mid(key, now)
    return 1 if summary["failed"] else 0


def _job_congestion(key: str | None = None) -> int:
    """관광지 집중률 — 시군구 전부. 한도 초과로 멈춘 것은 실패가 아니다. 실패한 시군구가 있거나 전부 0건이면 1."""
    summary = congestion.run(key or _api_key())
    return 1 if summary["failed"] else 0


def _job_related(base_ym: str | None, key: str | None = None, today=None) -> int:
    """연관 관광지 — 전달(또는 --base-ym) 을 아직 안 받은 시군구만. 공개 전이면 다음 날 다시 묻는다(창 마지막 날이면 1)."""
    summary = related.run(key or _api_key(), today or datetime.now(sync_tour.KST).date(), base_ym)
    return 1 if summary["failed"] else 0


def _job_gocamping(key: str | None = None) -> int:
    """고캠핑 — 주 1회 전량(1콜). 겹치지 않는 캠핑장만 관광지 행(source=GOCAMPING)이 된다."""
    return 1 if gocamping.run(key or _api_key())["failed"] else 0


def _job_air(kind: str, key: str | None = None) -> int:
    """대기 — 실시간 측정(매시) 또는 측정소 목록·매핑(주 1회). 한도 초과로 멈춘 것은 실패가 아니다."""
    key = key or _api_key()
    summary = air.run_stations(key) if kind == "stations" else air.run_measurements(key)
    return 1 if summary["failed"] else 0


def _job_media(budget: int, langs: tuple[str, ...]) -> int:
    """부가 사진·반복정보 하루치. 레코드당 **두 콜**이라 budget 은 레코드 수다."""
    loaded = backfill_media.run(_api_key(), budget, langs)
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


#: 행사·숙박·여행코스 — 이 순서로 국·영을 받는다. 코스는 영문 서비스에 유형이 없다.
PORTAL_TYPES = ("festival", "stay", "course")


def _job_tour_portal_sync(key: str | None = None, today=None) -> int:
    """행사·숙박·여행코스 목록 동기화. `_job_sync` 를 거치지 않는다 — 오퍼레이션이 다르고 행 원문을 싣는다.

    **한 유형·한 언어가 실패해도 나머지는 받는다**(sync_pet_tour 와 같다). 대신 하나라도 실패했으면
    끝까지 받은 뒤 1 을 돌려준다 — 0 으로 끝나면 CronJob 이 성공으로 남아 빠진 유형을 아무도 모른다.
    """
    key = key or _api_key()
    failed = []
    for content_type in PORTAL_TYPES:
        for service in ("kor", "eng"):
            if service not in sync_tour.CONTENT_TYPES[content_type]:
                continue
            label = f"[{service}/{content_type}]"
            try:
                rows, counts = sync_tour.fetch_portal(key, service, content_type, today)
                created, updated = place_client.bulk_upsert(rows) if rows else (0, 0)
            except Exception as e:                          # noqa: BLE001 — 유형·언어별 격리
                backfill_overview.log(f"{label} 실패 — 나머지는 계속 받는다: {e}")
                failed.append(label)
                continue
            backfill_overview.log(
                f"{label} 호출 {counts['calls']} · 수신 {counts['received']:,} · 적재 {counts['loaded']:,} "
                f"(신규 {created} · 갱신 {updated}) · 좌표 제외 {counts['noCoordinates']} · "
                f"날짜 변환 실패 {counts['dateFailures']} · 다른 유형 제외 {counts['otherType']} · "
                f"contentid 없음 {counts['noContentId']} · 제목 없음 {counts['noTitle']}")
    if failed:
        backfill_overview.log(f"행사·숙박·코스 동기화 실패 {len(failed)}건: {' '.join(failed)}")
        return 1
    return 0


#: 인기순으로 큐에 올릴 여유분. 이미 받은 곳·재시도 대기 중인 곳이 섞여 있어
#: 한 회차 예산보다 넉넉히 올려야 실제로 쓸 대상이 그만큼 나온다.
QUEUE_HEADROOM = 10


def _job_links(limit: int) -> int:
    """수집 대상만큼 외부 소스를 훑어 place 에 돌려준다. 일일 예산 관리는 place 가 한다."""
    youtube_key = os.environ.get("YOUTUBE_API_KEY")
    naver_id = os.environ.get("NAVER_CLIENT_ID")
    naver_secret = os.environ.get("NAVER_CLIENT_SECRET")

    sources = []
    # 유튜브 검색어는 place 가 정한다(이름이 겹치는 곳은 시군구를 붙인다).
    if youtube_key:
        sources.append(("YOUTUBE", lambda item: youtube.search(
            youtube_key, item["title"], item.get("lang") or "ko", item.get("query"),
            item.get("latitude"), item.get("longitude"))))
    if naver_id and naver_secret:
        sources.append(("NAVER_BLOG", lambda item: naver.search(
            naver_id, naver_secret, item["title"], item.get("lang") or "ko")))
    if not sources:
        raise SystemExit("YOUTUBE_API_KEY 또는 NAVER_CLIENT_ID/SECRET 중 하나는 필요합니다")

    # 예산을 어디에 쓸지 먼저 정한다 (ADR-0095). 집계가 없으면 빈 목록이라 기존 순서로 간다.
    popular = popularity.top_attraction_ids(limit * QUEUE_HEADROOM)
    if popular:
        enqueued = place_client.enqueue_links(popular)
        backfill_overview.log(f"[links] 인기순 {len(popular)}곳 중 {enqueued}곳 큐 등록")

    for source, fetch in sources:
        _collect_source(source, fetch, limit)
    if youtube_key:
        _fill_video_details(youtube_key)
    return 0


#: 한 실행에 채울 영상 수 상한 — videos.list 50개 1 unit 이라 100 units. 길이·비율이 생기기 전에 받은
#: 영상(약 6천 개)을 첫 실행에 다 채우고, 그 뒤로는 응답에서 빠진(지워진) 영상만 남는다.
VIDEO_DETAILS_PER_RUN = 5000


def _fill_video_details(api_key: str) -> None:
    """길이·비율을 모르는 영상을 채운다 — 쇼츠/일반 판정의 원천 값(ADR-0070 개정)."""
    ids = place_client.fetch_videos_missing_details(VIDEO_DETAILS_PER_RUN)
    if not ids:
        return
    try:
        found = youtube.video_details(api_key, ids)
    except youtube.QuotaExceeded as e:
        backfill_overview.log(f"[YOUTUBE] 영상 정보 — 쿼터 소진, 내일 다시 ({e})")
        return
    items = [{"externalId": vid, **{k: v for k, v in d.items() if k != "viewCount"}} for vid, d in found.items()]
    updated = place_client.put_video_details(items)
    backfill_overview.log(f"[YOUTUBE] 영상 정보 채움 — 대상 {len(ids)} · 받음 {len(found)} · 행 {updated}"
                          f" · 응답에 없음(지워진 영상) {len(ids) - len(found)}")


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


def _job_google_places(budget: int) -> int:
    """구글 place_id 보강 — Text Search ID-only(무과금 SKU)로 미보강분을 id 순 소진한다.

    키가 없으면 조용히 건너뛴다 — 선택 키다 (_job_links 가 소스별 키를 거르는 것과 같은 태도).
    좌표 링크 폴백이 있어 화면은 깨지지 않고, 키가 생기는 날부터 채워진다.
    """
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not api_key:
        backfill_overview.log("[GOOGLE_PLACES] 키 없음 — 건너뜀 (좌표 링크 폴백으로 동작)")
        return 0

    items = place_client.fetch_pending_google_place_ids(budget)
    if not items:
        backfill_overview.log("[GOOGLE_PLACES] 미보강분 없음")
        return 0

    # ADR-0082 — 제공자 단위 장부. JVM(quant·deal·place:app)과 같은 Redis 키를 쓴다.
    # 자체 카운터를 두면 같은 API 키를 쓰는 다른 서비스를 모른 채 합쳐서 넘긴다.
    ledger = quota.QuotaLedger()

    results = []
    misses = failures = 0
    blocked = 0
    for item in items:
        # 호출 직전에 예약한다. 성공·빈결과·실패 전부 1콜로 세고 되돌리지 않는다.
        if not ledger.try_acquire(quota.GOOGLE_PLACES):
            blocked = len(items) - len(results) - misses - failures
            backfill_overview.log(f"[GOOGLE_PLACES] 일일 한도 소진 — {blocked}건을 다음 실행으로 넘긴다")
            break
        try:
            place_id = google_place.find_place_id(
                api_key, item["title"], item.get("address"), item.get("lang") or "ko")
        except Exception as e:
            # 답을 못 받은 것 — 행은 null 로 남아 다음 실행이 다시 시도한다.
            backfill_overview.log(f"  [GOOGLE_PLACES] {item['title']} 실패: {e}")
            failures += 1
            continue
        if place_id:
            results.append({"attractionId": item["attractionId"], "googlePlaceId": place_id})
        else:
            misses += 1
    applied = place_client.apply_google_place_ids(results)
    backfill_overview.log(f"[GOOGLE_PLACES] 적용 {applied} · 결과없음 {misses} · 실패 {failures} "
                          f"(대상 {len(items)})")
    return 0


def _job_administrative_regions(file: str | None) -> int:
    """행정안전부 법정동코드 자료를 적재한다 (ADR-0071).

    자료 확보는 사용자 작업이다 — 다운로드가 세션·폼 파라미터에 묶여 있어 스크립트로 긁으면
    정부 포털의 내부 폼을 역공학하는 셈이 된다.
    """
    if not file:
        raise SystemExit("--file 로 법정동코드 전체자료 경로를 주세요")
    regions = administrative_region.run(Path(file).expanduser())
    sido = sum(1 for r in regions if r["level"] == "SIDO")
    located = sum(1 for r in regions if r.get("latitude") is not None)
    named = sum(1 for r in regions if r.get("nameEn"))
    created, updated = administrative_region.upsert(regions)
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
                    choices=["overview", "intro", "media", "stats", "sync", "tour-portal-sync", "links",
                             "administrative-regions", "google-places", "lcls-codes", "pet-tour",
                             "attraction-attrs", "visitors", "weather-short", "weather-mid", "congestion", "related",
                             "air", "air-stations", "gocamping"])
    ap.add_argument("--budget", type=int, default=int(os.environ.get("BUDGET", "1000")),
                    help="개요 수집 일일 예산 (언어별, detailCommon2 호출 상한)")
    ap.add_argument("--lang", choices=["ko", "en"], help="미지정 시 ko·en 둘 다")
    ap.add_argument("--content-type", default="attraction", choices=list(sync_tour.LIST_SYNC_TYPES))
    ap.add_argument("--limit", type=int, default=200000, help="목록 동기화 상한 (사실상 무제한)")
    ap.add_argument("--file", help="법정동코드 전체자료 경로 (--job=administrative-regions)")
    ap.add_argument("--link-limit", type=int, default=int(os.environ.get("LINK_LIMIT", "10")),
                    help="한 실행에서 훑을 관광지 수 (일일 예산은 place 가 따로 센다)")
    ap.add_argument("--google-places-budget", type=int,
                    default=int(os.environ.get("GOOGLE_PLACES_DAILY_BUDGET", "1000")),
                    help="구글 place_id 보강 일일 상한 (Text Search ID-only 호출 수)")
    ap.add_argument("--wellness", action="store_true",
                    help="--job=attraction-attrs 에서 요일과 무관하게 웰니스를 받는다 (기본: 월요일 KST 만)")
    ap.add_argument("--from", dest="from_month",
                    help="--job=visitors 백필 시작 달 YYYY-MM (없으면 매일 창)")
    ap.add_argument("--base-ym", help="--job=related 에서 전달 대신 받을 달 YYYYMM (수동 1회)")
    args = ap.parse_args()

    langs = (args.lang,) if args.lang else ("ko", "en")
    if args.job == "stats":
        return _job_stats()
    if args.job == "overview":
        return _job_overview(args.budget, langs)
    if args.job == "intro":
        return _job_intro(args.budget, langs)
    if args.job == "media":
        return _job_media(args.budget, langs)
    if args.job == "links":
        return _job_links(args.link_limit)
    if args.job == "google-places":
        return _job_google_places(args.google_places_budget)
    if args.job == "administrative-regions":
        return _job_administrative_regions(args.file)
    if args.job == "lcls-codes":
        return _job_lcls_codes(langs)
    if args.job == "pet-tour":
        return _job_pet_tour(langs)
    if args.job == "attraction-attrs":
        # BUDGET 환경변수는 개요 잡의 일일 예산이다 — 무장애는 자기 예산 상수를 쓴다(원천 한도가 API 마다 따로다)
        return _job_attraction_attrs(barrier_free.DAILY_BUDGET, True if args.wellness else None)
    if args.job == "visitors":
        return _job_visitors(args.from_month)
    if args.job in ("weather-short", "weather-mid"):
        return _job_weather(args.job.removeprefix("weather-"))
    if args.job == "congestion":
        return _job_congestion()
    if args.job in ("air", "air-stations"):
        return _job_air("stations" if args.job == "air-stations" else "measurements")
    if args.job == "gocamping":
        return _job_gocamping()
    if args.job == "related":
        if args.base_ym and not (len(args.base_ym) == 6 and args.base_ym.isdigit()):
            raise SystemExit(f"--base-ym 은 YYYYMM 이다: {args.base_ym}")
        return _job_related(args.base_ym)
    if args.job == "tour-portal-sync":
        return _job_tour_portal_sync()
    return _job_sync(args.content_type, args.limit)


if __name__ == "__main__":
    sys.exit(main())
