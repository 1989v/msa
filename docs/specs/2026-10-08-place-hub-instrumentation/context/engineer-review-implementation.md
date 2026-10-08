# Engineer Review — implementation

## 3라운드 (2026-10-08)

- 대상: `spec.md`(2라운드 개정본) + `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `context/review-verdict-round2.md` §2(확정 5건은 재론하지 않음)
- 코드 기준: 워크트리 `wt-impl`(origin/main `8a61f0b`). 메인 트리는 읽지 않았다.
- 규칙 문서: 2라운드와 같음(`docs/standards/test-rules.md`, `docs/conventions/kotlin-style.md` §1.1, 루트 `CLAUDE.md` 「검사는 대상의 산출물을 본다」).
- 지식베이스: 2라운드 인용 3건이 그대로 유효 — [[msa-unified-search-instrumentation-record]] (1989v, updated 2026-09-20) 저장 행 수로 판정·헤드리스 UA 202/0 → SR-9.4; [[measurement-needs-human-ua]] (1989v `claude/memory/msa`) → SR-9.2·9.4 사람 UA; [[msa-ad-network-record]] (1989v) :15 beacon 은 헤더를 못 싣는다 → SR-7.1 본문 `sessionId`. 이번 라운드의 새 확인(TS 합집합·Kotlin const)은 코드 근거로 닫혀 볼트 조회가 필요 없었다.

### 1. 2라운드 항목별 해소 판정

| 2라운드 | 개정 스펙 | 판정 |
|---|---|---|
| **N1** `overlay` 트리거는 목록 `query`(`PlacePage.tsx:305`) 밖이라 발화 불가 | 심판 ①(a 제거). SR-2.3 어휘에서 `overlay` 삭제, `lang`·`other` 추가. SR-2.4 「오버레이 토글은 목록 질의를 바꾸지 않으므로 SEARCH 가 없다」. SR-10 필터 적용 식 `('region','category','attribute','eventStatus')` 에 overlay 없음. Out of Scope + Q13. SR-9.1 「오버레이 칩 토글 → SEARCH 미발화·viewId 불변」 테스트 | **해소** |
| **N2** SESSION_START 섹션 비움을 `events.ts:48` 필수 타입이 거절 | 심판 ④. SR-6.1 `PlacedItem \| PageItem(entityType:'PAGE', sectionId?: never …)`, SR-1.3 「섹션은 없다(`PageItem`)」·`screenRef` 빈 값 명시, SR-6.3 키 `sectionId ?? ''`, SR-7.3 `orEmpty()`. `requirements.md:13` 「섹션 없음(`PageItem`, SR-6.1)」 로 정정. 곁들임(마운트 시 `sidoCode` null)도 SR-1.3 본문에 들어감 | **해소** |
| **N3** `requirements.md`·`test-quality.md` 1라운드 이전 잔재 5곳 | `requirements.md:14` `term` + trigger 어휘가 SR-2.3 과 동일(`filter`·`overlay` 없음), `:15` `screenRef: SR-2.1 의 지역 코드`, `:19` `MAP_OVERLAY` + 판별 합집합, `:25` 「`term` 이고 `keyword` 를 넣지 않는다」, `:37`·`:51` 중복 키에 `section_id`. `test-quality.md:5` `term`·`keyword` 없음, `:8` entityType·sectionId | **해소** |
| **N4** 어댑터 테스트가 상수 보간 기대값이면 상수를 비워도 초록 | 심판 ③. SR-8.2 리터럴 `section_id NOT IN ('MAP_LINK', 'FAVORITE')` 두 술어 + `impressions` 에 제외 없음 + `POST_SELECTION_SECTIONS shouldBe setOf(…)` 별도 고정, 「기대값을 상수로 만들지 않는다」. SR-9.3 회귀 주입에 `emptySet()` 1건 추가(8건). `INSERT_DAY` 는 `private val` | **해소** (성립 확인 §3-b) |
| **N5** trigger ref 를 못 심는 핸들러 11곳 + undefined 게이트 | SR-2.3 에 전부 등재: 쪽 넘김 `:377`·`:1209`·`:1218`·`:1231`, 분류 칩 `:1033-1036`·`:1046-1050`(`changed` 복수), 행사 상태 `:1099-1102`, 구 지역 축 `:1072-1076`(`region`·`changed:['areaCode']`), `selectRegion` trigger 인자 + 자동 선택 `:458` 만 `initial`, `switchLang:880-884` → `lang`, `pickSuggestion` early return `:840` 뒤, ref 빈 채 도착 = `other`. SR-9.1 「`trigger` 가 `undefined` 인 SEARCH 가 하나라도 있으면 실패」 게이트 | **해소** (인용 전부 일치 §2) |
| **N6** 가운데 클릭은 `click` 이 아니라 `auxclick` | 심판 ⑤. SR-3.1 「가운데 클릭은 … 세지 않는다」「newTab 클릭 뒤 같은 카드의 일반 클릭은 같은 키라 가지 않는다」, Out of Scope 명시 | **해소** |
| **N7** 같은 view 둘째 찜 토글은 방향 무관 유실 | SR-5.4 「같은 view 의 이후 토글(해제·재찜)은 `saved` 와 무관하게 중복 키에 걸려 가지 않는다」「카드 별(`:1368`)과 패널 별(`:1304`)은 … 서로도 막는다」. SR-9.1 「`saved` 두 방향 케이스는 서로 다른 viewId 로」 + 「해제→찜은 `pendingForTest()` 에 한 건」 | **해소** |
| **N8** 컨트롤러 standalone 에 advice·slot | SR-9.2 「standalone 에 `GlobalExceptionHandler` advice(선례 `AttractionSearchControllerTest.kt:22`)」「`collect` 인자를 `slot<List<AnalyticsEvent>>()` 로 받아 …」 + 사람 UA 헤더(`CrawlerUserAgents.kt:45`) | **해소** (성립 확인 §3-c) |

### 2. 인용 검증 — 3라운드 추가분

| 스펙 인용 | 실제 | 판정 |
|---|---|---|
| `PlacePage.tsx:377` 모바일 센티널 `setPage` | `:377` `setPage((p) => nextPage(p, totalPages) ?? p)` | ✔ |
| `:458` 자동 시도 선택이 `selectRegion` 호출 | `:458` `if (target) selectRegion(target);` | ✔ |
| `:840` `pickSuggestion` 좌표 없는 제안 early return | `:840` `if (s.latitude == null \|\| s.longitude == null) return;` | ✔ |
| `:880-884` `switchLang` | `:880-884` `navigate(next === 'en' ? …)` | ✔ |
| `:1033-1036` 전체 칩(category·page) | `:1033-1036` `setCategory(null); setPage(0)` | ✔ |
| `:1046-1050` 분류 칩(category·listEventStatus·page) | `:1046-1050` 세 setter | ✔ (`changed` 복수 근거) |
| `:1072-1076` 구 지역 축 `<select>`(areaCode·geo·page) | `:1068` `!hasRegionAxis`, `:1072-1076` 세 setter | ✔ |
| `:1099-1102` 행사 상태 칩 | `:1099-1102` `setListEventStatus`·`setPage(0)` | ✔ |
| `:1181` 지역 칩 `selectRegion(r)` | `:1181` | ✔ |
| `:1192` 결과 목록은 `!pickingRegion` 일 때만 | `:1192` `(isMobile \|\| listOpen) && !pickingRegion` — SR-10 「landing 은 카드가 없다」 근거 | ✔ |
| `:1209`·`:1218` 데스크톱 이전/다음, `:1231` 더 보기 | 일치 | ✔ |
| `:1349` 수정키 early return, `:603` 목록 핀 리스너 | `:1349` `e.metaKey \|\| … \|\| e.button !== 0` return, `:603` `marker.addListener('click', …)` | ✔ |
| `AggregateAttractionPopularityUseCase.kt` companion | `:22-25` `const val MAX_REAGGREGATE_DAYS = 90` — 인터페이스 companion | ✔ |
| `ClickHouseAttractionPopularityAdapter.kt:51` `INSERT_DAY` const | `:51` `private const val INSERT_DAY`, `:57` 템플릿 `${CollectEventsUseCase.ANONYMOUS_VISITOR}` | ✔ |
| `CollectEventsUseCase.ANONYMOUS_VISITOR` 선례 | `application/event/usecase/CollectEventsUseCase.kt:15-21` companion `const val` | ✔ |
| `common/.../CrawlerUserAgents.kt:45` UA 없음 = 크롤러 | 실제 경로 `common/web/CrawlerUserAgents.kt:45` `isNullOrBlank() → true` | ✔ (스펙은 `...` 생략 표기) |
| `shopApi.ts:110-111` `?: never` 선례 | `:109-112` `fromCart?: never` / `items?: never` | ✔ |
| `PlacePage.test.tsx:14, 63` | `:14` FavoriteButton null mock, `:63` `retry: false` | ✔ |
| `FavoriteButton.test.tsx:34` `portal_user_id` 쿠키 | 실제 경로 `components/favorite/__tests__/FavoriteButton.test.tsx:34-38` `setSession` | ✔ |
| `AttractionSearchControllerTest.kt:17-23` | 실제 경로 `search/app/src/test/kotlin/com/kgd/search/presentation/search/controller/` | ✔ |
| ADR-0095 `:63`·`:83`·`:140` | `:63` 「목록 화면이면 NULL」, `:83` 「같은 view_id + entity_id 는 노출 1회」, `:140` 「(view_id, entity_id) 로 1회만」 | ✔ |
| `EventCollectDtos.kt` eventId `:58-59`, `sectionId.orEmpty()` `:69` | 일치 | ✔ |

### 3. 구현 성립 확인 — 부모가 특정한 세 가지

**a. 판별 합집합이 `track`·`useImpression`·`TrackedLink` 시그니처를 깨지 않는가 — 깨지 않는다.**
- `tracker.ts:27-28` `track(action, item: TrackedItem, viewId)` 는 `{ ...item, action, viewId, occurredAt }` 를 `TrackedEvent` 에 넣는다. `TrackedItem` 이 합집합이 되면 spread 결과도 합집합으로 분배되고, `TrackedEvent = TrackedItem & { action; viewId; occurredAt }` 에 그대로 할당된다. `PageItem` 의 `sectionId?: never` 는 `undefined` 만 허용해 spread 뒤에도 성립.
- `keyOf`(`:23-25`) 는 `e.sectionId` 가 `SectionId | undefined` 가 되므로 SR-6.3 의 `?? ''` 가 필요하고 그것으로 충분하다.
- `useImpression.ts:22` `item: TrackedItem | null` 은 ref 에 저장했다가 `track` 에 그대로 넘긴다(`:62`) — 시그니처·본문 변경 없음. `TrackedLink.tsx:20` `item: TrackedItem` 도 같다.
- 기존 호출처는 전부 `sectionId` 를 갖는 `PlacedItem` 모양 — `NearbyExplore.tsx:283-292`, `tracker.test.ts:8-16`, `RegionPage`·`AttractionPage`·`UnifiedSearchPage`(2라운드 확인). `entityType: 'PAGE'` 호출처는 0건(grep) → `PageItem` 은 새 SESSION_START 하나뿐이라 회귀 표면이 없다.
- 참고(결함 아님): `PlacedItem.entityType` 이 `EntityType` 전체라 「PAGE + 섹션」 조합도 통과한다. 스펙 의도는 「섹션 생략은 PAGE 만」이고 그건 지켜진다.

**b. `INSERT_DAY` 를 `private val` 로 내려 companion 상수를 보간하는 것이 Kotlin 에서 성립하는가 — 성립한다.**
- 지금 `:51` 이 `const` 일 수 있는 이유는 템플릿 안이 `const val`(`ANONYMOUS_VISITOR`) 뿐이기 때문이다. `Set<String>.joinToString` 은 컴파일 상수가 아니라 `const` 를 떼야 하고, `private val` 은 companion 초기화 때 한 번 평가된다 — `prepareStatement(INSERT_DAY)` 호출 모양은 그대로.
- 인터페이스 companion 의 non-const `val Set<String>` 은 허용된다(`MAX_REAGGREGATE_DAYS` 옆에 둘 수 있음). 어댑터 companion 초기화가 유스케이스 companion 을 끌어오는 순환은 없다.
- `setOf("MAP_LINK", "FAVORITE")` 는 삽입 순서를 지키고 `joinToString` 기본 구분자는 `", "` 이므로 결과는 정확히 `'MAP_LINK', 'FAVORITE'` — SR-8.2 의 리터럴 기대값과 맞는다. raw string 안 `${X.joinToString { "'$it'" }}` 의 중첩 따옴표는 `${}` 식 안이라 허용.
- 기존 어댑터 테스트는 `prepareStatement` 인자를 잡아 `oneLine` 으로 공백을 접은 뒤 `shouldContain` 한다(`AdapterTest.kt:27-38`) — 리터럴 두 곳 단언과 `impressions` 제외 없음 단언이 같은 틀에서 가능하다.

**c. MockMvc standalone + advice·사람 UA 가 성립하는가 — 성립한다.**
- `GlobalExceptionHandler` 는 무인자 생성자(`common/exception/GlobalExceptionHandler.kt:16`)이고 analytics 는 `:common` 을 의존한다(`analytics/app/build.gradle.kts:10`). `CrawlerUserAgents.kt:45` 가 UA 없음을 크롤러로 보므로 SR-9.2 의 「비크롤러 5케이스에 사람 UA」는 필수가 맞다.

### 4. 새 발견

구현을 틀리게 만드는 결함 **없음**. 판정과 무관한 메모 2건만 남긴다.
- `EventCollectDtos.kt:52-55` KDoc 이 「(viewId, entityId, action)」 이라고 적고 있다 — `:59` 를 5축으로 고칠 때 같은 파일이니 한 줄 같이 고친다(Q8 의 `common` 주석과는 별개, analytics 안이라 이번 범위).
- `requirements.md:15` 의 예시 호출이 `sectionId:'ATTRACTION_LIST'` 리터럴 하나로 목록 핀·오버레이 핀을 같이 적고 있다. 괄호에 `MAP_OVERLAY` 가 있고 SR-3.2 가 우선이라 구현이 틀릴 여지는 없다.

### 5. 체크리스트 판정
- **C1 참조 존재** ✔ — §2 전부 일치. 경로가 생략 표기인 것 셋(`CrawlerUserAgents`·`FavoriteButton.test`·`AttractionSearchControllerTest`)도 실체 확인.
- **C2 기존 코드 충돌** ✔ — 2라운드 N1(`:305` deps)·N2(`events.ts:48` 타입)·N3(보조 문서)이 전부 스펙 문장으로 닫혔고, §3-a 로 타입 변경의 회귀 표면이 0 임을 확인.
- **C3 복잡도** ✔ — N5 의 핸들러 전수가 SR-2.3 에 들어갔고 「trigger undefined 면 실패」가 게이트(SR-9.1)로 섰다.
- **C4 NFR** ✔ — 2라운드와 동일(새 외부 호출·N+1 없음, 배치 상한·크롤러 거부 유지).
- **C5 마이그레이션/롤백** ✔ — 「구현 전제」 그대로.
- **C6 동시성** ✔ — 훅 수준 `onSuccess`, 서버 무상태.

### 6. 요약
- 2라운드 N1~N8: **8건 전부 해소**. 심판 §2 의 확정 5건과 스펙 문장이 일치한다.
- 부모가 특정한 세 확인(새 라인 참조 전수 · 판별 합집합 시그니처 · Kotlin `private val` 보간) 전부 성립.
- 새 결함 0, 판정 무관 메모 2(`EventCollectDtos.kt:52` KDoc 동반 수정 · `requirements.md:15` 예시 리터럴).

3라운드 판정: SHIP (파일 마지막 줄과 같음)

---

## 2라운드 (2026-10-08)

- 대상: `spec.md`(개정본) + `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml`
- 코드 기준: 워크트리 `wt-impl`(origin/main `8a61f0b`). 메인 트리는 읽지 않았다.
- 규칙 문서: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK), `docs/conventions/kotlin-style.md` §1.1(최소 수정), `analytics/CLAUDE.md`(토픽·ClickHouse 단독 소유), 루트 `CLAUDE.md` 「검사는 대상의 산출물을 본다」.
- 지식베이스: 이 세션에 셸이 없어 `kb-search.sh` 대신 `HNS_KB_PATH` 볼트를 직접 grep 했다.
  [[msa-unified-search-instrumentation-record]] (1989v, updated 2026-09-20) — 「보냈다」가 아니라 **저장된 행 수**로 판정, 헤드리스 UA 는 202/`accepted=0`. SR-9.4 와 일치.
  [[measurement-needs-human-ua]] (1989v `claude/memory/msa`) — CDP 는 `Network.setUserAgentOverride` 로 사람 UA. SR-9.4 와 일치.
  [[msa-ad-network-record]] (1989v) :15 — `sendBeacon` 은 헤더를 못 싣는다. SR-7.1 의 본문 `sessionId` 폴백이 바로 그 경로(`tracker.ts:64-70`)를 위한 것이라 일치.

### 1. 1라운드 발견 추적

| 1라운드 | 개정 스펙 | 판정 |
|---|---|---|
| **B1** CLICK 세 종류가 `tracker.ts:23-25` 키·`EventCollectDtos.kt:59` eventId 에서 접힘 | SR-3.4 불변식에 `sectionId` 포함, SR-6.3 키 `viewId\|entityType\|entityId\|sectionId\|action`, SR-7.3 eventId 5축, SR-10 「중복 튜플에 section_id」, Q11 closed(선택지 a, 상세 두 섹션 겹침 노출 2행 수용), SR-9.1 「실제 트래커로 세 건이 `pendingForTest()` 에 남는」 통합 케이스 | **해소** |
| **R1** `screenRef` 시군구 3자리 | SR-2.1 「시도코드+시군구코드 … `PLACE_REGION` 과 같은 체계」 | **해소** |
| **R2** 메인 트리 analytics·common 미커밋 변경 | 「구현 전제」 origin/main `8a61f0b` 워크트리 전용. 워크트리의 `AnalyticsStreamTopology.kt:123-131` 은 1라운드와 같다 | **해소** |
| 메모 trigger 는 diff 역추론 말고 state | SR-2.3 「조작 시점에 ref 로 남겼다가 결과 도착 시 소비」 | **해소** |
| 메모 오버레이 핀 `source:'overlay'` | SR-3.2 섹션 `MAP_OVERLAY` 로 가름(다른 방식, 목적 동일). 단 §2 N1 참조 | **해소** |
| 메모 모바일 viewId 를 `baseKey` 로 | SR-1.1 「이번 기준선은 view 단위 CTR 을 쓰지 않고 `page` SEARCH 는 분모 제외」로 **기각하고 이유를 적음** | 수용 |
| 메모 찜 `onSuccess` 훅 수준 | SR-5.2 | **해소** |
| 메모 롤백 한 줄 | 「구현 전제」 「롤백은 이미지 되돌리기 … 이행 없음」 | **해소** |
| 줄 번호(420-440 · 1317-1324) · 테스트 경로 `__tests__/` | Existing Code 목록 전부 일치 | **해소** |
| C4 관찰 `keyword:'*'` 가 KeywordScore 행을 남김 | SR-2.2 `term` 으로 바꿔 `keyword` 를 넣지 않음(Streams 는 `unknown`, 통합 검색과 같은 경로) + Q7 | **해소** |

### 2. 인용 검증 — 2라운드 추가분

`PlacePage.tsx` 278-306 · 308-321(`enabled` 없음, `retry: 3` :319) · 349-357 · 417 · 420-440 · 449-469 · 603 · 684-698 · 727 · 837-852 · 854-859 · 861-870 · 872-877 · 1304 · 1317-1324 · 1329-1383(1349 early return · 1368 카드 찜) — **전부 일치**.
`useFavorites.ts:28-48`(onSuccess 없음) · `FavoriteButton.tsx:53-78` · `EventCollectController.kt:35-56`(폴백 49, `X-User-Id` 50) · `EventCollectDtos.kt:58-59` · `ClickHouseAttractionPopularityAdapter.kt:25-32`·`55-57` · `AnalyticsStreamTopology.kt:123-131` · ads `EventDtos.kt:16-19` · `AttractionPage.tsx:221-223`·386·507-514 · `UnifiedSearchPage.tsx:55-71` · `RegionPage.tsx:271-296` · `__tests__/RegionPage.test.tsx:13-16,100-111` · `adsTestKit.ts:114` · `AttractionSearchControllerTest.kt:17-23` · ADR-0095 `:83`·`:140` — **일치**.
`event_id` 를 파싱하는 코드 없음(grep 0건), `V005:48` ORDER BY 에도 없음 → eventId 형식 변경이 기존 행과 섞여도 무해.
`useImpression` 의 다른 호출처(`AdCard.tsx:14`, `BannerAd.tsx:16`)는 `item=null` 이라 `track` 을 안 부른다 → 키 변경 영향 없음.

### 3. 새 발견

**N1 (REVISE). `overlay` 는 목록 `query` 에 없어 「결과 도착 시 SEARCH」 경로로는 `trigger:'overlay'` 가 발화할 수 없다.**
- 스펙: SR-2.3 trigger 목록에 `overlay`, SR-10 「필터 적용」 식에 `'overlay'` 포함.
- 코드: `PlacePage.tsx:305` `query` deps 는 `[keyword, lang, areaCode, sidoCode, sigunguCode, category, listEventStatus, geo, attributes, page]` — `overlay` 가 없다. 칩 `:1063` 은 `setOverlay` 만 부르고, 오버레이 결과는 별도 `useQuery`(`:684-698`, key `['place-overlay', overlay, mapView, lang]`)로 온다.
- 결과: 오버레이 토글은 viewId 도 목록 SEARCH 도 만들지 않아 SR-10 의 overlay 필터 적용은 항상 0. 기준선이 존재하지 않는 값을 정의한다.
- 수정안(택1, **b 권장** — 핀 CLICK 이 이미 `MAP_OVERLAY` 섹션이라 짝이 맞는다):
  a. `overlay` 를 SR-2.3·SR-10 에서 빼고 Out of Scope 에 「오버레이는 지도 레이어이지 목록 질의가 아니라 필터 적용으로 세지 않는다」.
  b. `overlayData` 도착 시 SEARCH 한 건: 대상 `SEARCH`/오버레이 카테고리 값, 섹션 `MAP_OVERLAY`, 허브 viewId 그대로, payload `{ trigger:'overlay', changed:['overlay'], overlay, total, radiusKm }`(좌표 제외). 키가 섹션·entityId 로 갈려 목록 SEARCH 와 안 부딪히고, 지도 팬으로 refetch 돼도 같은 키라 한 번만 간다. SR-10 식은 `section_id` 를 안 가르므로 그대로 잡힌다.

**N2 (REVISE). `SESSION_START` 의 「섹션 비움」은 화면 타입이 거절하고, 보조 문서는 다른 값을 적고 있다.**
- 스펙: SR-1.3 「섹션은 비운다(PAGE 대상은 `sectionId` 생략 허용)」, SR-6.3 「sectionId 가 없으면 빈 값」.
- 코드: `events.ts:48` `sectionId: SectionId` **필수** — 생략하면 tsc 가 거절한다. `SectionId`(`events.ts:23-40`)에 빈 값도 없다. `tracker.ts:23-25` 템플릿에 `undefined` 가 들어가면 키에 `"undefined"` 문자열이 박힌다(빈 값이 아니다).
- 문서: `requirements.md:13` 은 `sectionId:'ATTRACTION_LIST'` 로 보낸다 — 스펙과 상충.
- 수정안: `TrackedItem.sectionId?: SectionId` 로 선택화(서버는 `EventCollectDtos.kt:69` `sectionId.orEmpty()` 라 이미 빈 값을 받는다), `keyOf` 는 `${e.sectionId ?? ''}`, SR-7.3 eventId 도 `sectionId.orEmpty()` 로 명시. `requirements.md:13` 을 스펙에 맞춘다. 반대로 `'ATTRACTION_LIST'` 를 보내고 SR-1.3 을 고쳐도 된다 — 한 값으로.
- 곁들여: SESSION_START 는 마운트 시점이라 `sidoCode` 가 아직 null(`:251`, 자동 선택 `:449-469` 은 `sidoRegions` 도착 뒤) → `screenRef` 는 사실상 항상 빈 값. 틀린 건 아니지만 「모든 이벤트가 같은 값」 문장에 「SESSION_START 는 보통 빈 값」 한 줄.

**N3 (REVISE). `planning/requirements.md`·`test-quality.md` 가 1라운드 이전 결정을 그대로 갖고 있어, 두 문서를 읽는 구현자가 다섯 군데에서 스펙과 다른 지시를 받는다.**
- `requirements.md:25` 「허브 SEARCH payload 에 `keyword` 를 넣어 … `'*'`」 ↔ 스펙 SR-2.2 「`keyword` 가 아니라 `term`」 — **정반대**. `AnalyticsStreamTopology.kt:131` 이 `payload["keyword"]` 를 읽으므로 requirements 대로 짜면 허브 검색어가 상품 키워드 점수에 섞인다(Goal 위반).
- `requirements.md:15` CLICK `screenRef: keyword || 지역코드` ↔ SR-3.1 「SR-2.1 의 지역 코드」.
- `requirements.md:14` trigger 에 `filter` ↔ SR-2.3 에 없음. `requirements.md:19` SectionId 에 `MAP_OVERLAY` 없음 ↔ SR-6.1. `requirements.md:51` 중복 키에 섹션 없음 ↔ SR-6.3.
- `test-quality.md:5` `payload.trigger·changed·keyword·total` ↔ `term`; `:8` 「eventId 에 entityType 포함」(섹션 누락 — 반영 표 `:22` 에는 있음).
- 수정안: requirements.md 해당 줄을 스펙 문장으로 바꾸거나 머리에 「`spec.md` 가 우선, 아래는 초안」 한 줄. test-quality 는 `:5`·`:8` 두 셀만.

**N4 (메모). SR-8.2 「상수로 SQL 문자열을 만들어 대조」는 상수를 비워도 초록이다.**
- 선례 `ClickHouseAttractionPopularityAdapterTest.kt:57-58` 은 `ANONYMOUS_VISITOR` 상수로 기대값을 조립한다 — 「한쪽만 바뀜」을 잡는 데는 맞지만, `NON_LIST_SECTIONS` 는 「두 섹션이 들어 있다」가 본질이라 `emptySet()` 로 바꿔도 통과한다(루트 CLAUDE.md 「검사가 스스로 만든 근거는 근거가 아니다」).
- 수정안: ① `NON_LIST_SECTIONS shouldBe setOf("MAP_LINK","FAVORITE")` ② SQL 에 리터럴 `section_id NOT IN ('MAP_LINK', 'FAVORITE')` 가 `countIf(action = 'CLICK' AND …)` 와 `uniqStateIf(…)` **두 곳**에 있는지 리터럴로 본다. SR-9.3 회귀 주입에 「상수 비우기」 1건 추가.
- 구현 메모: `INSERT_DAY` 는 `private const val`(`:51`)인데 `Set.joinToString` 은 const 가 못 된다 — `private val` 로 내리거나, SQL 조각을 `const val NON_LIST_SECTIONS_SQL = "'MAP_LINK', 'FAVORITE'"` 로 두고 `events.ts` 주석과 상호 참조한다.

**N5 (메모). 핸들러 목록에 빠진 상태 변경 지점 — trigger ref 를 못 심으면 그 SEARCH 는 trigger 없이 간다.**
- `page`: 모바일 센티널 `PlacePage.tsx:377`, 데스크톱 이전/다음 `:1209`·`:1218`, 모바일 더 보기 `:1231`.
- `category`: 전체 칩 `:1033-1036`, 분류 칩 `:1046-1050`(category·listEventStatus·page 를 같이 바꿈 → `changed` 복수).
- `eventStatus`: `:1099-1102`.
- 구 지역 축: `!hasRegionAxis` 의 `<select>` `:1072-1076`(`areaCode`·geo·page) — `region` 으로 셀지 정한다.
- `region` vs `initial`: `selectRegion`(`:420`)은 칩 `:1181`·시도 마커·`RegionSheet`·자동 선택 `:458` 이 공유 — 자동 선택이 ref 를 먼저 심거나 `selectRegion` 에 trigger 인자를 준다.
- `lang`: `query` deps 에 있어(`:305`) 언어 전환(`:880-884`, navigate 로 같은 인스턴스의 pathname 만 바뀜)도 새 viewId·SEARCH 를 만든다. `lang` 이든 `landing` 이든 한 줄.
- `pickSuggestion:840` 좌표 없는 제안은 early return — ref 는 그 뒤에 심어야 다음 질의로 `suggestion` 이 새지 않는다.

**N6 (메모). SR-3.1 「가운데 클릭」은 `onClick` 으로 오지 않는다.**
- `PlaceCard:1348-1352` 는 `onClick` 하나. 브라우저는 가운데 버튼을 `click` 이 아니라 `auxclick` 으로 낸다 — 수정키 좌클릭(⌘/Ctrl)은 잡히고 가운데 클릭은 안 잡힌다. `onAuxClick` 을 더하거나 문장을 「수정키 좌클릭만 `newTab`」으로 좁힌다. 같은 키라 newTab 뒤 일반 클릭은 떨어진다 — 한 줄 명시.

**N7 (메모). SR-5.4 는 「둘째 `saved:true` 유실」만 적었는데, 같은 view 의 둘째 토글은 방향과 무관하게 떨어진다.**
- 키(`tracker.ts:23-25` 개정 뒤에도)에 payload 가 없다. 찜→해제의 `saved:false` 도, 카드 별(`:1368`)과 패널 별(`:1304`)이 같은 관광지면 서로도 막는다. 기준선은 `saved:true` 만 쓰므로 수치 영향 없음 — 문장만 「둘째 이후 토글은 방향과 무관하게」. SR-9.1 「`saved` 두 방향」은 다른 view 또는 다른 대상으로 짜야 실제 트래커에서도 둘 다 남는다.

**N8 (메모). 컨트롤러 6케이스의 「101건 400」은 standalone 에 `GlobalExceptionHandler` 를 붙여야 운영과 같은 본문이 된다.**
- 선례 `AttractionSearchControllerTest.kt:22` `.setControllerAdvice(GlobalExceptionHandler())`. 없어도 400 은 나지만 `ApiResponse` 가 아니다. `X-User-Id` 케이스는 `collectEvents.collect` 인자를 `slot` 으로 받아 `userId == null` 을 본다.

### 4. 체크리스트 판정

- **C1 참조 존재** ✔ — §2.
- **C2 기존 코드 충돌** △ — N1(스펙↔`:305` deps), N2(스펙↔`events.ts:48` 타입), N3(스펙↔보조 문서). 전부 스펙 문장 수정으로 닫힌다.
- **C3 복잡도** △ — trigger ref 커버리지(N5)가 구현의 실제 난이도. 핸들러 11곳에 한 줄씩이라 위험은 낮으나 빠뜨리면 조용히 trigger 가 빈다 — 「trigger 가 undefined 인 SEARCH 는 테스트가 실패」 한 케이스를 SR-9.1 에 더하면 게이트가 된다.
- **C4 NFR** ✔ — 새 외부 호출·N+1 없음. `seen` Set 은 SPA 수명 동안 허브 질의당 ~30키(기존 동작). 배치 상한·크롤러 거부 유지(`EventCollectDtos.kt:27`, `Controller:45-47`).
- **C5 마이그레이션/롤백** ✔ — 「구현 전제」 명시. 스키마 불변(`V005:26,40`), eventId 형식 변경 무해(§2).
- **C6 동시성** ✔ — 훅 수준 `onSuccess`(SR-5.2), 서버 무상태, `EventIngestionConsumer` 버퍼 불변.

### 5. 요약
- 1라운드 BLOCK 1 + REVISE 2 + 메모 5: **전부 해소**(메모 1건은 이유를 적고 기각 — 수용).
- 새 발견 8: REVISE 3(N1 overlay 는 목록 질의 밖 · N2 SESSION_START 섹션 타입 · N3 보조 문서 stale) + 메모 5(N4 어댑터 테스트 근거 · N5 핸들러 누락 지점 · N6 가운데 클릭 · N7 찜 둘째 토글 · N8 컨트롤러 테스트 advice).
- 사람 판단이 필요한 것은 없다 — N1 은 b 를 기본으로 두고 진행 가능.

2라운드 판정: REVISE (기록용 — 현재 판정은 파일 마지막 줄)

---

## 1라운드 (2026-10-08, 원문)

- 대상: `spec.md` + `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml`
- 코드 기준: 워크트리 `wt-impl`(origin/main `8a61f0b`)
- 규칙 문서: `docs/conventions/kotlin-style.md` §1·§1.1·§3, `docs/conventions/logging.md`, `docs/standards/test-rules.md`, `docs/conventions/frontend-design.md`
- 지식베이스: `kb-search.sh` 는 이 세션에 셸이 없어 `HNS_KB_PATH`(`.claude/hns-hooks.env:10`) 볼트를 직접 grep 했다.
  [[msa-unified-search-instrumentation-record]] (1989v, updated 2026-09-20) — 헤드리스 UA 는 `CrawlerUserAgents` 의 `headlesschrome` 에 걸려 202/`accepted=0`, payload null 하나로 본문 400, 「보냈다」가 아니라 **저장된 행 수**로 판정.
  [[hybrid-search-local-embedding]] (1989v) §「측정은 보낸 것이 아니라 쌓인 것으로 판정한다」.

### 1. 인용 검증 — 스펙이 가리킨 파일:줄이 실제로 그 내용인가

| 스펙 인용 | 실제 | 판정 |
|---|---|---|
| `PlacePage.tsx` `query` 278-306 | `useMemo` 278-306, deps 305 에 `page` 포함, `selectedId` 없음 | ✔ |
| `toggleAttribute` 349-357 | 349-357 | ✔ |
| `selectRegion` 417-439 | 417 은 `pickingRegion`, `selectRegion` 은 **420-440** | 경미(줄 어긋남) |
| 핀 클릭 603 · 727 | 603 목록 핀 `setSelectedId`, 727 **오버레이(음식·쇼핑) 핀** `setSelectedId` | ✔ (727 은 목록 밖 대상 — §3 참조) |
| `pickSuggestion` 837-852 · `runKeywordSearch` 854-859 · `searchThisArea` 861-870 · `nearMe` 872-877 | 일치 | ✔ |
| `PlaceCard` 1329-1383 · 선택 패널 지도 링크 1318-1325 | 1329-1383 ✔ · 링크 `<a>` 는 **1317-1324** | 경미 |
| 카드 `onSelect` 1200-1202, 첫 진입 자동 시도 449-469 | 일치 (`autoPickedRef` 449) | ✔ |
| `useFavorites.ts` 28-48 · `FavoriteButton.tsx` 53-78 | 일치 | ✔ |
| `AttractionPage.tsx` 221-223 · 507-514 | `viewId` memo 221, `installFlushOnLeave` 223, 지도 `<a>` 507-514 | ✔ |
| `UnifiedSearchPage.tsx` 55-71 · `RegionPage.tsx` 271-296 | 일치 | ✔ |
| `RegionPage.test.tsx:13-19, 100-110` | 실제 경로 `pages/place/__tests__/RegionPage.test.tsx`, mock 13-16, 테스트 100-111 | 경로에 `__tests__/` 누락 |
| `PlacePage.test.tsx` 는 tracker mock 없음 (requirements.md:43) | `__tests__/PlacePage.test.tsx:7,14` — placeApi · FavoriteButton 만 mock | ✔ |
| `EventCollectController.kt` 35-56 · `EventCollectDtos.kt` 20-82 · `ClickHouseAttractionPopularityAdapter.kt` 39-63 | 일치 (49 세션 폴백, 59 eventId, 55-57 countIf) | ✔ |
| `AnalyticsStreamTopology.kt` 123-130 | 123-130 필터, **131** `payload["keyword"] ?: "unknown"` | ✔ |
| `KafkaConsumerConfig.kt:18-36` ErrorHandlingDeserializer 없음 | 24 `JacksonJsonDeserializer` 직접 | ✔ |
| `RecommendationEventConsumer.kt:65-72` else 없는 when | 65-72 exhaustive, **71 에 `SESSION_START` 처리 있음** → SR-1.3 안전 | ✔ |
| `VisitorIdFilter.kt:31-33` 헤더 항상 채움 | 28-33 쿠키 `vid` → `X-Visitor-Id` 덮어씀 | ✔ |
| `common/.../EventAction.kt` SESSION_START · `EntityType` PAGE | `EventAction.kt:15`, `EntityType.kt:16` | ✔ |
| `CrawlerUserAgents` 헤드리스 | `CrawlerUserAgents.kt:28` `"headlesschrome"` | ✔ |
| ClickHouse 스키마 변경 없음 | `V005__events_two_axis.sql:26` `section_id LowCardinality(String)`, :40 `payload String` | ✔ |
| `EventRepositoryAdapter.kt:64-101` 깨진 `event_type` | 74·79 `event_type` — V005 에 그 컬럼 없음 | ✔ (Q6) |

### 2. 체크리스트 판정

#### C1 참조 클래스·모듈 존재 — ✔
표 §1. 줄 번호 둘(420-440, 1317-1324)과 테스트 경로(`__tests__/`)만 고친다.

#### C2 기존 코드와 충돌 — ✘ **BLOCK 1건**, REVISE 2건

**B1. 세 가지 CLICK(결과 선택·지도 링크·찜)이 트래커 중복 제거 키에서 같은 키가 되어 뒤의 것이 버려진다.**

- 스펙 결정: SR-3.1 카드·핀 클릭 = `CLICK`/`ATTRACTION`/id, SR-4.1 지도 링크 = `CLICK`/`ATTRACTION`/id(섹션 `MAP_LINK`), SR-5.1 찜 = `CLICK`/`ATTRACTION`/targetKey(섹션 `FAVORITE`). 셋은 **`sectionId`·`payload` 로만** 갈린다. SR-3.3 은 「같은 `viewId` 안 같은 관광지의 같은 action 은 기존 중복 제거 규칙대로 한 번만」을 명시했고, SR-7.2 는 서버 eventId 를 `viewId:entityType:entityId:action` 으로 정했다. `requirements.md:37` 의 기준선 질의도 `uniqExact(tuple(view_id, entity_type, entity_id, action))` 다.
- 코드: `portal-fe/src/analytics/tracker.ts:23-25` `keyOf = viewId|entityType|entityId|action`, `:30` `if (seen.has(key)) return;` — **섹션이 키에 없다.** `EventCollectDtos.kt:52-59` 서버 eventId 도 섹션 없음. `common/.../AnalyticsEvent.kt:19-22` · `V005__events_two_axis.sql:31` 주석이 그 의미(「같은 (viewId, entityId) 는 1회」)를 못 박고 있다.
- 왜 같은 viewId 인가: SR-1.1 대로 `viewId` 는 `query`(`PlacePage.tsx:278-306`)가 바뀔 때만 새로 만드는데, 카드 클릭은 `setSelectedId`(1201) 만 바꾸고 `selectedId` 는 `query` deps(305)에 없다. 선택 패널(1293-1327)의 지도 링크(1317-1324)와 찜 별(1304)은 그 패널 안에 있으므로 **같은 viewId** 다.
- 결과: 데스크톱의 기본 동선 「카드 클릭 → 패널 → 구글맵 열기」에서 두 번째 `track` 이 `tracker.ts:30` 에서 사라진다. 반대로 카드에서 별(1368)을 먼저 누르면 그 뒤 카드 클릭이 사라져 **결과 선택이 덜 센다.** 상세 화면도 같다 — `AttractionPage.tsx:221` viewId 는 contentId 당 하나라 지도 링크(507)와 찜(386)이 서로를 지운다. 스펙 Goal 의 여섯 행동 중 셋이 서로 간섭하고, 설령 FE 를 통과해도 SR-7.2 eventId 와 `requirements.md:37` 질의가 서버·분석 쪽에서 다시 하나로 접는다.
- `test-quality.md:5-6` 의 vitest 는 `track` 을 mock 하므로(`RegionPage.test.tsx:13-16` 패턴) 이 유실을 **못 본다** — 검사가 대상(트래커)을 재지 않는 모양이다.
- 사람 판단이 필요한 선택지:
  1. (권장) 중복 제거 축에 `sectionId` 를 더한다 — `tracker.ts:23-25`, `EventCollectDtos.kt:59`, `requirements.md:37` 질의, `AnalyticsEvent.kt:19-22`·`V005:31` 주석 네 곳. 부작용: 상세 화면에서 같은 관광지가 두 섹션(예 `SAME_CATEGORY_NEARBY` 와 `RELATED_PLACES`)에 동시에 나오면 지금은 노출 1회였던 것이 2회가 되어 인기 집계 분모가 변한다 — 이 변화를 받아들일지 결정.
  2. 키는 두고 `MAP_LINK`·`FAVORITE` 만 목록 축에서 떼어낸다 — 예: 그 두 클릭은 `newViewId()` 를 그 자리에서 만들어 보낸다(노출↔클릭 짝이 필요 없는 행동이라 viewId 를 공유할 이유가 없다). 변경은 FE 두 호출처뿐이지만 「viewId = 화면 한 벌」 의미가 흐려진다.
  어느 쪽이든 **mock 없이 실제 트래커로** 「카드 CLICK → 지도 링크 CLICK 둘 다 `pendingForTest()`(`tracker.ts:119-121`) 에 남는다」를 한 번 보고 켠다.

**R1. `screenRef` 의 시군구 코드가 시도 접두사 없는 3자리라 화면 간 코드 체계가 어긋난다.**
SR-2.1 「`screenRef` 는 시군구 코드」. 허브 state 의 `sigunguCode` 는 `RegionDrilldown.tsx:100` `region.code.slice(2)`, `PlacePage.tsx:403` 비교도 `r.code.slice(2)` — 즉 `'110'` 같은 접미사다. `PLACE_REGION` 은 전체 코드를 쓴다(`RegionPage.tsx:78,280`, 테스트 `RegionPage.test.tsx:108` `screenRef: '11'`). 그대로 넣으면 `'110'` 이 서울 종로·부산 중구를 구분 못 한다. 수정: `screenRef = sigunguCode ? `${sidoCode}${sigunguCode}` : sidoCode ?? ''` 로 전체 코드를 쓰고 스펙 문장을 「행정구역 전체 코드(`PLACE_REGION` 과 같은 체계)」로 바꾼다. payload `sido`·`sigungu` 는 지금처럼 따로 둔다.

**R2. 메인 워킹트리에 analytics·common 미커밋 변경이 진행 중이다.**
세션 시작 시 `git status`: `analytics/.../EventIngestionConsumer.kt`·`AnalyticsStreamTopology.kt`·`KeywordMetrics.kt`·`EventRepositoryAdapter.kt` M, `common/.../AnalyticsEvent.kt` M, `common/.../EventType.kt` **D(staged)**. 스펙이 손대는 `EventCollectDtos.kt`·`EventCollectController.kt`·`ClickHouseAttractionPopularityAdapter.kt` 와 파일은 겹치지 않지만 같은 모듈이고, `EventType.kt` 삭제는 Q6(깨진 `event_type` 질의)와 맞닿아 있다. 구현 착수 전 origin/main 을 다시 받아 Q6 상태와 `AnalyticsStreamTopology.kt:123-131` 이 그대로인지 재확인한다. 스펙 워크트리가 분리돼 있는 것은 맞다.

#### C3 복잡도 위험 — △ 식별, 비차단

- **trigger/changed 계산**(SR-2.3): 직전 `query` 를 ref 에 들고 ~10개 필드를 비교해야 한다. `initial` 은 `autoPickedRef`(`PlacePage.tsx:449-454`)가 이미 있어 구분 가능. 한 조작이 여러 필드를 바꾸는 경로가 실제로 있다 — `pickSuggestion`(841-848: keyword·category·areaCode·geo·page), `selectRegion`(425-429: sido·sigungu·area·geo·page), `runKeywordSearch`(856-858: keyword·geo·page). 스펙의 「사용자 조작 이름 우선」을 구현하려면 **조작 이름을 state 로 남겨** 결과 도착 시 읽는 편이 필드 diff 로 역추론하는 것보다 단순하다 (`pendingTriggerRef.current = 'suggestion'` → SEARCH 발화 시 소비·초기화). diff 역추론은 `keyword` 와 `geo` 가 함께 바뀌는 경우 `submit` 인지 `suggestion` 인지 못 가른다.
- **오버레이 핀**(727)은 목록에 없는 음식·쇼핑 대상이다. SR-3.1 대로 `source: 'map'` 으로 보내면 노출 없는 CLICK 이 인기 집계(`ClickHouseAttractionPopularityAdapter.kt:56`)에 들어간다. `source: 'overlay'` 로 갈라 두면 뒤에서 거를 수 있다 — 한 줄.
- **모바일 무한 스크롤**: viewId 가 `query`(page 포함) 단위라 2페이지가 붙으면 viewId 가 바뀌는데 1페이지 카드는 화면에 남아 있다(`PlacePage.tsx:323-335` 누적). 그 카드를 누르면 CLICK 은 새 viewId, IMPRESSION 은 옛 viewId 로 남아 짝이 끊긴다. `baseKey`(326, page 제외)로 viewId 를 만들고 `page` 는 SEARCH 를 새로 내지 않거나 payload 로만 남기는 쪽이 「같은 화면 한 벌」 정의에 맞는다. 데스크톱은 목록이 통째로 바뀌므로 어느 쪽이든 무방.

#### C4 NFR 안티패턴 — ✔ (관찰 1건)
- N+1·타임아웃·무제한 자원 없음. 배치 상한 100(`EventCollectDtos.kt:27`)·크롤러 거부(`Controller:45-47`) 유지. 사용자 경로 외부 호출 없음.
- SR-8 제외 조건은 `countIf` 술어 안에 들어가 원장을 한 번만 훑는 구조(`Adapter:55-57`)가 유지된다.
- 관찰: SR-2.5 의 `keyword: '*'` 는 `AnalyticsStreamTopology.kt:131` 의 `unknown` 을 피하지만 `'*'` 키로 `KeywordScore` 를 계산해 `keywordScoreRepository.save`·Redis 캐시(154-155)에 `'*'` 행을 남긴다. 상품 키워드 점수에 허브 검색어가 섞이는 것은 통합 검색(`UnifiedSearchPage.tsx:55-71`, payload 에 keyword 없음 → `unknown`)이 이미 하고 있는 일이라 새 오염은 아니다. 범위 밖으로 두되 Q 목록에 한 줄 적어 두면 좋다.

#### C5 마이그레이션/롤백 — ✔
스키마 변경 없음(`V005:26,40`), 이미지는 portal-fe·analytics 둘(`requirements.md:41`). 롤백은 이미지 되돌리기뿐이고 원장에 남은 새 섹션 행은 해가 없다. 인기 집계는 하루 단위 DELETE+INSERT(`Adapter:21-35`)라 SR-8 배포 뒤 재집계하면 앞선 날짜도 바로잡힌다. 스펙에 「롤백 = 이미지 되돌리기, 데이터 이행 없음」 한 줄만 명시하면 된다.

#### C6 동시성 — ✔ (구현 주의 1건)
- 트래커 `seen`·`queue` 는 모듈 변수, JS 단일 스레드라 경합 없음. 서버 컨트롤러 무상태.
- SR-5.1 「서버 성공 뒤에만」: `requirements.md:18` 대로 **훅 수준** `onSuccess`(`useFavorites.ts:28-48` 안)로 둔다. `mutate(vars, { onSuccess })` 의 호출별 콜백은 응답 전에 컴포넌트가 언마운트되면 TanStack Query 가 호출하지 않아 카드가 사라진 뒤의 찜 성공이 빠진다. `saved` 값은 `mutationFn`(29-32)이 **보낸 요청**(remove/add)을 반환해 쓰고, 낙관적 반전 뒤의 `keys` 를 다시 읽지 않는다(이미 뒤집혀 있다).

### 3. 규칙 문서 대조
- `kotlin-style.md` §1.1 최소 수정: 스펙 범위가 파일 단위로 좁다 ✔. §3 `!!` 금지 — `EventCollectDtos.kt:59,62-64` 는 기존 코드의 `!!`(validation 뒤) — 손대지 않는다(보이스카우트 보고만).
- `logging.md`: 새 로거·로그 없음 ✔.
- `test-rules.md`: Kotest BehaviorSpec + MockK — 기존 `CollectEventItemTest.kt`·`ClickHouseAttractionPopularityAdapterTest.kt` 패턴 그대로 ✔. 단 B1 의 FE 테스트는 mock 이 아니라 실제 트래커로 한 건 더.
- `frontend-design.md`: UI 변경 없음(계측만) ✔. 지도 링크 기본 동작 유지(SR-4.2) ✔.
- KB [[msa-unified-search-instrumentation-record]]: SR-9.3 「일반 Chrome UA」·「ClickHouse 행 수로 센다」가 그 교훈과 일치 ✔. CDP 는 `Network.setUserAgentOverride` 로 사람 UA 를 씌운다.

### 4. 요약
- BLOCK 1: B1 — CLICK 세 종류가 `tracker.ts:23-31` 키·`EventCollectDtos.kt:59` eventId·`requirements.md:37` 질의에서 하나로 접힌다. 키에 `sectionId` 를 더할지(부작용: 상세 두 섹션 중복 노출이 2회가 됨) 지도·찜만 viewId 를 분리할지 사람이 정한다.
- REVISE 2: R1 `screenRef` 전체 행정코드, R2 analytics·common 진행 중 변경과 리베이스.
- 비차단 메모: trigger 는 state 로 남겨 읽기 · 오버레이 핀 `source:'overlay'` · 모바일 viewId 를 `baseKey` 로 · 찜 onSuccess 는 훅 수준 · 롤백 한 줄 · 줄 번호 둘.

1라운드 판정: BLOCK (기록용 — 현재 판정은 파일 마지막 줄)

---

VERDICT: SHIP
