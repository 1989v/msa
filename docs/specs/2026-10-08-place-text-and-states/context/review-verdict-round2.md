# 2라운드 심판 결과: place 원문 정제와 상태 규칙 스펙

발견 23건 중 21건 유지, 1건 강등, 1건 기각입니다. BLOCK 은 0건입니다(REVISE 13 · MINOR 10). 입력 발견은 architecture 3 · domain 2 · implementation 4 · security 0(SHIP) · test-strategy 8 · usecase 6 건입니다.

- **기각한 것**: implementation R2-3 은 「템플스테이 0건의 원인이 아직 확정되지 않았다」는 주장입니다. 스펙 `spec.md:56` 에 운영 색인 실측이 적혀 있어 기각했습니다. `lclsSystm3=EX040100` 문서가 0건이므로 리뷰어가 내건 분기 ①=0, 곧 「SR-6 대로 진행」에 해당합니다.
- **강등한 것**: usecase R2-4 의 근거 절반은 「템플스테이가 든 문서 수를 재지 않았다」입니다. 이 부분은 `spec.md:56` 의 실측(ko 74 · en 1, `temple stay` en 18)으로 반증됩니다. 남은 위험은 「temple stay 에서 temple 만 다른 분류로 잡혀 잔여 검색어가 stay 가 된다」뿐이라 REVISE 를 MINOR 로 내렸습니다.
- **직접 확인한 핵심 근거**
  - `QueryIntent.kt:190` 에서 이름이 겹치면 깊은 코드가 이기고, `:172` 의 `byName` 이 private 입니다. 그래서 다 만든 사전을 나중에 거르는 방식은 막혀 있습니다.
  - `CategoryLexiconAdapter.kt:80-85` 는 사전을 언어별로 만들고, `:57` 의 빈 값 가드는 맵만 봅니다.
  - `AttractionSearchDocumentTest.kt:45` 는 리터럴 `"attributeParserVersion":1` 을 읽고 `:61` 에서 1 을 단언합니다.
  - `reindex-capture.json` 에 `"attributeParserVersion" : 1` 이 15곳 있습니다. 리뷰어는 16곳이라 했지만 결론에는 영향이 없습니다. CI 게이트는 `ci.yml:108-109` 입니다.
  - `PlacePage.tsx:551,556-557,561` 에서 `selectRegion` 은 trigger 를 `initial|region` 으로만 받고 ref 를 덮어쓰며 `setGeo(null)` 을 부릅니다.
  - `PlacePage.tsx:1028-1047` 의 이 지역 검색 · 내 주변 검색은 시도를 지우지 않습니다.
  - `App.tsx:264` 의 경로는 `/en/place` 입니다. `QueryClientProvider` 는 `main.tsx:33` 에 있습니다.
  - `glossary.md:106` 의 표제어는 「쿼리 언더스탠딩」입니다.

## 묶음 표

| 묶음 | 포함 발견 | 판정 | 등급 | 채택한 수정 |
|---|---|---|---|---|
| H1 SR-6 의 교집합 위치·순서·포트 구조 | A2-1, impl R2-2 참고 | keep | REVISE | 코드표 **행**을 먼저 거르고 `Lexicon.of` 를 부른다. 포트는 `CategoryCodePort` 로 바꾸고, 캐시·갱신은 application UseCase/Service 가 맡는다 (E7) |
| H2 SR-6 의 언어 축 | A2-2, D2-2(언어), impl R2-2②, test R3, uc R2-2 | keep | REVISE | 집합을 `lang` 별로 받고 그 언어 사전과만 교집합한다 (E7, E8) |
| H3 SR-6 의 집합 완전성·빈 집합·세 상태 | D2-2(완전성), impl R2-2①③, test R1 | keep | REVISE | 버킷 크기는 코드표 행 수 이상, `sum_other_doc_count>0`·빈 집합은 실패로 본다. 「한 번도 못 받음」 테스트를 둔다 (E7, E8) |
| H4 집계 요청이 목 경계 밖 | test R2 | keep | REVISE | 어댑터 요청 캡처 테스트를 둔다 (E8) |
| H5 SR-6 이 바꿀 곳 목록 | A2-3, impl R2-4 | keep | MINOR | KDoc · 주석 · 대역 4곳과 통합 검색 영향을 적는다 (E7) |
| H6 SR-4.2 의 버전 단언 오지시·캡처 재생성 누락 | impl R2-1 | keep | REVISE | `AttractionSearchDocumentTest` 는 1 을 유지하고, 캡처를 재생성해 같은 커밋에 넣는다 (E1) |
| H7 지역 해제가 반경까지 풀고 trigger 를 덮어씀 | uc R2-1 | keep | REVISE | 해제 함수가 상태 setter 를 직접 부르고 `geo` 는 유지한다 (E2) |
| H8 「0건 복구」 행이 이름과 다른 것을 셈 | uc R2-3 | keep | REVISE | 행 이름을 「0건 해제」로 바꾸고 포함 범위를 명시한다. 복구율은 정의하지 않는다 (E5) |
| H9 회귀 주입 누락 | test R4 | keep | REVISE | 13줄을 추가한다 (E11) |
| H10 패널 경로 이중 정규화 미검출 | test R5 | keep | REVISE | 패널 `<PARASITE>` vitest, `findById` Kotest, 주입을 둔다 (E9, E10, E11) |
| H11 용어 | D2-1 | keep | REVISE | 「질의 이해」를 「쿼리 언더스탠딩」으로 바꾸고, glossary 에 「분류 사전」 행을 더한다 (E12) |
| H12 템플스테이 원인 | impl R2-3 | **dismiss** | - | `spec.md:56` 실측(ⓒ) |
| H13 temple stay 의 어절 창 위험 | uc R2-4 | **demote** | MINOR | 착수 전 `analyze` 결과를 기록한다 (E6) |
| H14 `changed` 어휘 | uc R2-5 | keep | MINOR | 상태 필드 이름으로 맞춘다 (E4) |
| H15 「모두 해제」 사후 상태 | uc R2-6 | keep | MINOR | 개별 규칙을 한 번씩 적용한다 (E3) |
| H16 언어 전환 경로·마운트 | test R6 | keep | MINOR | `/en/place`, `App` 자체로 마운트한다 (E9) |
| H17 0건 픽스처 세부 | test R7 | keep | MINOR | 지역 · 반경 · 모두 해제 · 계측 케이스를 둔다 (E9) |
| H18 요약 길이 경계 | test R8 | keep | MINOR | 250자→150자 케이스를 둔다 (E10) |

