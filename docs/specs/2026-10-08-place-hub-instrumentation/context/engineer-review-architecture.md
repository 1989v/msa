# Architecture Review — place 허브 최소 행동 계측

## 3라운드 (2026-10-08)

- 대상: `spec.md`(2라운드 개정본) + `planning/requirements.md` · `planning/test-quality.md`(2라운드 절) · `context/open-questions.yml`(Q4·Q8·Q12 갱신, Q13) · `context/review-verdict-round2.md`
- 코드 기준: 워크트리 `wt-impl` (origin/main `8a61f0b`)
- 기준 문서: 2라운드와 같음. 심판 §2 의 확정 5건(overlay 제거 · 선택률 view 전환+튜플 제한 · `POST_SELECTION_SECTIONS` in use case companion · PAGE 판별 합집합 · 가운데 클릭 미계측)은 재론하지 않는다.
- 지식베이스: 2라운드 인용 둘(`[[msa-unified-search-instrumentation-record]]` · `[[msa-place-ssr-enrichment-record]]`, 볼트 1989v raw)에서 새로 끌어올 것 없음 — 이번 라운드의 판정은 전부 스펙 문장 ↔ 코드 대조로 닫힌다.

### 2라운드 항목별 판정

| # | 2라운드 발견 | 판정 | 개정 스펙 근거 | 코드 대조 |
|---|---|---|---|---|
| B1 | PAGE 대상의 `sectionId` 생략이 공유 타입을 선택 필드로 풀게 한다 | **해소** | SR-6.1 「`TrackedItem` 을 판별 합집합으로 — `PlacedItem`(`sectionId` 필수) `\| PageItem`(`entityType: 'PAGE'`, `sectionId?: never`, `sectionIndex?: never`, `itemIndex?: never`)」, `TrackedEvent` 는 타입 별칭, SR-6.3 `sectionId ?? ''`, SR-1.3 「섹션은 없다(`PageItem`)」 | `events.ts:42-64` — 지금 `TrackedEvent extends TrackedItem`(`:60`)이라 유니온이 되면 별칭이 필요한데 스펙이 그걸 명시했다. `entityType: 'PAGE'` 리터럴 호출처 0건(grep)이라 기존 호출처가 깨지지 않는다. `useImpression.ts:22`·`TrackedLink.tsx:20` 은 `TrackedItem` 을 받으므로 시그니처 불변. 선례 `shopApi.ts:109-112`(`?: never`) 확인 |
| B2 | 집계표 `clicks`·`unique_clickers` 의 뜻 변경을 두 소비자가 알 길이 없다 | **해소** | Existing Code 문서 항목 「§6 에 『`clicks`·`unique_clickers` 는 목록 선택(카드·목록 핀·오버레이 핀)만 센다 — `POST_SELECTION_SECTIONS` 제외, 노출은 그대로』」 + SR-8.2 의 `AggregateAttractionPopularityUseCase` KDoc 한 줄 | ADR-0095 §6 `:106-127` 이 두 소비자(place-ingest `:111`, search-batch `:123-125`)를 이름으로 드는 자리라 개정 위치가 맞다. KDoc 자리는 `AggregateAttractionPopularityUseCase.kt:5-10` |
| B3 | `screen_ref` 지역 코드가 ADR-0095 `:63` 정의와 어긋난 채 남는다 | **해소** | Existing Code 문서 항목 「`:63` 에 『목록 화면은 비우되, 지역을 축으로 고른 목록(허브·지역 허브)은 그 지역 코드』」, Q8 에 `Placement.kt:13` 후속 | ADR-0095 `:63` 원문 「목록 화면이면 NULL」 확인. V005·common 주석은 Q8 (범위 밖, 이번 결정과 일치) |
| B4 | SR-5.4 가 중복 키의 효과를 절반만 적는다 | **해소** | SR-5.4 「찜 CLICK 은 (view, 관광지) 당 첫 토글 한 번만 남는다 — … 이후 토글(해제·재찜)은 `saved` 와 무관하게 중복 키에 걸려 가지 않는다 … 처음부터 찜된 채 들어와 「해제 → 찜」을 하면 그 view 의 찜 완료는 0」, SR-9.1 「`saved` 두 방향 케이스는 서로 다른 viewId 로」 + 통합 케이스 「해제→찜은 1건」 | `tracker.ts:23-25` 키에 payload 없음 — 스펙 문장이 이제 코드의 실제 효과를 말한다 |
| B5 | Q4 근거 「인기 집계가 비율을 쓴다」는 코드에 없다 | **해소** | `open-questions.yml` Q4 「인기 집계 소비자는 비율을 쓰지 않으므로(place-ingest 는 clicks·impressions 정렬, search 는 unique_clickers 만) 노출 없는 섹션(MAP_OVERLAY)이 있어도 집계는 깨지지 않는다」, requirements R1 카드 노출 항목 같은 문장, SR-3.2 「집계 소비자는 비율을 쓰지 않으므로 깨지지 않는다(Q4)」 | 2라운드 근거(`popularity.py:70`, `ClickHouseClickSignalReader.kt:38`, V007 `:6`) 그대로 |
| A2 잔여 | Goal 「상품 키워드 지표를 오염시키지 않는다」가 `unknown` 증가를 가린다 | **해소** | Goal 「허브 검색어가 상품 키워드 점수의 키로 들어가지 않는다(`unknown` 묶음이 느는 것은 Q7)」 | — |
| 메모 | 목록 핀 리스너(`:603`)가 viewId 를 클로저로 잡으면 마커를 다시 만든다 | **해소** | SR-3.1 「목록 핀 리스너(`:603`)는 viewId 를 ref 로 읽는다 — 마커 effect 가 viewId 마다 다시 돌지 않게」 | — |
| 주의① | 제외 상수의 이름·자리(`private val` 정정) | **해소** | SR-8.2 「application 의 `AggregateAttractionPopularityUseCase.companion` 에 `val POST_SELECTION_SECTIONS = setOf("MAP_LINK", "FAVORITE")`(`MAX_REAGGREGATE_DAYS` 옆. 선례 `CollectEventsUseCase.ANONYMOUS_VISITOR`)… 어댑터는 `INSERT_DAY` 를 `private val` 로 내리고」 | `AggregateAttractionPopularityUseCase.kt:22-25` companion 실존, 어댑터가 application 상수를 읽는 선례 `ClickHouseAttractionPopularityAdapter.kt:3,57` 그대로. 지금 `INSERT_DAY` 는 `private const val`(`:51`)이라 함수 호출 보간을 못 하므로 `private val` 전환이 맞다 |
| 주의② | SESSION_START 의 `screenRef` 는 마운트 시점에 빈 값 | **해소** | SR-1.3 「`screenRef` 는 빈 값이다 — 마운트 시점에는 시도가 없다」, SR-2.1 「SESSION_START 는 SR-1.3 대로 빈 값」, SR-9.1 단언값 `screenRef: ''` | — |

