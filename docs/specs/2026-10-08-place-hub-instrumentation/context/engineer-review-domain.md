# Domain Review — place 허브 최소 행동 계측

## 3라운드 (2026-10-08)

- 대상: 2라운드 개정 `spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml`, `context/review-verdict-round2.md`). §2 상충 결정 5건은 확정으로 보고 재론하지 않았다.
- 코드 기준: 워크트리 `wt-impl` (origin/main `8a61f0b`). 메인 트리는 읽지 않았다.
- Seed Discovery: 개정 스펙 → planning/context → 2라운드 리뷰 원문·심판 판정 → 코드(`tracker.ts` · `events.ts` · `identity.ts` · `EventCollectDtos.kt` · `AggregateAttractionPopularityUseCase.kt` · `ClickHouseAttractionPopularityAdapter.kt` · `PlacePage.tsx` · `AttractionPage.tsx` · `App.tsx` · `useFavorites.ts` · `FavoriteButton.tsx` · `wishlistApi.ts`) → KB(1989v 볼트 `wiki/index.md` 직접 grep — `계측|instrument|place-hub|허브 행동|찜`; Bash 미제공이라 `kb-search.sh` 는 못 돌렸다).
- KB: 2라운드 뒤 새로 올라온 관련 페이지 없음. 같은 근거를 유지한다 — [[msa-unified-search-instrumentation-record]] (1989v `raw`, 2026-09-20; `wiki/index.md:322,326` 「질의당 SEARCH 한 행 · 계측은 저장된 행 수로 판정」) · [[msa-place-detail-serving-record]] (1989v, 2026-10-05; `index.md:256` 「찜 별 공통」).
- 참고: 체크리스트가 가리키는 `references/language-reference.md` 는 0.16.1 캐시에 여전히 없다(Glob 0건). 1·2라운드와 같이 체크리스트 본문 기준.

### 2라운드 발견 해소 여부

| 2R | 내용 | 판정 | 근거 |
|---|---|---|---|
| R2-1 | `overlay` 는 SEARCH 발화 경로가 없고 만들면 키가 겹친다 | **해소** | SR-2.3(`spec.md:32`) `trigger` 어휘에서 `overlay` 삭제, `lang`·`other` 추가. SR-2.4(`:33`) 「오버레이 토글은 목록 질의를 바꾸지 않으므로 SEARCH 가 없다」. SR-10(`:79`) 필터 적용 = `region·category·attribute·eventStatus` 만. Out of Scope(`:118`), Q13(`open-questions.yml:63-67`). SR-9.1(`:67`) 「오버레이 칩 토글 → SEARCH 미발화·viewId 불변」 테스트. 코드 근거 불변(`PlacePage.tsx:253`·`:1063`·`:684-698`·`:305`) |
| R2-2 | SR-5.4 가 「어느 행이 버려지는지」를 틀리게 적음 | **해소** | SR-5.4(`:50`) 「(view, 관광지) 당 첫 토글 한 번만 … 이후 토글(해제·재찜)은 `saved` 와 무관하게 중복 키에 걸려 가지 않는다」 + 「처음부터 찜된 채 들어와 해제 → 찜 이면 그 view 의 찜 완료는 0」 + 「신규 저장과 멱등 재응답은 가르지 않는다」. SR-9.1(`:67`) 「`saved` 두 방향 케이스는 서로 다른 viewId 로」·「해제 → 찜은 `pendingForTest()` 에 한 건」. Out of Scope(`:121`). `test-quality.md:31-32` 동기화. `tracker.ts:23-25` 키에 payload 없음 — 서술이 사실과 맞다 |
| R2-3 | planning 문서가 1라운드 이전 문장을 둔 채였음 | **해소** | `requirements.md:13` SESSION_START `screenRef:''`·섹션 없음(`PageItem`) · `:14` `term`(「`keyword` 라는 이름은 … 피한다」)·`trigger` 전 어휘·오버레이 SEARCH 없음 · `:15` CLICK `screenRef: SR-2.1 의 지역 코드`·오버레이 핀 `MAP_OVERLAY` · `:19` `SectionId` 셋 + 판별 합집합 · `:25` 「`term` 이고 `keyword` 를 넣지 않는다」(반대 지시 삭제) · `:51` 「(entityType, entityId, sectionId, action)」. `test-quality.md:5` `term`·`keyword` 없음, `:8` 「entityType·sectionId 포함」. 잔재는 아래 메모 M5 |
| R2-4 | `NON_LIST_SECTIONS` 이름이 자기 기준과 다름 | **해소** | SR-8.2(`:64`) `POST_SELECTION_SECTIONS` + 「이름이 『목록이 아님』이 아닌 이유: `MAP_OVERLAY` 도 목록 밖·노출 없음인데 집계에 넣는다 — 기준은 『선택 뒤 후속 행동』」. SR-6.1(`:53`) 주석 「선택 뒤 후속 행동 — 관심 신호가 아니라 인기 집계에서 뺀다」·`MAP_OVERLAY` 「노출 없는 클릭, 인기 집계 포함」. SR-3.2(`:38`) `clicks > impressions` 수용 + Q4. 위치 `AggregateAttractionPopularityUseCase.companion` 은 코드와 맞다 — `AggregateAttractionPopularityUseCase.kt:22-25` companion 에 `MAX_REAGGREGATE_DAYS`, 어댑터가 application 상수를 읽는 선례 `ClickHouseAttractionPopularityAdapter.kt:3,57`(`CollectEventsUseCase.ANONYMOUS_VISITOR`) |
| R2-5 | `sectionId` 생략이 타입 변경 목록에 없음 | **해소** | SR-6.1(`:53`) `TrackedItem = PlacedItem \| PageItem(entityType:'PAGE', sectionId?: never, sectionIndex?: never, itemIndex?: never)`, `TrackedEvent` 별칭, 「섹션을 빠뜨린 목록 호출처는 컴파일이 막는다」. SR-6.3(`:55`) `sectionId ?? ''`. SR-1.3(`:26`) 「섹션은 없다(`PageItem`, SR-6.1)」. 서버는 `EventCollectDtos.kt:69` `orEmpty()` 그대로(SR-7.3 `:60`) |
| 메모 | Q8 에 `Placement.kt:13` | **해소** | `open-questions.yml:41` 「`Placement.kt:13` 의 『목록 화면이면 빈 문자열』을 『지역을 축으로 고른 목록은 그 지역 코드』로」 |

