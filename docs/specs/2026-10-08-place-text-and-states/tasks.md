# Task Breakdown: place 원문 정제 + 상태 규칙 (S2-1 · S2-4 · 템플스테이 0건)

## Overview
Total Task Groups: 6. 정본은 `spec.md`(3라운드 심판 반영). 표준: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK), `docs/conventions/package-structure.md`, root `DESIGN.md`, `docs/conventions/blog-writing.md`(문구 문체).

### Task Group 1: 파서 v2 (SR-4)
**Dependencies:** None · **Phase:** search domain/batch · **Skills:** Kotlin
- [ ] 1.1 `raw-fixtures.tsv:105` 기대값 UNKNOWN(행 수 145 유지), `AttractionApiReindexTaskletTest.kt:305,329` 를 `VERSION` 으로(`AttractionSearchDocumentTest` 는 1 유지)
- [ ] 1.2 `PARKING_NO` 에서 `n/a` 제거, 주석 정리, `VERSION` 2
- [ ] 1.3 `reindex-capture.json` 재생성(같은 커밋)
- [ ] 1.4 Verify: `./gradlew :search:domain:test --tests '*AttractionAttributeParserTest' :search:batch:test --tests '*AttractionApiReindexTaskletTest' --rerun` + `git diff --stat search/app/src/test/resources/attraction/reindex-capture.json`

### Task Group 2: FE 칩·패널·0건·교정 (SR-2.1 · SR-3 · SR-5 FE · SR-7.1)
**Dependencies:** None(서버 `exact` 파라미터는 TG4 — FE 는 계약대로 싣는다) · **Phase:** portal-fe · **Skills:** React/TS, vitest
- [ ] 2.1 테스트 먼저(SR-7.1 전부, 의도된 빨강 `PlacePage.test.tsx:112,221,222` 갱신, `App` 마운트 언어 전환, 새 `UnifiedSearchPage.test.tsx`, `placeApi` exact 직렬화)
- [ ] 2.2 `placeAttributes.ts` 문구·`only`, 고른 칩 항상 그리기
- [ ] 2.3 패널 `:1533` 만 `overviewText`, 카드는 서버 값 그대로
- [ ] 2.4 0건 순수 함수·해제 핸들러(`relax`, `changed` 필드 이름, `autoPickedRef`, 모두 해제), 교정 안내 0건에도, `exactFor`, `placeApi` `exact`
- [ ] 2.5 Verify: `cd portal-fe && npx vitest run src/pages/place src/pages/search src/api && npx tsc -b`

### Task Group 3: 정규화 단일 원본·목록 요약 (SR-1)
**Dependencies:** 스펙 C TG2(렌더러 파일) 끝난 뒤 · **Phase:** search domain/app
- [ ] 3.1 테스트: 200자 경계·빈 정규화 null·`&lt;PARASITE&gt;` 남음·250→150 `…` 없음(기대 문자열 전체), `findById` 원문 그대로, `SearchUnifiedService` summary 그대로/null→address, 패리티 초록
- [ ] 3.2 `AttractionSeoText` → `search/domain/.../domain/attraction/model/`, public, KDoc(escapeHtml `'` 한계), import 수정
- [ ] 3.3 `SearchAttractionService` 요약: 정규화 → 200자 → `…`, 빈 → null, `SearchAttractionUseCase.kt:83` KDoc
- [ ] 3.4 Verify: `./gradlew :search:app:test --tests '*SearchAttractionServiceTest' --tests '*SearchUnifiedServiceTest' --tests '*AttractionJsonLdParityTest' --tests '*AttractionPageRendererTest' --rerun`

### Task Group 4: 원래 검색어 검색 `exact` (SR-5.3 서버)
**Dependencies:** TG3 · **Phase:** search app
- [ ] 4.1 테스트: `exact=true` 면 `correct` 미호출·`correctedKeyword == null`, `AttractionSearchControllerTest` 바인딩
- [ ] 4.2 Controller·UseCase.Query `exact`
- [ ] 4.3 Verify: `./gradlew :search:app:test --tests '*AttractionSearchControllerTest' --tests '*SearchAttractionServiceTest' --rerun`

### Task Group 5: 분류 사전 = 코드표 ∩ 언어별 색인 (SR-6)
**Dependencies:** TG4 · **Phase:** search app
- [ ] 5.1 착수 전 확인(SR-6.1) 기록
- [ ] 5.2 테스트: `CategoryLexiconServiceTest` ①~⑩, 어댑터 `indexedCategoryCodes` ⓐⓑⓒ(자기 mockk 클라이언트)
- [ ] 5.3 `CategoryCodePort`/`CategoryCodeAdapter`, `AttractionSearchPort.indexedCategoryCodes`, `CategoryLexiconUseCase`/`Service`(캐시·@Scheduled·교집합·실패 처리·빈 코드표 가드), 소비자 2곳 주입, KDoc·주석·대역 4곳
- [ ] 5.4 Verify: `./gradlew :search:app:test --tests '*CategoryLexicon*' --tests '*AttractionSearchAdapter*' --tests '*SearchAttractionServiceTest' --tests '*SearchUnifiedServiceTest' --tests '*UnifiedAttraction*' --tests '*AttractionReindexCaptureTest' --rerun`

### Task Group 6: 문서·회귀 주입·배포
**Dependencies:** TG1–5
- [ ] 6.1 `search/glossary.md` §3-2 세 행, `search-architecture.md` §2.1·§2.2·§4, ADR-0090 개정 한 줄, `place-hub-instrumentation/spec.md` SR-10 표
- [ ] 6.2 회귀 주입(SR-7.3 전부, 임시 사본) → `verifications/regression-injection.md`
- [ ] 6.3 배포 순서 search:app → portal-fe → search:batch → 재색인, SR-7.5 확인 → `verifications/deploy-check.md`

## Execution Order
1. TG1 · TG2 (병렬, 스펙 C TG2 와도 파일 겹침 없음)
2. TG3 → TG4 → TG5 (search app 순차)
3. TG6