2라운드 항목 가운데 미해소는 없다.

### 체크리스트 재판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | PASS | 2라운드와 같음. `POST_SELECTION_SECTIONS` 는 application(규칙), SQL 보간은 adapter — ADR-0083 의 「규칙은 application, SQL 은 adapter」 |
| 상향 의존 없음 | PASS | 어댑터 → application 상수 읽기(기존 방향, `:3`). 새 import 방향 없음 |
| 외부 연동은 Port 경유 | PASS | 변동 없음 |
| 모듈 경계 변경의 근거 | PASS | B2 해소 — ADR-0095 §6 + KDoc 으로 집계표 값 정의 변경이 소비자 쪽 문서에 남는다 |
| 아키텍처 패턴 일관성 | PASS | B3 해소 — `screen_ref` 정의가 ADR `:63` 개정 목록에 들어가 데이터와 문서가 같은 말을 한다 |
| 순환 의존 없음 | PASS | 변동 없음 |
| 트랜잭션 경계 | N/A | 변동 없음 |
| 인터페이스 표면 최소 | PASS | B1 해소 — 판별 합집합이 목록 호출처의 `sectionId` 필수성을 유지한 채 PAGE 만 연다. `track`·`useImpression`·`TrackedLink` 시그니처 불변 |
| 얕은 pass-through 없음 | PASS | 새 모듈 없음 |
| 정보 은닉 | PASS | B4 해소 — 중복 키 효과를 스펙이 그대로 말한다 |
| Seam 현실성 | PASS | 새 인터페이스 없음 |
| 모듈 이름 | PASS | `POST_SELECTION_SECTIONS` 가 기준 문장 「선택 뒤 후속 행동」과 같은 말. glossary 등재는 Q10 |
| Deletion Test | N/A | 새 모듈 없음 |

### 새 발견

없다. 구현을 틀리게 만들 결함 후보 일곱을 코드로 대조했고 전부 기각했다 — 기록은 아래.

| 후보 | 대조 결과 |
|---|---|
| SR-10 `save_rate` 의 (view_id, entity_id) 조인이 성립하려면 찜 CLICK 의 `entity_id`(`targetKey`)와 카드 CLICK 의 `entity_id`(관광지 id)가 같아야 한다 | `PlacePage.tsx:1304,1368`·`AttractionPage.tsx:386` 전부 `targetKey={attraction.id}` — 같은 값. 조인 성립 |
| SR-7.1 `@Size(max = 128)` 이 실제로 검증되려면 본문에 `@Valid` 가 있어야 한다 | `EventCollectController.kt:38` `@Valid @RequestBody` 이미 있음. DTO 에 `@field:Size` 선례(`EventCollectDtos.kt:21-22`) 그대로 |
| 판별 합집합이 기존 호출처를 깨는가 | `entityType: 'PAGE'` 리터럴 호출처 0건. `PlacedItem.entityType` 은 「지금 모양」(`EntityType` 전체)이라 변수형 entityType 을 넘기는 통합 검색도 그대로 통과 |
| `TrackedEvent extends TrackedItem`(`events.ts:60`)은 유니온을 상속할 수 없다 | SR-6.1 이 「`TrackedEvent` 는 … 타입 별칭이 된다」로 명시 — 구현이 막히지 않는다 |
| SR-4.2 「`TrackedLink` 를 쓰지 않고 `onClick` 에서 `track` 만」의 전제는 상세 지도 링크가 평범한 `<a>` 라는 것 | `AttractionPage.tsx:507-514` 평범한 `<a target="_blank">`. 허브 패널 `PlacePage.tsx:1317-1324` 도 같다 |
| SR-9.2 standalone advice 선례가 analytics 에서도 쓰이는가 | `GlobalExceptionHandler` 는 `common/.../exception/GlobalExceptionHandler.kt:16`, 선례 `AttractionSearchControllerTest.kt:21-22` `.setControllerAdvice(com.kgd.common.exception.GlobalExceptionHandler())`. analytics 는 common 을 의존하므로 그대로 쓴다 |
| SR-9.1 의 `resetIdentityForTest()` 가 실존하는가 | `identity.ts:64` export 확인 |

### 메모 (이슈 아님)

- `PlacedItem.entityType` 이 `EntityType` 전체라 `{ entityType: 'PAGE', sectionId: 'X' }` 도 `PlacedItem` 으로 통과한다. 페이지 대상에 섹션을 붙이는 것은 ADR-0095 §2 와 모순이 아니고, `Exclude<EntityType, 'PAGE'>` 로 좁히면 변수형 entityType 호출처가 깨지므로 스펙대로 「지금 모양」이 맞다.
- SR-8.2 의 `setOf("MAP_LINK", "FAVORITE")` 는 `LinkedHashSet` 이라 `joinToString` 이 삽입 순서를 지킨다 — 리터럴 기대값 `('MAP_LINK', 'FAVORITE')` 과 순서가 일치한다. 상수 순서를 바꾸면 테스트가 빨간불이 되는 것이 의도된 결합이다.
- SR-5.2 「`onSuccess` 는 훅 안에」 — `useMutation` 옵션 콜백은 Mutation 객체에 묶여 언마운트 뒤에도 불리고 `mutate()` 호출별 콜백만 생략된다(TanStack Query v5 문서 기준). 구현 시 호출별 콜백으로 옮기지 않는다.

### 판정

2라운드 항목 9건(B1~B5 · A2 잔여 · 메모 · 주의 ①②) 전부 해소. 새 결함 없음. Clean Architecture·교차 서비스 import·`common` 변경 위반 없음.

---

## 2라운드 (2026-10-08)

- 대상: `spec.md`(개정본) + `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml`(Q11·Q12 추가)
- 코드 기준: 워크트리 `wt-impl` (origin/main `8a61f0b`)
- 기준 문서: 1라운드와 같음 + `docs/adr/ADR-0095` §2·§3·§6, `AggregateAttractionPopularityUseCase.kt`(집계표 소비자 명세)
- 지식베이스: `[[msa-unified-search-instrumentation-record]]` (볼트 1989v raw, updated 2026-09-20) — 「저장된 행 수로 판정」·헤드리스 UA 202/0·payload null 400 → SR-7.3·SR-9.4 반영 확인. `[[msa-place-ssr-enrichment-record]]` (볼트 1989v raw, 2026-09-29~10-02) — 클릭 신호(`uniqMerge(unique_clickers)` 14일 창)는 `clickBoost` **꺼짐**, 켜는 조건은 T16 nDCG 판정. 이 둘이 B2 의 「집계표 소비자가 둘」 판단의 근거다. 개념 페이지(`wiki/concepts`)에는 이벤트 원장·노출/클릭 항목이 없다(`index.md` 조회 기준).

