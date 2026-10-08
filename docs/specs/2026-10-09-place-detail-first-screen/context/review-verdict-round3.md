# spec-review 심판 3라운드(마지막): 관광지 상세 첫 화면

전체 12건 중 10건은 유지하고 2건은 기각했습니다. 강등한 건은 없습니다. 기각한 2건은 편집 흔적 2(마침표)와 편집 흔적 3(Out of Scope 중복)입니다. 둘 다 뜻이 바뀌지 않는 표기 정리라서 헌법 5(스타일)에 해당합니다. 고쳐도 문제는 없습니다. BLOCK 은 없습니다.

두 건은 리뷰어가 말한 것보다 실측이 더 무겁게 나왔습니다.
- **I3-1**: `admission()` 은 지금 `&lt;` 가 디코드되지 않은 원문을 받기 때문에 「<어린이> 무료」가 UNKNOWN 입니다. 그런데 `feeText`(디코드된 값)로 바꾸면 `stripTags` 가 「<어린이>」를 지워 FREE 가 됩니다. 스펙을 그대로 구현하면 판정이 틀어집니다.
- **I3-2**: 읽기 쪽에서 `petAcmpyType` 이 빠진 것은 실수가 아니라 의도된 예외입니다. `build.gradle.kts:528` 에 이유가 「응답 필드가 아니다」로 등록돼 있습니다. 그래서 필드만 더하면 게이트가 실패합니다(`:598`). 수정 문장에 omitted 항목 제거도 함께 넣었습니다.

## 1. 묶음 표

| 묶음 | 내용 | 포함 발견 | 판정 |
|---|---|---|---|
| D1 | 요금 판정에서 정규화를 두 번 한다. 디코드된 `<…>` 가 태그로 지워져 FREE 가 된다 | I3-1 · T3-3 | 유지 REVISE |
| D2 | 반려동물 칸의 원문 폴백 값이 읽기 경로에 없다 | I3-2 | 유지 REVISE, 사용자 판단 U8 |
| D3 | 골든 입력 형식과 전화 회귀 주입에 빈틈이 있다 | T3-1 · T3-2 · 편집 흔적 1 | 유지 REVISE(편집 흔적 1 은 MINOR) |
| D4 | 문구·용어·인용 정확도 | U3-1 · U3-2 · D3-1 · 편집 흔적 4 | 유지 MINOR |
| D5 | 표기 정리 | 편집 흔적 2 · 3 | 기각(스타일) |

## 2. 발견별 판정 JSON

