# Task Breakdown: 관광지 영문 짝(hreflang) + 본문 변경 시각 + RSS + IndexNow (S3-5 · S3-9)

## Overview
Total Task Groups: 8. 정본은 `spec.md`(3라운드 심판 반영). 열린 질문은 `context/open-questions.yml` 권고 기본값을 따른다 — Q1 IndexNow 제출·Q2 짝 스위치는 **꺼진 채 배포**하고 켜기는 사용자 몫(부록 B·C), Q3 판단 2~8 은 권고 기본값, Q4 ADR 개정은 구현 커밋에 함께, Q5 `/.txt`·틀린 키는 막지 않음(SPA 셸), Q6 Secret 은 사용자가 배포 전에 만듦, Q7 조각에 `X-Robots-Tag` 없음.
표준: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK, 도메인 Mock 금지), `docs/conventions/package-structure.md`(ADR-0083 — UseCase 인터페이스 + Outbound Port + Adapter), `docs/conventions/jpa-persistence.md`(Flyway+validate), `docs/conventions/entity-mutation.md`(전체 동기화가 자기 계산값을 지우지 않게).

의존 순서는 데이터 흐름을 따른다: place 가 본문 변경 시각을 만들고(TG1) 내부 조회로 내준다(TG2) → search:batch 가 그 시각과 짝을 색인에 싣는다(TG3) → SSR·FE 가 짝으로 hreflang 을 낸다(TG4) → RSS 가 색인 시각으로 줄 세운다(TG5) → IndexNow 가 place 내부 조회로 제출한다(TG6). ADR·대장 문서(TG7), 회귀 주입·배포·운영 확인(TG8)이 마지막이다.

**Flyway 번호**: 이 워크트리(`place-stage2`)와 `origin/main` 의 place 마이그레이션 최신은 `V33__attraction_short_link_click.sql`(`place/feature/src/main/resources/placedb/migration/`) → 새 파일은 **`V34`**. 메인 트리 로컬 `main` 은 다른 계열(`V20__attraction_short_link_click.sql` 추적 + `V17`~`V19` 미추적)이라 번호가 어긋나 있다 — 이 작업은 메인 트리를 건드리지 않는다. **커밋 직전에 `git fetch && git ls-tree --name-only origin/main place/feature/src/main/resources/placedb/migration/ | sort -V | tail -2` 로 V34 가 아직 비어 있는지 다시 본다** — 다른 세션이 V34 를 먼저 푸시했으면 번호를 올리고 spec·ADR 초안의 「V34」 표기도 함께 고친다(커밋한 마이그레이션은 이미 운영에 적용됐을 수 있어 남의 V34 를 고치지 않는다).

---

### Task Group 1: place 본문 변경 시각 (SR-2.1 · SR-2.2 · SR-2.3 · SR-2.4 place 쪽)
**Dependencies:** None · **Phase:** place:domain · place:feature(영속·응답 DTO) · **Required Skills:** Kotlin, JPA, Flyway, Kotest BehaviorSpec
- [x] 1.1 테스트 먼저
  - 새 `place/domain/src/test/kotlin/com/kgd/place/domain/attraction/model/AttractionContentHashTest.kt`: 같은 본문 → 같은 해시 · 공백·태그만 다름 → 같음 · 유니코드 공백(U+00A0·U+3000) 연속 → 같음 · 요금(`useFee`) 변경 → 다름 · 행사 날짜만 변경 → 다름 · `introRaw` 변경 → 다름 · null 과 빈 문자열 → 같음 · 저장값이 `v1:` + 64자 hex · `HASH_FIELDS` 순서가 spec 목록과 같음
  - `AttractionSyncFromTest.kt` 증보(SR-2.3 표 다섯 행 각각 given/then): 새 행(`stampNew(now)`) → 해시 계산·시각 `now` · 이전 해시 null → 시각 = `sourceModifiedAt`(그것도 null 이면 null) · 이전 접두 `v0:` → 해시 재계산·시각 그대로(null 이면 `sourceModifiedAt`) · 같은 해시 → 둘 다 그대로 · 다른 해시 → 새 해시·`now`
  - 같은 파일: **개요 없는 목록 레코드가 들어와도 해시·시각 그대로**(병합이 기존 overview 를 지키는 경로) · source 에 `contentHash`·`contentUpdatedAt` 를 넣어 보내도 무시 · 해시는 **병합 뒤 자기 필드**로 계산(source 값이 아니라 병합 결과가 바뀔 때만 `now`)
  - `place/feature/src/test/kotlin/com/kgd/place/infrastructure/persistence/attraction/entity/AttractionJpaEntityTest.kt`: 두 열 왕복(도메인 → 엔티티 → 도메인)
  - `place/feature/src/test/kotlin/com/kgd/place/infrastructure/persistence/attraction/adapter/AttractionRepositoryAdapterTest.kt`: `existing == null` 경로가 `stampNew(now)` 를 거쳐 저장 · 기존 행 경로가 `syncFrom(source, now)` 에 어댑터 `now`(Asia/Seoul) 를 넘김
  - `place/feature/src/test/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtoRoundTripTest.kt`: 응답에 `contentUpdatedAt` · 요청(`UpsertAttractionItem`)에는 두 필드가 없음