### Seed Discovery 요약

| 단계 | 본 것 |
|---|---|
| 스펙 | SR-1~SR-10, Goal, Out of Scope, Open Questions(Q7~Q12) |
| 폴더 | requirements R1~R3(1라운드 전 문안이 남아 있음 — `sectionId:'ATTRACTION_LIST'` 세션 시작·`payload.keyword`), test-quality 「리뷰 1라운드 반영」표, open-questions Q11(심판 결정) |
| 표준 | ADR-0095 §2(`:59-76`) §3(`:78-84`) §6(`:106-127`) FE 노출 감지(`:135-146`), ADR-0083 레이어, V005 `:25,:31`, V006 `:1-8`, V007 `:1-6` |
| 코드 | `tracker.ts:20-40,63-70`, `events.ts:13,23-58`, `identity.ts:22-48`, `useImpression.ts:21-25`, `TrackedLink.tsx:25-26`, `useFavorites.ts:28-48`, `FavoriteButton.tsx:53-78`, `PlacePage.tsx:278-335,449-469,583-603,684-730,837-877,1200-1202,1304-1324,1344-1368`, `AttractionPage.tsx:216-223,498-514,558-629`, `NearbyExplore.tsx:240-293`, `exploreItems.ts:51-97`, `RegionPage.tsx:271-284`, `EventCollectController.kt:37-56`, `EventCollectDtos.kt:31-83`, `CollectEventsUseCase.kt:17-20`, `AggregateAttractionPopularityUseCase.kt:5-26`, `ClickHouseAttractionPopularityAdapter.kt:3,51-62`, `AnalyticsStreamTopology.kt:123-131`, `KeywordMetrics.kt:12-22`, `VisitorIdFilter.kt:27-35`, `gateway/application.yml:37-41`, `ClickHouseClickSignalReader.kt:7-43`, `place/ingest/src/popularity.py:59-71`, `WeakJudgmentGenerator.kt:43-61`, `AdEventService.kt:220-240` |

### 1라운드 발견 판정

| # | 1라운드 발견 | 판정 | 근거 |
|---|---|---|---|
| A1 | viewId 재생성 단위가 모바일 누적 목록에서 노출↔클릭 조인을 끊는다 | **해소**(선택지 2) | SR-1.1 이 `page` 포함 유지 + 모바일 트레이드오프를 명시하고, SR-10 이 view 단위 CTR 을 쓰지 않으며 `trigger='page'` SEARCH 를 분모에서 뺀다. 데스크톱(`PlacePage.tsx:1207-1222` 페이지 교체)은 ADR-0095 §3 그대로, 일 집계는 view 와 무관(`ClickHouseAttractionPopularityAdapter.kt:59-61` entity·day 그룹). 더 요구할 것 없음 |
| A2 | `payload.keyword: '*'` — 생산자가 소비자 그룹 키에 맞춘다 | **해소** | SR-2.2 가 필드명을 `term` 으로 바꿔 `keyword` 를 보내지 않고, Q7 이 토폴로지 수정을 post-impl 로 기록. 잔여: 허브 SEARCH 행은 여전히 키워드 브랜치를 통과해 `unknown` 키의 `searchCount` 를 올린다(`AnalyticsStreamTopology.kt:126,131`, `KeywordMetrics.kt:14`) — 1라운드가 받아들인 「센티널 하나」 결과다. Goal 의 「상품 키워드 지표를 오염시키지 않는다」는 「허브 검색어가 키워드 점수의 키로 들어가지 않는다(`unknown` 묶음 증가는 Q7)」로 좁히는 편이 정확하다. 문구 수준이라 이슈로 세지 않는다 |
| A3 | 섹션 리터럴이 FE 와 analytics SQL 에 따로 산다 | **해소** | SR-6.1 상호 참조 주석, SR-8.2 이름 있는 상수 `NON_LIST_SECTIONS` + 상수로 만든 SQL 대조, SR-4.2·SR-5.3 「IMPRESSION 금지·`TrackedLink` 금지」. 1라운드가 적은 `private val` 은 SR-8.2 의 테스트 접근과 모순이므로 정정한다 → 「구현 시 주의」 |
| A4 | 오버레이 핀을 `ATTRACTION_LIST` 로 적으면 섹션이 거짓말한다 | **해소** | SR-3.2 `MAP_OVERLAY`(`source: map`, `itemIndex` 없음), SR-6.1 유니온 추가, SR-10 「결과 선택」이 두 섹션을 함께 센다. 근거 문구 문제는 B5 |
| A5 | 본문 `visitorId` 는 도달 불가 | **해소** | SR-7.1 「본문 `visitorId` 는 받지 않는다」, DTO 는 `sessionId` 만. 비콘 본문이 지금도 `visitorId` 를 싣지만(`tracker.ts:65-69`) analytics·common 에 `FAIL_ON_UNKNOWN_PROPERTIES` 를 켜는 설정이 없어(grep 0건) 무시된다 — 400 유실 경로가 아니다 |

1라운드 발견 가운데 미해소·새 문제로 번진 것은 없다.

