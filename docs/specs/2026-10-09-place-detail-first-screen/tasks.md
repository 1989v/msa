# Task Breakdown: 관광지 상세 첫 화면 + 고유 블록 (S2-2 · S3-7)

## Overview
Total Task Groups: 6. 정본은 `spec.md`(3라운드 심판 반영). 열린 질문은 `context/open-questions.yml` 권고 기본값을 따른다 — Q1 표시 규칙 건은 후속 커밋, Q2 리치 결과 테스트는 사용자 몫, U8 반려동물 UNKNOWN 이면 원문.
표준: `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK), `docs/conventions/package-structure.md`, root `DESIGN.md`·`docs/design/k-heritage.html`(FE 배치), `docs/standards/fe-visual-verification.md`(CDP 실측).

규칙 원본은 둘이다. 요금 규칙은 search:domain `AttractionFee`(Kotlin 단일 원본, FE 는 색인 `feeText` 만 읽는다). 전화·JSON-LD·방문 요약 문구는 FE(`copy.mjs`·`placeAttributes.ts`)가 원본이고 Kotlin 이 골든 패리티로 따른다. 그래서 FE 규칙 원본·골든(TG3)이 SSR 렌더(TG4)보다 앞선다.

### Task Group 1: 요금 규칙 + 파서 v3 (SR-2.2 · SR-2.3 · SR-2.4)
**Dependencies:** None · **Phase:** search:domain · **Required Skills:** Kotlin, Kotest BehaviorSpec
- [ ] 1.1 테스트 먼저
  - 새 `search/domain/src/test/kotlin/com/kgd/search/domain/attraction/model/AttractionFeeTest.kt` — SR-5.1 `AttractionFee.text` 11사례를 given/then 개별 케이스로(픽스처 표 아님): useFee 있음 · 「무료」+반복정보 금액 → 「무료」 · 공백뿐 → 반복정보 · 요금 행 둘 serialnum 순 「 / 」 · 「입장 료」 일치 · 「주차요금」 제외 · `Map` 단일 행 · 수 아닌 serialnum → 원천 위치 · `info` null+useFee 없음 → null · `&lt;어린이&gt; 무료` → 「<어린이> 무료」(정규화 한 번) · 둘 다 없음 → null
  - `AttractionAttributeParserTest.kt` 증보: 77 → MON, 4811 → UNKNOWN(U1), 16151 → UNKNOWN, 「매주 화요일(공휴일 정상 개장)」 → TUE, 닫히지 않은 괄호 → UNKNOWN, tsv:41·79 기대값 유지, `feeText` 「<어린이> 무료」 → 입장 UNKNOWN, 반복정보만 「무료」 → FREE · 금액 → PAID(`AttractionFee.text(null, info)` 결과를 `feeText` 로)
  - 헬퍼(`AttractionAttributeParserTest.kt:159-173`)의 `useFee` 인자를 `feeText` 로. tsv `useFee` 행은 `parse(feeText = AttractionFee.text(row.raw, null))`. 기존 19행 기대값 유지 — 바뀌는 행은 원문·이유를 테스트 주석에 적고 기대값을 고친다
  - `raw-fixtures.tsv` 새 행 추가 + `fixtures.size` 단언을 새 행 수로
- [ ] 1.2 `search/domain/.../domain/attraction/model/AttractionFee.kt` — `object AttractionFee { fun text(useFee: String?, info: Any?): String? }`. JSON 을 풀지 않는다(`CourseStops.kt:18` 선례). 이름 3종(「입장료」「관람료」「이용요금」, 공백 제거 비교), serialnum 수 정렬 + 원천 위치 폴백(`placeView.ts:324` 와 같은 규칙), `AttractionSeoText.sourceText` 한 번 → 빈 것 버림 → 「 / 」. 결과는 정규화된 평문이라는 KDoc
- [ ] 1.3 파서 v3
  - `AttractionAttributeSource.useFee` → `feeText` 로 **교체**(필드 추가 아님), `admission()` 은 `source.feeText` 그대로 — `:176` 의 `stripTags` 호출 삭제
  - 휴무: 쉼표·빗금 분할(`:65`) 전에 괄호 단서 처리 — 이동 말(「다음날」「다음 평일」「그 다음」「전날」「대신」) → UNKNOWN, 여는 말만 → 괄호 떼고 요일 읽기, 미닫힘 → UNKNOWN, 매주가 아닌 문장 → UNKNOWN, 영문 괄호는 지금 동작 유지
  - KDoc(`:6-8`) 「요금은 place `use_fee` + 반복정보 요금 행 폴백, 규칙은 `AttractionFee` 한 곳」, `VERSION` 2 → 3
- [ ] 1.4 Verify: `./gradlew :search:domain:test --tests '*AttractionFeeTest' --tests '*AttractionAttributeParserTest' --rerun`

### Task Group 2: 색인 필드 전달 + 읽기 경로 (SR-2.2 태스클릿 · SR-4.1)
**Dependencies:** TG1 · **Phase:** search:batch · search:app · portal-fe 타입 · **Required Skills:** Kotlin, Spring Batch, OpenSearch 매핑, TS
- [ ] 2.1 테스트 먼저
  - `search/batch/src/test/kotlin/com/kgd/search/client/PlaceApiClientTest.kt`: `source`·`copyrightDivCd` 역직렬화(손 매핑 `fetchPageAfter` 경유)
  - `search/batch/src/test/kotlin/com/kgd/search/job/AttractionApiReindexTaskletTest.kt`: `useFee=null`+`infoRaw` 무료 행 → bulk `attrAdmission=FREE`·`feeText` · 금액 행 → PAID · `infoRaw` 깨진 JSON → `feeText` 는 useFee 기준, 코스 경고 동작 그대로 · `source`·`copyrightDivCd` 단 dto → bulk 같은 값 · `attributeParserVersion` 단언은 `VERSION` 참조
  - `search/batch/src/test/kotlin/com/kgd/search/infrastructure/indexing/AttractionsIndexMappingTest.kt`: `source`·`copyrightDivCd` keyword, `feeText` text `index: false`
  - `search/app/src/test/kotlin/com/kgd/search/application/attraction/service/SearchAttractionServiceTest.kt`: API 결과에 `source`·`copyrightDivCd`·`feeText`·`petAcmpyType` 네 필드
  - `search/app/src/test/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocumentTest.kt`: 네 필드 `toDomain()` 왕복
  - `AttractionReindexCaptureTest`: 캡처(`reindex-capture.json`, 배치 테스트가 다시 씀)에 세 필드가 실리고 읽기 문서까지 남는지
- [ ] 2.2 batch: `PlaceApiClient.AttractionDto` 필드 + `fetchPageAfter` 손 매핑(`PlaceApiClient.kt:32-33, 177-218` — 데이터 클래스에만 넣으면 null 색인)
- [ ] 2.3 batch 태스클릿: `infoRaw` 를 `introReader.readValue(raw, Any::class.java)` 로 한 번 풀기(빈 값·실패 → null), `AttractionFee.text(attraction.useFee, info)` 한 번 계산 → 파서 `feeText` 와 문서 `feeText` 에 같은 값(`:221-229`, 문서 조립 `:267-322`). `courseStopsOf` 경로는 그대로, 원천 `useFee`·`infoRaw` 는 그대로 적재
- [ ] 2.4 문서·매핑: search:domain `AttractionDocument`, batch `AttractionIndexDocument`(필드·변환), `attractions-index.json` 세 필드
- [ ] 2.5 읽기 경로: app `AttractionSearchDocument`(세 필드 + `petAcmpyType`, 변환), `SearchAttractionUseCase` 결과, `SearchAttractionService` 매핑(`:240`)
- [ ] 2.6 루트 `build.gradle.kts`: `searchReadRequired`(`:538`)에 `source`·`copyrightDivCd`·`feeText`·`petAcmpyType`, `searchReadOmitted` 의 `petAcmpyType`(`:528`) 삭제
- [ ] 2.7 FE 타입: `portal-fe/src/api/placeApi.ts` `Attraction` 에 `source`·`copyrightDivCd`·`feeText`·`modifiedAt`·`petAcmpyType`(모두 optional·nullable)
- [ ] 2.8 Verify:
  - `./gradlew :search:batch:test --tests '*PlaceApiClientTest' --tests '*AttractionApiReindexTaskletTest' --tests '*AttractionsIndexMappingTest' --rerun`
  - `./gradlew :search:app:test --tests '*SearchAttractionServiceTest' --tests '*AttractionSearchDocumentTest' --tests '*AttractionReindexCaptureTest' --rerun`
  - `./gradlew verifySearchIndexContract`
  - `git diff --stat search/app/src/test/resources/attraction/reindex-capture.json` (같은 커밋에 재생성분)
  - `cd portal-fe && npx tsc -b`

### Task Group 3: FE 규칙 원본 + 골든 (SR-2.1 · SR-2.5 · SR-2.6 · SR-3.5 · SR-3.6)
**Dependencies:** TG2(타입) · **Phase:** portal-fe(`copy.mjs`·`placeAttributes.ts`) · **Required Skills:** TS/ESM, vitest
- [ ] 3.1 테스트 먼저
  - `portal-fe/src/seo/__tests__/copy.test.ts` 증보: `attractionPhone` `tel:` 8사례(SR-5.1 목록) + 「관광안내전화1330」 → `tel:1330`, 원문 빈 값 → 항목 없음
  - 새 `portal-fe/src/seo/__tests__/phoneGolden.test.ts`: 위 9사례 출력 `{text, href}` 를 `search/app/src/test/resources/render/phone-golden.json` 로 쓴다(`footerLinksGolden.test.ts` 방식)
  - `attractionJsonLdGolden.test.ts`: 케이스 추가 — 사진 Type1·Type3·Type2·없음 × 시군구 있음·없음. `toApi`(`:30`)가 색인 `sigunguName` 을 copy.mjs 가 읽는 자리로 옮기게. `containedInPlace`·`ImageObject`(`contentUrl`·`license`·`creditText`)·BreadcrumbList 시군구 단계
  - `portal-fe/src/pages/place/__tests__/placeView.test.ts` 증보 — `visitSummary(attraction, lang)` 칸 값(국·영): 요금 `feeText` 우선·`useFee` 폴백·「정보 없음」, 쉬는 날 Weekly+원문 두 줄·AlwaysOpen·Unknown 원문만, 주차 NO 「주차 불가」·UNKNOWN+원문 없음 「정보 없음」, 반려동물 ALLOWED 문구·UNKNOWN 원문(U8), 무장애 긍정 항목 「 · 」·없음, `attributes` null 옛 문서는 원문 줄만, 확인 상태 source TOURAPI·GOCAMPING·null·기타 × 국·영 + `modifiedAt` null + 「수집일: 정보 없음」, 배지 줄 신용카드·유모차·많이 클릭한 곳 순서·0개면 없음
  - 새 `portal-fe/src/pages/place/__tests__/visitSummaryGolden.test.ts`: `{name, input, output}` 케이스를 `search/app/src/test/resources/render/visit-summary-golden.json` 으로 쓴다. `input` 은 색인 `_source` 모양, `output` 은 `toApi` → `visitSummary` 결과. 케이스: feeText 있음·useFee 만·둘 다 없음 × source 있음·없음 × 국·영 + SR-2.1 표 해석·원문 조합 각 1건
- [ ] 3.2 `copy.mjs`: `attractionPhone(raw)` → `{ text, href }`(패턴 `(?:\+82[- ]?)?0\d{1,3}[- ]?\d{3,4}[- ]?\d{4}`, 없을 때만 `\b1\d{3}(?:-\d{4})?\b`, href 는 숫자와 `+` 만, 첫 번호 하나), `attractionJsonLd`(`:674`) `containedInPlace`·`ImageObject`·license(Type1·Type3 만), `attractionBreadcrumbJsonLd`(`:822`) 시군구 단계, 출처 표시명 표(TOURAPI·GOCAMPING·그 밖 「정보 없음」) — JSON-LD `dateModified` 는 넣지 않는다
- [ ] 3.3 `placeAttributes.ts`: `visitSummary(attraction, lang)` 순수 함수 하나 — 칸 목록(SR-2.1 표 순서) + 배지 줄. 「정보 없음 / Not provided」 문구 신설. `feeText` 에 `sourceText` 다시 걸지 않는다
- [ ] 3.4 CI: `.github/workflows/ci.yml` vitest 뒤에 「Visit summary golden fixture is current」「Phone golden fixture is current」 두 단계(기존 secure-image 단계와 같은 모양 — `git diff --exit-code` + `git status --porcelain`)
- [ ] 3.5 Verify: `cd portal-fe && npx vitest run src/seo src/pages/place/__tests__/placeView.test.ts src/pages/place/__tests__/visitSummaryGolden.test.ts && npx tsc -b` + `git status --porcelain search/app/src/test/resources/render/` 로 골든 셋(jsonld·visit-summary·phone) 생성 확인

### Task Group 4: SSR 렌더 (SR-1 · SR-2 SSR · SR-3)
**Dependencies:** TG2(문서 필드) · TG3(골든) · **Phase:** search:app `infrastructure/render`, search:domain `AttractionSeoText` · **Required Skills:** Kotlin, HTML 이스케이프, JSON-LD
- [ ] 4.1 테스트 먼저
  - `search/domain/src/test/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoTextTest.kt`: `attractionPhone` 대표 사례
  - 새 `search/app/src/test/kotlin/com/kgd/search/infrastructure/render/VisitSummaryParityTest.kt`: `visit-summary-golden.json` 의 `input` → `AttractionSearchDocument` → `toDomain()` → 렌더 → `<dl data-place-section="visit-summary">`·`visit-badges` 추출 → `FooterLinksParityTest` 의 `decodeHtml` → `output` 과 비교(`AttractionJsonLdParityTest.kt:47` 선례)
  - 새 `search/app/src/test/kotlin/com/kgd/search/infrastructure/render/PhoneParityTest.kt`: `phone-golden.json` 전 사례 + 렌더된 `actions` 절 href 1건 대조
  - `AttractionJsonLdParityTest.kt`: 새 골든 케이스 통과 + license 절대값 `it`(Type1 → 제1유형 URL, Type3 → 제3유형 URL, Type2·null → 속성 없음)
  - `AttractionPageRendererTest.kt` 증보: `data-place-section` 표지 기준 순서(`order.none { it < 0 }` + `order shouldBe order.sorted()`) · 일반 유형에 `visitorInfo`·「방문 정보 요약」 절 없음 · 행사·숙박·코스는 유형별 절·배지 절 그대로 + 행동 줄만 · actions 는 전화 항목 있을 때만, 길찾기 링크 없음(U7) · 전화 중복(`infoCenter` 빔+`tel` → 제목 아래 줄 없음 / 둘 다 → 둘 다) · XSS(`&lt;img src=x onerror=alert(1)&gt;`·`"` → `&lt;img`·`&quot;` 만, `<img` 0) · `feeText` 「<어린이> 무료」 → `<dd>` 에 `&lt;어린이&gt; 무료` · 확인 상태 「원천 갱신일: YYYY-MM-DD」 텍스트·null 폴백 「출처: 정보 없음」 · 바닥 출처 줄 GOCAMPING+camping 이면 「고캠핑」 한 번 · 브레드크럼 시군구(화면·BreadcrumbList) · 이웃 0건·모두 끝난 행사 → 절 없음 · `<img>` https 그대로·tong http → https·그 밖 http 없음·사진 없음 없음
  - 기존 단언 갱신: `:145-150`(「이용 안내」 표지), `:152-154`(`<dt>이용시간</dt>` → 방문 요약 `<dl>`), `:186-195`(「매주 화요일 휴무」 표지·「배지 뒤」 제목), `:303-326`(「입장 무료」<「많이 클릭한 곳」·`<h2>방문 정보 요약</h2>` → `visit-badges` 줄)
  - 골든 HTML: 관광지(12) 국·영 두 건 추가(`render/golden/attraction-ko.html`·`attraction-en.html`), 기존 골든은 재생성 diff 를 이번 변경 범위로 확인
