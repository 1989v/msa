# spec-review 3라운드 (마지막) — 관광지 상세 첫 화면

범위: 2라운드 심판 판정문 4절 범위만 봤다(`context/review-verdict-round2.md:233-241`). 이미 판정된 항목(U2-3 전화 두 번 노출, I2-3 푸시 게이트 등)은 다시 열지 않는다. 새로 생긴 결함과 편집을 반영하면서 깨진 문장만 적는다.

| 차원 | 판정 | 건수 |
|---|---|---|
| usecase | REVISE (MINOR만) | 2 |
| implementation | REVISE | 2 |
| test-strategy | REVISE | 3 |
| architecture | SHIP | 0 |
| security (대조) | SHIP | 0 |
| domain (대조) | REVISE (MINOR) | 1 |
| 편집 흔적 | — | 4 |

## implementation — REVISE

**I3-1. `admission()` 이 이미 정규화된 `feeText` 에 다시 `stripTags` 를 건다 (심판 NOTES 가 실제 오판으로 이어진다)**
- 스펙: `spec.md:56` 「`admission()` 은 `source.feeText` 를 읽는다 … 규칙 표는 지금 그대로 쓴다」, `spec.md:54` 「`feeText` 는 이미 정규화된 평문이다. 다시 `sourceText` 하지 않는다」.
- 코드: `AttractionAttributeParser.kt:176` `val text = stripTags(raw ?: return Admission.UNKNOWN).trim().lowercase()`, `:189` `TAG = Regex("<[^>]*>")`.
- 결과: `spec.md:119` 의 「<어린이> 무료」(디코드된 feeText)에서 `<어린이>` 가 태그로 지워지고 「무료」만 남는다. 그러면 `STARTS_FREE`(`:167`)에 걸려 **FREE** 가 된다. 요금 칸에는 「어린이만 무료」가 보이는데, 판정과 JSON-LD `isAccessibleForFree`(`spec.md:89`)는 무료라고 말하게 된다. SR-2.2 의 「정규화는 한 번」 원칙과도 어긋난다.
- 수정안: SR-2.3 에 「`admission()` 은 `feeText` 를 그대로 읽는다(`stripTags` 를 걸지 않는다 — 줄바꿈 태그는 `sourceText` 가 이미 `\n` 으로 바꿨다)」를 넣는다. SR-5.1 `AttractionFee`/파서 케이스에는 「`feeText`=「<어린이> 무료」 → UNKNOWN」을 더한다.

**I3-2. 반려동물 칸의 UNKNOWN 폴백 `sourceText(petAcmpyType)` 가 화면·SSR 어디서도 값을 받지 못한다**
- 스펙: `spec.md:41` 「UNKNOWN 이면 `sourceText(petAcmpyType)`」, `spec.md:132` 「반려동물 … UNKNOWN 이면 원문」. 그런데 SR-4.1 필드 목록(`spec.md:97-98`)에는 `petAcmpyType` 이 없다.
- 코드:
  - 읽기 문서 `AttractionSearchDocument.kt:30-74` 에 `petAcmpyType` 필드가 없다(search/app main 에서 grep 0건).
  - SSR 의 `AttractionDocument` 는 `AttractionSearchDocument.toDomain()`(`AttractionSearchDocument.kt:168`, `AttractionSearchAdapter.kt:310`)에서 만들어지므로, SSR 에서도 이 값은 늘 null 이다.
  - FE `placeApi.ts` 의 `Attraction` 에도 이 필드가 없다(grep 0건).
- 결과: 렌더러 단위 테스트에서는 `AttractionDocument` 를 직접 만들어 넘기므로 초록이 나온다. 하지만 운영에서는 UNKNOWN 이면 항상 「정보 없음」이 된다. FE 쪽은 이 칸을 아예 구현할 수 없다.
- 수정안: SR-4.1 에 `petAcmpyType` 을 더한다. 대상은 app `AttractionSearchDocument`(필드·`toDomain`), `SearchAttractionUseCase` 결과, `SearchAttractionService` 매핑, FE `placeApi.ts`, `searchReadRequired` 다. 다른 방법은 반려동물 칸을 「해석값만, UNKNOWN 이면 정보 없음」으로 줄이는 것이다.

## test-strategy — REVISE