## 판정 (발견 하나에 객체 하나)

```json
[
 {"id":"A2-1 교집합은 사전 생성 전 코드표 행에, 포트·캐시 이동","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/query/model/QueryIntent.kt","line":190,"quote":"if (existing == null || depth >= existing.second) map[key] = facet to depth"},{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/query/model/QueryIntent.kt","line":172,"quote":"private val byName: Map<String, Pair<Facet, Int>> = entries"},{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":58,"quote":"교집합은 application 계층 한 곳에서 한다(위치는 구현 단계에서"}],"reason":"깊은 코드가 이기고 코드 목록이 private 이라, 다 만든 사전을 나중에 거르면 결과가 달라진다는 지적에 반증이 없다."},
 {"id":"A2-2 색인 코드 집합은 언어별, 포트에 lang","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt","line":81,"quote":"return langs.associateWith { lang ->"},{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt","line":523,"quote":"b.filter { f -> f.term { it.field(\"lang\").value(FieldValue.of(lang)) } }"}],"reason":"사전은 언어별로 만들고 질의는 lang 으로 걸러지는데, 스펙은 집합을 하나로만 적었다."},
 {"id":"A2-3 사전 원본·소유 변경에 따른 문서·대역 목록","verdict":"keep","severity":"MINOR","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/application/attraction/port/CategoryLexiconPort.kt","line":9,"quote":"**못 받으면 빈 사전을 준다.**"},{"file":"search/app/src/main/kotlin/com/kgd/search/SearchApplication.kt","line":23,"quote":"// 분류 사전 주기 갱신 (CategoryLexiconAdapter)"}],"reason":"인용한 KDoc·주석·대역 4곳(SearchAttractionServiceTest:52 등)이 실재한다."},
 {"id":"D2-1 질의 이해 → 쿼리 언더스탠딩, 분류 사전 glossary 미등재","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/glossary.md","line":106,"quote":"| **쿼리 언더스탠딩** | 검색어에서 의도어를 떼어 잔여 검색어·패싯 필터·타입 의도·상업 의도로 나누는 단계"},{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":55,"quote":"### SR-6 질의 이해가 색인에 없는 분류로 좁혀 0건을 만들지 않는다"}],"reason":"용어집 표제어와 다르고, 새 불변식을 가진 「분류 사전」이 용어집에 없다. 스타일이 아니라 공용 어휘 문제로 본다."},
 {"id":"D2-2 색인 코드 집합의 언어 단위·완전성 미정","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt","line":57,"quote":"if (loaded.isEmpty()) {"},{"file":"place/CLAUDE.md","line":58,"quote":"`attraction_category_codes`(`lclsSystmCode2`, ko 315 · en 302)"}],"reason":"빈 값 가드는 맵에만 걸리고, 집합 크기·잘림 규칙이 스펙에 없다."},
 {"id":"impl R2-1 AttractionSearchDocumentTest:61 오지시·reindex-capture 재생성 누락","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocumentTest.kt","line":45,"quote":"\"petPolicy\":\"PARTIAL\",\"attrAdmission\":\"PAID\",\"attributeParserVersion\":1,"},{"file":".github/workflows/ci.yml","line":108,"quote":"./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' --no-daemon"},{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":35,"quote":"`AttractionSearchDocumentTest.kt:61` 의 버전 단언은 `AttractionAttributeParser.VERSION` 으로 바꾼다"}],"reason":"입력 리터럴이 1이라 VERSION(2)으로 바꾸면 빨강이 되고, 캡처 파일의 1(15곳)이 CI diff 게이트에 걸린다."},
 {"id":"impl R2-2 SR-6 집계 크기·언어별·빈 집합 규칙 부재","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt","line":220,"quote":"bucket.name to Aggregation.of { a -> a.filter { f -> f.bool { b -> b.filter(others + bucket.condition) } } }"},{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":58,"quote":"attractions 색인의 `lclsSystm1~3` 값 집합을 집계로 받아 코드표와 교집합한다"}],"reason":"레포에 terms 집계 선례가 없고 스펙에 크기·잘림·빈 집합 규칙이 없다."},
 {"id":"impl R2-3 템플스테이 0건 원인 미확정(벡터 스탬프 가능성)","verdict":"dismiss","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":56,"quote":"운영 색인 실측(2026-10-08, 색인 `attractions_20261007213012`): `lclsSystm3=EX040100` 문서 0건."}],"reason":"ⓒ 리뷰어 수정안의 분기 ①(필터 없이 센 EX040100 문서 수)이 이미 0으로 기록돼 있어 원인 ⓑ(벡터 스탬프)는 배제된다."},
 {"id":"impl R2-4 통합 검색에도 같은 사전이 걸림","verdict":"keep","severity":"MINOR","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/application/unified/service/SearchUnifiedService.kt","line":29,"quote":"val understood = QueryIntent.analyze(q, categoryLexicon.lexicon(query.lang), searchTypes = true)"}],"reason":"실재하는 영향이고, SR-1.3 의 「코드 불변」과 충돌하는 지점이다."},
 {"id":"test R1 SR-6 세 상태 중 둘만 테스트, 빈 집합 규칙 없음","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":60,"quote":"테스트: 코드표에 있고 색인 집합에 없는 코드는 사전에서 빠진다, 색인 집합 조회 실패 시 이전 사전 유지."}],"reason":"「한 번도 못 받음」 상태를 다루는 테스트가 없다."},
 {"id":"test R2 집계 요청이 목 경계 밖","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/standards/test-rules.md","line":12,"quote":"- **Application 테스트**: Outbound Port는 MockK로 Mock"}],"reason":"포트를 목으로 두면 어댑터 요청 모양을 아무것도 재지 않는다."},
 {"id":"test R3 SR-6 언어 축 미정","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt","line":83,"quote":"val ordered = rows.filterNot { it.lang == lang } + rows.filter { it.lang == lang }"}],"reason":"H2 와 같은 문제다."},
 {"id":"test R4 회귀 주입 8종 누락","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":72,"quote":"회귀 주입: 패널 정규화 제거 → vitest 빨강."}],"reason":"새 게이트(순수 함수·relax·exact 직렬화 등)에 주입 항목이 없다."},
 {"id":"test R5 패널 경로 이중 정규화 미검출","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/application/attraction/service/SearchAttractionServiceTest.kt","line":227,"quote":"every { searchPort.findById(\"1\") } returns document(overview = \"가\".repeat(300))"}],"reason":"평문 픽스처라 findById 에 정규화를 걸어도 초록이다."},
 {"id":"test R6 /place/en 경로 오기·마운트 방식","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/App.tsx","line":264,"quote":"<Route path=\"/en/place\" element={placeRoute(<PlacePage />)} />"},{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":67,"quote":"`App.tsx` 의 `/place`·`/place/en` `<Routes>` 를 포함해 마운트한다"}],"reason":"실제 경로는 /en/place 다."},
 {"id":"test R7 0건 픽스처·지역·반경·계측 세부","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":335,"quote":"areaCode: sidoCode ? undefined : (areaCode ?? undefined),"}],"reason":"지역·반경 분기 테스트가 SR-7.1 에 없다."},
 {"id":"test R8 서버 요약 길이 경계","verdict":"keep","severity":"MINOR","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt","line":226,"quote":"overview = overview?.let { if (summarize && it.length > OVERVIEW_SUMMARY_LENGTH) it.take(OVERVIEW_SUMMARY_LENGTH) + \"…\" else it },"}],"reason":"「…」을 붙이는 기준이 원문 길이에서 정규화 길이로 바뀌는데 경계 케이스가 없다."},
 {"id":"uc R2-1 지역 해제 selectRegion 이 반경까지 풀고 trigger 덮어씀","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":551,"quote":"trigger: 'initial' | 'region',"},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":561,"quote":"setGeo(null);"},{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":44,"quote":"해제는 기존 `selectRegion`(`:548-573`)으로 한 단계 위로 올린다."}],"reason":"스펙의 「한 조건만」·「relax」와 지정 함수의 동작이 충돌하고, searchThisArea·nearMe 가 시도를 남겨 시도+반경 0건이 실제로 생긴다(:1028-1047)."},
 {"id":"uc R2-2 SR-6 색인 집합 언어별 아님","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt","line":91,"quote":"val understood = keyword?.let { QueryIntent.analyze(it, categoryLexicon.lexicon(query.lang)) }"}],"reason":"H2 와 같은 문제다."},
 {"id":"uc R2-3 「0건 복구」 행이 이름과 다른 것을 셈","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1378,"quote":"{data?.correctedKeyword && attractions.length > 0 && ("},{"file":"docs/specs/2026-10-08-place-hub-instrumentation/spec.md","line":80,"quote":"카드가 그려진 view 전부(initial·page·lang·other 포함)"}],"reason":"원래 검색어 링크가 0건 아닌 화면에도 있고 useQuery 에 enabled 가 없어(:360-373) 지역 고르기 view 도 SEARCH 를 낸다."},
 {"id":"uc R2-4 잔여 검색어 BM25 일치 미확인","verdict":"demote","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":56,"quote":"분류 필터 없이 제목·개요 `and` 일치만 걸면 「템플스테이」 75건(ko 74·en 1), 「temple stay」 en 18건"}],"reason":"ⓒ 「문서 수를 재지 않았다」는 근거는 실측 기록으로 반증된다. 남은 것은 temple 어절이 다른 분류에 잡힐 가능성뿐이라 강등한다."},
 {"id":"uc R2-5 changed 값 어휘 불일치","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":472,"quote":"changedRef.current = ['attributes', 'page'];"},{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":49,"quote":"`changedRef` 에 푼 축 이름(`keyword`·`category`·`eventStatus`·`attribute`·`region`·`geo`·`exact`)"}],"reason":"기존 changed 값은 상태 필드 이름이다."},
 {"id":"uc R2-6 「모두 해제」 사후 상태 미정","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/specs/2026-10-08-place-text-and-states/spec.md","line":47,"quote":"2개 이상이면 「모두 해제」 버튼 하나."}],"reason":"지역을 몇 단계 푸는지 정해지지 않았다."}
]
```