- [ ] 4.2 `AttractionSeoText.attractionPhone`(Kotlin, 골든 패리티로 copy.mjs 를 따른다)
- [ ] 4.3 `AttractionPageRenderer.kt`
  - `attractionBody`(`:364-388`) 순서: 브레드크럼(시군구) → h1 → 방문 요약 `<dl data-place-section="visit-summary">` → `<p data-place-section="visit-badges">`(있을 때만) → 행동 줄 `data-place-section="actions"`(전화만) → 개요 → 기존 절
  - 일반 유형에서 `visitorInfo`(`:448-453`)·`badges`(`:466`) 미출력, 행사·숙박·코스는 지금대로
  - 「같은 분류 가까운 곳」을 `regionSection` 밖 독립 절 `data-place-section="same-category-nearby"`, 끝난 행사 거른 뒤(`:553`) 0건이면 미출력. 집계 문장은 기존 `regionSection` 그대로
  - 대표 사진 `<img src alt="{제목}">`(https 그대로·tong http → https·그 밖 없음, width/height 없음)
  - `primaryJsonLd`(`:223`) `containedInPlace`·`ImageObject`, `breadcrumbJsonLd`(`:331`) 시군구, `sourceLine`(`:611`) GOCAMPING 첫 항목·「고캠핑」 한 번
  - 출력 순서 계약(`:41`): `feeText` 는 `escapeHtml` 만, 그 밖 새 원문 값(요금 폴백 `useFee`·이용시간·쉬는 날·주차·반려동물 원문·전화·시군구·이웃 제목·`alt`·`containedInPlace.name`)은 `sourceText` → `escapeHtml`, `tel:` href 도 `escapeHtml`
  - 제목 아래 전화 줄(`:376`)은 `infoCenter` 가 빌 때만 뺀다
