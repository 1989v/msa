# Engineer Review — domain (1라운드)

- 대상: `docs/specs/2026-10-08-place-text-and-states/spec.md` (S2-1 · S2-4)
- 작업 트리: origin/main a05ab2765 사본 (`scratchpad/wt-impl`)
- Seed: spec · planning/initialization.md · context/open-questions.yml → 계획서 S2-1(:74)·S2-4(:78) → `docs/context-map.md` · `search/glossary.md` §3-1·3-2 → 인용 코드 직접 대조
- 세션 결정 ①~⑥ 은 재론하지 않았다. 아래 항목은 모두 그 결정 안에서 생긴 결함이다.

## 판정: REVISE (6건, 차단 없음)

## 인용 대조

인용한 file:line 은 대부분 실제 코드와 맞는다. `AttractionSeoText.kt:43-57`, `SearchAttractionService.kt:74,83-87,125,169,226`, `SearchUnifiedService.kt:61,73`, `AttractionSearchController.kt:46-72`, `SearchAttractionUseCase.kt:84,187-188`, `AttractionAttributeParser.kt:26,113,147-158`, `AttractionApiReindexTasklet.kt:221`, `copy.mjs:844-860`, `placeView.ts:203,206`, `placeAttributes.ts:39-55`, `PlacePage.tsx:293-307,470-480,1204-1213,1249-1253,1297-1318,1375-1379,1533,1656`, `UnifiedSearchPage.tsx:230`, `AttractionJsonLdParityTest.kt:90,92`, `AttractionPageRenderer.kt:20-23` 을 확인했다.

어긋난 곳은 둘이고 둘 다 사소하다.
- `AttractionAttributeParser.kt:120` 은 주석 줄이다. 판정은 `:118-123` 에 있다.
- 테스트 경로가 실제로는 `portal-fe/src/pages/place/__tests__/PlacePage.test.tsx` 다. 스펙은 `PlacePage.test.tsx` 로 적었다.

## 체크리스트

| # | 항목 | 결과 |
|---|---|---|
| 1 | BC 경계 · 누출 | **이슈 D-2** — 통합 검색 FE 정규화가 다른 BC 의 summary 까지 건다 |
| 2 | Glossary 존재 | 통과 — `docs/context-map.md:20` → `search/glossary.md` |
| 3 | 스펙 어휘 ↔ glossary | **이슈 D-5** — 「원문 검색」·`exact`·오타 교정이 사전에 없다 |
| 4 | `Avoid:` 동의어 | 통과 — 「주변 관광지」·「정제 검색어」·「카테고리 부스트」를 쓰지 않는다 |
| 5 | 코드와의 어휘 일관 | **이슈 D-3 · D-6** — 목록 `overview` 의 뜻이 바뀌는데 KDoc 이 그대로다. 「개요 없음」 판정이 두 벌로 갈린다 |
| 6 | 불변식 명시 · 강제 가능 | **이슈 D-1 · D-4** — 「sourceText 멱등」이 거짓이다. 「걸린 조건」의 정의가 실제 질의와 다르다 |
| 7 | 도메인 이벤트 | 해당 없음 — 이벤트를 새로 만들지 않는다 |
| 8 | 교차 집계 직접 참조 | 통과 — search 안에서만 바뀌고 place 원천은 그대로 둔다(data-sources §0 ②) |
| 9 | VO / Entity 분류 | 통과 — `AttractionSeoText` 는 상태 없는 함수 묶음이다. SR-4 는 `Availability` VO 의 판정만 바꾼다 |

SR-4(`n/a` → UNKNOWN)는 glossary §3-1 「속성 패싯」의 불변식(「`UNKNOWN` 을 부정으로 바꾸지 않는다」, `search/glossary.md:75`)과 맞는다. 원천 근거도 확인했다: `attr-raw-values.json` 의 en 표본 「N/A (Please use nearby parking facilities)」(`docs/specs/2026-09-29-place-ssr-enrichment/implementation/attr-raw-values.json:1618`).

## 발견