- [x] 1.2 `place/domain/.../domain/attraction/model/AttractionContentHash.kt` — `object`, 상수 `HASH_FIELDS`(spec SR-2.2 순서 그대로), `VERSION = "v1"`, 필드별 정규화(null → "" · `<[^>]*>` 제거 · `\s` 와 유니코드 공백 연속 → 공백 하나 · trim · 날짜 ISO) → `필드명=값` 을 `\u001F` 로 이어 SHA-256 hex → `"v1:" + hex`. KDoc: search `sourceText` 와 일치를 요구하지 않는다(자기 이전 값과만 비교), 규칙을 바꾸면 접두를 올린다
- [x] 1.3 `Attraction.kt`: `contentHash: String?` · `contentUpdatedAt: LocalDateTime?` 필드 + `stampNew(now)` + `syncFrom(source, now)` 마지막 단계에서 SR-2.3 표 적용(`:325-407`). source 의 두 필드는 읽지 않는다. 호출부 시그니처 변경을 같은 커밋에서 전부 따라간다
- [x] 1.4 Flyway `place/feature/src/main/resources/placedb/migration/V34__attraction_content_hash.sql` — `ALTER TABLE attractions ADD COLUMN content_hash VARCHAR(80) NULL, ADD COLUMN content_updated_at DATETIME(6) NULL` + `CREATE INDEX idx_attractions_content_updated ON attractions (content_updated_at, id)`. 백필 없음(다음 동기화가 첫 채움 규칙으로 채운다)
- [x] 1.5 `AttractionJpaEntity.kt`(`:20-25,134-156,172`) 두 열 매핑 + 변환. `AttractionRepositoryAdapter.kt`(`:24-46`) — `existing == null` 이면 `stampNew(now)`, 아니면 `syncFrom(source, now)`, `now = LocalDateTime.now(ZoneId.of("Asia/Seoul"))`
- [x] 1.6 응답: `AttractionDtos.kt` 목록·단건 응답에 `contentUpdatedAt`(`sourceModifiedAt` 옆, `:187`·`:241` 근처). 요청 DTO 에는 넣지 않는다
- [x] 1.7 Verify:
  - `./gradlew :place:domain:test --tests '*AttractionContentHashTest' --tests '*AttractionSyncFromTest' --rerun`
  - `./gradlew :place:feature:test --tests '*AttractionJpaEntityTest' --tests '*AttractionRepositoryAdapterTest' --tests '*AttractionDtoRoundTripTest' --rerun`
  - `git diff --cached --name-only | grep -c 'V34__'` → 1 (커밋 직전, 위 Flyway 번호 재확인 포함)

### Task Group 2: place 변경 목록 내부 조회 (SR-4.3)
**Dependencies:** TG1 · **Phase:** place:feature application·infrastructure·presentation · **Required Skills:** Kotlin, Spring MVC, Querydsl/JPA, MockK
- [ ] 2.1 테스트 먼저
  - 새 `place/feature/src/test/kotlin/com/kgd/place/application/attraction/service/AttractionContentUpdatedServiceTest.kt`(MockK 포트): 포트에 `since·until·afterId·size` 를 그대로 넘김 · 결과가 `size` 와 같으면 `nextAfterId` = 마지막 id, 작으면 null · `size` 상한(예: 1000) 넘는 요청은 상한으로 · `since ≥ until` → 빈 결과
  - `AttractionRepositoryAdapterTest.kt` 증보: `findContentUpdated` 범위 — `since` 포함 · `until` 제외 · `content_updated_at` null 제외 · ACTIVE 만 · `id > afterId` · id 오름차순 · `size` 개
  - 새 `place/feature/src/test/kotlin/com/kgd/place/presentation/attraction/controller/AttractionContentUpdatedInternalControllerTest.kt`(슬라이스, `AttractionExtrasInternalControllerTest` 방식): `GET /internal/attractions/content-updated?since=&until=&afterId=&size=` → `{items:[{id,lang}], nextAfterId}` · 파라미터 누락·형식 오류 → 400
- [ ] 2.2 `place/feature/.../application/attraction/usecase/FindContentUpdatedAttractionsUseCase.kt`(인터페이스 + Query/Result 모델) · `AttractionRepositoryPort.findContentUpdated(since, until, afterId, size)` · 구현 `AttractionContentUpdatedService`(UseCase 당 서비스 — `AttractionExtrasService` 선례)
- [ ] 2.3 어댑터 질의 — 인덱스 `(content_updated_at, id)` 를 타는 모양(`content_updated_at >= ? AND content_updated_at < ? AND id > ? AND status = 'ACTIVE' ORDER BY id LIMIT ?`). 범위 안에서 id 키셋이므로 정렬은 id
- [ ] 2.4 컨트롤러 `AttractionContentUpdatedInternalController`(`/internal/attractions/content-updated`, 게이트웨이 비경유 — `AttractionExtrasInternalController` 와 같은 `/internal/attractions/**`). 날짜 파라미터는 ISO `LocalDateTime`(KST)
- [ ] 2.5 Verify: `./gradlew :place:feature:test --tests '*AttractionContentUpdatedServiceTest' --tests '*AttractionRepositoryAdapterTest' --tests '*AttractionContentUpdatedInternalControllerTest' --rerun`