### 체크리스트 재판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | PASS | SR-7 은 `presentation/event`(식별자 결정 `EventCollectController.kt:48-50`, DTO `EventCollectDtos.kt:20-29`), SR-8 은 `infrastructure/popularity` SQL 상수(`:51-62`). application·domain 변경 없음. `NON_LIST_SECTIONS` 의 자리는 아래 「구현 시 주의」 |
| 상향 의존 없음 | PASS | 새 import 방향 없음. 어댑터→application 상수 읽기(`ClickHouseAttractionPopularityAdapter.kt:3,57`)는 기존 허용 방향 |
| 외부 연동은 Port 경유 | PASS | `AttractionPopularityPort`·`EventPublisherPort` 그대로. 새 외부 연동 없음 |
| 모듈 경계 변경의 근거 | REVISE(경미) | FE↔analytics 섹션 계약은 SR-6.1/SR-8.2 로 근거가 생겼다. 그러나 **집계표의 두 소비자**(place-ingest·search-batch)에게 `clicks`·`unique_clickers` 의 뜻이 바뀐 사실을 알리는 문서가 없다 → B2 |
| 아키텍처 패턴 일관성 | REVISE(경미) | ADR-0095 §2 의 `screen_ref` 정의(「목록 화면이면 NULL」)와 SR-2.1 이 어긋난다 → B3. 두 축·계층·view_id 는 지켰다 |
| 순환 의존 없음 | PASS | 1라운드와 같음. `components/favorite` → `analytics/*`(leaf) |
| 트랜잭션 경계 | N/A | 1라운드와 같음 |
| 인터페이스 표면 최소 | REVISE(경미) | SR-1.3 「섹션은 비운다」가 **공유 타입** `TrackedItem.sectionId` 를 선택 필드로 풀게 만든다 → B1 |
| 얕은 pass-through 없음 | PASS | 새 모듈 없음 |
| 정보 은닉 | PASS | SR-5.1 「`saved` 는 요청 종류로 정하고 캐시를 다시 읽지 않는다」가 1라운드 지적(`useFavorites.ts:33-47` onSettled invalidate 뒤 반전)을 닫았다. 중복 키 문구는 B4 |
| Seam 현실성 | PASS | 새 인터페이스 없음 |
| 모듈 이름 | PASS | `MAP_OVERLAY`·`MAP_LINK`·`FAVORITE`·`place-hub` 는 `events.ts` 어휘와 같은 꼴. glossary 등재는 Q10 |
| Deletion Test | N/A | 새 모듈 없음. SR-2.3 이 diff 역추론을 버리고 ref 소비로 바꿔 1라운드의 「순수 함수 분리」권고도 필요 없어졌다 |

### 새 발견 (전부 경미 — 스펙 문장으로 닫힌다)

#### B1. SR-1.3 이 공유 타입 `TrackedItem.sectionId` 를 선택 필드로 풀게 한다 (REVISE, 경미)

- 스펙: SR-1.3 「섹션은 비운다(PAGE 대상은 `sectionId` 생략 허용)」, SR-6.3 「(sectionId 가 없으면 빈 값)」. SR-6 에는 타입 변경 항목이 없다.
- 코드: `events.ts:48` `sectionId: SectionId` 는 **필수**다. `TrackedLink.tsx:20`·`useImpression.ts:22` 가 같은 타입을 받는다. 생략을 허용하려면 `sectionId?: SectionId` 로 풀어야 하고, 그러면 목록 카드·링크 호출처 전부가 섹션을 빠뜨려도 컴파일이 통과한다.
- 왜 문제인가: SR-8 은 **거부 목록**(`NON_LIST_SECTIONS`)이다. 섹션이 빈 ATTRACTION CLICK 은 제외되지 않고 인기 집계에 **들어간다**(`ClickHouseAttractionPopularityAdapter.kt:55-57` 에 `NOT IN` 을 더하는 구조). 타입이 막던 실수가 집계 오염으로 바뀐다.
- 수정안(택1, SR-6 에 한 줄): ① `TrackedItem` 을 판별 합집합으로 — `PlacedItem`(지금 모양, `sectionId` 필수) `| PageItem`(`entityType: 'PAGE'`, `sectionId?: never`, `itemIndex`·`sectionIndex` 없음). `track` 시그니처는 그대로. ② 공유 타입은 건드리지 않고 SESSION_START 만 `sectionId: ''` 를 쓰지 못하게… 는 유니온에 빈 값이 없으므로 불가 — ①을 권장. 서버는 변경 없음(`sectionId.orEmpty()`, `EventCollectDtos.kt:69`).

#### B2. SR-8 이 바꾸는 `clicks`·`unique_clickers` 의 뜻을 집계표의 두 소비자가 알 길이 없다 (REVISE, 경미)

- 스펙: SR-8.1 「클릭 수와 고유 클릭자 집계에서 `MAP_LINK`·`FAVORITE` 행을 제외」. 문서 개정 목록(Existing Code → 문서)은 ADR-0095 `:83`·`:140` 두 줄뿐.
- 표준: ADR-0095 §6(`:106-116`) 「공용 원장에 직접 붙이지 않는다 — 집계 표 계약만 지키면 소비자가 안 깨진다」. 소비자는 둘이다 — place-ingest `links`(`popularity.py:65-71`, `ORDER BY sum(clicks) DESC`)와 search-batch 재색인(`ClickHouseClickSignalReader.kt:37-43`, `uniqMerge(unique_clickers)` → `clickBoost`, ADR-0095 `:123-125`). `AggregateAttractionPopularityUseCase.kt:5-10` KDoc 도 둘을 이름으로 든다.
- 왜 문제인가: 컬럼 모양은 그대로라 「계약」은 안 깨지지만 **값의 정의**가 바뀐다(찜·지도 열기는 더 이상 클릭이 아니다). 검색 쪽이 나중에 `clickBoost` 를 켤 때(`[[msa-place-ssr-enrichment-record]]` T16) 「클릭 = 목록 선택」임을 ADR 에서 읽을 수 있어야 한다. 지금은 어댑터 SQL 을 열어야만 안다.
- 수정안: ADR-0095 개정 목록에 §6 한 줄 추가 — 「`clicks`·`unique_clickers` 는 **목록 선택**(카드·목록 핀·오버레이 핀)만 센다. 항목 동작 섹션(`NON_LIST_SECTIONS` = MAP_LINK·FAVORITE)은 제외하고 노출은 그대로」. `AggregateAttractionPopularityUseCase` KDoc 에 같은 한 줄. 지금은 `clickBoost` 가 꺼져 있어 운영 영향은 없다.

#### B3. `screen_ref` 에 지역 코드를 넣는 결정이 ADR-0095 §2 정의와 어긋난 채 남는다 (REVISE, 경미)

- 스펙: SR-2.1 「`screenRef` 는 행정구역 전체 코드 … PLACE_HUB 의 모든 이벤트가 같은 값을 쓴다」.
- 표준: ADR-0095 `:63` 「`screen_ref` 그 화면의 주체 — 상세면 그 관광지 id. **목록 화면이면 NULL**」, V005 `:25` 「없으면 ''」. 선례 `RegionPage.tsx:280`(`PLACE_REGION`, `screenRef: code`)은 지역이 그 화면의 주체라 정의 안이다. 허브는 목록 화면이고 지역은 필터다.
- 왜 문제인가: 결정 자체는 합당하다(SR-10 이 지역별로 자르려면 payload `JSONExtract` 보다 컬럼이 낫다). 그러나 스펙이 ADR 두 줄을 이미 개정하면서 이 줄을 두면 ADR 이 데이터와 어긋난 채 남고, 다음 목록 화면(통합 검색은 지금 `screenRef` 없음, `UnifiedSearchPage.tsx:55-71`)이 어느 쪽을 따를지 모른다.
- 수정안: ADR-0095 개정 목록에 `:63` 추가 — 「목록 화면은 비우되, **지역을 축으로 고른 목록**(허브·지역 허브)은 그 지역 코드」. V005 주석은 Q8 과 같이 후속(`common` 아님, ClickHouse 스크립트지만 이번엔 건드리지 않는 범위로 두어도 된다).

