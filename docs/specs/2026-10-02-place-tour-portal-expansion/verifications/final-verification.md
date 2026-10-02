# Verification Report: 2026-10-02-place-tour-portal-expansion
**Date:** 2026-10-02 (KST)  **Status:** PASS WITH ISSUES

## Summary
TG1~TG11, TG13 의 체크 항목은 코드·문서·운영 기록(`verifications/status.md`)에서 근거가 확인된다. TG12(2단계 공공데이터)는 활용신청 미승인이라 미체크가 맞다.
이 스펙이 추가·변경한 테스트 40개 파일과 게이트를 범위 지정으로 다시 돌렸고 실패는 0건이다. 남은 문제는 운영 확인 항목 몇 개의 증거가 체크 문구보다 좁다는 것이다. 코드 결함은 없다.

검증 범위: 커밋 `91714dd3`(스펙·ADR-0104 제안)부터 `b0020c3c`(HEAD)까지. 워크트리는 `scratchpad/wt3` 이다.

## Tasks
- [x] Group 1 — 사전 확인 (evidence: `implementation/sample-*.json` 6개 · `q1~q4-*.md` · `rollback-bulk-unknown-field.md` · `context/open-questions.yml` Q5 `status: resolved` · `search/glossary.md:81,84,85`. 정제 게이트 1.10 명령을 다시 돌렸고 exit 0)
- [x] Group 2 — place 저장 (evidence: `place/feature/src/main/resources/placedb/migration/V23__add_attraction_event_dates_and_list_raw.sql` · `AttractionDeepLink.kt:45 of(title, contentTypeId)` · V24 `widen_attraction_tel` 추가 보정)
- [x] Group 3 — 수집기 (evidence: `place/ingest/src/sync_tour.py:49 CONTENT_TYPES` · `src/main.py`·`sync_tour.py` 의 `tour-portal-sync`/`normalize_row` · `src/fix_legacy_en_type.py`(3.10 Q2 채움 경로))
- [x] Group 4 — CronJob·대장·배포 ① (evidence: `k8s/base/place-ingest/cronjob-tour-sync.yaml:26 schedule "10 18 * * *"`, `:33 activeDeadlineSeconds: 540` · `kustomization.yaml:12` · `11-allow-egress-https-public.yaml:11` 주석 · `data-sources.md:75,146` · `ops-before.txt`/`ops-after.txt` · status.md 「배포 ① 4.8.1~4.8.6」 행). 4.8.5 이슈는 아래 Follow-ups 1
- [x] Group 5 — 일정 규칙·코스 파서 (evidence: `search/domain/.../EventSchedule.kt:50 object EventSchedule` · `CourseStops.kt:23 object CourseStopsParser` · 골든 `portal-fe/src/seo/__tests__/fixtures/event-schedule-golden.json` + `.github/workflows/ci.yml:100` `git diff --exit-code`)
- [x] Group 6 — 재색인 (evidence: `search/batch/src/main/resources/opensearch/attractions-index.json:526 eventStartEffective`, `:534 courseStops` · `SearchAttractionService.kt:260` courseStops 결과 매핑 · `ci.yml:108` 재색인 캡처 diff)
- [x] Group 7 — 검색 API (evidence: `SearchAttractionUseCase.kt:48 eventStatus` · `SearchAttractionService.kt:114 EventStatusFilter.of` · `SearchUnifiedService.kt:62` 자동완성/통합 NOT_ENDED)
- [x] Group 8 — 서버 렌더 유형별 본문·JSON-LD (evidence: `AttractionPageRendererTest` 57건 · `AttractionJsonLdParityTest` 29건 · `ci.yml:300` jsonld 골든 diff)
- [x] Group 9 — 목록·상세·정적 sitemap·배포 ② (evidence: `portal-fe/src/seo/eventSchedule.ts` · `prerender-seo.mjs:999 SLICE_WINDOW = 10_000` · `verifications/cdp-deploy2/result.json` · status.md 「배포 ②」 행). 9.7·9.9.3·9.9.4 이슈는 아래 Follow-ups 2~4
- [x] Group 10 — 근처 행사·숙소·지역 허브 (evidence: `AttractionPage.tsx:644 sectionId="NEARBY_STAYS"`, `:653 "NEARBY_EVENTS"`, `:107 NEARBY_EVENTS_RADIUS_KM = 20` · `RegionPage.tsx:255,268 REGION_EVENTS_THIS_MONTH` · `placeApi.ts:211 AMENITY_CATEGORIES = ['shopping', 'food']`). 0건 대조 이슈는 Follow-ups 3
- [x] Group 11 — 행사 만료·행사 sitemap·nginx·배포 ③ (evidence: `EventSitemapController.kt:22 @GetMapping("/internal/render/sitemap/events.xml")` · `RenderEventSitemapUseCase.kt:9` · `EventSitemapService.kt:23 Clock` · `portal-fe/nginx.conf:75 location = /sitemap-places-events.xml` · `prerender-seo.mjs:812 PLACE_EVENT_SITEMAP` · `useSeo.ts:54 'noindex, follow'` · status.md 「배포 ③」 행)
- [ ] Group 12 — 2단계 공공데이터: 미체크가 정상(활용신청 미승인, 착수 조건 미충족)
- [x] Group 13 — 문서 정리 (evidence: `ADR-0104` 상태 줄 「채택 (2026-10-02 …)」 · `ADR-0071:95-98` · `ADR-0103:90` · `ADR-0076:68` · `place/CLAUDE.md:52,86,105` · `search/CLAUDE.md:115`). 13.1·13.4 의 `doc_scan.py` 부분은 UNVERIFIED (Follow-ups 5)