SUMMARY: keep 21 / demote 1 / dismiss 1

NOTES:
- ADR-0090 `:158` 은 「사전은 원천 코드표에서 만든다」라고 적고 있습니다. SR-6 뒤에는 이 문장이 「코드표 ∩ 그 언어 색인」으로 바뀌고, 사전이 OpenSearch 에도 의존하게 됩니다. 그래서 스펙 머리말의 「ADR 불요(의존 변경 없음)」가 정확한지 사용자 확인 대상으로 남깁니다. 리뷰어 발견이 아니어서 판정은 하지 않았습니다.
- `lang` 없는 질의는 ko 사전을 쓰면서 전 언어 문서를 검색합니다. ko 집합이 전 언어 집합의 부분집합이라 0건 위험은 없습니다.

---

## spec.md 편집 목록 (그대로 반영)

**E1 · SR-4.2 (`spec.md:35`)**
- 바꿀 문장: 「`AttractionApiReindexTaskletTest.kt:305,329` 의 `attributeParserVersion shouldBe 1` 과 `AttractionSearchDocumentTest.kt:61` 의 버전 단언은 `AttractionAttributeParser.VERSION` 으로 바꾼다.」
- 새 문장: 「`AttractionApiReindexTaskletTest.kt:305,329` 의 `attributeParserVersion shouldBe 1` 은 `AttractionAttributeParser.VERSION` 으로 바꾼다. `AttractionSearchDocumentTest.kt:45,61` 은 저장된 문서 JSON(리터럴 `"attributeParserVersion":1`)을 읽어 복원하는 테스트라 1 을 그대로 둔다. `./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest'` 로 `search/app/src/test/resources/attraction/reindex-capture.json` 을 다시 써서(현재 `"attributeParserVersion" : 1` 15곳) 같은 커밋에 넣는다. CI(`ci.yml:108-109`)가 `git diff --exit-code` 로 막는다. 캡처 안의 다른 값(`attrParking` 등)이 함께 바뀌면 그 diff 도 같이 커밋한다.」