#### B4. SR-5.4 가 중복 키의 효과를 절반만 적는다 (REVISE, 경미)

- 스펙: SR-5.4 「같은 view 에서 해제 뒤 다시 찜하면 둘째 `saved:true` 는 중복 키에 걸려 가지 않는다」. SR-9.1 「`saved` 두 방향」 테스트.
- 코드·스펙: 중복 키는 `viewId|entityType|entityId|sectionId|action`(SR-6.3, `tracker.ts:23-25` + sectionId)이고 payload 는 키에 없다. 따라서 같은 view 의 **두 번째 FAVORITE CLICK 은 방향과 무관하게** 버려진다 — 찜 직후의 해제(`saved:false`)도 남지 않는다. 허브 view 는 검색 조건이 바뀔 때만, 상세 view 는 관광지가 바뀔 때만 새로 난다(`AttractionPage.tsx:221`).
- 왜 문제인가: 기준선(`saved:true` 만)에는 영향이 없다. 그러나 「두 방향이 기록된다」고 읽히는 문장은 후속 분석(찜 해제율)을 잘못 기대하게 하고, SR-9.1 의 두 방향 테스트는 **서로 다른 viewId** 로만 성립한다.
- 수정안: SR-5.4 를 「같은 view 의 FAVORITE CLICK 은 첫 토글 한 건만 남는다(방향 무관). 기준선은 `saved:true` 만 세므로 첫 토글이 찜일 때만 센다」로. SR-9.1 두 방향 케이스에 「viewId 를 달리하여」 한 마디.

#### B5. Q4 의 근거 「인기 집계가 노출/클릭 비율을 쓴다」는 코드에 없다 (REVISE, 경미)

- 스펙: `open-questions.yml` Q4 「인기 집계가 노출/클릭을 함께 쓰므로 클릭만 보내면 비율이 깨진다」, requirements R1 카드 노출 항목도 같은 문장.
- 코드: 소비자 어느 쪽도 비율을 계산하지 않는다 — `popularity.py:70` 은 `sum(clicks)` 뒤 `sum(impressions)` 정렬, `ClickHouseClickSignalReader.kt:38` 은 `unique_clickers` 만, V007 `:6` 은 「노출은 순위 신호로 되먹이지 않는다」.
- 왜 문제인가: 결정(카드 IMPRESSION 전송, SR-3.3)은 ADR-0095 의 지면별 CTR 질의 때문에 여전히 옳다. 그러나 틀린 근거는 다음 결정을 흔든다 — 같은 논리면 SR-3.2 의 `MAP_OVERLAY`(노출 없는 클릭)도 「비율을 깬다」고 읽혀 노출을 억지로 붙이게 된다. 실제로는 소비자가 비율을 안 쓰므로 SR-3.2 는 그대로 맞다.
- 수정안: Q4 답을 「ADR-0095 의 지면별 CTR 질의(SR-10 이후)를 위해. 인기 집계 소비자는 비율을 쓰지 않으므로 노출 없는 섹션(`MAP_OVERLAY`)이 있어도 집계는 깨지지 않는다」로.

### 통과한 것 (근거)

- **SR-1.3 저장소 실패 폴백**: `identity.ts:22-33` 도 저장소 실패 시 회차 임시 id 라, 「새로고침마다 1회」가 세션 경계와 일치한다.
- **SR-7.1 비콘 경로**: 헤더 없는 비콘은 본문 `sessionId` 로 받고, `X-Visitor-Id` 는 게이트웨이가 `vid` 쿠키로 채운다(`VisitorIdFilter.kt:28-33`) — fetch 와 beacon 의 visitor 가 같다.
- **SR-7.2**: `/api/v1/events` 는 analytics 라우트 predicate 에 「익명 허용」으로 들어 있다(`gateway/application.yml:40-41`). 클라이언트 `X-User-Id` 를 안 읽는 결정이 맞다.
- **SR-8 범위**: 운영 경로에서 ATTRACTION CLICK 을 세는 원장 독자는 인기 집계 어댑터 하나다. `WeakJudgmentGenerator.kt:46-61` 은 V004 컬럼(`event_type`·`product_id`)의 PRODUCT 전용, `EventRepositoryAdapter.kt:76` 은 실험 지표(Q6 깨짐). ads 사본(`AdEventService.kt:225-230`)은 `EntityType.AD` 라 `entity_type='ATTRACTION'` 필터 밖이다.
- **ADR-0095 개정 대상 줄**: `:83`(「같은 view_id + entity_id 는 노출 1회」)·`:140`(「(view_id, entity_id) 로 1회만」) 확인. B2·B3 가 §6·`:63` 을 더하자는 것이다.
- **상세 두 섹션 겹침**: 주변 탐색 안에서는 `exploreItems.ts:53-57` 이 id 로 중복을 걸러 한 관광지가 한 섹션에만 간다. 겹침은 주변 탐색 ↔ 추천 탭(`SIMILAR_ELSEWHERE`·`RELATED_PLACES`, `AttractionPage.tsx:583-620`) 사이에서만 나므로 Q11 의 「2행 수용」범위가 좁다.
- **이미지 범위**: 여전히 portal-fe + analytics 둘. `common`·gateway 불변.

### 구현 시 주의 (이슈 아님)

- `NON_LIST_SECTIONS` 의 자리: 1라운드의 `private val` 제안을 **정정**한다. SR-8.2 의 테스트가 그 상수로 SQL 을 만들어야 하므로 비공개일 수 없고, 같은 어댑터가 이미 application 상수 `CollectEventsUseCase.ANONYMOUS_VISITOR`(`CollectEventsUseCase.kt:20`, 어댑터 `:57`)를 읽는 선례가 있다. `AggregateAttractionPopularityUseCase.companion`(`:22-25` 의 `MAX_REAGGREGATE_DAYS` 옆)에 두고 어댑터가 보간하면 ADR-0083 의 「규칙은 application, SQL 은 adapter」와 맞고 FE 주석의 상호 참조도 application 심볼을 가리킨다.
- SESSION_START 의 `screenRef`: 허브 마운트 시점에는 시도가 아직 없다(자동 선택은 `PlacePage.tsx:449-469` 의 비동기 effect). 첫 SESSION_START 는 대개 `''` 로 나간다 — SR-2.1 「모든 이벤트가 같은 값」은 「그 시점의 값」으로 읽어야 한다. SR-10 의 세션 분모는 `entity_id='place-hub'` 라 영향 없다.
- 1라운드 메모 유지: 마커 리스너(`:603`)는 viewId 를 ref 로 읽는다 · `installFlushOnLeave` 는 `useEffect(installFlushOnLeave, [])`.