체크가 빠졌는데 끝난 항목은 없다.

## Test Suite
전체 스위트는 돌리지 않았다(사용량 한도 규칙). 대상은 `git log --name-only --format= 91714dd3^..HEAD -- '*Test.kt' '*Spec.kt' '*.test.ts' '*.test.tsx' '*_test.py'` 로 뽑은 40개 파일이고, 7.5 가 요구한 기존 `AttractionSearchAdapterFacetTest`·`HybridTest`, 2.6 의 `AttractionTest` 를 더했다. 건수는 각 모듈 `build/test-results/test/TEST-*.xml` 에서 셌고, 타임스탬프는 모두 이번 실행 것(2026-10-02T05:57~05:58Z)이다. `place:domain` 은 첫 실행에서 UP-TO-DATE 였기 때문에 `--rerun` 으로 다시 돌렸다.

```
$ ./gradlew :place:domain:test --tests '*AttractionDeepLinkTest' --tests '*AttractionSyncFromTest' --tests '*AttractionTest' :place:feature:test --tests '*AttractionServiceTest' --tests '*AttractionRepositoryAdapterTest' --tests '*AttractionJpaEntityTest' --tests '*PlaceSchemaIntegrationSpec' --tests '*AttractionDtoRoundTripTest' --tests '*UpsertAttractionItemTest' :search:domain:test --tests '*CourseStopsParserTest' --tests '*EventScheduleGoldenTest' --tests '*EventScheduleTest' --tests '*RegionAggregatorTest' :search:batch:test --tests '*PlaceApiClientTest' --tests '*AttractionsIndexMappingTest' --tests '*IndexAliasManagerTest' --tests '*AttractionApiReindexTaskletTest' --continue
BUILD SUCCESSFUL in 35s
place/feature: classes=6 tests=18 failures=0 errors=0 skipped=0   (PlaceSchemaIntegrationSpec 5/0, 실제 MySQL 컨테이너, skip 0)
search/domain: classes=4 tests=36 failures=0 errors=0 skipped=0
search/batch:  classes=4 tests=61 failures=0 errors=0 skipped=0

$ ./gradlew :place:domain:test --rerun --tests (위 3개) :search:app:test --tests '*AttractionPageServiceTest' --tests '*EventSitemapServiceTest' --tests '*SearchAttractionServiceTest' --tests '*AttractionReindexCaptureTest' --tests '*AttractionSearchAdapterClickBoostTest' --tests '*AttractionSearchAdapterEventTest' --tests '*AttractionSearchAdapterRankingTest' --tests '*AttractionSearchAdapterFacetTest' --tests '*AttractionSearchAdapterHybridTest' --tests '*AttractionSearchDocumentTest' --tests '*AttractionJsonLdParityTest' --tests '*AttractionPageRendererTest' --tests '*EventSitemapRendererTest' --tests '*EventSitemapControllerTest' --tests '*AttractionSearchControllerTest' --continue
BUILD SUCCESSFUL in 26s
place/domain: classes=3 tests=26 failures=0 errors=0 skipped=0
search/app:   classes=15 tests=256 failures=0 errors=0 skipped=0

$ ./gradlew verifyArchitecture verifySearchIndexContract
BUILD SUCCESSFUL in 4s   (exit 0)

$ ./gradlew :code-dictionary:feature:test --rerun --tests '*OntologyFilesSpec' --tests '*OntologyCoverageSpec' --tests '*AtlasGraphExportSpec'
BUILD SUCCESSFUL in 23s
AtlasGraphExportSpec 1/0 · OntologyCoverageSpec 3/0 · OntologyFilesSpec 4/0  (tests=8 failures=0 skipped=0)

$ cd place/ingest && python3 -m pytest -q tests/backfill_pick_test.py tests/categorize_test.py tests/sync_tour_portal_test.py tests/upsert_fields_test.py
24 passed in 0.19s

$ cd portal-fe && npx vitest run src/api/__tests__/placeApi.test.ts src/pages/place/__tests__/AttractionPage.test.tsx src/pages/place/__tests__/PlacePage.test.tsx src/pages/place/__tests__/RegionPage.test.tsx src/seo/__tests__/attractionJsonLdGolden.test.ts src/seo/__tests__/eventSchedule.test.ts src/seo/__tests__/prerenderPlace.test.ts
 Test Files  7 passed (7)
      Tests  82 passed (82)

$ cd portal-fe && npx tsc --noEmit -p tsconfig.app.json
exit 0   (--listFilesOnly 기준 node_modules 밖 275개 파일 검사, 0개 파일 검사가 아님을 확인)

$ bash portal-fe/scripts/check-nginx-events-sitemap.sh
18 checks ok · PASSED (exit 0)

$ (1.10 정제 게이트) ls implementation/sample-*.json && ! grep -rniE 'servicekey|[0-9a-f]{64}|[A-Za-z0-9+/%]{60,}' implementation/*.json
exit 0
```