### 판정 요약 (체크리스트 9항)

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 · 누수 | SHIP — 2라운드와 같음. 서버 변경은 analytics 안(DTO 선택 필드·컨트롤러 폴백·어댑터 제외 절·use case 상수)뿐 |
| 2 | Glossary 존재 | 조건부 — Q10(`open-questions.yml:48-52`, 선적 뒤 `/hns:glossary`). 체크리스트 문자대로면 「부재 → REVISE」지만 권고 조치가 「선적 뒤」라 스펙 수정이 0 이다 — 1·2라운드와 같은 처리 |
| 3 | 스펙 어휘 ↔ glossary | 조건부 — Q10. 2라운드 개정이 새로 만든 말은 `trigger` 값(`landing`·`initial`·`lang`·`other`·`page`)과 지표명(「결과 view」·「선택률」·「결과 선택 튜플」, SR-10). 값은 Q10 의 `trigger` 가 덮고, 지표명은 메모 M6 |
| 4 | `Avoid:` 동의어 | 조건부 — Q10(`Favorite` Avoid 해소). 1라운드 판단 유지 |
| 5 | 유비쿼터스 언어 ↔ 코드 | **SHIP** — R2-1·R2-3·R2-4 해소. 인용 재검: `PlacePage.tsx:1304`·`:1368`·`AttractionPage.tsx:386` 세 찜 호출처 모두 `targetKey={attraction.id}` 라 FAVORITE 행의 `entity_id` 가 선택·노출 행의 관광지 id(`:1201`·`:603`·`:727` 의 `a.id`)와 같은 식별자다 — SR-10 「(view_id, entity_id) 튜플」 조인의 전제가 코드에서 성립한다. `sigunguCode` 는 시도 접두 없이 저장되므로(`:403` `r.code.slice(2)`) SR-2.1 「시도코드+시군구코드」 연결이 `RegionPage` 의 전체 코드 체계와 맞다 |
| 6 | 애그리거트 불변식 | **SHIP** — R2-1·R2-2 해소. 불변식 네 줄이 전부 명시·강제된다: 클릭·노출 튜플(SR-3.4 ↔ `tracker.ts` 키 SR-6.3 ↔ eventId SR-7.3 ↔ `requirements.md:37,51`), 찜은 (view, 관광지) 첫 토글 1회(SR-5.4), 세션 시작 세션당 1회(SR-1.3 ↔ `identity.ts:44-48` 같은 저장소·수명), view 하나 = SEARCH 한 행(SR-2.1 + SR-2.4 오버레이 제외) |
| 7 | 도메인 이벤트 소유 | SHIP — 변동 없음 |
| 8 | 애그리거트 간 직접 참조 | SHIP — 변동 없음 |
| 9 | VO / Entity | SHIP — `PageItem`·`PlacedItem` 은 전송 모양(판별 합집합)이지 도메인 엔티티가 아니다. `trigger`·`changed`·`saved`·`kind`·`source`·`newTab` 은 payload VO |

### 새 발견

구현을 틀리게 만드는 결함은 없다. 아래는 메모 — 스펙 문장 한두 줄이거나 후속 후보이고, 지금 구현을 바꾸지 않는다.

- **M1 — 패널이 열린 채 쪽을 넘기면 지도·찜 행이 선택 없는 view 로 간다.** `selectedId` 는 `selectRegion`(`PlacePage.tsx:430`)만 비우고 쪽 넘김(`:1209`·`:1218`·`:377`)은 안 비운다. 데스크톱에서 카드 선택(view A) → 다음 쪽(view B, 패널 유지) → 패널 지도 링크 → `MAP_LINK` 가 (B, id) 로 가고 B 에는 선택 CLICK 이 없다. SR-10(`:85`) 이 자동완성 패널에 대해 적은 것과 같은 부류(절대 건수에 남고 비율 분자에서 빠짐). 그 문장에 「쪽 넘김 뒤 패널」을 한 어절 더하면 읽는 이가 놀라지 않는다. 구현 변경 없음.
- **M2 — 구 지역 축은 지역을 남기지 않는다.** `!hasRegionAxis` 의 `<select>`(`:1068-1076`)는 `areaCode` 만 바꾸는데 SR-2.1 `screenRef`(시도·시군구)와 SR-2.2 payload(`sido`·`sigungu`)에 `areaCode` 자리가 없다 — 그 SEARCH 행은 `trigger:'region'`·`changed:['areaCode']` 인데 어느 지역인지 모른다. 시도 목록 API 가 비었을 때만 도는 폴백이라 기준선엔 영향 없음. payload 에 `areaCode` 한 칸을 두든지 「구 축은 지역을 남기지 않는다」를 SR-2.2 에 적어 두든지.
- **M3 — 자동완성 제출은 `entityId='*'`·`term=''` 다.** `pickSuggestion` 이 `keyword` 를 비우고(`:841`) 좌표 검색으로 바꾸므로 고른 제안의 글자(`s.title`)는 어디에도 안 남는다. 「검색 제출」 건수엔 문제없고 SR-9.1 의 `suggestion` 1건 단언도 성립한다. 「무엇을 골랐나」가 필요해지면 payload `suggestion` 칸 — 후속.
- **M4 — 「landing 에 카드가 없다」는 시도 목록 도착에 걸려 있다.** `pickingRegion`(`:417`)은 `hasRegionAxis`(`:391`)가 true 여야 true 고, 그 전엔 `:1192` 가 목록을 그린다. 목록이 시도보다 먼저 오면 그 사이 카드가 잠깐 보이고(노출은 1초 체류라 거의 안 남음), 시도 API 가 끝내 비면 landing view 에 카드가 계속 있는데 결과 view 에서 빠진다. 폴백 경로. SR-10(`:84`) 의 「지역 선택 화면이라 카드가 없다」에 「시도 목록이 있을 때」 한 어절.
- **M5 — `requirements.md` 잔재 둘(해롭지 않음).** `:15` 코드 조각이 세 호출처에 `sectionId:'ATTRACTION_LIST'` 한 값을 적고 괄호로만 `MAP_OVERLAY` 를 말한다(SR-3.2 가 우선). `:18` 「`entityType: 대상 매핑`」은 1라운드 R6 이전 문구 — SR-5.1 「이번에는 관광지만」이라 4분기 매핑을 짤 이유가 없다(YAGNI).
- **M6 — Q10 에 지표명도.** SR-10 이 「결과 view」·「선택률」·「결과 선택 튜플」을 새로 정의했다. 2단계 전후 비교가 이 이름으로 오갈 테니 `trigger` 등과 함께 glossary 에 올린다.
- **M7 — `lang` 트리거의 ref 수명.** `lang` 은 pathname 에서 오고(`:227`) `switchLang` 은 `navigate`(`:883`)다. `/`·`/en` 두 Route(`App.tsx:212`·`:316`)가 같은 자리에 같은 엘리먼트라 리마운트 없이 ref 가 산다고 본다. 만약 리마운트되면 ref 가 죽어 `lang` 은 어휘에만 남지만, 그때도 `landing`·`initial` 로 가 건수 정의는 안 깨진다. SR-9.1 에 `lang` 케이스가 없다 — 테스트 차원 메모.