- [ ] 4.4 Verify:
  - `./gradlew :search:domain:test --tests '*AttractionSeoTextTest' --rerun`
  - `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*AttractionJsonLdParityTest' --tests '*VisitSummaryParityTest' --tests '*PhoneParityTest' --tests '*FooterLinksParityTest' --tests '*SecureImageParityTest' --rerun`
  - 골든 생성: `UPDATE_RENDER_GOLDEN=1 ./gradlew :search:app:test --tests '*AttractionPageRendererTest' --rerun` 후 `git diff --stat search/app/src/test/resources/render/golden/` — 바뀐 파일이 이번 절 이동·새 절로만 설명되는지 확인하고, 플래그 없이 한 번 더 돌려 초록

### Task Group 5: FE 상세 화면 (SR-1 · SR-2 FE)
**Dependencies:** TG3 · **Phase:** portal-fe `pages/place` · **Required Skills:** React/TS, vitest, DESIGN.md 토큰
- [ ] 5.1 테스트 먼저 — `portal-fe/src/pages/place/__tests__/AttractionPage.test.tsx` 증보(DOM 순서 단언)
  - 일반 유형 순서: 브레드크럼(시군구) → h1·찜 → 방문 요약 → 배지 줄 → 행동 줄(길찾기·전화) → 개요 → 사진 히어로
  - 「이용 안내」(일반 유형): 주차요금·intro·반복정보(요금 행 포함) 남음, 이용시간·쉬는날·이용요금·주차·문의 행 없음. 행사·숙박·코스는 지금과 같음
  - `AttractionInfoTabs` 에 넘기는 `badges` 가 일반 유형에서 빈 목록
  - 전화 중복(`infoCenter` 빔+`tel` → 제목 아래 줄 없음·행동 줄 `tel:`, 둘 다 → 둘 다)
  - XSS: 방문 요약 안 `img` 요소 0, `<img src=x onerror=alert(1)>` 가 텍스트로
  - 기존 단언 갱신: `:134-153`(「이용 안내」 h2 순서), `:440-456`(At a glance 탭 「Closed on Tuesdays」 → 방문 요약 쉬는 날 칸)