### D-1 「sourceText 멱등」 불변식이 거짓이다. 서버 정규화 뒤 FE 가 한 번 더 거르면 본문이 지워진다 (REVISE · 6번)
- 스펙 SR-2.2 는 `sourceText(sourceText(x)) === sourceText(x)` 를 테스트로 고정하라고 한다. SR-2.1·2.2 는 서버가 정규화한 목록 요약(SR-1.2·1.3)에 FE `overviewText` 를 한 번 더 건다.
- 그런데 함수는 **태그 제거 → 엔티티 디코드** 순서다(`copy.mjs:849-850`, `AttractionSeoText.kt:40-49`). 첫 번째 실행에서 `&lt;X&gt;` 가 `<X>` 로 풀리고, 두 번째 실행이 그것을 태그로 보고 지운다.
- 1단계 증거 표본에 실제 사례가 있다. `s1-6-hub-ui-check.md:16` 의 `K-movie &lt;PARASITE&gt; - …` 는 서버를 거치면 `K-movie <PARASITE> - …` 가 되고, FE 를 한 번 더 거치면 `K-movie  - …` 가 된다. 영화 제목이 사라진다. `&amp;lt;`·`&amp;rsquo;` 같은 이중 인코딩도 두 번째 실행에서 값이 또 바뀐다.
- 결과: SR-6.1 의 멱등 테스트는 이 입력에서 빨강이 된다. 그 입력을 피해 픽스처를 고르면 테스트가 결함을 덮는다.
- 수정안:
  - 서버가 정규화해 내는 표면(허브 카드 `PlacePage.tsx:1656`, 통합 검색 `UnifiedSearchPage.tsx:230`)에서는 FE 정규화를 빼고 받은 문자열을 그대로 그린다. React 텍스트 노드라 `<` 가 섞여도 안전하다.
  - FE 정규화는 원문을 받는 표면에만 둔다. 선택 패널(`:1533`)은 `fetchAttraction`(`PlacePage.tsx:604-608`, findById 원문)을 그리므로 여기에 둔다.
  - 멱등 요구는 지우고 「서버 출력 + 한 번 정규화 = 1회 결과」만 고정한다.
  - 카드 회귀 테스트(SR-6.3 「카드 정규화 제거 → 빨강」)는 Kotest 쪽 서버 요약 테스트로 옮긴다.

### D-2 통합 검색 FE 정규화가 다른 BC 의 summary 까지 건다 (REVISE · 1번)
- SR-1.3 은 서버 쪽 범위를 「관광지 외 타입은 손대지 않는다」로 좁혔다. 그런데 SR-2.2 는 `UnifiedSearchPage.tsx:230` 의 `hit.summary` 전체에 정규화를 건다.
- 이 렌더는 7개 타입(`SearchUnifiedService.kt:118-121`: blog_post·game·concept·deal_offer·service·product)을 함께 그린다. TourAPI 원문 규칙이 code-dictionary 개념 설명 같은 다른 BC 텍스트에까지 적용된다. `List<String>` 같은 문자열은 태그로 읽혀 지워진다.
- 수정안: 정규화는 `hit.type === 'attraction'` 일 때만 건다. D-1 을 따르면 이 표면에서는 FE 정규화가 아예 없어지므로 이 문제도 함께 사라진다.

### D-3 목록 `overview` 의 뜻이 바뀌는데 계약 문구가 그대로다 (REVISE · 5번)
- SR-1.2 를 적용하면 목록 응답의 `overview` 는 「정규화된 평문 요약, 비면 null」이 된다. 단건 응답은 그대로 「원천 원문」이다. 같은 필드 이름이 두 뜻을 갖는다.
- 그런데 KDoc 은 `SearchAttractionUseCase.kt:83` 「목록 응답은 200자 요약 — 전문은 단건 조회로」 그대로다.
- 이 목록 API 는 허브 외에도 상세의 주변·편의시설·지도(`AttractionSearchController.kt:69`)와 빌드 프리렌더(`prerender-seo.mjs:990-997`)가 함께 쓴다.
- 수정안: SR-1.2 에 KDoc 갱신을 넣는다. 예: 「목록: 정규화(`AttractionSeoText.sourceText`) 뒤 200자 평문, 비면 null · 단건: 원천 원문」.