### 통과 근거

- **튜플 조인 전제(체크 5·6)**: 찜 `targetKey` = 관광지 `id`(세 호출처 전부), 선택 CLICK `entityId` = `a.id`, 섹션이 키에 들어가므로 SR-10 의 두 비율 질의(`:87-103`)가 FE 키·서버 eventId 와 같은 축으로 접힌다.
- **세션 정의(R5·R2 잔여 없음)**: `identity.ts:44-48` `sessionStorage` 캐시 + 저장 실패 시 회차 임시 id — SR-1.3 의 플래그 폴백(모듈 변수, 새로고침마다 1회)과 범위가 일치한다.
- **키워드 지표 보호(R4)**: `requirements.md:25` 가 스펙과 같은 방향으로 고쳐져 구현이 `term` 으로 간다. 회귀 주입 「payload 에 `keyword: term` 한 줄 추가」(SR-9.3, `test-quality.md:37`)가 게이트다.
- **집계 오염 방지(SR-8)**: `ClickHouseAttractionPopularityAdapter.kt:55-57` 의 `countIf(action = 'CLICK')`·`uniqStateIf(…)` 두 곳이 제외 대상이고 `:55` 노출은 그대로 — 스펙 문장과 코드 위치가 맞다.

3라운드 판정: **SHIP**. 2라운드 REVISE 5건은 전부 해소됐고, 새 발견은 메모 7건(스펙 한 어절·후속 후보)이며 구현을 바꾸는 것이 없다. 체크 2~4 는 Q10(선적 뒤 glossary)이 조건이다.

---

## 2라운드 (2026-10-08)

- 대상: 개정 `spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml` Q11)
- 코드 기준: 워크트리 `wt-impl` (origin/main `8a61f0b`). 메인 트리는 읽지 않았다.
- Seed Discovery: 개정 스펙 → planning/context → `docs/context-map.md` · `analytics/glossary.md` · `wishlist/glossary.md` · ADR-0095 → 코드(`tracker.ts` · `events.ts` · `identity.ts` · `useImpression.ts` · `EventCollectDtos.kt` · `EventCollectController.kt` · `ClickHouseAttractionPopularityAdapter.kt` · `AnalyticsStreamTopology.kt` · `GameSessionConsumer.kt` · `common/analytics/*.kt` · `PlacePage.tsx` · `RegionPage.tsx` · `AttractionPage.tsx` · `UnifiedSearchPage.tsx` · `useFavorites.ts` · `FavoriteButton.tsx` · `V005__events_two_axis.sql`) → 조사 원문 `s1-12-instrumentation.md:77-84` · 작업 계획 `2026-10-08-place-growth-work-plan.md:68,93,95` → KB(1989v 볼트 `wiki/index.md` 직접 grep — Bash 미제공으로 `kb-search.sh` 는 1라운드와 같이 못 돌렸다).
- KB 인용: [[msa-unified-search-instrumentation-record]] (1989v `raw`, 2026-09-20) `:22` 「질의 한 번 = SEARCH 한 행, 0건도 남는다」 · [[place-cross-analysis]] (1989v `claude/artifact`, updated 2026-10-08) `:13` 「허브 행동 미계측(S1-12b 선행)」, `:202` 「ADR-0074 찜은 로그인 전용」 · [[msa-place-detail-serving-record]] (1989v, 2026-10-05) 「찜 별 공통」.

### 1라운드 발견 재판정

| 1R | 내용 | 판정 | 근거 |
|---|---|---|---|
| B1 | 중복 키·eventId 가 섹션을 몰라 선택·지도·찜 CLICK 이 접힘 | **해소** | SR-3.4(`spec.md:40`) 불변식 명시, SR-6.3(`:55`) FE 키, SR-7.3(`:60`) eventId, `requirements.md:37` 질의에 `section_id`, `test-quality.md:19-20,25`, ADR-0095 `:83`·`:140` 개정 계획(`spec.md:94`), Q11 로 결정 기록. 잔여: `requirements.md:51` 이 아직 「(entityType, entityId, action) 한 번만」 — R2-3 |
| R1 | place glossary 부재·신조어 미등재 | **해소(조치 등재)** | 1라운드 권고가 「선적 뒤 `/hns:glossary`」였고 Q10(`open-questions.yml:48-52`, `spec.md:108`)이 그대로 적혀 있다. 사전 자체는 아직 없다(`docs/product/glossary.md` 없음, `context-map.md:16-38` 에 place 없음) — 체크 2·3 은 선적 뒤 Q10 실행이 조건 |
| R2 | `Favorite` 가 wishlist glossary 의 조건부 `Avoid` | **해소(조치 등재)** | Q10 「wishlist glossary 의 Favorite Avoid 해소」. 코드는 이미 `FavoriteButton.tsx:53`·`wishlistApi.ts:24` 로 통일 — 1라운드 판단 유지 |
| R3 | 한 화면 안에서 `screenRef` 뜻이 이벤트마다 다름 | **해소** | SR-2.1(`:30`) 「PLACE_HUB 의 모든 이벤트가 같은 값」, SR-1.3(`:26`)·SR-3.1(`:37`) 이 그것을 참조. `RegionPage.tsx:280` 의 전체 지역 코드 선례와 같다. 잔여: `requirements.md:15` 가 아직 `keyword || 지역코드` — R2-3 |
| R4 | `payload.keyword` 가 허브 검색어를 상품 KeywordScore 로 흘림 | **해소** | SR-2.2(`:31`) `term` + 이유 명시, 옛 SR-2.5 삭제, Q7 후속. `AnalyticsStreamTopology.kt:131` 은 `keyword` 키만 읽으므로 허브 행은 통합 검색과 같은 `unknown` 으로 간다. 잔여: `requirements.md:25` 가 **아직 반대 지시**(「`keyword` 를 넣어 `'*'`」) — R2-3 |
| R5 | `SESSION_START` 의 「세션」이 게임 세션과 다른 뜻 | **해소** | SR-1.3(`:26`) 「화면 쪽 `sessionId`(탭 수명)와 같은 범위」 = `identity.ts:44-48`, 섹션 비움, SR-1.4(`:27`) `PAGE`/`place-hub` 로 `GameSessionConsumer.kt:47` 의 GAME 과 가름. `PAGE` 는 서버 `EntityType.kt:16` 에 있어 포이즌 필 위험 없음. 잔여: 「PAGE 대상은 `sectionId` 생략 허용」이 `events.ts:48`(필수) 타입 변경을 뜻하는데 SR-6(`:53-55`) 목록에 없다 — R2-5 |
| R6 | 비관광지 찜 매핑이 PRODUCT 클릭·추천 신호를 오염 | **해소** | SR-5.1(`:47`) 「이번에는 관광지만」, Out of Scope(`:99`) 「소비자 쪽 섹션 제외가 먼저」. `AnalyticsEvent.kt:20` 주석은 Q8 |