- [ ] 5.2 `AttractionPage.tsx`: 방문 요약·배지 줄은 `typeSection` null 유형만, 「이용 안내」 다섯 행 제외(`:443-449`), `badges` 빈 목록(`:256,498`), 행동 줄(`googleMapsSearchUrl` 링크를 요약 아래로 + `attractionPhone`), 제목 아래 전화 줄(`:407`) 조건부, 사진 히어로를 요약 아래로
- [ ] 5.3 레이아웃: 데스크톱 2열(왼쪽 요약·행동, 오른쪽 히어로), 지금 높이 이하. 색·간격은 DESIGN.md 토큰만(hex 직접 입력 금지), `k-heritage.html` 견본 기준. 모바일 390 에서 요금·쉬는 날·길찾기가 폴드 안에 들어가는 밀도
- [ ] 5.4 Verify: `cd portal-fe && npx vitest run src/pages/place src/seo && npx tsc -b`

### Task Group 6: 회귀 주입 · 문서 · 배포 · 운영 확인
**Dependencies:** TG1–5

> **배포 제약 (SR-4.2)**: 2026-10-09 06:30 KST 정기 재색인 로그에서 `attribute parser v2` 와 영문 N/A 주차 UNKNOWN 건수를 확인해 `docs/specs/2026-10-08-place-text-and-states/verifications/deploy-check.md` 에 적기 **전에는 이 변경을 main 에 푸시하지 않는다** — main 푸시가 곧 이미지 생성이고(`.github/workflows/images.yml:5`), 다음 정기 재색인이 v3 로 돈다.
> 색인 필드 `source`·`copyrightDivCd`·`feeText` 추가와 파서 v3 는 **재색인 1회를 거쳐야** 문서에 실린다. 그 전까지 표시는 폴백(확인 상태 「출처: 정보 없음」·바닥 출처 줄 고정 문구·요금 칸 `sourceText(useFee)`)으로 나간다.