### 판정

1라운드 5건은 전부 해소됐고, Clean Architecture·교차 서비스 import·`common` 변경 위반은 없다. 새 발견 5건은 모두 경미하며 스펙 문장(SR-6 타입 한 줄, ADR-0095 개정 목록에 §6·`:63` 두 줄, SR-5.4 문구, Q4 답)으로 닫힌다. 구현을 막는 것은 없다. 2라운드 판정: REVISE.

---

## 1라운드 (2026-10-08) — 원문

- 대상: `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml`)
- 코드 기준: 워크트리 `wt-impl` (origin/main `8a61f0b`)
- 기준 문서: `docs/architecture/00.clean-architecture.md` · `docs/conventions/package-structure.md` · `docs/architecture/kafka-convention.md` · `docs/adr/ADR-0083` · `docs/adr/ADR-0017` · `docs/adr/ADR-0095` · `analytics/CLAUDE.md`
- 지식베이스: `[[msa-unified-search-instrumentation-record]]` (볼트 1989v raw, updated 2026-09-20) — 「계측은 보낸 것이 아니라 **저장된 행 수**로 판정」·헤드리스 UA 202/accepted=0·payload null 400. 스펙 SR-7.3·SR-9.3 이 이 셋을 그대로 반영하고 있다. 다른 개념 페이지(analytics·ClickHouse·Kafka 계측)는 index 에 없음.

### Seed Discovery 요약

| 단계 | 본 것 |
|---|---|
| 스펙 | SR-1~SR-9, Out of Scope(enum·common·소비자 불변) |
| 폴더 | requirements R1~R3 · test-quality · open-questions Q1~Q6 · initialization(no-interview) |
| 표준 | 00.clean-architecture §2.1·§4, package-structure 규칙 6·7·8, ADR-0083 §1·§2·§5, ADR-0095 §1~§6, kafka-convention(analytics DLT 없음) |
| 코드 | `EventCollectController.kt:35-56`, `EventCollectDtos.kt:31-83`, `EventCollectService.kt`, `CollectEventsUseCase.kt`, `ClickHouseAttractionPopularityAdapter.kt:51-62`, `EventRepositoryAdapter.kt:19-62`, `EventIngestionConsumer.kt`, `KafkaConsumerConfig.kt:18-29`, `AnalyticsStreamTopology.kt:58-67,123-155`, `KeywordMetrics.kt`, `RecommendationEventConsumer.kt:46-72`, `VisitorIdFilter.kt:27-35`, `EventAction.kt`, `EntityType.kt`, `V005__events_two_axis.sql`, `V006__attraction_popularity_daily.sql`, `tracker.ts`, `events.ts`, `identity.ts`, `useImpression.ts`, `TrackedLink.tsx`, `useFavorites.ts`, `FavoriteButton.tsx`, `PlacePage.tsx:278-470,590-730,837-877,1192-1383`, `AttractionPage.tsx:216-223,507-514`, `UnifiedSearchPage.tsx:45-79` |

### 체크리스트 판정

#### Layer & Dependency

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | PASS | SR-7(헤더/본문 → 식별자 결정)은 HTTP 관심사라 `presentation/event/{controller,dto}` 가 맞다(`EventCollectController.kt:48-49` 의 기존 결정 위치와 같음). SR-8 은 `infrastructure/popularity` 어댑터의 SQL 상수(`:51-62`)만 바뀐다. application(`EventCollectService.kt`)·domain 은 손대지 않는다 |
| 상향 의존 없음 | PASS | 어댑터가 `CollectEventsUseCase.ANONYMOUS_VISITOR`(application 상수)를 읽는 기존 방향(`ClickHouseAttractionPopularityAdapter.kt:3,57`)은 infra → application 이라 허용. 새 import 방향 없음 |
| 외부 연동은 Port 경유 | PASS | ClickHouse 집계는 `AttractionPopularityPort` 구현체 안(`:19`), 발행은 `EventPublisherPort`(`EventCollectService.kt:11`). 새 외부 연동 없음 |
| 모듈 경계 변경의 근거 | PASS / 보완 | `common`·Kafka 소비자 불변의 근거가 명시돼 있다(Goal, requirements 목표 3: `KafkaConsumerConfig.kt:18-29` 에 ErrorHandlingDeserializer 없음 → 새 enum 값은 포이즌 필). 다만 FE 섹션 리터럴이 analytics SQL 로 들어가는 **새 교차 경계**(SR-8)는 양쪽에 근거 주석이 필요하다 → A3 |
| 아키텍처 패턴 일관성 | REVISE | ADR-0095 두 축·계층 위치는 지켰다. 그러나 SR-2.5 는 **생산자(FE)가 소비자(Streams 토폴로지) 내부 키 규칙에 맞춰 값을 만든다** → A2. SR-1.1 의 viewId 단위가 ADR-0095 §3 「노출↔클릭을 view_id 로 잇는다」와 모바일 누적 목록에서 어긋난다 → A1 |
| 순환 의존 없음 | PASS | portal-fe `components/favorite` → `analytics/tracker` 는 새 간선이지만 `analytics/*` 는 leaf 유틸(`tracker.ts` 는 `identity`·`events` 만 import)이라 순환 없음 |
| 트랜잭션 경계 | N/A | ClickHouse 집계·Kafka 발행 경로에 트랜잭션 없음. SR-5 「서버 성공 뒤에만」은 react-query `onSuccess` 로 FE 안에서 닫힌다 |

#### Module Depth

| 항목 | 판정 | 근거 |
|---|---|---|
| 인터페이스 표면 최소 | REVISE(경미) | `FavoriteButton.tracking?`(3 필드, 선택)·`CollectEventsRequest.sessionId`는 필요한 만큼이다. `CollectEventsRequest.visitorId` 는 배포 토폴로지에서 **한 번도 읽히지 않는 필드** → A5 |
| 얕은 pass-through 없음 | PASS | 새 모듈 없음 |
| 정보 은닉 | PASS | `useFavorites` 의 유일한 호출자는 `FavoriteButton.tsx:65` 라 훅 API 확장이 밖으로 새지 않는다. `saved` 는 `onMutate` 컨텍스트 `previous`(`useFavorites.ts:33-40`)로 정해야 한다 — `onSettled` 의 invalidate 뒤 `keys` 를 보면 값이 뒤집힌다 |
| Seam 현실성 | PASS | 새 인터페이스 없음(1-adapter seam 생성 없음) |
| 모듈 이름 | PASS | 새 모듈 없음. 섹션 id `MAP_LINK`·`FAVORITE` 는 `events.ts` 의 기존 어휘(`ATTRACTION_LIST`·`SEARCH_GROUP`)와 같은 꼴 |