### 판정 요약 (체크리스트 9항)

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 · 누수 | SHIP — analytics 가 자기 원장·집계만, FE 는 `POST /api/v1/events` 만. SR-7.2 가 미인증 라우트의 `X-User-Id` 를 안 읽는 것도 경계에 맞다 |
| 2 | Glossary 존재 | 조건부 — Q10(선적 뒤). 이번 라운드 판정에 반영하지 않음 |
| 3 | 스펙 어휘 ↔ glossary | 조건부 — Q10 이 신조어 7건(`trigger`·`changed`·`term`·`MAP_LINK`·`FAVORITE`·`MAP_OVERLAY`·`place-hub`) 전부 적음 |
| 4 | `Avoid:` 동의어 | 조건부 — Q10 |
| 5 | 유비쿼터스 언어 ↔ 코드 | REVISE (R2-1, R2-3, R2-4) |
| 6 | 애그리거트 불변식 | REVISE (R2-1, R2-2) — B1 은 해소 |
| 7 | 도메인 이벤트 소유 | SHIP — 찜 CLICK 은 서버 성공 뒤 FE 가 내는 화면 행동 원장 행(SR-5.1·5.3). 비로그인 미발화는 ADR-0074 「로그인 전용」([[place-cross-analysis]] `:202`)과 맞다 |
| 8 | 애그리거트 간 직접 참조 | SHIP — SR-8 집계는 `analytics.events` 한 표만 읽는다 |
| 9 | VO / Entity | SHIP — `trigger`·`changed`·`saved`·`kind`·`source` 는 payload VO |

---

### R2-1 — REVISE (새): `overlay` 는 SEARCH 발화 경로가 없고, 만들면 같은 view 의 SEARCH 와 키가 겹친다

**스펙** — SR-2.3(`spec.md:32`) 이 `trigger` 어휘에 `overlay` 를 두고, SR-10(`:79`) 「필터 적용」이 `overlay` 를 센다. 그런데 SEARCH 발화 규칙은 SR-2.1(`:30`) 「검색 결과가 도착하면 그 `viewId` 로 한 번」, 그리고 `viewId` 는 SR-1.1(`:24`) 「`query` 메모가 바뀔 때」뿐이다.

**코드** — `PlacePage.tsx:253` `overlay` 는 별도 state, `:1063` 칩이 토글, `:684-698` **별도 `useQuery`**(`['place-overlay', overlay, mapView, lang]`)가 가져온다. `:305` `query` 의존성 목록에 `overlay` 가 없다. 즉 오버레이 토글은 `query` 도 `viewId` 도 목록 결과 도착도 바꾸지 않는다. 화면도 이 칩들을 필터 칩과 가르고 `L.onMap`(`:1056`) 이라는 다른 라벨 밑에 둔다 — 「목록 필터」가 아니라 「지도 위 레이어」다.

**결과** — SR-2.1 대로 구현하면 `trigger: 'overlay'` 행은 **한 건도 안 생기고** SR-10 「필터 적용」의 그 항은 조용히 0 이다. 반대로 `overlayData` 도착에서 SEARCH 를 내면 (a) 같은 `viewId` · 같은 섹션 `ATTRACTION_LIST` · 같은 `term` 이라 `tracker.ts:29-30` 키(`viewId|SEARCH|term|ATTRACTION_LIST|SEARCH`)에서 버려지고, (b) 섹션을 달리해 통과시켜도 한 view 에 SEARCH 가 두 행이 되어 「view 하나 = SEARCH 한 행 = trigger 하나」([[msa-unified-search-instrumentation-record]] `:22`, SR-10 의 분모 분할 전제)가 깨진다 — 같은 view 가 검색 제출과 필터 적용 양쪽에 들어간다. (c) 오버레이 질의는 `mapView` 가 바뀔 때마다(지도 `idle`, `:680`) 다시 도니 그걸 「필터 적용」으로 세면 팬 한 번이 한 건이다.

**수정안** — `overlay` 를 `trigger` 어휘(SR-2.3)와 SR-10 `:79` 에서 빼고, SR-3.2 의 `MAP_OVERLAY` CLICK 만 남긴다(오버레이가 쓰이는지는 그 클릭 행이 말한다). Out of Scope 에 「오버레이 토글 자체는 이번 슬라이스에서 세지 않는다 — 목록 질의가 아니라 지도 레이어」 한 줄. 세기를 원하면 별도 결정이 필요하다(어느 `viewId` · 어느 섹션 · 재질의 중복 기준).

BLOCK 이 아닌 이유: 1라운드 B1 처럼 주 흐름이 통째로 유실되는 것이 아니라 한 지표의 한 항이고, 수정이 어휘 한 단어·표 한 칸이다.

### R2-2 — REVISE (새): SR-5.4 가 「어느 행이 버려지는지」를 틀리게 적었다

**스펙** — SR-5.4(`spec.md:50`) 「해제 뒤 다시 찜하면 **둘째 `saved:true`** 는 중복 키에 걸려 가지 않는다」. SR-5.1(`:47`) payload `saved: true|false`, SR-9.1(`:67`) 「`saved` 두 방향」 테스트.