### Task Group 3: 색인 — 언어 대체 짝 계산·스위치 + `contentUpdatedAt` (SR-1.1~1.6 · SR-1.8 · SR-2.4 search 쪽)
**Dependencies:** TG1(place 응답 필드) · **Phase:** search:domain · search:batch · search:app 읽기 경로 · portal-fe 타입 · k8s CronJob env · **Required Skills:** Kotlin, Spring Batch, OpenSearch 매핑, Kotest, TS
- [ ] 3.1 테스트 먼저
  - 오라클 픽스처 `search/domain/src/test/resources/attraction/alternate-pairs-oracle.json`: `docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-8-review-pages.json` 에서 57개 문서의 `id·lang·contentTypeId·googlePlaceId·latitude·longitude·title(국문)·titleLocal(영문)` + 30쌍 `expected`(pair|none, 부록 A). `hasOverview` 는 전부 true. 뽑은 스크립트는 스크래치패드에서 돌리고 레포에 두지 않는다
  - 새 `search/domain/src/test/kotlin/com/kgd/search/domain/attraction/model/AlternateLanguagePairerTest.kt`: **57개 전체를 한 번에** `pair()` → 30쌍 각각 `expected` 와 같음(짝 16·없음 14) · 결과 맵이 양방향 · 조건 ① 실패(오라클 #27 + 합성: 한쪽 placeId 빈 값) · ② 합성 51m → 없음, 50m → 짝 · ③ 국 12 ↔ 영 76 → 짝, 국 12 ↔ 영 75 → 없음, 국 25·행사 15/85 → 없음, 표에 없는 코드 → 없음 · ④ NFKC·공백·대소문자만 다른 제목 → 짝, 다른 제목 → 없음, `titleLocal` 없음 → 없음 · **합성** 일대다(국문 둘이 ①~④ 모두 만족 → 둘 다 없음) · 한쪽 `hasOverview=false` → 없음 · 통계(edges·uniqueness·overview 탈락 수)
  - 새 `search/domain/src/test/kotlin/com/kgd/search/domain/attraction/model/ContentTypeLangTest.kt`: 대응표 값이 spec SR-1.2 표와 같음(테스트도 이 상수를 쓴다 — `sync_tour.py:47-58` 과 수치 대조 한 줄 주석)
  - `search/batch/src/test/kotlin/com/kgd/search/client/PlaceApiClientTest.kt`: `contentUpdatedAt` 역직렬화(손 매핑 `fetchPageAfter` 경유 — 데이터 클래스에만 넣으면 null 색인)
  - `search/batch/src/test/kotlin/com/kgd/search/job/AttractionApiReindexTaskletTest.kt`(`samePlace` 단언 옆): 짝 두 문서 → 서로의 `alternateId` · 짝 아닌 문서 null · **스위치 꺼짐 → 모든 문서 `alternateId` null 이고 로그 N 은 켜짐과 같음** · 로그 한 줄 `Alternate pairs: N (edges E, dropped by uniqueness U, dropped by overview O, enabled=…)` · `contentUpdatedAt` 가 문서에 그대로
  - `search/batch/src/test/kotlin/com/kgd/search/infrastructure/indexing/AttractionsIndexMappingTest.kt`: `alternateId` keyword(doc_values 유지) · `contentUpdatedAt` date(doc_values 유지)
  - `search/app/src/test/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocumentTest.kt`: 두 필드 `toDomain()` 왕복
  - `search/app/src/test/kotlin/com/kgd/search/application/attraction/service/SearchAttractionServiceTest.kt`: API 결과에 `alternateId`·`contentUpdatedAt`
  - `search/app/src/test/kotlin/com/kgd/search/infrastructure/opensearch/AttractionReindexCaptureTest.kt`: 캡처(`reindex-capture.json`)에 두 필드가 실리고 읽기 문서까지 남음
- [ ] 3.2 search:domain `ContentTypeLang`(언어 중립 유형 ↔ 국·영 코드, 행사·코스 제외 표시) + `AlternateLanguagePairer.pair(projections): Map<String, String>` + 통계 반환 — `SamePlace.kt` 와 같은 패키지, `SamePlaceGrouper` 는 건드리지 않는다. 거리는 `RegionAggregator.distanceMeters`, 제목은 `Normalizer.normalize(NFKC)` → `\s`·유니코드 공백 제거 → `lowercase(Locale.ROOT)`
- [ ] 3.3 batch: `PlaceApiClient.AttractionDto` + `fetchPageAfter` 손 매핑(`:163`)에 `contentUpdatedAt`. `RegionProjection` 에 `googlePlaceId`·`titleLocal`·`hasOverview`
- [ ] 3.4 batch 태스클릿 `AttractionApiReindexTasklet.kt`: 1차 패스 `collectRegionPlacements`(`:391-418`)가 `pair()` 호출 → 로그 한 줄 → 2차 패스(`:450-464`)가 문서에 `alternateId`(스위치 꺼짐이면 null). 설정 `search.alternate-pairs.enabled`(기본 false, `@ConfigurationProperties` 또는 `@Value` — 같은 모듈의 기존 설정 방식을 따른다)
- [ ] 3.5 문서·매핑: batch `AttractionIndexDocument`, `search/batch/src/main/resources/opensearch/attractions-index.json` 두 필드
- [ ] 3.6 읽기 경로: app `AttractionSearchDocument`(필드 + `toDomain`) · 도메인 모델 · `SearchAttractionUseCase` 결과 · `SearchAttractionService` 매핑
- [ ] 3.7 루트 `build.gradle.kts` `searchReadRequired`(`:538`)에 `alternateId`·`contentUpdatedAt`
- [ ] 3.8 FE 타입: `portal-fe/src/api/placeApi.ts` `Attraction` 에 `alternateId?: string | null`·`contentUpdatedAt?: string | null`. `portal-fe/scripts/prerender-seo.mjs` `indexDoc` 투영에 `alternateId`
- [ ] 3.9 `k8s/base/search-batch/cronjob-attraction-reindex.yaml` env(`:54` 블록)에 `SEARCH_ALTERNATE_PAIRS_ENABLED: "false"`
- [ ] 3.10 Verify:
  - `./gradlew :search:domain:test --tests '*AlternateLanguagePairerTest' --tests '*ContentTypeLangTest' --rerun`
  - `./gradlew :search:batch:test --tests '*PlaceApiClientTest' --tests '*AttractionApiReindexTaskletTest' --tests '*AttractionsIndexMappingTest' --rerun`
  - `./gradlew :search:app:test --tests '*AttractionSearchDocumentTest' --tests '*SearchAttractionServiceTest' --tests '*AttractionReindexCaptureTest' --rerun`
  - `./gradlew verifySearchIndexContract`
  - `git diff --stat search/app/src/test/resources/attraction/reindex-capture.json` (같은 커밋에 재생성분)
  - `grep -n 'SEARCH_ALTERNATE_PAIRS_ENABLED' -A1 k8s/base/search-batch/cronjob-attraction-reindex.yaml` → `"false"`
  - `cd portal-fe && npx tsc -b`

### Task Group 4: hreflang 표시 — 헬퍼·SSR·하이드레이션·sitemap (SR-1.7)
**Dependencies:** TG3(문서 `alternateId`) · **Phase:** portal-fe `copy.mjs`·`AttractionPage.tsx`·`prerender-seo.mjs`, search:app `AttractionPageRenderer` · **Required Skills:** TS/ESM, vitest, Kotlin, HTML
- [ ] 4.1 테스트 먼저
  - `portal-fe/src/seo/__tests__/placeCopy.test.ts` 증보: `attractionHreflangAlternates('ko', 'K', 'E')` → `[ko /attractions/K, en /en/attractions/E, x-default = en]` · `('en', 'E', 'K')` → 같은 세 줄(docLang 기준) · 순서 고정
  - 새 `portal-fe/src/seo/__tests__/attractionHreflangGolden.test.ts`: 케이스(국문 문서·영문 문서) 출력을 `search/app/src/test/resources/render/attraction-hreflang-golden.json` 으로 쓴다(`footerLinksGolden.test.ts` 방식)
  - `portal-fe/src/pages/place/__tests__/AttractionPage.test.tsx`: `alternateId` 있음·noindex 아님 → `useSeo` 입력에 alternates · `alternateId` null → alternates 키 없음 · 개요 없음(noindex) → 없음
  - `portal-fe/src/seo/__tests__/prerenderPlace.test.ts`: `placeDetailSitemapEntries` — 상대 항목이 있으면 alternates · `alternateId` 는 있으나 상대 언어 항목 집합에 없음 → alternates 없음 · `alternateId` 없음 → 없음
  - 새 `search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionHreflangParityTest.kt`: 골든 JSON 의 입력 → 렌더 → `<link rel="alternate" hreflang>` 세 줄 추출 → 출력과 비교(`AttractionJsonLdParityTest` 선례)
  - `AttractionPageRendererTest.kt` 증보: 짝·자기 noindex 아님 → 세 줄 + `data-seo-multi` · 짝 없음 → 0줄 · 짝이지만 noindex → 0줄 · `/en/attractions/{국문id}` 요청 → docLang 기준 ko·en
- [ ] 4.2 `copy.mjs`: `attractionHreflangAlternates(docLang, id, alternateId)` — `placeHreflangAlternates`(`:541-547`) 와 같은 규칙(x-default = en)
- [ ] 4.3 `AttractionPageRenderer.kt`(`:50-70`): `alternateId != null && !noindex` 일 때만 세 줄, `data-seo-multi` 속성. 주석 `:65`·`:117` 교체(SR-1.7 문구)
- [ ] 4.4 `AttractionPage.tsx`(`:150-173`): 같은 조건으로 `useSeo({ alternates })`, 아니면 키를 넘기지 않음. 주석 `:171-173` 교체
- [ ] 4.5 `prerender-seo.mjs` `placeDetailSitemapEntries`(`:816-826`): 상대 언어 항목 집합에 있을 때만 `alternates`. 주석 `:707-708` 교체
- [ ] 4.6 CI: `.github/workflows/ci.yml` vitest 뒤 「Attraction hreflang golden fixture is current」 단계(기존 골든 단계와 같은 모양 — `git diff --exit-code` + `git status --porcelain`)
- [ ] 4.7 Verify:
  - `cd portal-fe && npx vitest run src/seo/__tests__/placeCopy.test.ts src/seo/__tests__/attractionHreflangGolden.test.ts src/seo/__tests__/prerenderPlace.test.ts src/pages/place/__tests__/AttractionPage.test.tsx && npx tsc -b`
  - `git status --porcelain search/app/src/test/resources/render/attraction-hreflang-golden.json` (생성 확인)
  - `./gradlew :search:app:test --tests '*AttractionHreflangParityTest' --tests '*AttractionPageRendererTest' --rerun`
  - `grep -rn 'hreflang 없음\|hreflang 을 걸지' search/app/src/main portal-fe/src/pages/place portal-fe/scripts/prerender-seo.mjs` → 0줄(옛 주석 잔존 없음)

### Task Group 5: RSS 피드 (SR-3)
**Dependencies:** TG3(색인 `contentUpdatedAt`) · TG4(`data-seo-multi` 출력 경로) · **Phase:** search:app render · portal-fe `nginx.conf`·`useSeo.ts`·`copy.mjs`·`prerender-seo.mjs` · **Required Skills:** Kotlin, RSS 2.0/XML, nginx, TS
- [ ] 5.1 테스트 먼저
  - 새 `search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionFeedRendererTest.kt`: `contentUpdatedAt desc, id asc` 정렬(같은 시각 → id 오름) · 50 상한 · 해당 언어만 · `contentUpdatedAt` null 제외(질의 조건) · 제목에 U+0001·U+FFFE 포함 → 제거된 유효 XML(JDK `DocumentBuilder` 로 파싱 통과) · `& < > " '` 이스케이프 · `pubDate` `+0900` RFC 1123 · `guid isPermaLink="true"` = 상세 canonical · `lastBuildDate` = 첫 항목 시각 · 0건 → 항목 없는 유효 channel · `language` ko/en
  - 새 `search/app/src/test/kotlin/com/kgd/search/presentation/render/controller/AttractionFeedControllerTest.kt`(`EventSitemapController` 테스트 방식): `/internal/render/feed/ko.xml`·`en.xml` 200 + `application/rss+xml` + `Cache-Control: public, max-age=600` · 조회 실패 → 503 + `no-store` · 모르는 언어 → 404
  - `AttractionPageRendererTest.kt` 증보: 상세 `<head>` 에 해당 언어 feed `<link rel="alternate" type="application/rss+xml" … data-seo-multi>`
  - 새 `portal-fe/src/seo/__tests__/useSeoFeeds.test.ts`: `useSeo({ feeds })` → MULTI 블록에 feed 링크, 재호출 시 지우고 다시 담(중복 없음)
  - `portal-fe/src/seo/__tests__/prerenderPlace.test.ts` 증보: 허브 국·영 프리렌더 `<head>` 에 해당 언어 feed 링크
  - 새 `portal-fe/scripts/check-nginx-place-feed.sh`(`check-nginx-events-sitemap.sh` 복제 방식, 실제 nginx 이미지 + 스텁): ① place 호스트 `/feed.xml`·`/en/feed.xml` → 스텁 고정 경로 · 200 · `Cache-Control` 한 벌 ② Cookie·Authorization 미전달 ③ apex·blog → 404·스텁 호출 없음 ④ 스텁 503 → 503(셸 200 아님)
- [ ] 5.2 search:app `infrastructure/render/AttractionFeedRenderer.kt`(텍스트 순서 `sourceText` → XML 금지 문자 제거 → 이스케이프 고정, 제목·요약 규칙은 `AttractionSeoText` 재사용) + 조회(언어·`contentUpdatedAt` exists·정렬·50) + `presentation/render/controller/AttractionFeedController.kt`. 서버 캐시 없음
- [ ] 5.3 `portal-fe/nginx.conf`: `location = /feed.xml`·`location = /en/feed.xml` — 행사 sitemap location(`:75-89`) 그대로(place 호스트 외 404, 고정 upstream 경로, 쿠키·인증 헤더 제거, `proxy_intercept_errors` 없음, 성공에만 캐시 헤더)
- [ ] 5.4 head 링크: `AttractionPageRenderer` 상세 + 허브 SSR(있으면) `data-seo-multi` · `useSeo.ts`(`:69-78`)에 `feeds` 입력(같은 MULTI 블록) · `copy.mjs` feed 제목·주소 헬퍼 하나 · `AttractionPage.tsx`·허브 페이지가 `feeds` 전달 · `prerender-seo.mjs` 허브(`:712`·`:1123` 근처) 같은 값
- [ ] 5.5 Verify:
  - `./gradlew :search:app:test --tests '*AttractionFeedRendererTest' --tests '*AttractionFeedControllerTest' --tests '*AttractionPageRendererTest' --rerun`
  - `cd portal-fe && npx vitest run src/seo/__tests__/useSeoFeeds.test.ts src/seo/__tests__/prerenderPlace.test.ts && npx tsc -b`
  - `bash portal-fe/scripts/check-nginx-place-feed.sh` (exit 2 = 도커 없음, 통과로 세지 않는다)
  - `bash portal-fe/scripts/check-nginx-events-sitemap.sh` (기존 계약 유지)

### Task Group 6: IndexNow — 키 파일·제출 잡 (SR-4)
**Dependencies:** TG2(내부 조회) · TG5(nginx.conf 같은 파일 — 충돌 회피 순서) · **Phase:** portal-fe 이미지(entrypoint·nginx include), place-ingest(Python), k8s CronJob·Deployment env · **Required Skills:** POSIX sh, nginx, Docker, Python/pytest, Kustomize
- [ ] 6.1 테스트 먼저
  - 새 `place/ingest/tests/indexnow_test.py`(`urlopen` 만 가짜): `INDEXNOW_ENABLED` 미설정·false → 요청 없음 + `IndexNow 비활성 — 보낼 주소 N건` · 켜짐 → 본문 `host·key·keyLocation·urlList`, URL 국 `/attractions/{id}`·영 `/en/attractions/{id}` · 10,001건 → 요청 2회(10,000 + 1) · 200·202 → 성공 기록 · 400·403(「키 불일치 — 키 파일 확인」)·422·429·500·타임아웃 → 코드별 문구 + exit 0 · 0건 → 요청 없이 `IndexNow 대상 0건` · 창 = `[실행 KST − 24h, 실행 KST)` 를 place 조회 파라미터로 · `nextAfterId` 따라 페이지 순회 · 로그 전체에 키 문자열·요청 본문 없음
  - 새 `portal-fe/scripts/check-nginx-indexnow.sh`(`check-nginx-events-sitemap.sh` 와 같은 방식, `nginx:1.27-alpine`): 레포의 실제 entrypoint 스크립트를 실행 권한째 `/docker-entrypoint.d/` 에 마운트, `-e INDEXNOW_KEY` 를 바꿔 가며 ① 미설정 → 기동·`/{임의hex}.txt` 가 키 본문 아님 ② `;` 포함 · 여러 줄(첫 줄 정상 키) · 끝 개행 포함 → 조각 없음·기동 ③ 정상 32자 hex → place 호스트 200·본문 = 키·`Cache-Control` 한 벌, apex·blog 404, `/.txt`·틀린 키 → 키 본문 아님. 도커 없으면 exit 2
- [ ] 6.2 `portal-fe/docker-entrypoint.d/15-indexnow-key.sh`(20-envsubst 앞 번호, 레포 파일 모드 100755 — `git update-index --chmod=+x`): `${#k} -eq 32` + `case "$k" in *[!0-9a-f]*) 거부` 로만 검사(줄 단위 `grep` 금지), 통과 시 `/etc/nginx/conf.d/indexnow/indexnow.conf` 에 spec SR-4.2 조각, 아니면 경고 한 줄(키 값 미출력)
- [ ] 6.3 `portal-fe/Dockerfile`(`:76-80`): `COPY --chmod=0755 docker-entrypoint.d/15-indexnow-key.sh /docker-entrypoint.d/` + `mkdir -p /etc/nginx/conf.d/indexnow`. `nginx.conf` place server 블록에 `include /etc/nginx/conf.d/indexnow/*.conf;`. `NGINX_ENVSUBST_FILTER` 는 그대로
- [ ] 6.4 portal-fe Deployment env `INDEXNOW_KEY`(secretKeyRef `place-indexnow`/`key`, `optional: true`) — oci-arm·k3s-lite 가 같은 base 를 쓰는지 확인하고 base 한 곳에. Secret·SealedSecret 파일은 만들지 않는다
- [ ] 6.5 place-ingest: `place/ingest/src/indexnow.py`(제출 — 10,000건 분할, 타임아웃 30초, 코드별 문구) + `place_client.py`(`:33-105` 방식)에 `content_updated(since, until, after_id, size)` + `main.py` `--job=indexnow` 분기·모듈 독스트링 한 줄
- [ ] 6.6 `k8s/base/place-ingest/cronjob-indexnow.yaml`(`place-ingest-indexnow`, `schedule: "30 22 * * *"` UTC = KST 07:30, 다른 ingest CronJob 템플릿 복제) — env `INDEXNOW_ENABLED: "false"`, `INDEXNOW_KEY` secretKeyRef `optional: true` · `k8s/base/place-ingest/kustomization.yaml` 에 등록 · oci-arm overlay 에 이미지 매핑이 CronJob 별로 필요한지 확인(다른 place-ingest CronJob 과 같게)
- [ ] 6.7 `docs/architecture/data-sources.md` 「송신」 행(IndexNow — 공개 URL·공개 키, 개인정보 없음) · `k8s/base/network-policy/11-allow-egress-https-public.yaml` place-ingest 주석에 「+ IndexNow 송신(api.indexnow.org)」(정책 값 그대로)
- [ ] 6.8 Verify:
  - `cd place/ingest && python -m pytest tests/indexnow_test.py -q`
  - `bash portal-fe/scripts/check-nginx-indexnow.sh` (exit 2 = 도커 없음, 통과로 세지 않는다)
  - `git ls-files -s portal-fe/docker-entrypoint.d/15-indexnow-key.sh` → `100755`
  - `kubectl kustomize k8s/overlays/oci-arm | grep -n 'place-ingest-indexnow\|INDEXNOW_ENABLED\|optional: true'` (로컬 렌더만 — 클러스터 접근 없음)
  - `kubectl kustomize k8s/overlays/k3s-lite >/dev/null && echo ok`

### Task Group 7: ADR 개정·문서 동기화 (Q4 · SR-1.7 주석 문구 · SR-4.6)
**Dependencies:** TG1~TG6 · **Phase:** docs · **Required Skills:** 문서 작성(ADR-0026 분류)
- [ ] 7.1 `docs/adr/ADR-0062-seo-and-organic-discovery.md` §8 끝에 `context/adr-amendments-draft.md` 「개정 — 언어 대체 짝에만 hreflang (2026-10-09)」 블록(규칙·스위치 기본 꺼짐·켜기는 사용자). 원문 「hreflang 을 걸지 않는다」는 지우지 않는다
- [ ] 7.2 `docs/adr/ADR-0103-place-attraction-server-render-enrichment.md` 끝에 「개정 — 본문 변경 시각은 place 에 둔다: 결정 4 의 예외」 절. Flyway 번호가 V34 에서 바뀌었으면 여기도 맞춘다
- [ ] 7.3 서비스 문서: `place/CLAUDE.md`(두 열·내부 조회 `/internal/attractions/content-updated`·`--job=indexnow`), `search/CLAUDE.md`(`alternateId`·`contentUpdatedAt`·`search.alternate-pairs.enabled`·RSS 내부 경로) — 해당 절이 있는 곳에만 한두 줄. `place/ingest/README.md` 잡 목록에 indexnow
- [ ] 7.4 문서-소스 추적: `docs/standards/doc-index-tracking.md` 절차대로 `doc_map.py`/`doc_scan.py` 를 돌려 `docs/doc-index.json` 갱신분 확인
- [ ] 7.5 Verify:
  - `grep -n '언어 대체 짝에만 hreflang' docs/adr/ADR-0062-seo-and-organic-discovery.md` → 1줄
  - `grep -n '결정 4 의 예외' docs/adr/ADR-0103-place-attraction-server-render-enrichment.md` → 1줄
  - `grep -n 'IndexNow' docs/architecture/data-sources.md k8s/base/network-policy/11-allow-egress-https-public.yaml`
  - doc-index 검증 명령(`doc-index-tracking.md` 에 적힌 lock 검증) 통과

### Task Group 8: 회귀 주입 · 온톨로지 참조 · 배포 · 운영 확인 (SR-5.2 · SR-5.3 · SR-5.4 · 부록 B·C)
**Dependencies:** TG1~TG7 · **Phase:** 검증·배포 · **Required Skills:** Gradle, vitest, pytest, 도커, `ssh msa-oci`(읽기 확인만 — 로컬 kubectl 로 운영 접근 금지)
- [ ] 8.1 회귀 주입 — **워킹트리가 아니라 임시 사본**(`git worktree add` 또는 `cp -r` 를 스크래치패드에)에서 하나씩 주입 → 해당 테스트 빨강 확인 → 되돌림. 컴파일되는 회귀여야 한다(구문 오류 빨강은 증거 아님). 결과(주입·잡은 테스트·빨강 줄)를 `verifications/regression-injection.md` 에 남긴다
  - [ ] 대응표 무시(코드 문자열 비교) → `AlternateLanguagePairerTest`(#25 22453↔19751 이 없음으로)
  - [ ] 제목 조건 삭제 → 오라클(#16·#19 가 짝, #4·#15 가 일대일에서 빠짐)
  - [ ] 일대일 삭제 → 합성 일대다 사례
  - [ ] 좌표 조건 삭제 → 합성 51m 사례
  - [ ] 개요 조건 삭제 → 한쪽 개요 없음 사례
  - [ ] 짝 스위치 분기 삭제(꺼져도 `alternateId` 를 실음) → `AttractionApiReindexTaskletTest` 「꺼짐 → 모든 문서 null」
  - [ ] 해시 비교 삭제(항상 `now`) → `AttractionSyncFromTest` 같은 해시 행
  - [ ] 병합 전 source 로 해시 계산 → 개요 없는 목록 레코드 사례
  - [ ] 첫 채움 처리 삭제 → 이전 해시 null 행
  - [ ] 새 행 처리 삭제 → `stampNew` 행 / `AttractionRepositoryAdapterTest`
  - [ ] RSS 정렬 뒤집기 → `AttractionFeedRendererTest` 정렬
  - [ ] XML 금지 문자 제거 삭제 → 제어문자 제목 파싱 사례
  - [ ] IndexNow 꺼짐 분기 삭제 → `indexnow_test.py` 꺼짐 사례
  - [ ] `AttractionPage` alternates 전달 삭제 → `AttractionPage.test.tsx`
  - [ ] 키 형식 검사를 줄 단위 `grep` 으로 바꾸기 → `check-nginx-indexnow.sh` ②
- [ ] 8.2 온톨로지 참조 확인: `grep -nE 'hreflang|IndexNow|RSS|sitemap|lastmod' code-dictionary/feature/src/main/resources/ontology/*.yaml` — 걸린 개념의 설명·근거 경로가 이번 변경(상세 hreflang 조건부 허용·RSS·IndexNow)과 어긋나면 그 항목만 고친다. 0건이면 그 사실만 적는다
- [ ] 8.3 커밋 전 점검: Flyway 번호 재확인(Overview 의 `git ls-tree` 한 줄) · `git diff --cached` 에 핵심 라인(`V34__`·`AlternateLanguagePairer`·`SEARCH_ALTERNATE_PAIRS_ENABLED: "false"`·`INDEXNOW_ENABLED: "false"`·`include /etc/nginx/conf.d/indexnow/*.conf`) 존재 · 레포에 Secret·키 값 없음(`git grep -nE '[0-9a-f]{32}' -- portal-fe k8s/base/place-ingest` 결과가 키가 아님)
- [ ] 8.4 배포 순서(SR-5.3)
  - [ ] (사용자) OCI 에 Secret `place-indexnow` 생성 — `ssh msa-oci` 에서 `kubectl -n commerce create secret generic place-indexnow --from-literal=key=<32자 hex>`. 없어도 배포는 안전하다(키 파일만 없음)
  - [ ] place(V34·응답 필드·내부 조회) → search:batch·app → portal-fe → place-ingest CronJob 순으로 이미지·동기화 확인
  - [ ] Secret 을 portal-fe 배포 뒤에 만들었으면 `ssh msa-oci` 에서 `kubectl -n commerce rollout restart deploy/portal-fe`
- [ ] 8.5 배포 뒤 확인(SR-5.4, 스위치 꺼진 상태 — 운영 확인은 `ssh msa-oci` 와 공개 URL 로만)
  - [ ] Flyway: place 기동 로그에 V34 적용, `attractions` 두 열·인덱스 존재(`oci-mysql`)
  - [ ] `curl -s https://place.1989v.com/feed.xml`·`/en/feed.xml` 200 · 항목 ≤ 50 · `xmllint --noout` 통과 · apex·blog 호스트 `/feed.xml` 404
  - [ ] 재색인 로그 `Alternate pairs: N (… enabled=false)`, N ≥ 1 · 운영 응답 `alternateId` 전부 null · 상세 SSR·sitemap 상세 hreflang 0줄
  - [ ] 키 파일: `https://place.1989v.com/{key}.txt` 200·본문 = 키 · apex·blog 404 · `/.txt`·틀린 키 → 키 본문 아님(SPA 셸)
  - [ ] 다음 KST 07:30 ingest 로그 `IndexNow 비활성 — 보낼 주소 N건` (N = 창 안의 새 행 + 원천 수정일이 창 안인 첫 채움 행, 0 가능)
- [ ] 8.6 (사용자) 부록 C — 짝 스위치 켜기: ADR-0062 §8 개정 승인 → `SEARCH_ALTERNATE_PAIRS_ENABLED: "true"` 커밋 → 다음 KST 06:30 재색인 `enabled=true` → 표본 #2(en 2180 ↔ ko 5337)·#3(14206 ↔ 7935)·#9(13515 ↔ 5318) `alternateId`·양쪽 SSR 세 줄 · 반례 #19(en 1676·ko 160)·#24(ko 2477) 없음 · hreflang 오류 0(전제 `alternateId` 문서 ≥ 1, 전부 스크롤해 상대 존재·상호 참조·언어 다름·양쪽 overview 있음 위반 0) · 무작위 30쌍 수동 확인을 `docs/research/2026-10-07-tourism-growth/evidence/` 에. 범위 다름 1건이라도 → `"false"` + 재색인 + portal-fe 재빌드·배포
- [ ] 8.7 (사용자) 부록 B — IndexNow 켜기: 키 파일 200 확인 → `k8s/base/place-ingest/cronjob-indexnow.yaml` `INDEXNOW_ENABLED: "true"` 커밋 → 다음 KST 07:30 `IndexNow 제출 N건 — 200|202`(403 이면 키 파일·Secret 대조). 되돌리기는 `"false"`
- [ ] 8.8 Verify(이 그룹에서 새로 만든 증거만):
  - `test -s docs/specs/2026-10-09-place-hreflang-feed-indexnow/verifications/regression-injection.md && grep -c '빨강' docs/specs/2026-10-09-place-hreflang-feed-indexnow/verifications/regression-injection.md` → 15 이상
  - 배포 뒤: `curl -s https://place.1989v.com/feed.xml | xmllint --noout - && curl -s https://place.1989v.com/en/feed.xml | xmllint --noout -`
  - 배포 뒤: `curl -s -o /dev/null -w '%{http_code}' -H 'Host: 1989v.com' https://1989v.com/feed.xml` → 404