**T3-1. 방문 요약 골든의 입력 형식이 정해지지 않아, 양쪽이 각자 입력을 만들 수 있다**
- 스펙: `spec.md:143` 은 「FE `visitSummary` 의 출력 … 을 골든 JSON 으로 쓴다」고만 하고, 입력을 어디에 두는지는 적지 않았다.
- 선례: `attractionJsonLdGolden.test.ts:31` 의 `toApi`, `:63` 의 `input:`. JSON-LD 골든은 **색인 문서 모양의 입력**을 골든에 함께 싣는다. FE 는 그 입력을 `toApi` 로 바꿔 쓰고, Kotlin 은 같은 입력을 읽는다.
- 위험: 속성 모양이 두 쪽에서 다르다. FE 는 평평한 `attrParking`·`closureState` 를 쓰고, Kotlin 은 `AttractionAttributes` 를 쓴다. 각자 입력을 만들면 패리티 검사가 자기 사본을 재게 된다.
- 수정안: 「골든은 `{name, input(색인 문서 모양), output}` 이다. FE 는 `toApi` 를 거쳐 `visitSummary` 를 부르고, Kotlin 은 `input` 을 `AttractionSearchDocument` → `toDomain()` 으로 읽어 렌더한다」를 넣는다. I3-2 를 고치면 `toApi` 에 `petAcmpyType` 도 포함된다.

**T3-2. 전화 회귀 주입이 초록으로 남을 수 있다 — `+82` 분기를 덮는 케이스가 없다**
- 스펙: 패턴은 `(?:\+82[- ]?)?0\d{1,3}…`(`spec.md:71`)이고, 회귀 주입은 「패턴 한 글자 변경 → 전화 골든 패리티 빨강」(`spec.md:184`)이다. 그런데 골든 케이스 8건(`spec.md:149-156` 과 「관광안내전화1330」) 중 `+82` 로 시작하는 것이 없다.
- 결과: `+82` 부분을 지우거나 바꾸는 회귀는 어떤 케이스에도 걸리지 않는다. 「한 글자 변경」은 어느 글자를 바꾸느냐에 따라 초록이 나온다.
- 수정안: 케이스 「+82-2-123-4567」 → `tel:+8221234567` 를 더한다. 회귀 주입은 「대표번호 분기의 `\b` 삭제」처럼 **어느 케이스를 빨갛게 하는지 정해진 변경**으로 적는다.

**T3-3. E-9 가 존재하지 않는 SSR 단언을 빨간불 근거로 든다**
- 스펙: `spec.md:182` 「SSR 에서 `feeText` 에 `sourceText` 다시 걸기 → XSS 단언·「<어린이> 무료」 단언 빨강」.
- 실제: 「<어린이> 무료」 케이스는 `AttractionFee.text` 단위 케이스(`spec.md:119`, domain)뿐이다. SSR 출력에서 `&lt;어린이&gt; 무료` 를 보는 단언은 SR-5.1 어디에도 없다. SSR 쪽 회귀로 이 단언이 빨개질 수 없다.
- 수정안: SR-5.1 렌더러 항목에 「`feeText`=「<어린이> 무료」 → SSR `<dd>` 에 `&lt;어린이&gt; 무료`」를 더한다.

## usecase — REVISE (MINOR)

**U3-1. 「패리티 예외는 셋뿐」이 사실과 다르다**
- 스펙: `spec.md:27` 「SSR 과 FE 가 다른 것은 아래 셋뿐이다」.
- 코드: 렌더러 KDoc 은 「반경 주변 관광지·편의시설·근처 행사·숙소는 … SPA 가 그린다」고 적는다(`AttractionPageRenderer.kt:362`). glossary 의 「주변 명소」도 「서버 렌더 본문에는 없다」(`search/glossary.md:81`)고 적는다.
- 수정안: 「이번 변경이 만드는 차이는 아래 셋뿐이다(기존 FE 전용 주변 절은 그대로)」로 고친다.

**U3-2. E-8 기대값 문구가 모호하다**
- 스펙: `spec.md:165` 「기대값은 「일치하는 id 수 → 0」으로 둔다」. 남는 건수 「11 − 일치 수」인지, 일치한 id 가 0 이 되는지 읽는 사람마다 다르게 읽힌다.
- 수정안: 「요금 칸 「정보 없음」 11 → (11 − 일치 id 수). 일치한 id 는 각각 「정보 없음」이 아니게 된다」로 고친다.