**키** — SR-6.3(`:55`) `viewId|entityType|entityId|sectionId|action`. `saved` 는 payload 라 키에 없다. 그러므로 같은 view 에서 같은 관광지의 찜 CLICK 은 **방향과 무관하게 첫 토글 한 번만** 간다(`tracker.ts:29-30` 의 `seen`). 「찜 → 해제 → 찜」이면 둘째가 아니라 **해제(`saved:false`)부터** 버려진다.

**결과** — `saved:false` 행은 「그 view 의 첫 찜 조작이 해제일 때」(이미 찜한 채로 허브에 들어와 푼 경우)에만 남는다. 기준선(`saved:true` 만)은 영향이 없지만, SR-5.1 의 「true|false」 는 「한 view 안의 토글 이력」이 아니라 「첫 조작의 방향」이고, SR-9.1 「두 방향」 테스트는 view 를 달리해야 통과한다.

**수정안** — SR-5.4 를 「찜 CLICK 은 (view, 관광지) 당 첫 토글 한 번만 남는다. 방향은 payload 가 말하고 기준선은 `saved:true` 만 센다. 같은 view 의 이후 토글(해제·재찜)은 전부 유실이며 받아들인다」로 고치고, SR-9.1 의 「`saved` 두 방향」에 「서로 다른 `viewId` 로」를 붙인다. 결정(`saved:true` 만 집계, 유실 수용)은 그대로다 — 서술만 사실에 맞춘다.

참고: 조사 원문 `s1-12-instrumentation.md:82` 가 요구한 「신규 저장과 멱등 재응답 구분」은 스펙이 채택하지 않았고(요청 종류로만 판정) Out of Scope 에도 없다. 낙관 캐시가 낡은 경우(다른 탭)에만 생기는 일이라 작지만, 한 줄로 「안 가른다」고 적어 두는 편이 낫다.

### R2-3 — REVISE (1라운드 잔여): planning 문서가 개정 스펙과 어긋난 채 남아 있다

`spec.md:4` 는 「개정」이라 했지만 `requirements.md`·`test-quality.md` 는 1라운드 이전 문장을 그대로 두고 절만 덧붙였다. 구현자가 R1·R2 절을 읽으면 스펙과 반대로 짠다.

| 파일:줄 | 남은 옛 문구 | 개정 스펙 |
|---|---|---|
| `requirements.md:25` | 「허브 SEARCH payload 에 `keyword` 를 넣어 `unknown` 키로 떨어지지 않게 한다(`'*'`)」 | SR-2.2(`:31`) `term`, `keyword` 금지. **같은 파일 `:14` 와도 모순** |
| `requirements.md:13` | SESSION_START `sectionId:'ATTRACTION_LIST'` | SR-1.3(`:26`) 섹션 비움 |
| `requirements.md:15` | CLICK `screenRef: keyword || 지역코드` | SR-3.1(`:37`) 지역 코드만 |
| `requirements.md:15,19` | 오버레이 핀(`:727`)도 `ATTRACTION_LIST`; `SectionId` 추가는 `MAP_LINK`·`FAVORITE` 둘 | SR-3.2(`:38`)·SR-6.1(`:53`) `MAP_OVERLAY` |
| `requirements.md:51` | 중복 「(entityType, entityId, action) 한 번만」 | SR-6.3(`:55`) `sectionId` 포함 |
| `test-quality.md:5` | SEARCH payload 검증 항목에 `keyword` | `term` |
| `test-quality.md:8` | 「eventId 에 entityType 포함」 | `:22` 「섹션」이 덮지만 옛 행이 그대로 |

**수정안** — 위 줄을 고치거나, 두 planning 파일 머리에 「`spec.md` 가 우선. 아래 R1~R3 은 1라운드 이전 초안이며 `keyword`·`screenRef`·섹션·중복 키는 스펙을 따른다」 한 줄. 전자가 낫다 — 한 줄 주석은 `:25` 같은 반대 지시를 못 이긴다.

### R2-4 — REVISE (새, 작음): `NON_LIST_SECTIONS` 라는 이름이 자기 기준과 다르다

**스펙** — SR-8.2(`spec.md:64`) 제외 목록 이름 `NON_LIST_SECTIONS` = {`MAP_LINK`, `FAVORITE`}; SR-6.1(`:53`) 주석 「클릭 전용, 인기 집계 제외」.

**불일치** — SR-3.2(`:38`) `MAP_OVERLAY` 도 목록 섹션이 아니고 노출이 없다(노출은 SR-3.3 카드 루트의 `useImpression` 뿐, `useImpression.ts:21`; 핀에는 없다) — 즉 「클릭 전용」인데 인기 집계에 **포함**한다. 그러니 집합의 기준은 「목록이 아님」도 「클릭 전용」도 아니고 「결과에 대한 관심이 아닌 후속 행동(선택 뒤 지도 열기·찜)」이다. 이름이 기준을 틀리게 말하면 다음에 섹션을 더하는 사람이 `MAP_OVERLAY` 를 넣거나 새 「클릭 전용」 섹션을 빼먹는다.

**수정안** — `POST_SELECTION_SECTIONS`(또는 `NON_INTEREST_SECTIONS`)로 바꾸고 SR-6.1 주석을 「선택 뒤 후속 행동 — 관심 신호가 아니라 인기 집계에서 뺀다. 핀·오버레이 클릭은 관심이라 남긴다」로. 덧붙여 SR-3.2 에 「오버레이 클릭은 노출 없는 클릭이라 그 관광지의 일 집계 `clicks` 가 `impressions` 를 넘을 수 있다(`ClickHouseAttractionPopularityAdapter.kt:55-56`; 목록 핀 클릭도 같은 성질)」를 적어 두면 `clickBoost`(ADR-0095 `:123-125`) 쪽이 놀라지 않는다.

### R2-5 — 작은 잔여 (R5): `sectionId` 생략이 타입 변경 목록에 없다

SR-1.3(`:26`) 「PAGE 대상은 `sectionId` 생략 허용」·SR-6.3(`:55`) 「`sectionId` 가 없으면 빈 값」은 `events.ts:48` `sectionId: SectionId`(필수)를 선택으로 바꾸는 일인데 SR-6.1~6.2(`:53-54`) 변경 목록에 없다. SR-6.1 에 「`TrackedItem.sectionId` 를 선택으로」 한 줄. 서버는 `EventCollectDtos.kt:37,69` 가 이미 null → 빈 문자열이라 변경 없음.

