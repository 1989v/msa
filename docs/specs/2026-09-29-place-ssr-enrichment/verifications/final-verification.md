# Verification Report: 2026-09-29-place-ssr-enrichment
**Date:** 2026-09-30  **Status:** PASS WITH ISSUES

## Summary
이번 스펙이 추가·변경한 테스트 클래스 30개(Kotlin 25, vitest 4 파일)를 모듈별로 범위를 지정해 돌렸고 실패는 0건이다. `verifyArchitecture` · `verifySearchIndexContract` 도 통과했다.
체크된 항목은 모두 코드·문서에서 근거를 찾았다. 반대로 끝난 작업이 tasks.md 에 체크되지 않은 곳(TG9, 10.1~10.3, 2.6)이 있고, 파이썬 유사도 테스트는 훅에 막혀 이번에 다시 돌리지 못했다.

## Tasks
- [x] Group 1 — 속성 파서·지역 집계기 (evidence: `search/domain/.../attraction/model/AttractionAttributes.kt:11`, `RegionAggregator.kt:42` `object RegionAggregator`, `search/domain/src/test/resources/attributes/raw-fixtures.tsv`, `implementation/pet-policy-map.md`)
- [x] Group 2 — 재색인 확장 (evidence: `search/batch/.../job/AttractionApiReindexTasklet.kt`, `build.gradle.kts:494` `searchIndexContracts` · `:515` `searchReadOmitted`). 2.6 은 미체크지만 status.md 「배포 ①」 줄에 재색인 5분 1초 · 283→296.2MB · 속성 필드 59,735/59,735 기록이 있다(체크 누락)
- [x] Group 3 — 서버 렌더 (evidence: `search/app/.../usecase/RenderAttractionPageUseCase.kt:11`, `port/AttractionPagePorts.kt:15` `AttractionPageRenderPort`, `presentation/render/controller/AttractionPageController.kt:22,25,45,52` — 두 경로 · `no-cache, must-revalidate` · `X-Render`; 골든 재생성 CI `.github/workflows/ci.yml:284` `git diff --exit-code -- search/app/src/test/resources/render/jsonld-golden.json`)
- [x] Group 4 — 배선 (evidence: `portal-fe/nginx.conf:158-168` 숫자 id location · 변수 upstream · `proxy_connect_timeout 500ms` · `proxy_read_timeout 3s` · Cookie/Authorization 비움 · `error_page 500 502 503 504`; `:181` 비숫자 id; `k8s/base/network-policy/19-allow-portal-fe-to-search-render.yaml`, `20-allow-search-shell-fetch.yaml`). 4.4 중 search 중단 폴백·쿠키 미전달은 스텁 nginx 로만 확인(status.md 「운영 미확인」 줄)
- [x] Group 5 — 속성 패싯 API (evidence: `search/app/.../usecase/SearchAttractionUseCase.kt:40` `attributeFacets`, `SearchAttractionService.kt:103,117`; T22 운영 대조는 status.md 「배포 ③(API) T22」 줄)
- [x] Group 6 — 화면 (evidence: `portal-fe/src/pages/place/__tests__/PlacePage.test.tsx`, `AttractionPage.test.tsx`; T20 `verifications/t20-*.png`, `t20-measure.json`)
- [x] Group 7 — 비슷한 곳 (evidence: `place/feature/src/main/resources/placedb/migration/V22__create_attraction_similar.sql`, `AttractionSimilarInternalController.kt:22,28,42` `/internal/attractions/similar` `/bulk` `/lookup`, `tools/embed/src/embed/similar.py`, `verifications/similar-quality.md`)
- [x] Group 8 — 클릭 신호 (evidence: `analytics/app/src/main/resources/clickhouse/analytics/V007__attraction_unique_clickers.sql`, `search/batch/.../clicksignal/ClickHouseClickSignalReader.kt:38` `uniqMerge`, `AttractionApiReindexTasklet.kt:230` `uniqueClickers14d`, `search/app/.../opensearch/AttractionClickBoostProperties.kt`(기본 꺼짐), `k8s/base/search-batch/eval/live-eval.py`)
- [ ] Group 9 — 프리렌더 제거: **체크 누락(작업은 됨)**. `portal-fe/scripts/prerender-seo.mjs` 에 `PLACE_DETAIL_CAP`·관광지 상세 emit 이 없고 관광지 URL 은 sitemap(`:709`)·지역 허브 목록(`:992`)에만 남는다. status.md TG9 줄(vitest 24 passed · 회귀 주입 2 failed→13 passed)도 있다. 9.0~9.2 가 `[ ]` 인 채로 커밋 31913f72 메시지는 「complete task group 9·10」. 9.3 은 배포 뒤 확인이라 미체크가 정상
- [x] Group 10 — 문서: **10.0 은 체크, 하위 10.1~10.3 은 미체크**. 근거는 있다 — ADR-0103 「상태: 채택 (2026-09-30)」, ADR-0062 상태 줄 §8 대체, `search/glossary.md:75-79`(속성 패싯·`petPolicy`·`clickBoost`·서버 렌더), `place/CLAUDE.md:52,86`. 다만 10.3 의 문서 게이트는 status.md 에 `doc_map --check exit 1(HEAD 에서도 같은 기존 drift)` 로 적혀 있어 「문서 게이트 통과」 AC 는 엄밀히 충족되지 않았다
- 보류: T7(파서 정확도 사람 라벨 200건) — tasks 항목 없음, 보류로 취급