**E2 · SR-5.1 지역 항목 (`spec.md:44`)**
- 바꿀 문장: 「해제는 기존 `selectRegion`(`:548-573`)으로 한 단계 위로 올린다.」
- 새 문장: 「해제는 `selectRegion` 을 부르지 않는다. 그 함수는 `setGeo(null)` 로 반경까지 풀고 `triggerRef` 를 `region` 으로 덮는다(`:551-561`). 해제 함수가 직접 한 단계 위로 올린다.
  - 시군구 해제: `setSigunguCode(null)`
  - 시도 해제: `setSidoCode(null)`·`setSigunguCode(null)`·`setAreaCode(null)`
  - `areaCode` 해제: `setAreaCode(null)`

  `geo` 는 건드리지 않고 지도도 옮기지 않는다.」

**E3 · SR-5.1 끝 문장 (`spec.md:47`)**
- 바꿀 문장: 「조건 0개면 버튼 없이 이유 문장만, 2개 이상이면 「모두 해제」 버튼 하나.」
- 새 문장: 「조건 0개면 버튼 없이 이유 문장만 보인다. 2개 이상이면 「모두 해제」 버튼 하나를 더한다. 「모두 해제」는 순수 함수가 낸 조건 각각을 개별 버튼과 같은 규칙으로 한 번씩 푼다. 지역은 한 단계만 푼다(시군구가 있었으면 시도가 남는다). 검색어가 있었으면 `keyword`·`keywordInput`·`exactFor` 도 비우고, 마지막에 `setPage(0)` 한다.」