#### Deletion Test

새 모듈(≥1 파일)이 없어 적용 대상 없음. SR-2.3 의 trigger·changed 도출(13개 trigger, 직전 조건 diff)은 스펙이 위치를 말하지 않는데, `PlacePage.tsx`(현재 1,384줄) 안에 인라인하면 SR-9.1 의 vitest 가 지도·IO 를 전부 mock 해야 trigger 행렬을 검증할 수 있다. 순수 함수 파일(`pages/place/searchTrigger.ts` 류)로 두는 편이 테스트가 대상의 산출물을 보게 한다 — pass-through 가 아니라 도출 로직이므로 Deletion Test 상 문제 없음. 권고이지 이슈는 아니다.

### Findings

#### A1. viewId 재생성 단위가 모바일 누적 목록에서 노출↔클릭 조인을 끊는다 (REVISE)

- 스펙: SR-1.1 「검색 조건(`query` 메모)이 바뀔 때마다 새 `viewId`」, SR-2.3 trigger 에 `page` 포함.
- 코드: `query` 에 `page` 가 들어 있다(`PlacePage.tsx:302,305`). 모바일은 페이지가 **누적**된다(`store.items`, `:323-335`, `:360-363`) — page 1 이 오면 viewId 가 바뀌지만 page 0 카드는 그대로 화면에 있다. 그 카드의 IMPRESSION 은 viewId(page0), 이후 클릭은 viewId(page1) 로 남는다.
- 표준: ADR-0095 §3 「노출↔클릭은 `view_id` 로 잇는다」, `V005__events_two_axis.sql:31`.
- 반대쪽 제약: 페이지마다 SEARCH 한 행을 남기려면 viewId 가 바뀌어야 한다 — 트래커 중복 키가 `viewId|SEARCH|keyword|SEARCH`(`tracker.ts:23-25`)라 같은 viewId 에서는 두 번째 SEARCH 가 버려진다. 스펙은 이 트레이드오프를 적지 않았다.
- 수정안(택1, 스펙에 명시):
  1. **권장** — viewId 를 `baseKey`(query − page, `:326`)에 묶고, `page` 는 trigger 에서 뺀다. 페이지 이동은 Goal 의 여섯 행동에 없고, 첫 SEARCH 의 `payload.total`·`page` 로 분모는 이미 남는다. 노출↔클릭 조인이 데스크톱·모바일 모두 한 view 안에서 성립한다.
  2. 현행 유지 + 「모바일 누적 목록에서 노출↔클릭은 view_id 가 아니라 (session_id, entity_id) 로 잇는다」를 스펙과 기준선 질의 메모(requirements 범위 밖 절)에 적는다.

#### A2. `payload.keyword: '*'` — 생산자가 소비자 내부 그룹 키에 맞춘다 (REVISE)

- 스펙: SR-2.5 「Streams 키워드 지표가 `payload.keyword` 로 묶이므로 키워드 없는 검색에는 `*` 를 넣어 `unknown` 키로 떨어지지 않게 한다」.
- 코드: `AnalyticsStreamTopology.kt:124-131` 은 `action == SEARCH` 전부를 `payload["keyword"] ?: "unknown"` 으로 키 잡고, `:146-155` 에서 그 키로 `KeywordScore` 를 계산해 `keywordScoreRepository.save` + Redis 캐시에 넣는다. 즉 `*` 를 보내면 **리터럴 `*` 키워드 점수 행**이 저장·캐시된다 — `unknown` 과 같은 종류의 쓰레기 행이 하나 더 생길 뿐이다. 통합 검색은 지금도 `payload.keyword` 없이 보내(`UnifiedSearchPage.tsx:55-71`) 전부 `unknown` 으로 간다.
- 뿌리: 토폴로지가 `entityType == SEARCH` 일 때 `entityId`(ADR-0095: 「entityId 는 질의어」, `EntityType.kt:17`)가 아니라 `payload.keyword` 를 읽고, 키워드 없는 검색을 거르지 않는다. 이건 소비자 쪽 결함이고 이번 슬라이스는 소비자를 손대지 않는다(합당).
- 수정안: FE 는 키워드가 있을 때만 `payload.keyword` 를 넣는다(센티널 둘을 만들지 않는다 — `unknown` 하나로 모인다). `context/open-questions.yml` 에 post-impl **Q7**: 「키워드 지표 브랜치는 `entityType == SEARCH` 이면 `entityId` 로 키 잡고, 빈 키워드는 건너뛴다(토폴로지 수정, 통합 검색도 같이 살아난다)」. SR-2.1 의 `entityId: keyword || '*'` 는 원장에만 남으므로 그대로 둬도 된다.

#### A3. SR-8 의 섹션 리터럴 — FE `SectionId` 와 analytics SQL 이 같은 지식을 따로 든다 (REVISE)

- 스펙: SR-8.1 「클릭 수와 고유 클릭자 집계에서 섹션 `MAP_LINK`·`FAVORITE` 행을 제외」, SR-8.2 「SQL 에 명시적으로 … 어댑터 테스트가 그 문자열을 확인」.
- 코드: 섹션 id 는 TS 유니온(`events.ts:23-40`)이고 서버는 자유 문자열(`V005:26`, `Placement.sectionId`). `ClickHouseAttractionPopularityAdapter.kt:55-57` 에 `section_id NOT IN ('MAP_LINK','FAVORITE')` 를 넣으면 「목록 선택이 아닌 항목 동작」이라는 규칙이 TS 와 Kotlin 두 곳에 공유 상수 없이 산다. 거부 목록이라 다음 비목록 섹션(공유 버튼 등)이 생기면 **조용히 다시 오염된다** — SR-8 이 막으려는 바로 그 실패.
- 덧붙여, SR-8.1 「노출 집계는 바꾸지 않는다」는 **이 두 섹션으로 IMPRESSION 이 절대 오지 않는다**는 전제 위에서만 안전하다. `TrackedLink`(`TrackedLink.tsx:25-33`)를 지도 링크에 쓰면 앵커에 `useImpression` 이 붙어 `MAP_LINK` 노출이 올라가고, 그 노출은 제외되지 않는다.
- 수정안:
  - Kotlin: `private val NON_LIST_SECTIONS = listOf("MAP_LINK", "FAVORITE")` 처럼 이름을 주고, 주석에 「portal-fe `analytics/events.ts` 의 SectionId 와 같이 고친다 — 항목 동작 섹션은 클릭만 보내고 노출을 보내지 않는다」를 적는다. 테스트는 이 상수에서 SQL 문자열을 만들어 대조한다.
  - TS: `events.ts` 의 `MAP_LINK`·`FAVORITE` 주석에 「인기 집계 제외 대상 — `ClickHouseAttractionPopularityAdapter` 와 한 몸 · 클릭 전용(노출 금지)」.
  - 스펙 SR-4·SR-5 에 「이 섹션으로 IMPRESSION 을 보내지 않는다(`TrackedLink` 사용 금지, `onClick` 에서 `track` 만)」 한 줄.