## Test Suite
범위 지정 실행(usage 한도로 전체 스위트 금지). 대상 = `git log --name-only --format= 39b11fe8^..HEAD -- '*Test.kt' '*Spec.kt' '*.test.ts' '*.test.tsx'`.

$ ./gradlew --continue :search:domain:test --tests '*AttractionAttributeParserTest' --tests '*AttractionClickSignalTest' --tests '*ClosedTodayTest' --tests '*RegionAggregatorTest'
BUILD SUCCESSFUL in 5s — AttractionAttributeParserTest 11/0 · AttractionClickSignalTest 6/0 · ClosedTodayTest 4/0 · RegionAggregatorTest 8/0 (tests/failures, JUnit XML)

$ ./gradlew --continue :search:batch:test --tests '*PlaceApiClientTest' --tests '*AttractionsIndexMappingTest' --tests '*AttractionApiReindexTaskletTest'
BUILD SUCCESSFUL in 9s — PlaceApiClientTest 16/0 · AttractionsIndexMappingTest 5/0 · AttractionApiReindexTaskletTest 18/0

$ ./gradlew --continue :search:app:test --tests '*AttractionPageServiceTest' --tests '*SearchAttractionServiceTest' --tests '*AttractionSearchAdapterClickBoostTest' --tests '*AttractionSearchAdapterFacetTest' --tests '*AttractionSearchDocumentTest' --tests '*AttractionJsonLdParityTest' --tests '*AttractionPageRendererTest' --tests '*AttractionShellProviderTest' --tests '*AttractionPageControllerTest' --tests '*AttractionSearchControllerTest' --tests '*AttractionSearchAdapterTest'
BUILD SUCCESSFUL in 15s — PageService 3/0 · SearchAttractionService 32/0 · ClickBoost 12/0 · Facet 31/0 · SearchDocument 5/0 · JsonLdParity 7/0 · PageRenderer 23/0 · ShellProvider 4/0 · PageController 5/0 · SearchController 3/0 (`AttractionSearchAdapterTest` 라는 클래스는 없다)

$ ./gradlew --continue :place:domain:test --tests '*SimilarAttractionsTest'
BUILD SUCCESSFUL in 1s — `:place:domain:test UP-TO-DATE`(입력 변경 없음), 기존 결과 SimilarAttractionsTest 5/0

$ ./gradlew --continue :place:feature:test --tests '*AttractionServiceTest' --tests '*AttractionSimilarServiceTest' --tests '*PlaceSchemaIntegrationSpec' --tests '*AttractionControllerTest' --tests '*AttractionSimilarInternalControllerTest'
BUILD SUCCESSFUL in 17s — AttractionService 5/0 · AttractionSimilarService 4/0 · PlaceSchemaIntegrationSpec 3/0 (skip 0) · AttractionController 2/0 · AttractionSimilarInternalController 2/0