---

### 통과 항목 근거

- **불변식(체크 6) 핵심은 해소**: SR-3.4 의 두 튜플이 FE 키(SR-6.3)·서버 eventId(SR-7.3)·기준선 질의(`requirements.md:37`)·회귀 주입(`test-quality.md:25` 「중복 키의 `sectionId` 제거」)까지 한 줄로 이어진다. 상세 두 섹션 겹침 노출 2행 수용은 ADR-0095 §2(`:69-70` 「CTR 은 지면마다 다른 수치」)와 같은 방향 — Q11 기록.
- **`screenRef` 통일(R3)** 은 `Placement.kt:13` 「목록 화면이면 빈 문자열」과 글자로는 다르지만 `RegionPage.tsx:280`(PLACE_REGION 이 지역 코드) 선례가 이미 그 뜻을 「화면이 걸린 범위」로 넓혔다. `common` 주석 갱신은 Q8 에 `Placement.kt:13` 도 넣어 두길.
- **세션 정의(R5)**: `sessionStorage` 플래그와 `identity.ts:46` 의 `kgd.sessionId` 가 같은 저장소·같은 수명이라 「세션당 1회」와 `session_id` 컬럼의 범위가 일치한다. SR-7.1 본문 `sessionId` 폴백은 `tracker.ts:64-69` beacon 경로가 이미 본문에 싣는 값을 서버가 받게 하는 것 — 식별 계약이 한 벌로 닫힌다.
- **키워드 지표 보호(R4)**: `AnalyticsStreamTopology.kt:125-131` 은 `payload["keyword"]` 만 키로 읽으므로 `term` 행은 통합 검색(`UnifiedSearchPage.tsx:63-68`, `keyword` 없음)과 같은 `unknown` 싱크다. `requirements.md:6` 목표가 지켜진다 — 단 R2-3 의 `:25` 를 고쳐야 구현이 그 길로 간다.
- **BC 경계(체크 1)**: 서버 변경은 analytics 안(DTO 선택 필드·컨트롤러 폴백·어댑터 제외 조건)뿐이고 `common`·wishlist·gateway 는 불변. FE ↔ 서버가 섹션 문자열을 각자 들고 상호 참조 주석으로 묶는 것은 ADR-0095 「`sectionId` 는 자유 문자열」 안의 선택이라 받아들인다.

1라운드 판정은 BLOCK 이었고(아래 절 원문), 2라운드는 차단 사유가 없다.

2라운드 판정: REVISE (원문 마지막 줄 `VERDICT: REVISE` — 3라운드 판정이 아래 한 줄로 대체한다).

---

## 1라운드 (2026-10-08, 원문)

- 대상: `spec.md` (+ `planning/requirements.md`, `planning/test-quality.md`, `context/open-questions.yml`)
- 코드 기준: 워크트리 `wt-impl` (origin/main `8a61f0b`)
- Seed Discovery: 스펙 → 같은 폴더 planning/context → `docs/context-map.md` · `analytics/glossary.md` · `wishlist/glossary.md` · `search/glossary.md` · ADR-0095/0017/0074 → 코드(`common/analytics/*.kt`, `portal-fe/src/analytics/*`, `PlacePage.tsx`, `AttractionPage.tsx`, `FavoriteButton.tsx`, `useFavorites.ts`, `EventCollectDtos.kt`, `EventCollectController.kt`, `ClickHouseAttractionPopularityAdapter.kt`, `AnalyticsStreamTopology.kt`, `KeywordMetrics.kt`, `ProductMetrics.kt`, `GameSessionConsumer.kt`, `RecommendationEventConsumer.kt`, `V005__events_two_axis.sql`) → KB(`1989v` 볼트 `wiki/index.md` 직접 조회; Bash 미제공으로 `kb-search.sh` 는 못 돌리고 같은 index 를 grep 했다).
- 참고: 체크리스트가 가리키는 `references/review-protocol.md` · `references/language-reference.md` 는 플러그인 캐시(0.16.1)에 없다. 체크리스트 본문과 `docs/context-map.md` 의 포맷을 기준으로 했다.

### 판정 요약

| # | 항목 | 판정 |
|---|---|---|
| 1 | BC 경계 · 누수 | REVISE (R4, R6) |
| 2 | Glossary 존재 | REVISE (R1) — place BC glossary 없음 · context-map 에 place 미등재 |
| 3 | 스펙 어휘 ↔ glossary | REVISE (R1) — 신조어 6건 미등재 |
| 4 | `Avoid:` 동의어 | REVISE (R2) — 조건부 Avoid, 조건 미충족 |
| 5 | 유비쿼터스 언어 ↔ 코드 | REVISE (R3, R5) |
| 6 | 애그리거트 불변식 | **BLOCK (B1)** — 이벤트 식별 키가 세 행동을 하나로 접는다 |
| 7 | 도메인 이벤트 소유 | SHIP — 찜 완료는 wishlist 도메인 이벤트가 아니라 화면 행동 원장 행이고, 서버 성공 뒤 FE 가 낸다(SR-5.1·5.3). 적절 |
| 8 | 애그리거트 간 직접 참조 | SHIP — analytics 가 자기 원장만 읽는다(SR-8); FE 는 API 만 |
| 9 | VO / Entity | SHIP — `geo`·`trigger`·`changed` 는 payload VO. 식별 문제는 6번으로 |

---

### B1 — BLOCK: CLICK 한 action 에 세 행동을 얹었는데 식별 키는 섹션을 모른다

**스펙 결정**
- SR-3.1 결과 선택 = `CLICK` / `ATTRACTION` / id / 섹션 `ATTRACTION_LIST`
- SR-4.1 지도 링크 = `CLICK` / `ATTRACTION` / id / 섹션 `MAP_LINK`
- SR-5.1 찜 완료 = `CLICK` / `ATTRACTION` / targetKey(=id) / 섹션 `FAVORITE`
- SR-3.3 「같은 `viewId` 안 같은 관광지의 같은 action 은 기존 중복 제거 규칙대로 한 번만 간다」
- SR-7.2 서버 eventId = `viewId:entityType:entityId:action`
- SR-1.1 `viewId` 는 검색 조건(`query`)이 바뀔 때만 새로 만든다