합계: JUnit/Kotest 405건(place 44 · search 353 · 온톨로지 8) · pytest 24건 · vitest 82건 · nginx 18건이고, 실패와 skip 은 모두 0건이다.

## Failed Tests
None

## AC Coverage
spec.md 에는 번호 붙은 AC 가 없고 SR 이 그 역할을 한다. SR 과 테스트 번호(T#)의 대응은 `planning/test-quality.md` 를 따랐다.

| SR | T# | 테스트 | 상태 |
|---|---|---|---|
| SR-1 · SR-1b 수집·정규화·잡 | T5 · T6 · T7 · T7b | `upsert_fields_test` · `categorize_test` · `sync_tour_portal_test` · `backfill_pick_test` | 통과 |
| SR-2 저장·왕복 | T4 ①②③ · T4b · T11b | `AttractionSyncFromTest` · `AttractionJpaEntityTest` · `AttractionRepositoryAdapterTest` · `AttractionDtoRoundTripTest` · `AttractionDeepLinkTest` · `PlaceSchemaIntegrationSpec` | 통과 |
| SR-2b 파생 분류 | T6 | `categorize_test` | 통과 |
| SR-3 EventSchedule | T1 · T2 · T2b · T12b | `EventScheduleTest` · `EventScheduleGoldenTest` · `eventSchedule.test.ts` | 통과 |
| SR-4 재색인 | T8 · T9 · T9b | `CourseStopsParserTest` · `AttractionApiReindexTaskletTest` · `AttractionReindexCaptureTest` · `PlaceApiClientTest` · `AttractionsIndexMappingTest` · `verifySearchIndexContract` | 통과 |
| SR-4b 검색 API·목록 화면 | T10 · T16 | `AttractionSearchAdapterEventTest` · `SearchAttractionServiceTest` · Facet·Ranking·Hybrid 스냅샷 · `PlacePage.test.tsx` · `placeApi.test.ts` | 통과 |
| SR-5 유형별 본문 | T11 · T12 · T3(일부) | `AttractionPageRendererTest` · `AttractionPageServiceTest` · `AttractionJsonLdParityTest` · `attractionJsonLdGolden.test.ts` | 통과 |
| SR-6 근처 절·지역 허브 | T16 · T17 | `AttractionPage.test.tsx` · `RegionPage.test.tsx` · CDP `cdp-deploy2/result.json` | 테스트 통과, CDP 는 부분(Follow-ups 2·3) |
| SR-7 만료·정적 sitemap | T3 · T12b · T13 | `AttractionPageRendererTest` · `AttractionPage.test.tsx:375` · `prerenderPlace.test.ts` | 통과 |
| SR-7b 행사 sitemap | T14 · T15 | `EventSitemapRendererTest` · `EventSitemapServiceTest` · `EventSitemapControllerTest` · `check-nginx-events-sitemap.sh` | 통과 |
| SR-8 2단계 | T20 | 없음 — TG12 미착수(미승인) | 범위 밖 |
| SR-9 출처·대장·문서 | — | grep 근거(`data-sources.md:75,146`), 문서 게이트는 미실행 | 부분 |
| SR-10 · SR-10b 배포·운영 | T18 · T19 | `ops-before.txt`/`ops-after.txt` · status.md 배포 ①②③ 행 | 기록으로 확인 |

빠진 것: T17 의 코스 순서 목록과 바텀시트 기간 줄 CDP 측정, TG10 AC 의 0건 대조 운영 기록(Follow-ups 2·3).

## Follow-ups
1. **4.8.5 기록 위치:** 체크 문구는 첫 실행 소요를 `implementation/` 에 남기라고 하지만, 「41초(마감 540초)」는 `verifications/status.md` 에만 있다. 값은 있으니 위치만 어긋난다.
2. **9.7 / T17 CDP 범위:** `cdp-deploy2/result.json` 은 상태 칩 줄·목록 기간 줄·근처 절만 잰다. 「코스 순서 목록」과 「바텀시트 기간 줄」 측정값이 없다. 운영 재색인 기록상 코스 구성이 0건(반복정보 보강 대기)이라 운영에서는 아직 잴 대상이 없다. 같은 파일의 `bundleNew` 가 네 조합 모두 `{}` 이므로, 측정한 번들이 새 것인지 이 파일만으로는 판정할 수 없다. status.md 의 서버 렌더 마커 확인이 대신 근거가 된다.
3. **TG10 AC 0건 대조:** AC 는 「0건 대조(영문 숙박 상세)와 양성 대조 둘 다 기록」을 요구한다. 운영 기록에는 양성(해운대 근처 숙소 6·근처 행사 6)만 있다. 0건 분기는 vitest(`AttractionPage.test.tsx`)에서만 확인된다.
4. **9.9.3 · 9.9.4 문구보다 좁은 증거:** status.md 에 「숙박에 예약 링크·OTA 딥링크 없음」을 운영 응답에서 확인한 줄이 없다. 단위 테스트 T11·T11b 로는 덮인다. 필터 기록에는 다섯 값 중 `THIS_MONTH` 가 없고, OpenSearch `_count` 와 대조했다는 서술도 없다(ONGOING+UPCOMING=NOT_ENDED 합만 있다).
5. **13.1·13.4 `doc_scan.py`:** 스크립트가 `ai/plugins/hns/scripts/` 아래에 있는데, 이 워크트리에서는 `ai` 서브모듈이 초기화되지 않아 실행하지 못했다(exit 127). status.md 에 따르면 `doc_map --check` 의 exit 1 은 HEAD 에도 있던 드리프트다. 문서 게이트 통과는 UNVERIFIED 로 둔다.
6. **배포 ② 남은 것:** 코스 구성 0건(반복정보 보강 대기)과 새 행 임베딩 대기가 남아 있다. 코스 절 마커와 TouristTrip `itinerary` 는 운영에서 아직 빈 상태일 수 있다.
7. `docs/product/roadmap.md` 가 없으므로 로드맵 완료 표시 후보는 없다.

## 메인 보완 (2026-10-02 15:1x KST, 운영 실측)
| 지적 | 실측 |
|---|---|
| 9.9.4 THIS_MONTH · _count 대조 | API 국문 행사 THIS_MONTH 267 = OpenSearch `_count`(ko·15·시작 ≤ 10-31 ∧ 종료 ≥ 10-02) 267 |
| 9.9.3 숙박 예약·OTA | 숙박 12835·1057 서버 렌더 HTML myrealtrip 0 · klook 0 · 「예약」 0, 링크 API TOUR_PRODUCT 0 |
| TG10 0건 대조 | 영문 숙박 22244(제주) 반경 5km 영문 숙박 1건 = 자기 자신 → 자기 제외 0 → 「근처 숙소」 절 생략 대상 |
| 9.7 번들 확인 | `bundleNew` 식은 Promise 를 값으로 못 받아 `{}` — 근거에서 뺐다. 새 코드에만 있는 `NEARBY_EVENTS`·`NEARBY_STAYS` 섹션이 네 조합 모두 그려진 것을 새 번들 근거로 쓴다 |
| 9.7 코스 순서 목록 | 운영 코스 구성 0건(반복정보 보강 대기) — 보강 뒤 측정으로 남김 |
| 4.8.5 기록 위치 | implementation/q1-festival-window.md 에 첫 실행 41초 추가 |