### D-4 0건 화면의 「걸린 조건」이 실제 질의와 다르다 (REVISE · 6번)
SR-5.1 은 조건을 상태 변수(`keyword`·`category`·`listEventStatus`·`attributes`·지역·`geo`)로 나열한다. 질의는 그 상태를 조건부로만 싣는다(`PlacePage.tsx:330-357`).
- `attributes` 는 행사 분류에서 빠진다(`:353`). glossary §3-1 도 「행사를 고르면 … 속성 조건 … 을 모두 뺀다」(`search/glossary.md:75`)고 적고 있다. 지금 정의대로면 결과에 영향이 없는 칩마다 해제 버튼이 생긴다.
- `listEventStatus` 는 행사 분류일 때만 실린다(`:345-347`).
- `areaCode` 는 `sidoCode` 가 있으면 빠진다(`:335`).
- 지역을 통째로 풀면 `pickingRegion`(`:542`)이 켜진다. 그러면 목록 대신 지역 고르기 화면이 나온다(`:1373`). 버튼 하나가 「조건 해제」가 아니라 「화면 전환」이 된다.
- 수정안:
  - 「걸린 조건 = 이번 질의(`query`)에 실제로 실린 사용자 조건」으로 정의한다. 버튼은 `query` 에서 만든다.
  - 지역 해제는 한 단계씩 올린다(시군구 → 시도). 시도까지 풀면 지역 고르기 화면으로 간다는 것도 적는다.
  - SR-6.1 에 「행사 분류 + 고른 속성 칩 → 속성 해제 버튼 없음」 케이스를 더한다.

### D-5 새 용어가 사전에 없고, 「원문」이 두 뜻으로 쓰인다 (REVISE · 3번)
- 스펙은 「원문」을 TourAPI 원천 텍스트(Goal·SR-1, glossary §3-1 의 「원문」)에도 쓰고, 교정 전 검색어(결정 ⑤ 「원문 재검색」, SR-5.3 「원문 검색 파라미터 `exact=true`」)에도 쓴다. 한 문서 안에서 같은 말이 두 뜻이다.
- 오타 교정(`correctedKeyword`)과 새 파라미터 `exact` 는 `search/glossary.md` §3-2 에 없다.
- 수정안:
  - 검색어 쪽은 「원래 검색어」(또는 「교정 없이 검색」)로 통일하고, 「원문」은 원천 텍스트에만 쓴다.
  - 구현 뒤 `/hns:glossary --conflict 오타교정` 으로 §3-2 에 「오타 교정 · `correctedKeyword` · `exact`(교정 생략, 응답 교정어 null)」 행을 더한다.
  - 「표시 시점 정규화」도 같은 기회에 §3-1 에 한 줄 넣는다.

### D-6 「개요 없음」 판정이 표면마다 갈린다 (REVISE · 5번)
- SR-1.2 를 적용하면 목록 `overview` 는 정규화 결과가 비면 null 이다. 빌드 프리렌더는 이 목록 값으로 `hasOverview` 를 정하고, 그 값이 sitemap·허브 링크에 들어갈지를 가른다(`prerender-seo.mjs:996-997`).
- 서버 렌더 robots 는 원문 그대로 `doc.overview.isNullOrEmpty()` 로 noindex 를 판정한다(`AttractionPageRenderer.kt:63`).
- glossary §3-1 「만료 noindex」의 「개요 없음」(`search/glossary.md:87`)이 이렇게 두 기준으로 갈린다. 태그·공백만 있는 개요를 가진 문서는 sitemap 에서는 빠지는데 서버 렌더에서는 index 로 남는다.
- 수정안(둘 중 하나를 스펙에 명시):
  - (a) `AttractionPageRenderer.kt:63` 도 `sourceText(doc.overview).isEmpty()` 로 맞춘다. 이때 `attractionNoindex`(`eventSchedule.ts:105`)도 같은 기준으로 바꿔야 하이드레이션 전후가 같다.
  - (b) 이번 범위에서는 차이를 받아들이고 Out of Scope 에 「개요 없음 기준 통일」을 후속으로 적는다.

### 참고(판정 무관)
- `AttractionSeoText` 를 옮기면 `escapeHtml`·`clampDescription`(HTML·메타 표시 규칙)도 함께 `search:domain` 으로 간다. 의존 규칙은 지키지만 이름 `com.kgd.search.domain.text` 는 범용으로 읽혀 다른 타입이 갖다 쓰기 쉽다. 관광지 원천 규칙이라는 것이 드러나게 `com.kgd.search.domain.attraction.text` 를 권한다. 결정 ① 의 「search:domain 으로」는 그대로 지켜진다.
- SR-1.3: 정규화가 null 을 내면 `SearchUnifiedService.kt:73` 의 `?: it.address` 로 넘어가 주소가 요약 자리에 나온다. 의도한 동작인지 한 줄로 적어 둔다.

VERDICT: REVISE