**코드**
- `portal-fe/src/analytics/tracker.ts:23-25` `keyOf = viewId|entityType|entityId|action`, `:29-30` `if (seen.has(key)) return;` — 섹션이 키에 없다
- `analytics/.../EventCollectDtos.kt:57-59` eventId 도 같은 네 축
- `portal-fe/src/pages/place/PlacePage.tsx:305` `query` 의존성에 `selectedId` 가 없다 → 카드 선택·패널 열기는 `viewId` 를 바꾸지 않는다
- `PlacePage.tsx:1366-1369` 찜 별은 카드(`ATTRACTION_LIST` 섹션) **안**에 앉아 있다
- `AttractionPage.tsx:221` 상세의 `viewId` 는 관광지 하나당 한 벌

**문서**
- ADR-0095 §3(`docs/adr/ADR-0095-impression-click-pipeline.md:83-84`) 「같은 view_id + entity_id 는 **노출** 1회로 센다」 — 1회 규칙은 노출에 대해 정의됐고, 클릭 세 종류를 한 키로 접으라는 뜻이 아니다
- `Placement.kt:17` · `events.ts:22` · ADR-0095:64 — `sectionId` 는 「섹션 고유 id」, 즉 **어디에** 보였나. `MAP_LINK`·`FAVORITE` 는 화면 섹션이 아니라 **무엇을 했나**다
- 조사 보고서 `docs/research/2026-10-07-tourism-growth/evidence/stage1/s1-12-instrumentation.md:102` 가 이미 「eventId 에 entityType/섹션이 빠진다」를 지적했고, 스펙은 entityType 만 넣었다

**결과**: 허브의 주 흐름 「카드 선택 → 패널에서 찜 → 지도 열기」에서 첫 CLICK 만 가고 찜·지도 CLICK 은 `tracker.ts:30` 에서 버려진다(키 `viewId|ATTRACTION|id|CLICK` 동일). 상세 화면에서도 「찜 → 지도」 중 뒤엣것이 버려진다. 설령 서버까지 가도 SR-7.2 eventId 가 같고, 기준선 질의 `uniqExact(tuple(view_id, entity_type, entity_id, action))`(`requirements.md:37`)가 다시 하나로 접는다. Goal 의 「찜 완료·지도 링크 클릭을 … 같은 잣대로 비교」와 User Story 1 이 성립하지 않는다.

**사람이 정할 것** (어느 쪽이든 SR-3.3 · SR-7.2 · `requirements.md:37` 질의 · `test-quality.md` 행이 같이 바뀐다):
1. 식별 키에 `sectionId` 를 넣는다 — FE `keyOf` 와 서버 eventId 둘 다. 단 노출까지 넣으면 ADR-0095 §3 (같은 view 에서 두 섹션에 보인 같은 관광지 = 노출 1회) 이 바뀐다. **`action === 'CLICK'` 일 때만 섹션을 키에 넣는** 변형이 ADR 을 안 건드리는 최소안이지만, 「클릭은 (view, entity, action, section) 1회」를 스펙에 불변식으로 적어야 한다.
2. Q5(ErrorHandlingDeserializer)를 먼저 하고 `SAVE` 같은 action 을 늘린다 — 설계상 맞는 축이지만 이번 슬라이스 범위 밖으로 둔 결정이다.
3. 유실을 받아들이고 Goal 에서 찜·지도 집계를 뺀다.

---

### R1 — REVISE: glossary 부재 · 신조어 미등재

- `docs/product/glossary.md` 없음. `docs/context-map.md:16-38` 의 BC 표에 **place 가 없고** `place/glossary.md` 도 없다. 이 스펙의 화면·대상(관광지·허브·시군구)은 place BC 어휘다.
- `analytics/glossary.md`(2026-05-11, `:3`)·`wishlist/glossary.md`(`:3`)는 ADR-0095(2026-09-14)·ADR-0074 이전 것이라 원장·노출·클릭·`viewId`·`Placement`·섹션·찜(다형)이 한 줄도 없다. `wishlist/glossary.md:18-23` 은 아직 `(memberId, productId)` 로 적혀 있고 코드는 `targetKey`·`BLOG_POST` 다(`wishlist/domain/.../WishlistItem.kt:13`).
- 스펙이 새로 만든 용어: `trigger`·`changed`(SR-2.3), `MAP_LINK`·`FAVORITE`(SR-6.1), PAGE id `place-hub`(SR-1.3), 「허브를 연 세션」(Q3). 
- 조치: 스펙 선적 뒤 `/hns:glossary` 로 place glossary 생성 + context-map 한 줄, `/hns:glossary --conflict` 로 위 용어 등재. 스펙 자체 수정은 불필요.

### R2 — REVISE: `Favorite` 는 wishlist glossary 의 조건부 `Avoid`

- `wishlist/glossary.md:26` `Avoid. Favorite, Bookmark (의미 분화 시)`. 스펙은 `FAVORITE` 섹션(SR-5.1)·`FavoriteButton`(SR-5.2)을 쓴다.
- 기계적으로는 BLOCK 규칙이지만, Avoid 조건 「의미 분화 시」가 아니다 — 같은 찜(WishlistItem) 개념이고, ADR-0074 이후 FE 는 `FavoriteButton.tsx:53` · `wishlistApi.ts:24` `FavoriteTargetType` 으로 이미 통일돼 있다([[msa-place-detail-serving-record]] 1989v, 2026-10-05 — 「찜 별 공통」). glossary 가 낡은 것이 원인.
- 조치: `/hns:glossary --conflict Favorite` 로 glossary 를 코드에 맞춘다. 스펙은 그대로.

### R3 — REVISE: 한 화면 안에서 `screenRef` 의 뜻이 이벤트마다 다르다

- SR-2.1 SEARCH: `screenRef` = 시군구 코드(없으면 시도, 없으면 빈 값)
- SR-3.1 CLICK: `screenRef` = 검색어(없으면 지역 코드)
- SR-3.2 IMPRESSION · SR-1.3 SESSION_START: 미명시
- `Placement.kt:13-16` · ADR-0095:63 · `V005__events_two_axis.sql:25` — `screenRef` 는 「그 화면의 **주체**. 목록 화면이면 빈 문자열」. 한 view 의 주체는 하나여야 한다. 지금 정의면 같은 `viewId` 의 SEARCH 행과 CLICK 행이 다른 `screen_ref` 를 갖고, 노출 행은 빈 값이 되어 `screen_ref` 별 CTR 이 안 맞는다.
- 수정안: PLACE_HUB 의 `screenRef` 를 **지역 코드(시군구→시도→'')** 하나로 정해 SEARCH·IMPRESSION·CLICK·SESSION_START 전부 같은 값을 쓴다. 검색어는 이미 SEARCH 의 `entityId`·`payload` 에 있고 `viewId` 로 조인된다(ADR-0095 §3). 기존 `RegionPage.tsx:280`(지역 코드)과도 맞는다.