```json
[
  {"id":"I3-1 admission() 이 정규화된 feeText 에 stripTags 재적용","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":176,"quote":"val text = stripTags(raw ?: return Admission.UNKNOWN).trim().lowercase()"},
               {"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":167,"quote":"private val STARTS_FREE = Regex(\"\"\"^(무료|free(?![a-z]))\"\"\")"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":56,"quote":"`admission()` 은 `source.feeText` 를 읽는다 — 표시와 같은 값이다. 규칙 표는 지금 그대로 쓴다."},
               {"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt","line":49,"quote":"text = text.replace(BR, \"\\n\")"}],
   "reason":"「<어린이> 무료」가 stripTags 를 거치면 「무료」만 남아 STARTS_FREE 에 걸리고, 줄바꿈 태그는 sourceText 가 이미 \\n 으로 바꿨으므로 다시 걸 이유가 없다."},
  {"id":"I3-2 반려동물 UNKNOWN 폴백 sourceText(petAcmpyType) 값이 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"build.gradle.kts","line":528,"quote":"\"petAcmpyType\" to \"반려동물 동반 — 테마 필터 축이지 응답 필드가 아니다\","},
               {"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchAdapter.kt","line":310,"quote":"return if (response.found()) response.source()?.toDomain() else null"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":41,"quote":"`petPolicy` ALLOWED·PARTIAL → 지금 배지 문구. UNKNOWN 이면 `sourceText(petAcmpyType)`"}],
   "reason":"search/app main 과 portal-fe/src/api/placeApi.ts 에서 petAcmpyType 을 grep 하면 0건이다. 읽기 생략 목록에 등록돼 있어서, SSR·FE 모두 이 값을 늘 null 로 받는다."},
  {"id":"T3-1 방문 요약 골든 입력 형식 미정","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/seo/__tests__/attractionJsonLdGolden.test.ts","line":31,"quote":"function toApi({ location, ldongRegnCd, eventStartEffective, eventEndEffective, ...rest }: IndexDoc) {"},
               {"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionJsonLdParityTest.kt","line":47,"quote":"fun documentOf(input: JsonNode) = indexMapper.treeToValue(input, AttractionSearchDocument::class.java).toDomain()"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":143,"quote":"FE `visitSummary` 의 출력(칸 이름·값·배지 줄)을 골든 JSON(...)으로 쓴다."}],
   "reason":"선례 골든은 input 을 함께 실어 두 쪽이 같은 입력을 읽는데, 스펙은 output 만 정했으므로 Kotlin 이 자기 사본 입력을 만들 수 있다."},
  {"id":"T3-2 전화 회귀 주입이 +82 분기를 덮지 않음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":71,"quote":"패턴: `(?:\\+82[- ]?)?0\\d{1,3}[- ]?\\d{3,4}[- ]?\\d{4}`"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":184,"quote":"Kotlin `attractionPhone` 패턴 한 글자 변경 → 전화 골든 패리티 빨강"}],
   "reason":"spec.md:149-156 의 7사례와 「관광안내전화1330」 중 +82 로 시작하는 것이 없으므로 그 분기를 바꾸는 회귀는 초록으로 남는다. 리뷰어가 예로 든 「\\b 삭제」도 현재 케이스로는 빨개지지 않을 수 있어서, 편집안은 +82 분기 삭제로 정했다."},
  {"id":"T3-3 E-9 가 존재하지 않는 SSR 「<어린이> 무료」 단언을 근거로 듦","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":182,"quote":"SSR 에서 `feeText` 에 `sourceText` 다시 걸기 → XSS 단언·「<어린이> 무료」 단언 빨강"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":119,"quote":"`infotext` 「&lt;어린이&gt; 무료」 → 「<어린이> 무료」(정규화 한 번)."}],
   "reason":"「<어린이> 무료」는 AttractionFee 단위 케이스에만 있고 SSR 출력 단언은 SR-5.1 에 없다. XSS 단언(:135 의 `&lt;img` 존재)은 빨개지지만, 인용된 둘째 근거는 실재하지 않는다."},
  {"id":"U3-1 「패리티 예외는 셋뿐」이 사실과 다름","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":361,"quote":"반경 주변 관광지·편의시설·근처 행사·숙소는 조회가 더 필요해 SPA 가 그린다"},
               {"file":"search/glossary.md","line":81,"quote":"관광지 상세에서 화면이 검색 API 반경 검색으로 그리는 가까운 관광지 절 … 서버 렌더 본문에는 없다"}],
   "reason":"기존 FE 전용 절이 실재하므로 「셋뿐」은 이번 변경분으로 한정해야 한다. 리뷰어가 인용한 :362 는 실제로 :361 이지만 내용은 같다."},
  {"id":"U3-2 E-8 기대값 「일치하는 id 수 → 0」 모호","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":165,"quote":"기대값은 「일치하는 id 수 → 0」으로 둔다."}],
   "reason":"남는 건수인지, 일치한 id 의 「정보 없음」 수인지 원문이 정하지 않는다. 반증할 근거가 없다."},
  {"id":"D3-1 「배지 줄」 glossary 미등록·「방문 정보 요약」 혼동","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":475,"quote":"return \"<h2>${if (en) \"At a glance\" else \"방문 정보 요약\"}</h2><ul>$list</ul>\""},
               {"file":"portal-fe/src/pages/place/AttractionInfoTabs.tsx","line":11,"quote":"visit: '방문 정보',"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":186,"quote":"「방문 요약」「확인 상태」「행동 줄」「feeText」를 등록한다."}],
   "reason":"glossary 에서 「배지」를 grep 하면 0건이고, 한 단어 차이인 두 이름이 서로 다른 절을 가리킨다."},
  {"id":"편집 흔적 1 「위 tel: 7사례」가 실제로는 아래","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":144,"quote":"케이스는 위 `tel:` 7사례 + 「관광안내전화1330」"}],
   "reason":"목록은 :149-156 에 있다. 위치를 잘못 가리켜 찾는 사람을 헛짚게 하므로 표기 문제가 아니라 내용 오류다."},
  {"id":"편집 흔적 2 `placeAttributes.ts:187`., 마침표","verdict":"dismiss","severity":"MINOR",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":189,"quote":"`placeAttributes.ts:187`., `AttractionSeoText.kt:12-13,46,74`"}],
   "reason":"구두점 하나라 뜻이 바뀌지 않으므로 스타일(헌법 5)이다. 고쳐도 무방하다."},
  {"id":"편집 흔적 3 Out of Scope 중복 항목","verdict":"dismiss","severity":"MINOR",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":192,"quote":"수집일·검수일 신설 … 계획 S3-7 의 creator·sameAs(원천 없음), 수집일 신설."}],
   "reason":"같은 항목이 두 번 나올 뿐 범위가 달라지지 않으므로 스타일(헌법 5)이다. 고쳐도 무방하다."},
  {"id":"편집 흔적 4 AttractionPageRenderer.kt:375·565-576 줄 번호 어긋남","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":376,"quote":"if (!doc.tel.isNullOrEmpty()) append(\"<p>${escapeHtml(doc.tel)}</p>\")"},
               {"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":375,"quote":"append(\"<p>${escapeHtml(listOfNotNull(categoryLabel(doc.category, lang), doc.address…"}],
   "reason":":375 는 분류·주소 줄이고 전화 줄은 :376 이다. 고칠 위치를 찾는 인용이라 틀리면 다른 줄을 고치게 된다."}
]
```