#### A4. 오버레이 핀 클릭을 `ATTRACTION_LIST` 로 적으면 섹션 id 가 거짓말한다 (REVISE, 경미)

- 스펙: SR-3.1 「카드 좌클릭과 지도 핀 클릭은 … 섹션 `ATTRACTION_LIST`, payload `source` 는 `card` 또는 `map`」, Existing Code 가 핀 클릭 `:603, 727` 둘을 같이 든다.
- 코드: `:603` 은 목록(`attractions`)의 마커지만 `:727` 은 **오버레이**(`overlayData`, 음식·숙박 반경 질의 `:684-698`)의 마커다. 오버레이 POI 는 카드가 없어 노출이 0 이고 목록 순서도 없다. `ATTRACTION_LIST` 로 적으면 노출 없는 클릭이 목록 섹션에 쌓인다.
- 표준: ADR-0095 §2 「`section_id` 섹션 고유 id — 한 축으로 누르면 원인을 못 가린다」.
- 수정안: `SectionId` 에 `MAP_OVERLAY` 를 더해 `:727` 경로는 그 섹션으로 보낸다(payload `source: 'map'`, `itemIndex` 없음). 인기 집계 포함 여부는 그대로(관광지이긴 하다) — 섹션 이름만 사실을 말하면 된다.

#### A5. 본문 `visitorId` 는 게이트웨이 뒤에서 한 번도 읽히지 않는다 (REVISE, 경미)

- 스펙: SR-7.1 「visitor 는 헤더 우선(게이트웨이가 항상 채움), 헤더가 없을 때만 본문 `visitorId`」.
- 코드: `VisitorIdFilter.kt:31-33` 이 모든 요청에 `X-Visitor-Id` 를 **덮어쓴다**(`mutate().header()` 는 교체). 컨트롤러는 헤더 우선(`EventCollectController.kt:48`). 따라서 운영에서 본문 `visitorId` 분기는 도달 불가 코드다. 반면 `sessionId` 는 살아 있는 분기다 — 아무도 `X-Session-Id` 를 채우지 않고 beacon 은 헤더를 못 싣는다(`tracker.ts:63-70`).
- 수정안: DTO 에는 `sessionId` 만 더한다. `visitorId` 를 굳이 받으려면 「게이트웨이 밖 직접 호출(로컬·테스트) 전용」이라고 스펙과 DTO 주석에 적는다. (Jackson 이 미지 필드를 무시하므로 FE 가 지금처럼 본문에 `visitorId` 를 실어도 깨지지 않는다.)

### 통과한 것 (근거)

- **SR-1.3 / SR-6.2 `SESSION_START`**: 서버 enum 에 이미 있고(`EventAction.kt:15`), recommendation 의 `when` 이 덮는다(`RecommendationEventConsumer.kt:71` → null, `:48` 에서 PRODUCT 가 아니면 그 전에 버림). Streams 두 브랜치는 PRODUCT(`AnalyticsStreamTopology.kt:60-66`)·SEARCH(`:124-130`)만 받는다. `EventIngestionConsumer` 는 action 을 가리지 않는다. `EntityType.PAGE` 있음(`EntityType.kt:16`). 포이즌 필 위험 없음.
- **SR-7.2 eventId 형식**: FE 중복 키(`tracker.ts:24`)와 축이 같아진다. `event_id` 는 정렬 키에 없고(`V005:48`) 엔진이 MergeTree 라 형식 변경이 중복 제거 의미를 바꾸지 않는다. 소비자는 로그에만 쓴다(`RecommendationEventConsumer.kt:41`).
- **SR-7.3 / SR-9.3**: `[[msa-unified-search-instrumentation-record]]` 의 두 유실 원인(헤드리스 UA·payload null)이 스펙에 반영돼 있다. `CollectEventItem.payload: Map<String, Any?>`(`EventCollectDtos.kt:49`)는 그대로.
- **SR-5 `useFavorites` 확장**: 유일한 호출자가 `FavoriteButton`(`FavoriteButton.tsx:65`)이라 훅 API 변경이 블로그·게임·상점 호출처(`GameCard.tsx:47`, `PostCard.tsx:38`, `ShopProductDetailPage.tsx:122`, `FavoritesPage.tsx:251`)로 번지지 않는다 — `tracking` prop 이 없으면 미계측이라는 SR-5.2 와 맞다.
- **이미지 범위**: `common` 불변 → JVM 이미지 재빌드 없음. 바뀌는 것은 portal-fe + analytics 둘(requirements 제약과 일치).

### 구현 시 주의 (이슈 아님)

- `:603` 마커 리스너는 `[attractions, mapReady, …]` effect 안이다(`:663`). viewId 를 클로저로 잡으면 viewId 가 바뀔 때마다 마커를 다시 만든다 — `selectedIdRef`(`:595`)처럼 ref 로 읽는다.
- `installFlushOnLeave` 는 상세와 같은 꼴(`AttractionPage.tsx:223`)로 `useEffect(installFlushOnLeave, [])`.
- SR-1.3 의 `sessionStorage` 플래그는 `identity.ts` 의 `kgd.sessionId` 와 같은 저장소라 「세션」의 경계가 일치한다. 지금 호출자가 하나라 별도 헬퍼는 만들지 않는다(YAGNI).

### 1라운드 판정

Clean Architecture 위반·교차 서비스 import·`common` 변경은 없다. 이슈 5건은 모두 이벤트 모델의 계약 일관성(viewId 단위·소비자 내부 키 의존·FE↔analytics 섹션 리터럴·오버레이 섹션·죽은 필드)이고 스펙 문장으로 닫을 수 있다. 1라운드 판정: REVISE.

---

VERDICT: SHIP