나머지 확인 결과는 문제없다.
- 두 줄 값과 `attributes` null 경계(`spec.md:33`)는 FE 에서도 성립한다. FE 의 속성은 평평한 `attr*` 이고 null 이면 해석 줄이 빠지므로(`placeAttributes.ts:279-297`), 결과가 같다.
- U2 범위에서 SSR `visitorInfo` 4행(`AttractionPageRenderer.kt:451-453`)은 전부 방문 요약 칸으로 옮겨 가고, 사라지는 원천 행은 없다.

## architecture — SHIP

- `AttractionFee.text(useFee, info: Any?)` 의 경계는 `CourseStops.kt:18` 선례와 같다. JSON 은 batch 가 푼다.
- 전화 규칙은 copy.mjs 가 원본이고 Kotlin 이 골든으로 따른다. JSON-LD 와 같은 구조다(`attractionJsonLdGolden.test.ts:24`).
- U7(SSR 은 전화만)은 SR-1.6 · SR-2.6 · Out of Scope 세 곳의 서술이 서로 맞는다.
- 「같은 분류 가까운 곳」 절 위치도 확인했다. 지금은 `regionSection` 안에 있다(`AttractionPageRenderer.kt:553-559`). SR-3.2 가 이것을 밖으로 옮기므로, 새 순서 단언 표지(`same-category-nearby`)와 충돌하지 않는다.

## security (대조) — SHIP

- `feeText` 는 `escapeHtml` 만 건다(`spec.md:75`). 그 밖의 새 원문은 `sourceText → escapeHtml` 순서다(`spec.md:76`). `tel:` href 는 숫자와 `+` 만 남긴 뒤 `escapeHtml` 을 거친다(`spec.md:71,77`).
- 새 문구(배지 문구·「정보 없음」·출처 표시명·무장애 이름 `BarrierFreeInfo.ICONS`)는 상수다. 기존 `escapeHtml` 경로(`AttractionPageRenderer.kt:474,569`)를 그대로 탄다.
- 출력 경로마다 이스케이프가 남아 있다.

## domain (대조) — REVISE (MINOR)

**D3-1. 「배지 줄」을 glossary 에 등록하고, 「방문 요약」과 「방문 정보 요약」의 혼동을 막아야 한다**
- 스펙:
  - 새 용어 「배지 줄」을 쓴다(`spec.md:19,45`, 표지 `visit-badges`).
  - 반면 glossary 등록 목록은 「방문 요약」「확인 상태」「행동 줄」「feeText」뿐이다(`spec.md:186`).
  - 행사·숙박·코스는 SSR 배지 절 제목 「방문 정보 요약」/「At a glance」를 계속 쓴다(`AttractionPageRenderer.kt:475`, `spec.md:20`). FE 탭 이름도 「방문 정보」/「At a glance」다(`AttractionInfoTabs.tsx:11,20`).
- 위험: 「방문 요약」(새 `<dl>`)과 「방문 정보 요약」(옛 배지 절)은 이름이 한 단어 차이인데 가리키는 것이 다르다.
- 현재 glossary 3-1 에는 「배지」「방문 요약」 항목이 하나도 없다(grep 0건).
- 수정안: SR-5.6 등록 목록에 「배지 줄」을 더하고, 「방문 정보 요약은 행사·숙박·코스의 배지 절 제목이며 방문 요약과 다르다」를 금지/주의 열에 적는다.

## 편집 반영 흔적 (문장 깨짐·중복)

1. `spec.md:144` 「케이스는 **위** `tel:` 7사례」라고 쓰여 있지만, 그 목록은 아래 `spec.md:149-156` 에 있다. 「아래」로 고친다.
2. `spec.md:189` 에 `` `placeAttributes.ts:187`., `AttractionSeoText.kt…` `` 가 있다. E-10 을 덧붙이면서 마침표 뒤에 쉼표 목록이 이어졌으므로, 마침표를 지운다.
3. `spec.md:192` Out of Scope 에 같은 항목이 두 번씩 있다. 「수집일·검수일 신설」과 끝의 「수집일 신설」, 「`sameAs`, 사진별 creator」와 「계획 S3-7 의 creator·sameAs(원천 없음)」이다. 한 번씩만 남긴다.
4. `spec.md:73` 과 `spec.md:189` 의 `AttractionPageRenderer.kt:375` 는 지금 줄 번호로 `:376` 이다(`:375` 는 분류·주소 줄). `:565-576` 도 `:566-577` 이다. 고칠 위치를 찾는 데 쓰는 인용이므로 줄 번호를 맞춘다.

VERDICT: REVISE