### R4 — REVISE: `payload.keyword` 가 허브 검색어를 커머스 KeywordScore 로 흘린다

- SR-2.5 「키워드 없는 검색에는 `*` 를 넣어 `unknown` 키로 떨어지지 않게 한다」, SR-2.2 `keyword` 를 payload 에 담는다.
- `AnalyticsStreamTopology.kt:124-131` 은 **모든** SEARCH 를 `payload["keyword"] ?: "unknown"` 으로 키 잡아 `keyword-metrics-store` 에 넣고, `:147-155` 가 `KeywordScore.compute` → Redis 캐시 + `analytics.keyword_scores`(`KeywordScoreRepositoryAdapter.kt:14-18`) 에 쓴다. `KeywordScore` 는 상품 검색 랭킹용 집계다(`analytics/glossary.md:28-34`, ADR-0017 §5).
- 결과: `*` 행 하나와 허브에서 친 관광지 검색어(경복궁…) 행이 상품 키워드 점수 표에 생긴다. `requirements.md:6` 「Streams 키워드 지표를 오염시키지 않는다」가 지켜지지 않는다 — `unknown` 에서 `*` 로 옮겼을 뿐이고, 실제 검색어는 더 들어간다. 통합 검색은 `keyword` 키를 안 보내 공용 `unknown` 싱크에 머문다(`UnifiedSearchPage.tsx:63-68`, [[msa-unified-search-instrumentation-record]] 1989v, 2026-09-20).
- 수정안: payload 필드 이름을 `keyword` 가 아닌 것(`term`)으로 바꾸고 SR-2.5 를 지운다 — 검색어는 ClickHouse 에 그대로 남고 Streams 가지는 통합 검색과 같은 `unknown` 으로 간다. 관광지 검색어를 상품 키워드 점수에 넣기로 **의도**한 것이면 그 사실을 SR-2.5 에 적는다.

### R5 — REVISE: `SESSION_START` 의 「세션」이 코드와 다른 뜻이다

- 코드: `GameSessionConsumer.kt:29,45-53` — SESSION_START = **게임 한 판**(entity GAME, `visitorId`/`sessionId` = 판의 `sessionKey`, eventId `session_start:{sessionKey}`).
- 스펙 SR-1.3 / Q3: SESSION_START = 허브를 연 **브라우저 탭 세션**(`sessionStorage` 플래그; `identity.ts:44-48` 탭 수명, 비활동 만료 없음 — `s1-12-instrumentation.md:71`).
- 같은 action 이름 아래 두 세션 정의가 공존한다. ADR-0095 두 축 모델상 허용되지만, `action='SESSION_START'` 를 entity 구분 없이 세면 섞인다. 스펙에 「PLACE_HUB 세션 = FE `sessionId` 와 같은 범위(탭 수명)」를 명시하고, 플래그 키(`kgd.place.sessionStarted`, `requirements.md:13`)와 `session_id` 컬럼이 같은 범위라는 불변식을 적는다.
- 부수: SR-1.3 의 섹션 `ATTRACTION_LIST` 는 세션 시작의 위치가 아니다(`Placement.kt:17`). TS `TrackedItem.sectionId` 가 필수(`events.ts:48`)라 넣은 것이면, PAGE 대상 이벤트에서는 비워 보내도록 타입을 느슨하게 하는 편이 뜻에 맞다. 작은 항목.

### R6 — REVISE: 비관광지 찜 매핑은 지금 쓰지 않는데 오염 경로가 열려 있다

- SR-5.1 이 `PRODUCT→PRODUCT`, `GAME→GAME`, `BLOG_POST→POST` 를 정의하지만 SR-5.2 에서 `tracking` 을 넘기는 호출처는 place 셋뿐이다.
- 누가 상점에서 `tracking` 을 넘기는 순간 PRODUCT 찜 CLICK 은 `ProductMetrics.kt:15-18` 에서 상품 클릭(CTR 분자)으로, `RecommendationEventConsumer.kt:48-49,67` 에서 추천 `click` 신호로 센다 — SR-8 이 ATTRACTION 에만 막은 오염이 PRODUCT 에서는 그대로다.
- 수정안: 이번 스펙은 `ATTRACTION` 매핑만 정의하고(YAGNI), 나머지는 「소비자 쪽 섹션 제외를 먼저 넣은 뒤 연다」로 Out of Scope 에 적는다.
- 후속 메모: SR-7.2 로 eventId 에 entityType 이 들어가면 `common/.../AnalyticsEvent.kt:20-21` 주석 「같은 (viewId, entityId) 는 1회」가 낡는다. `common` 은 안 건드리기로 했으니 post-impl 항목으로 남긴다.

---

### 통과 항목 근거 (1라운드)

- BC 경계: SR-7 수집기·SR-8 집계는 analytics 소유(ADR-0095 §5-6), FE 는 `POST /api/v1/events` 만 부른다. wishlist 서버는 손대지 않는다.
- SR-8.1 의 FAVORITE·MAP_LINK 제외는 `unique_clickers` 를 읽는 검색 `clickBoost`(ADR-0095:123-125, `search/glossary.md:78`; [[msa-place-ssr-enrichment-record]] 1989v, 2026-10-02 「클릭 신호(꺼짐, 0곳)」)까지 같이 보호한다. 찜이 클릭보다 강한 관심 신호인데 인기에서 빼는 것은 제품 결정이고 User Story 2 가 그 이유를 말한다 — 적절.
- SR-9.3 일반 UA · 202 accepted 확인은 [[msa-unified-search-instrumentation-record]](1989v, 2026-09-20) 의 함정(헤드리스 UA 202/accepted=0, payload null 400)과 맞다.

1라운드 판정: BLOCK (원문 마지막 줄 `VERDICT: BLOCK` — 2라운드 판정이 아래 한 줄로 대체한다).

---

VERDICT: SHIP