## 3. spec.md 편집 목록

**E3-1 (I3-1) SR-2.3** — 다음 문장을 찾습니다.
`` `admission()` 은 `source.feeText` 를 읽는다 — 표시와 같은 값이다. ``
이렇게 바꿉니다.
`` `admission()` 은 `source.feeText` 를 그대로 읽는다 — 표시와 같은 값이다. `stripTags` 를 걸지 않는다(`AttractionAttributeParser.kt:176` 의 호출을 뺀다) — 줄바꿈 태그는 `sourceText` 가 이미 `\n` 으로 바꿨고, 디코드된 「<어린이>」를 태그로 지우면 「무료」만 남아 FREE 가 된다. ``

SR-5.1 「파서 v3 픽스처」 목록의 「닫히지 않은 괄호 → UNKNOWN.」 다음 줄에 추가합니다.
`` - `feeText` 「<어린이> 무료」 → 입장 UNKNOWN. ``

SR-5.5 회귀 주입 목록 끝에 추가합니다.
`` - 파서 `admission()` 에 `stripTags` 다시 걸기 → 「<어린이> 무료」 UNKNOWN 단언 빨강 ``

**E3-2 (I3-2, U8 기본값 기준) SR-4.1** — 다음 문장을 찾습니다.
`` app `AttractionSearchDocument`(필드·변환), `SearchAttractionUseCase` 결과, `SearchAttractionService` 매핑, FE `placeApi.ts` `Attraction`(`source`·`copyrightDivCd`·`feeText`·`modifiedAt`). ``
이렇게 바꿉니다.
`` app `AttractionSearchDocument`(필드·변환 — 새 세 필드와 `petAcmpyType`), `SearchAttractionUseCase` 결과, `SearchAttractionService` 매핑, FE `portal-fe/src/api/placeApi.ts` `Attraction`(`source`·`copyrightDivCd`·`feeText`·`modifiedAt`·`petAcmpyType`). `petAcmpyType` 은 색인에 이미 있고(`attractions-index.json:372`) 읽기 쪽만 빠져 있다 — 반려동물 칸의 UNKNOWN 폴백(SR-2.1)이 읽는다. ``

다음 문장을 찾습니다.
`` `searchReadRequired`(`build.gradle.kts:538`)에 `source`·`copyrightDivCd`·`feeText` 를 넣는다. ``
이렇게 바꿉니다.
`` `searchReadRequired`(`build.gradle.kts:538`)에 `source`·`copyrightDivCd`·`feeText`·`petAcmpyType` 을 넣고, `searchReadOmitted` 의 `petAcmpyType` 항목(`build.gradle.kts:528`)을 지운다 — 두 목록에 함께 있으면 게이트가 실패한다(`:598`). ``

SR-5.1 에서 `` `SearchAttractionService`: API 결과에 세 필드가 실린다. `` 를 이렇게 바꿉니다.
`` `SearchAttractionService`: API 결과에 네 필드(`source`·`copyrightDivCd`·`feeText`·`petAcmpyType`)가 실린다. ``

**E3-3 (T3-1) SR-5.1 패리티 항목** — 다음 문장을 찾습니다.
`` FE `visitSummary` 의 출력(칸 이름·값·배지 줄)을 골든 JSON(`search/app/src/test/resources/render/visit-summary-golden.json`)으로 쓴다. Kotlin 은 렌더된 `<dl>`·`visit-badges` 에서 뽑아 ``
이렇게 바꿉니다.
`` 골든 JSON(`search/app/src/test/resources/render/visit-summary-golden.json`)의 케이스는 `{name, input, output}` 이다. `input` 은 색인 문서 `_source` 모양이다. `output` 은 FE 가 `input` 을 `toApi`(`attractionJsonLdGolden.test.ts:31` 과 같은 변환)로 바꿔 `visitSummary` 에 넣은 결과(칸 이름·값·배지 줄)다. Kotlin 은 같은 `input` 을 `AttractionSearchDocument` 로 역직렬화해 `toDomain()` 한 문서를 렌더하고(`AttractionJsonLdParityTest.kt:47` 선례), 렌더된 `<dl>`·`visit-badges` 에서 뽑아 ``
(뒤에 이어지는 「`FooterLinksParityTest` 의 `decodeHtml` 로 되돌린 뒤 비교한다 …」는 그대로 둡니다.)

**E3-4 (T3-2 + 편집 흔적 1)** — 전화 패리티 항목에서 `케이스는 위 `tel:` 7사례` 를 `케이스는 아래 `tel:` 8사례` 로 바꿉니다.