- [ ] 6.1 선행 확인: `deploy-check.md` 의 「파서 v2」 행이 확인 값으로 채워졌는지 본다. 비어 있으면 6.6 이후를 멈춘다
- [ ] 6.2 S2-7 「전」 값 + 기대값 표(SR-5.2) — 재색인 **전에** `verifications/s2-7-expected.md` 에 먼저 적는다
  - 「전」: v2 재색인 뒤 같은 30곳, 같은 집계 스크립트
  - 휴무 누락 2 → 1(U1: 4811 은 휴무 이동 단서라 UNKNOWN 유지)
  - 요금 칸 「정보 없음」 11건: id 별 반복정보 `infoname`·`serialnum`·`infotext` 원문과 SR-2.2 일치 여부 표 → 기대 「11 → (11 − 일치 id 수)」, 일치 id 는 각각 「정보 없음」이 아니어야 한다. 3종 이름 밖 id 는 이유와 함께 「남는 건」(이름 목록은 이 표를 보고 늘리지 않는다)
  - 입장 UNKNOWN 9건: 13354 는 요금 행 없음 → 남음. 나머지 8건은 반복정보 요금 행 원문으로 FREE·PAID·UNKNOWN 기대값
  - 안 바뀌는 id 는 이유와 함께 「남는 건」