$ ./gradlew --continue :analytics:app:test --tests '*AttractionPopularityServiceTest' --tests '*ClickHouseAttractionPopularityAdapterTest' --tests '*ClickHouseSchemaInitializerTest'
BUILD SUCCESSFUL in 4s — AttractionPopularityService 3/0 · ClickHouseAttractionPopularityAdapter 4/0 · ClickHouseSchemaInitializer 5/0

$ ./gradlew verifyArchitecture verifySearchIndexContract
BUILD SUCCESSFUL in 3s (18 actionable tasks: 9 executed, 9 up-to-date)

$ cd portal-fe && npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx src/pages/place/__tests__/PlacePage.test.tsx src/seo/__tests__/attractionJsonLdGolden.test.ts src/seo/__tests__/prerenderPlace.test.ts
 Test Files  4 passed (4)
      Tests  36 passed (36)

합계: Kotlin 25 클래스 226 tests / 226 passed / 0 failed · vitest 36 / 36 / 0

$ python3 -m pytest tests/test_similar.py  (tools/embed)
실행 안 됨 — `~/.claude/hooks/test-scope-gate.sh:43` 이 파일을 지정해도 `pytest` 단어만 보면 차단한다(주석의 허용 예시 `pytest tests/test_foo.py` 와 어긋남). status.md TG7 줄의 이전 실행 「5 passed」가 유일한 기록

## Failed Tests
None (파이썬 `test_similar.py` 는 미실행)

## AC Coverage
- SR-1 서버 렌더 → AttractionPageRendererTest · AttractionPageControllerTest · AttractionShellProviderTest · AttractionPageServiceTest · AttractionJsonLdParityTest · attractionJsonLdGolden.test.ts
- SR-2 속성 추출·정규화 → AttractionAttributeParserTest · ClosedTodayTest · AttractionApiReindexTaskletTest
- SR-3 속성 패싯 → AttractionSearchAdapterFacetTest · SearchAttractionServiceTest · AttractionSearchControllerTest · PlacePage.test.tsx
- SR-4 지역 안 위치 → RegionAggregatorTest · AttractionApiReindexTaskletTest · AttractionPage.test.tsx
- SR-5 비슷한 곳 → SimilarAttractionsTest · AttractionSimilarServiceTest · AttractionSimilarInternalControllerTest · PlaceSchemaIntegrationSpec · test_similar.py(미재실행)
- SR-6 클릭 신호 → AttractionPopularityServiceTest · ClickHouseAttractionPopularityAdapterTest · ClickHouseSchemaInitializerTest · AttractionClickSignalTest · AttractionSearchAdapterClickBoostTest
- SR-7 색인 계약·배선 → AttractionsIndexMappingTest · AttractionSearchDocumentTest · `verifySearchIndexContract` · `verifyArchitecture`. nginx 동작은 자동 테스트 없이 스텁 nginx 수동 검증(status.md TG4)
- SR-8 배포 순서·운영 확인 → 자동 테스트 없음, status.md 배포 ①~⑤ 운영 기록. 배포 ⑥(9.3) 미완

## Follow-ups
- tasks.md 체크 정리: 2.6, 9.0~9.2, 10.1~10.3 (작업·근거는 있음)
- 10.3 문서 게이트: `doc_map --check` exit 1 의 기존 drift 해소 여부 결정
- 9.3 배포 뒤 확인: 이미지 크기 전후(기준 97.2~97.6MB) · 상세 `X-Render: ssr` · `/regions/*` 유지
- T19 중 search 중단 폴백·쿠키 미전달은 운영 증거가 없다(스텁만)
- test-scope 훅의 pytest 정규식이 파일 지정도 막는다 — 훅 수정 여부 판단 필요
- 이번 vitest 는 워크트리의 `portal-fe/node_modules` 심볼릭 링크(공유 트리 경로)를 통해 실행됐다
- T7 파서 정확도 사람 라벨 200건 보류