**E4 · SR-5.1 계측 (`spec.md:49`)**
- 바꿀 문장: 「`changedRef` 에 푼 축 이름(`keyword`·`category`·`eventStatus`·`attribute`·`region`·`geo`·`exact`)을 넣는다.」
- 새 문장: 「`changedRef` 에는 실제로 바꾼 상태 필드 이름을 넣는다. 기존 핸들러와 같은 어휘다(`:472,557,1208`).
  - 검색어: `['keyword','page']`
  - 분류: `['category','page']`
  - 행사 상태: `['listEventStatus','page']`
  - 속성: `['attributes','page']`
  - 시군구: `['sigunguCode','page']`
  - 시도: `['sidoCode','sigunguCode','areaCode','page']`
  - `areaCode`: `['areaCode','page']`
  - 반경: `['geo','page']`
  - 원래 검색어로 검색: `['exact','page']`
  - 「모두 해제」: 푼 필드의 합집합」

**E5 · SR-5.1 계측 (`spec.md:49`)**
- 바꿀 문장: 「`place-hub-instrumentation/spec.md` 집계 표의 「건수에서 빼는 것」에 `relax` 를 더하고(결과 view 에는 포함), 「0건 복구」 행(`trigger='relax'` 의 `uniqExact(view_id)`)을 같은 커밋에서 적는다.」
- 새 문장: 「같은 커밋에서 `place-hub-instrumentation/spec.md` SR-10 표를 고친다.
  - ① 「건수에서 빼는 것」 행의 목록에 `relax` 를 더한다. 검색 제출·필터 적용은 허용 목록(`IN (...)`)이라 쿼리는 그대로이고, 결과 view 에는 들어간다.
  - ② 「0건 해제」 행을 더한다. 정의는 `uniqExact(view_id)` where `action='SEARCH' AND JSONExtractString(payload,'trigger')='relax'` 이다. 해제 버튼·「모두 해제」·「원래 검색어로 검색」으로 생긴 view 전부를 센다. 0건이 아닌 화면에서 누른 원래 검색어 링크, 해제 뒤 다시 0건인 view, 지역 고르기 화면으로 넘어간 view 도 포함한다. 복구율은 이번에 정의하지 않는다.
  - ③ 「결과 view」 정의 칸에 다음 문장을 더한다: 「지역 고르기 화면(`pickingRegion`)으로 넘어간 view 도 SEARCH 가 나가 여기 들어간다(카드는 없다)」.」
- 헤더 결정 ⑦ 의 「SR-5.1 의 집계 표 한 줄만 바뀐다」는 「SR-5.1 의 집계 표 행만 바뀐다」로 바꾼다.

**E6 · SR-6.1 끝에 추가 (`spec.md:56`)**
- 「착수 전 확인(구현 단계에서 하고 이 절에 기록한다): place 코드표에서 이름에 `temple`·`stay`·`템플` 이 든 행(코드·깊이·이름)을 적는다. 그다음 `EX040100` 행을 뺀 코드표로 만든 ko·en 사전에 `QueryIntent.analyze("템플스테이")`·`analyze("temple stay")` 를 넣고, 결과의 facets·residual 을 적는다. facets 가 남으면 그 필터와 잔여 검색어로 `lang=en` 건수를 함께 적는다. 0 이면 구현을 멈추고 사용자에게 보고한다.」

**E7 · SR-6.3 전체 교체 (`spec.md:58`)**