- [ ] 6.3 회귀 주입(SR-5.5, 임시 사본 워크트리 — 공유 트리에서 하지 않는다). 각각 빨간불과 잡은 테스트 이름을 `verifications/regression-injection.md` 에 기록. 컴파일되는 회귀여야 한다(구문 오류 빨간불은 증거 아님)
  - 괄호 여는 말 처리 삭제 → 77 단언
  - 휴무 이동 말 판정 삭제 → 4811 UNKNOWN 단언
  - `AttractionFee` 반복정보 폴백 삭제 → `AttractionFeeTest`
  - 태스클릿 `feeText` 전달 삭제 → 태스클릿 단언
  - `SearchAttractionService` 매핑 한 줄 삭제 → 서비스 단언
  - 확인 상태 null 폴백 삭제 → 「출처: 정보 없음」 단언
  - 요금 행 `escapeHtml` 제거 → XSS 단언
  - FE 방문 요약 문구 한쪽만 변경 → `VisitSummaryParityTest`
  - SSR 방문 요약을 개요 뒤로 → 순서 단언
  - ImageObject license 매핑 뒤바꿈 → 절대값 단언 + `AttractionJsonLdParityTest`
  - 색인 매핑에서 새 필드 삭제 → `verifySearchIndexContract`·`AttractionsIndexMappingTest`
  - SSR `feeText` 에 `sourceText` 다시 걸기 → XSS·「<어린이> 무료」 단언
  - `AttractionFee` `Map` 분기 삭제 → 단일 객체 케이스
  - Kotlin `attractionPhone` 에서 `(?:\+82[- ]?)?` 삭제 → `PhoneParityTest` 「+82-2-123-4567」
  - FE 「이용 안내」에서 `repeatInfoRows` 제외 → FE 남는 행 단언
  - 파서 `admission()` 에 `stripTags` 다시 걸기 → 「<어린이> 무료」 UNKNOWN 단언