「`tel:` 기대값」 목록에서 「1330」 줄 앞에 추가합니다.
`` - 「+82-2-123-4567」 → `tel:+8221234567` ``

SR-5.5 의 `` Kotlin `attractionPhone` 패턴 한 글자 변경 → 전화 골든 패리티 빨강 `` 을 이렇게 바꿉니다.
`` Kotlin `attractionPhone` 에서 `(?:\+82[- ]?)?` 삭제 → 「+82-2-123-4567」 골든 패리티 빨강 ``

**E3-5 (T3-3) SR-5.1 XSS 항목** — `` FE 는 방문 요약 안에 `img` 요소 0개, 같은 글자가 텍스트로 보인다. `` 다음에 이어 붙입니다.
`` SSR: `feeText`=「<어린이> 무료」 → 방문 요약 요금 `<dd>` 에 `&lt;어린이&gt; 무료`. ``

**E3-6 (U3-1) SR-1.6** — 다음 문장을 찾습니다.
`패리티 예외 — SSR 과 FE 가 다른 것은 아래 셋뿐이다:`
이렇게 바꿉니다.
`` 패리티 예외 — 이번 변경이 만드는 SSR·FE 차이는 아래 셋뿐이다(기존 FE 전용 절인 주변 명소·편의시설·근처 행사·숙소는 그대로, `AttractionPageRenderer.kt:361`): ``

**E3-7 (U3-2) SR-5.2** — `기대값은 「일치하는 id 수 → 0」으로 둔다.` 를 이렇게 바꿉니다.
`기대값은 「요금 칸 「정보 없음」 11 → (11 − 일치 id 수)」이고, 일치한 id 는 각각 요금 칸이 「정보 없음」이 아니어야 한다.`

**E3-8 (D3-1) SR-5.6** — `「방문 요약」「확인 상태」「행동 줄」「feeText」를 등록한다.` 를 이렇게 바꿉니다.
`「방문 요약」「확인 상태」「행동 줄」「배지 줄」「feeText」를 등록한다. 「방문 요약」 항목의 금지/주의 열에는 「「방문 정보 요약」/「At a glance」는 행사·숙박·코스의 배지 절 제목이고(FE 탭 이름은 「방문 정보」) 방문 요약과 다르다」를 적는다.`

**E3-9 (편집 흔적 4)**
- SR-2.6 「중복 제거」 줄의 `` SSR `AttractionPageRenderer.kt:375` `` 를 `:376` 으로 바꿉니다.
- Existing Code to Leverage 끝의 `AttractionPageRenderer.kt:375,449-453,565-576` 을 `AttractionPageRenderer.kt:376,449-453,566-577` 로 바꿉니다.

## 4. 사용자 판단 항목

| # | 질문 | 권고 기본값 | 근거 |
|---|---|---|---|
| U8 (신설) | 반려동물 칸이 UNKNOWN 일 때 원문을 보여 줄지 | **원문을 보여 준다.** 색인에 이미 있는 `petAcmpyType` 을 읽기 경로에 더한다(E3-2) | Goal 이 「값이 원천에 있는 만큼 채워지며(「정보 없음」은 원천에 정말 없을 때만)」라고 정했기 때문입니다. 색인 매핑(`attractions-index.json:372`)이 있어서 재색인 형식은 그대로입니다. 대안으로 「해석값만, UNKNOWN 이면 정보 없음」을 고르면 SR-2.1 반려동물 칸 값을 「`petPolicy` ALLOWED·PARTIAL → 배지 문구」로 줄이고, SR-5.1 의 「UNKNOWN 이면 원문」 케이스를 지웁니다. 이 경우 원천에 값이 있어도 「정보 없음」이 나오므로 Goal 과 어긋납니다 |

U1~U7 은 이전 판정 그대로 둡니다.

SUMMARY: keep 10 / demote 0 / dismiss 2

NOTES: 두 가지는 이번 판정 범위 밖이라 참고로만 적습니다. 첫째, 스펙에 남은 렌더러 줄 번호 중 SR-3.2 의 `:552`(실제 `:553`)와 Existing Code 의 `552-557` 도 한 줄씩 밀렸습니다. 둘째, 「관광안내전화1330」 골든은 JS 의 `\b`(ASCII 기준)와 JVM 의 `\b`(JDK 버전에 따라 한글을 단어 문자로 볼 수 있음)가 다르게 판정할 수 있습니다. Kotlin 쪽 실측이 필요합니다.

참고 경로(워크트리 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` 기준):
- `docs/specs/2026-10-09-place-detail-first-screen/spec.md`
- `docs/specs/2026-10-09-place-detail-first-screen/context/engineer-review-round3.md`
- `search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt`
- `build.gradle.kts`