> 3. 규칙: 사전은 **그 언어의 색인 문서가 1건 이상인 코드만** 담는다.
>    - 집합: attractions 색인에서 `lang` 별로 `lclsSystm1`·`lclsSystm2`·`lclsSystm3` 세 필드 값을 terms 집계로 받는다. 버킷 크기는 그 갱신에서 받은 코드표 행 수 이상으로 잡는다(상수·설정 아님). 어느 버킷이든 응답의 `sum_other_doc_count > 0` 이면 잘린 것이므로 어댑터가 예외를 던진다.
>    - 교집합 순서: 언어 `L` 의 사전을 만들 때 코드표 **행**(두 언어 행 모두)을 `code ∈ 집합[L]` 로 먼저 거른다. 그 뒤 기존 순서(다른 언어 행 먼저, `L` 행 나중)로 `QueryIntent.Lexicon.of` 를 부른다. 다 만든 사전을 나중에 거르지 않는다. `Lexicon.of` 는 이름이 겹치면 깊은 코드가 이기므로(`QueryIntent.kt:190`), 나중에 거르면 얕은 코드로 돌아가야 할 이름까지 지운다.
>    - 실패 처리: 코드표를 못 받으면 지금처럼 들고 있던 사전을 쓴다(처음이면 빈 사전). 코드표는 받았는데 `L` 의 집합을 못 받았거나(예외·잘림), 받은 집합이 비었으면 `L` 사전은 들고 있던 것을 쓴다. 한 번도 만든 적이 없으면 코드표 전체로 만든다(오늘 동작). 문서 수 하한은 상수·설정으로 두지 않는다.
>    - 구조(`docs/conventions/package-structure.md` 규칙 6·8):
>      - 포트: `CategoryLexiconPort` 를 `application/attraction/port/CategoryCodePort.kt` 로 바꾼다. 시그니처는 `fun codes(): List<CategoryCode>` 이고, 같은 파일에 `data class CategoryCode(val lang: String, val code: String, val depth: Int, val name: String)` 를 둔다.
>      - 코드표 어댑터: `CategoryLexiconAdapter` 는 place 조회만 하는 `CategoryCodePort` 구현이 된다. 클래스 이름은 `CategoryCodeAdapter` 로 바꾼다.
>      - 색인 쪽: `AttractionSearchPort` 에 `fun indexedCategoryCodes(bucketSize: Int): Map<String, Set<String>>`(lang → 코드)를 더하고 `AttractionSearchAdapter` 가 구현한다. 집계 선례는 `:210-238` 이다.
>      - application: 캐시(`AtomicReference`), `@Scheduled(initialDelay = 5_000, fixedDelay = 10 * 60 * 1000)` 갱신, 교집합, 실패 처리는 `application/attraction/usecase/CategoryLexiconUseCase`(인터페이스, `fun lexicon(lang: String?): QueryIntent.Lexicon`)와 그 구현 `application/attraction/service/CategoryLexiconService` 가 갖는다.
>      - 소비자: `SearchAttractionService`·`SearchUnifiedService` 는 포트 대신 이 UseCase 를 주입한다. 선례는 `SearchAttractionService.kt:34` 의 UseCase 주입과 `InventoryReconciliationService.kt:18` 의 application `@Scheduled` 다.
>    - 바꿀 곳:
>      - `CategoryLexiconPort.kt:9` KDoc 「못 받으면 빈 사전을 준다」를 위 실패 처리로 옮겨 적는다.
>      - `SearchApplication.kt:23` 주석의 갱신 주체를 `CategoryLexiconService` 로 바꾼다.
>      - 테스트 대역 4곳: `SearchAttractionServiceTest.kt:52`, `SearchUnifiedServiceTest.kt:38`, `UnifiedAttractionRequests.kt:32`, `AttractionReindexCaptureTest.kt:183`.
>    - 통합 검색도 같은 사전을 쓰므로(`SearchUnifiedService.kt:29`) 통합 검색의 관광지 분류 필터도 함께 좁아진다. SR-1.3 의 「코드를 바꾸지 않는다」는 summary(`:73`)에 대한 것이다. UseCase 주입 변경은 그 예외다.

**E8 · SR-6.5 전체 교체 (`spec.md:60`)**

> 5. 테스트. 판정은 사전 내부가 아니라 질의 이해의 산출물 `QueryIntent.analyze(질의, useCase.lexicon(lang))` 의 `facets`·`hasFilter` 로 한다.
>    - `CategoryLexiconServiceTest`(Kotest BehaviorSpec, 두 포트 MockK)
>      - ① 코드표에 있지만 그 언어 집합에 없는 코드의 이름 → 필터가 없다.
>      - ② ko 집합에만 있는 코드 → ko 사전은 필터가 있고, en 사전은 같은 코드의 영문 이름과 국문 이름 모두 필터가 없다.
>      - ③ 같은 이름의 깊은 코드가 집합에 없고 얕은 코드가 있으면 → 그 이름은 얕은 코드의 필드(`lclsSystm1` 또는 `lclsSystm2`)로 필터된다.
>      - ④ 집합 조회가 예외면 → 들고 있던 사전을 유지한다.
>      - ⑤ 집합이 빈 맵이거나 그 언어 집합이 비면 → 들고 있던 사전을 유지한다.
>      - ⑥ 집합을 한 번도 못 받으면 → 코드표 전체 사전이다(EX040100 이름에 필터가 있다).
>      - ⑦ 코드표 조회가 실패하면 → 들고 있던 사전을 유지한다.
>    - `AttractionSearchAdapter` 요청 캡처 테스트(`AttractionReindexCaptureTest`·`UnifiedAttractionRequests` 관례)
>      - 집계 요청이 `lang` 별로 `lclsSystm1`·`lclsSystm2`·`lclsSystm3` 세 필드를 terms 집계한다.
>      - 버킷 크기가 인자 `bucketSize` 이상이다.
>      - 응답 `sum_other_doc_count > 0` 이면 예외를 던진다.
>    - 배포 뒤: `GET /api/search/attractions?lang=ko&keyword=템플스테이` 와 `lang=en&keyword=temple stay` 가 모두 `total > 0` 이다.