- [ ] 6.4 골든·참조 정합
  - 골든 재생성 diff: `cd portal-fe && npx vitest run src/seo src/pages/place` 뒤 `git diff --stat search/app/src/test/resources/render/` 가 비어 있다(커밋된 jsonld·visit-summary·phone 골든이 최신). `UPDATE_RENDER_GOLDEN=1` 재생성 후 `render/golden/` diff 도 0
  - 온톨로지 참조: `grep -nE "AttractionApiReindexTasklet|AttractionAttributeParser|AttractionPageRenderer|AttractionSeoText|PlaceApiClient|copy\.mjs|placeAttributes|AttractionPage\.tsx" code-dictionary/feature/src/main/resources/ontology/*.yaml` — 걸린 `symbol` 문자열이 바뀐 파일에 그대로 남아 있는지 `grep -F` 로 하나씩 확인(현재 `spring.yaml:1142` 태스클릿 `execute`, `ads.yaml:673` `ADSENSE_CLIENT`)
- [ ] 6.5 문서: `search/glossary.md` 3-1 절에 「방문 요약」「확인 상태」「행동 줄」「배지 줄」「feeText」. 「방문 요약」 금지/주의 열에 「「방문 정보 요약」/「At a glance」는 행사·숙박·코스의 배지 절 제목이고(FE 탭 이름은 「방문 정보」) 방문 요약과 다르다」
- [ ] 6.6 배포(6.1 통과 뒤): main 푸시 → 이미지(search:batch·search:app·portal-fe) → 수동 재색인 1회. 정기 회차(21:30 UTC)와 겹치지 않는 시각, 실행 중 Job 없음 확인 뒤(`concurrencyPolicy: Forbid` 는 수동 Job 을 막지 않는다). OCI 조작은 `ssh msa-oci` 로만. 로그에서 `attribute parser v3` 와 색인 문서의 `source`·`copyrightDivCd`·`feeText` 적재 건수를 `verifications/deploy-check.md` 에 기록. 롤백은 v2 search:batch 이미지 + 재색인 1회, `attributeParserVersion` 2 확인
- [ ] 6.7 S2-7 30곳 재측정(SR-5.2): 같은 스크립트로 「후」를 받아 6.2 기대값과 id 별 대조 → `verifications/s2-7-result.md`
- [ ] 6.8 화면(SR-5.3, CDP): 390×844(가시 664)·1280×800 에서 표본 5곳 × 국·영, 요금·쉬는 날·길찾기 `getBoundingClientRect().bottom ≤ 664`(1280 은 800 기준). 측정 전에 로드된 번들에 이번 심볼(`visitSummary`·`attractionPhone`)이 있는지 확인하고 옛 번들 측정은 버린다. start·측정·stop 을 한 명령으로. 못 맞추면 실측과 이유 → `verifications/screens.md`
- [ ] 6.9 구조화 데이터(SR-5.4): 표본 5 URL validator.schema.org 오류 0 → `verifications/structured-data.md`. Google 리치 결과 테스트 표본 3 URL 은 사용자 몫(Q2) — 받기 전 S3-7 은 「구현 완료·검증 대기」

## Execution Order
1. TG1 (search:domain)
2. TG2 (batch·app·FE 타입 — TG1 의 `AttractionFee`·`feeText` 를 쓴다)
3. TG3 (FE 규칙 원본·골든 — TG4 의 패리티 입력)
4. TG4 · TG5 (병렬 가능 — 파일 겹침 없음. TG4 는 search:app, TG5 는 portal-fe `pages/place`)
5. TG6 (6.1 · 6.2 는 푸시 전, 6.6 이후는 6.1 통과 뒤)