**E9 · SR-7.1 (`spec.md:64-69`)**
- 「카드·패널」 항목 끝에 추가: 「단건 응답 overview `&lt;PARASITE&gt;` → 패널에 `<PARASITE>` 가 보인다(패널 경로 이중 정규화 감지).」
- 「칩」 항목
  - 바꿀 문장: 「언어 전환 테스트는 `App.tsx` 의 `/place`·`/place/en` `<Routes>` 를 포함해 마운트한다.」
  - 새 문장: 「언어 전환 테스트는 `App` 자체로 마운트한다. `window.history.pushState({}, '', '/place')` 뒤 `render(<QueryClientProvider client={…}><App /></QueryClientProvider>)` 로 띄운다(`App.tsx:202` 가 `BrowserRouter` 를 갖고, `QueryClientProvider` 는 `main.tsx:33` 에 있다). 전환 뒤 경로는 `/en/place` 다(`App.tsx:264`). 테스트 안에 `<Routes>` 를 다시 적지 않는다.」
- 「0건」 항목 끝에 추가:
  - 시군구 선택 + 0건 → 지역 버튼 1개. 누르면 다음 질의에 `sidoCode` 만 있고 `sigunguCode` 는 없다.
  - 시도 + 반경 0건에서 지역 버튼 → 다음 질의에 `lat`·`lng`·`radiusKm` 가 남고 `sidoCode` 는 없다. trigger 는 `relax` 다.
  - `areaCode`·`sidoCode` 상태가 둘 다 있으면 지역 버튼은 시도 하나뿐이다.
  - 시도만 있고 검색어·반경이 없을 때 시도를 풀면 지역 고르기 화면이 나온다.
  - 반경 해제 → 다음 질의에 `lat`·`lng` 가 없다.
  - 조건 3개(검색어·속성 1개·시군구)에서 「모두 해제」 → 다음 질의에 `keyword`·속성 파라미터가 없고 `sidoCode` 만 남는다. 입력창은 빈 값이다.
  - 계측: 각 해제·「모두 해제」·「원래 검색어로 검색」마다 `trigger='relax'` 이고, `changed` 가 SR-5.1 의 필드 목록과 같다.
- 「통합 검색」 항목 끝에 추가: 「테스트 파일은 새로 만든다: `portal-fe/src/pages/search/__tests__/UnifiedSearchPage.test.tsx`.」

**E10 · SR-7.2 (`spec.md:71`)**
- 「…`<PARASITE>` 가 남는다.」 바로 뒤에 추가: 「`findById` 는 원문 `&lt;PARASITE&gt;` 를 그대로 돌려준다. 요약 길이 경계: 원문 250자, 정규화 결과 150자면 `…` 없이 150자 그대로다. 경계 케이스는 조각이 없다는 것만 보지 않고 기대 문자열 전체로 단언한다.」
- 「SR-6.5 의 두 케이스.」 → 「SR-6.5 의 케이스 전부.」

**E11 · SR-7.3 끝에 추가 (`spec.md:72`)**
- 「추가 회귀 주입. 각각 컴파일되는 변경이어야 한다.
  - 순수 함수가 기본 분류를 조건에 넣는다 → 「기본 분류 버튼 없음」 빨강
  - 해제 핸들러가 `triggerRef` 를 심지 않는다 → `relax` 단언 빨강(`other` 가 나온다)
  - `placeApi` 의 `exact` 직렬화를 지운다 → placeApi 테스트 빨강
  - 컨트롤러의 `exact` 바인딩을 지운다 → `AttractionSearchControllerTest` 빨강
  - `PARKING_NO` 에 `n/a` 를 되돌린다 → `raw-fixtures.tsv:105` 빨강
  - `petPartial` 의 `only: 'ko'` 를 지운다 → 영문 4종 단언 빨강
  - `UnifiedSearchPage` summary 에 `overviewText` 를 건다 → `List<String>` 단언 빨강
  - 「실패 시 이전 사전 유지」를 지운다 → SR-6.5 ④ 빨강
  - 빈 집합 가드를 지운다 → ⑤ 빨강
  - 사전을 다 만든 뒤 거르도록 바꾼다 → ③ 빨강
  - 집계 버킷 크기 지정을 지운다 → 요청 캡처 테스트 빨강
  - `findById` 에 정규화를 건다 → `findById` Kotest 와 패널 `<PARASITE>` vitest 빨강
  - 지역 해제를 `selectRegion` 호출로 되돌린다 → 시도+반경 케이스 빨강」

**E12 · 용어 (D2-1)**
- `spec.md:6` 「(질의 이해가 색인에 없는 분류로 좁힘)」 → 「(쿼리 언더스탠딩이 색인에 없는 분류로 좁힘)」
- `spec.md:55` 제목 「질의 이해가」 → 「쿼리 언더스탠딩이」
- `spec.md:56` 「질의 이해가 분류 코드」 → 「쿼리 언더스탠딩이 분류 코드」
- `spec.md:57` 「질의 이해(`QueryIntent.analyze`)가」 → 「쿼리 언더스탠딩(`QueryIntent.analyze`)이」
- `spec.md:85` 「질의 이해(분류 좁힘)를」 → 「쿼리 언더스탠딩(분류 좁힘)을」
- SR-5.5(`spec.md:53`)
  - 바꿀 문장: 「「오타 교정(`correctedKeyword`)」과 「원래 검색어 검색(`exact`)」 행을 더한다.」
  - 새 문장: 「「오타 교정(`correctedKeyword`)」·「원래 검색어 검색(`exact`)」·「분류 사전」 세 행을 더한다. 분류 사전 행은 다음과 같다.
    - 정의: 「place 분류 코드표(`lclsSystmCode2`)의 이름 → 코드 사전(`CategoryLexiconUseCase`). 쿼리 언더스탠딩이 패싯 필터를 만들 때 쓴다. 그 언어의 attractions 문서가 1건 이상인 코드만 담고 10분마다 갱신한다」
    - 피할 말 칸: 「「질의 사전」(쿼리 벡터 캐시의 옛 이름)과 다르다」」

**E13 · 출처 · 기존 코드**
- `spec.md:1` source 목록: `search/app/src/main/kotlin/com/kgd/search/presentation/attraction/AttractionSearchController.kt` → `search/app/src/main/kotlin/com/kgd/search/presentation/search/controller/AttractionSearchController.kt`
- `spec.md:81` 끝에 추가: 「, 집계 선례 `AttractionSearchAdapter.kt:210-238`, application `@Scheduled` 선례 `InventoryReconciliationService.kt:18`」

## 3라운드 재리뷰가 필요한 차원
- **architecture**: E7 의 포트 · UseCase 재배치가 확정안이 됐는지 확인해야 합니다.
- **test-strategy**: E8 · E9 · E10 · E11 이 R1~R8 을 닫는지 확인해야 합니다.
- **usecase**: E2 ~ E5 의 지역 해제, 모두 해제, 계측 행을 확인해야 합니다.
- **implementation**: E1 의 캡처 재생성과 E7 의 집계 규칙을 확인해야 합니다.
- **domain**: E12 의 용어 반영만 가볍게 보면 됩니다.
- **security**: 재리뷰가 필요 없습니다.

## 사용자 판단이 필요한 항목
1. **지역 해제 시 반경 유지 (E2)**: 「한 조건만 푼다」는 스펙 원칙에 맞춰 반경을 남기기로 정했습니다. 반대로 「지역을 풀면 반경도 같이 푼다」를 원하면 E2 와 E9 의 시도+반경 케이스를 뒤집어야 합니다.
2. **「0건 복구」를 「0건 해제」로 바꾸고 복구율을 미룸 (E5)**: 세션 기본값 ⑦ 이 정한 「0건 복구」 행의 의미가 바뀝니다. 복구율이 꼭 필요하면 지금은 `total > 0` 조건과 지역 고르기 view 처리를 따로 정해야 합니다.
3. **ADR-0090 개정 여부 (NOTES)**: `:158` 의 「사전은 원천 코드표에서 만든다」가 SR-6 뒤에는 사실과 달라집니다. 스펙 머리말의 「ADR 불요」를 유지할지, ADR-0090 에 개정 한 줄을 더할지 정해야 합니다.

판정은 아래 파일들의 원문을 직접 읽고 내렸습니다(모두 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/` 기준).
- `docs/specs/2026-10-08-place-text-and-states/spec.md`
- `search/domain/src/main/kotlin/com/kgd/search/domain/query/model/QueryIntent.kt`
- `search/app/src/main/kotlin/com/kgd/search/infrastructure/client/CategoryLexiconAdapter.kt`
- `search/app/src/test/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocumentTest.kt`
- `search/app/src/test/resources/attraction/reindex-capture.json`
- `.github/workflows/ci.yml`
- `portal-fe/src/pages/place/PlacePage.tsx`
- `portal-fe/src/App.tsx`
- `search/glossary.md`