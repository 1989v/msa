<!-- source: search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt, portal-fe/src/pages/place/AttractionPage.tsx, portal-fe/src/seo/copy.mjs, search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt, search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt, search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/PlaceApiClient.kt -->
# Specification: 관광지 상세 첫 화면 + 고유 블록 (S2-2 · S3-7)

> 2026-10-09. 사용자 위임. 입력: S1-11 신뢰 필드 매핑, S2-7 대조 표(사이트 안 불일치: 요금이 반복정보에만 11/30, 입장 UNKNOWN 인데 원문 무료 9/30, 휴무 파서 누락 2/30). S2-7 공식 검수는 사용자 몫(Q1) — 이 스펙은 표시·파서 규칙과 첫 화면 구성을 고친다. ADR 불요: 색인 필드 두 개(`source`·`copyrightDivCd`) 추가는 ADR-0103/0090 범위의 문서 필드 확장이고 서비스 간 통신 방식은 그대로다. place API 는 이미 `source`·`copyrightDivCd` 를 응답에 싣고 있어 변경이 없고, search:batch 가 받아 쓰기만 한다.
>
> 개정 2026-10-09 — 1라운드 심판(34건 중 33 유지·1 강등, `context/review-verdict-round1.md`) 반영. 사용자 판단 U1~U6 은 심판 권고 기본값으로 진행(마지막에 사용자 확인): U1 휴무가 옮겨 가는 단서는 UNKNOWN 유지 · U2 방문 요약이 일반 유형의 이용 안내·배지 절을 대체 · U3 「수집일: 정보 없음」 · U4 SSR img 크기 생략·tong http→https · U5 영문 요금 행 범위 밖 · U6 BreadcrumbList 에도 시군구. 개정 2026-10-09(2) — 2라운드 심판(13건 전건 유지, `context/review-verdict-round2.md`) 반영: U2 를 「겹치는 행·배지만 대체」로 좁혔고(정보 손실 없음), U7 「SSR 행동 줄은 전화만」을 더했다. 결정: 공식 홈페이지 링크는 원천을 받지 않고 있어(수집 단계 homepage 0건) 이번엔 문의 전화로 대신한다(외부 데이터 3규칙 ①은 후속 — Out of Scope 에 근거). 개정 2026-10-09(3) — 3라운드 심판(12건 중 10 유지·2 기각, `context/review-verdict-round3.md`) 반영: U8 「반려동물 UNKNOWN 이면 원문을 보여 준다」(`petAcmpyType` 읽기 경로 추가)를 권고 기본값으로 진행.

## Goal
휴대폰 첫 화면(390×844, 가시 664px)에서 요금·휴무·길찾기가 보이고, 방문 요약 값이 원천에 있는 만큼 채워지며(「정보 없음」은 원천에 정말 없을 때만), 서버 렌더 본문이 그 페이지만의 사실 표·이웃·사진·출처를 담아 구조화 데이터 오류 없이 나간다.

## User Stories
- 방문자로서, 상세를 열면 스크롤 없이 요금·쉬는 날·가는 길을 보고 싶다.
- 방문자로서, 이 정보가 어디서 왔고 언제 갱신됐는지 알고 싶다.
- 검색엔진으로서, 페이지마다 다른 사실과 이웃 링크를 HTML 에서 읽고 싶다.

## Specific Requirements

### SR-1 첫 화면 순서 (FE · SSR 같은 순서)
1. 브레드크럼(허브 › 시도 › 시군구 — 색인 `sigunguName`·`ldongSignguCd` 가 없으면 시도까지) → 제목(h1)·찜 → **방문 요약**(SR-2) → 배지 줄(SR-2.1, 있을 때만) → 행동 줄(SR-2.6) → 개요(좁은 화면 접기 유지) → 이하 기존 절 순서 유지.
2. 방문 요약·배지 줄은 `typeSection` 이 null 인 유형(행사·숙박·여행코스를 뺀 전부)에만 붙는다. 행사·숙박·코스는 지금 유형별 절과 배지 절을 그대로 두고 행동 줄만 붙인다.
3. [U2] 일반 유형에서 방문 요약은 **겹치는 것만** 대체한다. 원천 행은 하나도 화면에서 빠지지 않는다.
   - SSR: `visitorInfo`(4행 — 이용시간·쉬는날·이용요금·주차, `AttractionPageRenderer.kt:449-453`)는 전부 방문 요약 칸과 겹치므로 일반 유형에서 내지 않는다. `badges` 절(「방문 정보 요약」/「At a glance」)도 일반 유형에서 내지 않는다 — 내용은 아래처럼 칸과 배지 줄로 옮긴다.
   - FE: 「이용 안내」에서 이용시간·쉬는날·이용요금·주차·문의(`infoCenter`) 다섯 행만 뺀다(`AttractionPage.tsx:443-449`). 주차요금(`parkingFee`)·`introRows`·`repeatInfoRows` 는 지금 자리·순서·`sourceText` 한 번 그대로 남긴다. 반복정보의 요금 행도 남긴다 — 어느 행이 요금인지 고르는 규칙 사본을 FE 에 두지 않기 위해서다. 남는 행이 없으면 절을 내지 않는다(지금 규칙). `AttractionInfoTabs` 에 넘기는 `badges`(`AttractionPage.tsx:256,498`)는 일반 유형에서 빈 목록으로 넘긴다. 탭과 그 안의 지역 절은 그대로 둔다.
   - 배지 흡수: 정기휴무(연중무휴·매주 ○요일 휴무)·주차 가능/불가·반려동물 동반은 SR-2.1 표의 해당 칸 첫 줄로 옮긴다. 입장 무료/유료는 요금 칸 값(`feeText`, 판정의 입력 그 자체)과 같은 정보라 따로 내지 않는다. 칸이 없는 신용카드·유모차 대여와 「많이 클릭한 곳」은 배지 줄로 남긴다.
4. FE 사진 히어로는 방문 요약 **아래**로 내린다. 데스크톱은 2열(왼쪽 요약·행동, 오른쪽 히어로)로, 지금 높이를 넘지 않게 — 세부 배치는 DESIGN.md 토큰과 `docs/design/k-heritage.html` 견본을 따른다.
5. SSR 은 FE 와 같은 순서로 절을 낸다. 절마다 `data-place-section` 속성(visit-summary · visit-badges · actions · same-category-nearby)을 붙인다. visit-badges 는 항목이 있을 때만, actions 는 전화 항목이 있을 때만 낸다. [U6] JSON-LD `BreadcrumbList` 도 시군구 단계를 넣는다(copy.mjs `attractionBreadcrumbJsonLd` 와 Kotlin `breadcrumbJsonLd` 를 함께 바꾸고 골든 사례에 넣는다).
6. 패리티 예외 — 이번 변경이 만드는 SSR·FE 차이는 아래 셋뿐이다(기존 FE 전용 절인 주변 명소·편의시설·근처 행사·숙소는 그대로, `AttractionPageRenderer.kt:361`):
   - 「같은 분류 가까운 곳」은 SSR 전용 절이다. FE 는 「주변 탐색」에 합쳐 두며(`AttractionPage.test.tsx:140`) 이번에 바꾸지 않는다.
   - FE 「이용 안내」에 남는 행(주차요금·intro·반복정보)은 FE 전용이다. SSR `visitorInfo` 는 지금도 4행뿐이었다.
   - [U7] 행동 줄의 길찾기 링크는 FE 전용이다. SSR 행동 줄은 전화만 낸다 — SSR 에 지도 URL 규칙과 `encodeURIComponent` 대응 사본을 만들지 않는다.

### SR-2 방문 요약 (값의 출처와 규칙)
1. 칸과 값. 아래 표가 FE·SSR 공통 규칙이다. 값이 없는 칸은 「정보 없음 / Not provided」로 남긴다 — 이 문구는 이번에 새로 만든다(지금 상세에는 없다). 불가·아니오로 바꾸지 않는다(S2-4). 값이 두 줄이면 줄 사이는 `\n` 이고, SSR `<dd>` 는 지금 `visitorInfo` 처럼 `\n` 을 그대로 둔다. `attributes` 가 없는 옛 문서는 해석 줄 없이 원문 줄만 낸다.

   | 칸 (국 / 영) | 값 | 「정보 없음」 조건 |
   |---|---|---|
   | 요금 / Admission | `feeText`. 필드가 없거나 null 이면 `sourceText(useFee)` | 결과가 빈 문자열 |
   | 이용시간 / Hours | `sourceText(useTime)` | 빈 문자열 |
   | 쉬는 날 / Closed | 첫 줄: `regularClosure` AlwaysOpen → 「연중무휴」/「Open every day」, Weekly → 지금 배지 문구(`weeklyClosureLabel`), Unknown → 줄 없음. 둘째 줄: `sourceText(restDate)`(비면 줄 없음) | 두 줄 다 없음 |
   | 주차 / Parking | 첫 줄: `parking` YES → 「주차 가능」/「Parking available」, NO → 「주차 불가」/「No parking」, UNKNOWN → 줄 없음. 둘째 줄: `sourceText(parking)` | 두 줄 다 없음 |
   | 반려동물 / Pets | `petPolicy` ALLOWED·PARTIAL → 지금 배지 문구. UNKNOWN 이면 `sourceText(petAcmpyType)` | 둘 다 없음 |
   | 무장애 / Accessibility | 접근성 긍정 항목 이름(SSR `BarrierFreeInfo.ICONS` · FE `barrierFreeIcons`, 「접근성 정보」 절 `<ul>` 과 같은 순서)을 「 · 」로 잇는다. 상세 행은 아래 「접근성 정보」 절에 그대로 둔다 | `barrierFree` 없음 또는 긍정 항목 0 |
   | 확인 상태 / Data status | SR-2.5 | 없음(항상 낸다) |

   배지 줄: 신용카드(가능/불가)·유모차 대여(있음/없음)·「많이 클릭한 곳」을 지금 배지 문구·순서 그대로 「 · 」로 잇는다. UNKNOWN 은 넣지 않는다. 항목이 없으면 내지 않는다. SSR 은 방문 요약 `<dl>` 바로 뒤에 `<p data-place-section="visit-badges">` 로 낸다.
   FE 는 칸 목록과 배지 줄을 순수 함수 하나(`placeAttributes.ts` 의 `visitSummary(attraction, lang)`)로 만들고, 화면과 패리티 골든이 같은 함수를 쓴다.
2. 요금 텍스트(새 파생 색인 필드 `feeText`): 규칙 원본은 search:domain 순수 함수 `AttractionFee.text(useFee: String?, info: Any?)` 한 곳이다. `info` 는 `infoRaw` 를 JSON 으로 푼 값이다 — domain 은 JSON 을 풀지 않는다(`CourseStops.kt:18` 선례).
   - `sourceText(useFee)` 가 비어 있지 않으면 그 값만 쓴다.
   - 비었으면(null · 빈 문자열 · 공백뿐) `info` 의 행을 본다. `List` 는 그대로, `Map` 은 한 행짜리 목록, 그 밖(null·문자열·수)은 행 없음이다. `Map` 이 아닌 행은 건너뛴다.
   - `infoname` 의 공백을 지운 값이 「입장료」「관람료」「이용요금」 중 하나인 행만 고른다. 「주차요금」 등 다른 이름은 제외한다.
   - 순서는 `serialnum` 수 값(수로 읽히는 문자열 포함) 오름차순이다. 수가 아니면 그 행의 원천 위치(0부터)를 순서값으로 쓰고, 같은 값은 원천 순서를 지킨다(`placeView.ts:324` 와 같다).
   - 각 행 `infotext` 를 `sourceText` 하고, 빈 것은 버린 뒤 「 / 」로 잇는다.
   - 둘 다 없으면 null 이다.
   - `feeText` 는 **이미 정규화된 평문**이다. 다시 `sourceText` 하지 않는다(`AttractionSeoText.kt:12-13` — 두 번 걸면 `&lt;…&gt;` 원문이 지워진다). SSR 은 `escapeHtml` 만 걸고, FE 는 텍스트 노드로 그대로 넣는다.
   - 재색인 태스클릿이 `infoRaw` 를 `introReader.readValue(raw, Any::class.java)` 로 풀어(빈 값·실패면 null) `AttractionFee.text(attraction.useFee, info)` 를 한 번 계산한다. 결과를 `feeText`(text, `index: false`)로 싣는다. 코스 구성 경로(`courseStopsOf`)는 지금 그대로다. SSR·FE 는 이 필드만 읽고 규칙 사본을 두지 않는다. 원천 `useFee`·`infoRaw` 는 그대로 둔다(외부 데이터 3규칙 ②).
3. 입장 무료 판정(도메인 `freeAdmission`, 색인 `attrAdmission`): `AttractionAttributeSource.useFee` 를 `feeText` 로 **바꾼다**(필드를 더하지 않는다 — 바꾸고 나면 `useFee` 를 읽는 곳이 없다). `admission()` 은 `source.feeText` 를 그대로 읽는다 — 표시와 같은 값이다. `stripTags` 를 걸지 않는다(`AttractionAttributeParser.kt:176` 의 호출을 뺀다) — 줄바꿈 태그는 `sourceText` 가 이미 `\n` 으로 바꿨고, 디코드된 「<어린이>」를 태그로 지우면 「무료」만 남아 FREE 가 된다. 규칙 표는 지금 그대로 쓴다. 태스클릿(`AttractionApiReindexTasklet.kt:221-229`)은 SR-2.2 에서 계산한 같은 값을 파서와 문서에 넘긴다. 파서 KDoc(`AttractionAttributeParser.kt:6-8`)은 「요금은 place `use_fee` + 반복정보 요금 행 폴백, 규칙은 `AttractionFee` 한 곳」으로 고친다. 파서 `VERSION` 2 → 3.
4. 휴무 파서(같은 VERSION 3): 쉼표·빗금으로 쪼개기(`:65`) **전에** 괄호 단서를 처리한다.
   - [U1] 괄호 `(`…`)` 안에 휴무가 옮겨 가는 말(「다음날」「다음 평일」「그 다음」「전날」「대신」)이 있으면 지금처럼 UNKNOWN 이다.
   - 그런 말이 없고 여는 말(「정상 개장」「개방」 등)만 있으면 괄호를 떼고 요일을 읽는다. 단서는 쉬는 날 원문에 그대로 보인다.
   - 괄호가 닫히지 않으면 UNKNOWN 이다.
   - 「매월 마지막 월요일 (단, …)」처럼 매주가 아닌 문장은 괄호를 떼도 UNKNOWN 이다.
   - 영문 괄호 단서는 지금 동작을 유지한다.
5. 확인 상태 칸: 「출처: {표시명} · 원천 갱신일: YYYY-MM-DD」(S1-11 §4 문구).
   - 표시명 표: TOURAPI → 「한국관광공사 TourAPI」 / 「Korea Tourism Organization TourAPI」 · GOCAMPING → 「한국관광공사 고캠핑」 / 「Korea Tourism Organization GoCamping」 · null 이나 그 밖의 값 → 「출처: 정보 없음」 / 「Source: Not provided」. TourAPI 로 추정하지 않는다(S1-11).
   - 원천 갱신일은 색인 `modifiedAt`(= place `sourceModifiedAt`)이다. null 이면 「원천 갱신일: 정보 없음」.
   - [U3] 수집일은 S1-11 대로 「수집일: 정보 없음」을 낸다(신설은 Out of Scope).
   - JSON-LD `dateModified` 는 넣지 않는다.
   - 바닥 출처 줄(출처표시 의무, SSR `sourceLine` · FE `placeSourceLine`)은 확인 상태와 별개로 유지한다. 첫 항목은 `source=GOCAMPING` 이면 「출처: 한국관광공사 고캠핑」, 그 밖(TOURAPI·null·모르는 값)이면 지금 고정 문구다. 의무 문구라 null 이어도 비우지 않는다(`data-sources.md:99-100`). 첫 항목이 고캠핑이면 덧붙는 「고캠핑」은 빼서 한 번만 낸다.
6. 행동 줄:
   - 길찾기(FE 전용, [U7]): 지금 「구글 지도에서 보기」 링크(`googleMapsSearchUrl`)를 요약 아래로 올린다(새 외부 호출 없음).
   - 전화(FE·SSR): 원문은 `sourceText(infoCenter)`, 비면 `sourceText(tel)` 이다. 원문에서 처음 나오는 전화번호 **하나만** `tel:` 링크로 만든다. 패턴: `(?:\+82[- ]?)?0\d{1,3}[- ]?\d{3,4}[- ]?\d{4}`, 이것이 없을 때만 대표번호 `\b1\d{3}(?:-\d{4})?\b`. href 는 숫자와 `+` 만 남긴다. 패턴이 없으면 링크 없이 원문만 보인다. 원문이 비면 전화 항목을 내지 않는다. 원문은 보이는 글로 둔다.
   - 전화 규칙 원본은 copy.mjs 의 새 함수 `attractionPhone(raw)` → `{ text, href }`(href 는 링크가 없으면 null)다. Kotlin `AttractionSeoText.attractionPhone` 이 골든 패리티(SR-5.1)로 따른다.
   - 중복 제거: FE 「이용 안내」의 문의 행은 SR-1.3 대로 뺀다. 제목 아래 전화 줄(SSR `AttractionPageRenderer.kt:376` · FE `AttractionPage.tsx:407`)은 행동 줄이 `tel` 을 원문으로 쓸 때(= `infoCenter` 가 빔)만 뺀다. `infoCenter` 가 있으면 행동 줄이 `tel` 을 보여 주지 않으므로 제목 아래 줄을 지금대로 남긴다.
7. 출력 순서(렌더러 계약 `AttractionPageRenderer.kt:41`):
   - `feeText` 는 `escapeHtml` 만 건다(SR-2.2).
   - 그 밖에 새로 나가는 원문 값(요금 폴백 `useFee`·이용시간·쉬는 날·주차·반려동물 원문·전화·시군구·이웃 제목·`alt`·`containedInPlace.name`)은 모두 `sourceText` → `escapeHtml` 순서다.
   - `tel:` href 도 `escapeHtml` 을 거친다.

### SR-3 고유 블록 (S3-7)
1. 사실 표: SSR 방문 요약을 `<dl data-place-section="visit-summary">`(이름·값 쌍, SR-2.1 표의 칸 순서)로 내고, 배지 줄은 바로 뒤 `<p data-place-section="visit-badges">` 로 낸다 — FE 와 같은 칸·같은 문구(SR-5.1 패리티 골든으로 잰다).
2. 거리순 이웃 링크: 기존 「같은 분류 가까운 곳 / Similar places nearby」를 `regionSection` 밖 독립 절(`data-place-section="same-category-nearby"`)로 옮긴다. 이름은 유지한다(glossary 3-1). 끝난 행사를 거른 **뒤**(`:553`) 0건이면 절을 내지 않는다. SSR 전용(SR-1.6).
3. 집계 문장: 새 문장을 만들지 않는다. 기존 `regionSection` 문장(「{시군구} {유형} N곳 중 {분류} M곳」, `AttractionPageRenderer.kt:535-545`, {분류}=원천 소분류 이름 `categoryName`)을 S3-7 집계 문장으로 본다.
4. SSR 사진: 대표 사진 1장을 `<img src alt="{제목}">` 으로 낸다.
   - [U4] `https://` 이면 그대로, `http://tong.visitkorea.or.kr/` 이면 `https://` 로 바꿔 낸다. 그 밖의 http 는 내지 않는다.
   - `width`·`height` 는 원천에 크기가 없어 넣지 않는다(크기·CLS 는 S2-5).
   - 사진이 없으면 내지 않는다.
5. JSON-LD 보강(TouristAttraction): `containedInPlace`(시군구 → 시도 `AdministrativeArea`, 이름만), `image` 를 `ImageObject`(`contentUrl`, `license`, `creditText` 「한국관광공사」)로 바꾼다.
   - `license` 는 `copyrightDivCd` 가 Type1 이면 공공누리 제1유형 URL, Type3 이면 제3유형 URL, 그 밖의 값(Type2 등)이나 null 이면 넣지 않는다.
   - `isAccessibleForFree` 는 SR-2.3 결과로 자연히 늘어난다.
   - `sameAs`·`creator` 는 원천이 없어 넣지 않는다(Out of Scope — 계획 S3-7 에서 줄어든 항목).
6. 규칙 원본은 지금처럼 `copy.mjs` `attractionJsonLd` 이고 Kotlin 이 골든 패리티로 따른다.
   - `jsonld-golden.json` 케이스: 사진 Type1·Type3·Type2·없음, 시군구 있음·없음.
   - 골든 생성기 `toApi`(`attractionJsonLdGolden.test.ts:30`)는 색인 `sigunguName` 을 copy.mjs 가 읽는 자리로 옮기도록 고친다.

### SR-4 색인 필드 전달
1. place 는 바꾸지 않는다 — `AttractionResponse` 가 이미 `source`(`AttractionDtos.kt:140`)·`copyrightDivCd`(`:159`)를 싣는다.
   - 고칠 곳: search:batch `PlaceApiClient.AttractionDto` 필드와 `fetchPageAfter` 손 매핑(`PlaceApiClient.kt:32-33, 177-218` — 데이터 클래스에만 넣으면 null 로 색인된다), 태스클릿 문서 조립(`AttractionApiReindexTasklet.kt:267-322`), search:domain `AttractionDocument`, batch `AttractionIndexDocument`(필드·변환), `attractions-index.json`(`source`·`copyrightDivCd` keyword, `feeText` text `index: false`), app `AttractionSearchDocument`(필드·변환 — 새 세 필드와 `petAcmpyType`), `SearchAttractionUseCase` 결과, `SearchAttractionService` 매핑, FE `portal-fe/src/api/placeApi.ts` `Attraction`(`source`·`copyrightDivCd`·`feeText`·`modifiedAt`·`petAcmpyType`). `petAcmpyType` 은 색인에 이미 있고(`attractions-index.json:372`) 읽기 쪽만 빠져 있다 — 반려동물 칸의 UNKNOWN 폴백(SR-2.1)이 읽는다.
   - `searchReadRequired`(`build.gradle.kts:538`)에 `source`·`copyrightDivCd`·`feeText`·`petAcmpyType` 을 넣고, `searchReadOmitted` 의 `petAcmpyType` 항목(`build.gradle.kts:528`)을 지운다 — 두 목록에 함께 있으면 게이트가 실패한다(`:598`).
   - 외부 데이터 3규칙 ③은 해당 없다 — place 컬럼·왕복 경로가 그대로이고, 재색인은 매번 새로 쌓는다.
2. 선행 조건: 2026-10-09 06:30 KST 정기 재색인 로그에서 `attribute parser v2` 와 영문 N/A 주차 UNKNOWN 건수를 확인해 `docs/specs/2026-10-08-place-text-and-states/verifications/deploy-check.md` 에 적기 **전에는 이 변경을 main 에 푸시하지 않는다** — main 푸시가 곧 이미지 생성이고(`.github/workflows/images.yml:5`), 다음 정기 재색인이 v3 로 돈다. S2-7 「전」 값도 v2 재색인 뒤 같은 30곳으로 다시 받는다.
3. 배포 순서: search:batch(색인) → 재색인 → search:app·portal-fe(표시). 한 커밋으로 함께 배포돼 표시가 먼저 나가도 아래 폴백이 있어 안전하다 — 순서가 걸리는 것은 재색인 시각뿐이다. 새 필드가 없을 때의 폴백:
   - 확인 상태 칸은 「출처: 정보 없음」, 바닥 출처 줄은 지금 고정 문구.
   - `feeText` 가 없으면 요금 칸은 `sourceText(useFee)` 다(SR-2.1 표).
4. 롤백: v2 search:batch 이미지로 되돌리고 재색인 1회. `attributeParserVersion` 이 2 로 돌아왔는지 확인한다. 새 필드는 비고 표시는 3 의 폴백으로 돌아간다.
5. 수동 재색인은 정기 회차(21:30 UTC)와 겹치지 않는 시각에, 실행 중인 Job 이 없는지 확인한 뒤 1회만 돌린다(`concurrencyPolicy: Forbid` 는 수동 Job 을 막지 않는다).

### SR-5 검증
1. 단위 (반복정보 케이스는 픽스처 표가 아니라 given/then 개별 케이스):
   - `AttractionFee.text(useFee, info)` (`info` 는 푼 값):
     - useFee 있음 → 그 값.
     - useFee 「무료」 + 반복정보 「입장료 3,000원」 → 「무료」, 판정 FREE.
     - useFee 공백뿐 → 반복정보.
     - 요금 행 둘(입장료·관람료) → serialnum 순 「 / 」.
     - 「입장 료」 → 일치.
     - 「주차요금」 → 제외.
     - `info` 가 `Map` 하나(단일 객체) → 그 행을 쓴다.
     - `serialnum` 이 수가 아닌 행 → 원천 위치를 순서값으로.
     - `info` null(태스클릿이 깨진 JSON 에서 넘기는 값) + useFee 없음 → null.
     - `infotext` 「&lt;어린이&gt; 무료」 → 「<어린이> 무료」(정규화 한 번).
     - 둘 다 없음 → null.
   - 파서 v3 픽스처:
     - 77 원문 → MON.
     - [U1] 4811 원문 → UNKNOWN.
     - tsv:41·79 기대값 유지.
     - 16151 원문 → UNKNOWN.
     - 쉼표 없는 괄호 「매주 화요일(공휴일 정상 개장)」 → TUE.
     - 닫히지 않은 괄호 → UNKNOWN.
     - `feeText` 「<어린이> 무료」 → 입장 UNKNOWN.
     - 테스트 헬퍼(`AttractionAttributeParserTest.kt:159-173`)의 `useFee` 인자를 `feeText` 로 바꾼다. tsv `useFee` 행은 `parse(feeText = AttractionFee.text(row.raw, null))` 로 운영과 같은 경로를 거친다. 기존 19행 기대값은 그대로여야 하고, 바뀌는 행이 있으면 원문·이유를 적고 기대값을 고친다.
     - 반복정보만 「무료」 → FREE, 금액 → PAID(`AttractionFee.text(null, info)` 결과를 `feeText` 로).
     - `fixtures.size` 단언을 새 행 수로 고친다.
   - 태스클릿: `useFee=null` + `infoRaw` 무료 행 → bulk `attrAdmission=FREE`·`feeText`, 금액 행 → PAID, `infoRaw` 가 깨진 JSON → `feeText` 는 useFee 기준이고 코스 경고 동작은 그대로. `source`·`copyrightDivCd` 를 단 dto → bulk 에 같은 값. 재색인 캡처(`AttractionReindexCaptureTest`)에도 세 필드를 넣는다.
   - 방문 요약 칸 값(Kotlin·FE 각각, 국·영): 쉬는 날 Weekly+원문 두 줄 · AlwaysOpen · Unknown 이면 원문만. 주차 NO 는 「주차 불가」, UNKNOWN+원문 없음은 「정보 없음」. 반려동물 ALLOWED 문구 · UNKNOWN 이면 원문. 무장애 긍정 항목 「 · 」 · 없음이면 「정보 없음」. `attributes` null 옛 문서는 원문 줄만. 배지 줄은 신용카드·유모차·많이 클릭한 곳 순서이고, 항목 0 이면 절 없음.
   - FE 「이용 안내」(일반 유형): 주차요금·intro·반복정보(요금 행 포함)가 남고, 이용시간·쉬는날·이용요금·주차·문의 행은 없다. 행사·숙박·코스는 지금과 같다.
   - 전화 중복: `infoCenter` 빔 + `tel` 있음 → 제목 아래 전화 줄 없음, 행동 줄에 `tel`. 둘 다 있음 → 둘 다 보인다.
   - XSS: 요금 행 `infotext` 에 `&lt;img src=x onerror=alert(1)&gt;` 와 `"` → `feeText` 는 평문 `<img src=x onerror=alert(1)>`, SSR 에 `<img` 없이 `&lt;img` 와 `&quot;` 만. FE 는 방문 요약 안에 `img` 요소 0개, 같은 글자가 텍스트로 보인다. SSR: `feeText`=「<어린이> 무료」 → 방문 요약 요금 `<dd>` 에 `&lt;어린이&gt; 무료`.
   - 순서 단언: 골든과 별개로 `data-place-section` 표지 기준, `order.none { it < 0 }` + `order shouldBe order.sorted()`. 새 순서·새 절에 맞춰 고칠 기존 단언:
     - SSR `AttractionPageRendererTest.kt:145-150`(「이용 안내」 표지)
     - `:152-154`(`<dt>이용시간</dt>` — 방문 요약 `<dl>` 의 이용시간 칸으로 대상 이동)
     - `:186-195`(「매주 화요일 휴무」 표지·「배지 뒤」 제목)
     - `:303-326`(「입장 무료」<「많이 클릭한 곳」 순서·`<h2>방문 정보 요약</h2>` — `visit-badges` 줄로)
     - FE `AttractionPage.test.tsx:134-153`(「이용 안내」 h2 순서)·`:440-456`(At a glance 탭의 「Closed on Tuesdays」 — 방문 요약 쉬는 날 칸으로)
     - FE 는 DOM 순서 단언.
   - FE↔SSR 방문 요약 패리티: 골든 JSON(`search/app/src/test/resources/render/visit-summary-golden.json`)의 케이스는 `{name, input, output}` 이다. `input` 은 색인 문서 `_source` 모양이다. `output` 은 FE 가 `input` 을 `toApi`(`attractionJsonLdGolden.test.ts:31` 과 같은 변환)로 바꿔 `visitSummary` 에 넣은 결과(칸 이름·값·배지 줄)다. Kotlin 은 같은 `input` 을 `AttractionSearchDocument` 로 역직렬화해 `toDomain()` 한 문서를 렌더하고(`AttractionJsonLdParityTest.kt:47` 선례), 렌더된 `<dl>`·`visit-badges` 에서 뽑아 `FooterLinksParityTest` 의 `decodeHtml` 로 되돌린 뒤 비교한다. 케이스는 feeText 있음·useFee 만·둘 다 없음 × source 있음·없음 × 국·영, 그리고 SR-2.1 표의 해석·원문 조합 각 1건.
   - 전화 패리티: copy.mjs `attractionPhone` 의 출력 `{text, href}` 를 골든 JSON(`search/app/src/test/resources/render/phone-golden.json`)으로 쓰고, Kotlin `attractionPhone` 이 같은 입력에 같은 값을 낸다. 케이스는 아래 `tel:` 8사례 + 「관광안내전화1330」(한글 바로 뒤 대표번호 → `tel:1330`). 렌더된 SSR `actions` 절의 href 도 한 건 대조한다.
   - `PlaceApiClientTest`: 두 필드 역직렬화.
   - `SearchAttractionService`: API 결과에 네 필드(`source`·`copyrightDivCd`·`feeText`·`petAcmpyType`)가 실린다.
   - 확인 상태: source TOURAPI·GOCAMPING·null·기타 × 국·영, `modifiedAt` null, SSR HTML 에 「원천 갱신일: YYYY-MM-DD」 텍스트.
   - 바닥 출처 줄: GOCAMPING + camping 일 때 「고캠핑」이 한 번만.
   - `tel:` 기대값:
     - 「행사장 02-319-1220운영사 02-737-6444」 → `tel:023191220`
     - 「02-724-0274~6」 → `tel:027240274`
     - 「02-2153-0310, 0311 (12:00~13:0」 → `tel:0221530310`
     - 「K-컬처 스퀘어 운영사무국 02-2068-1176」 → `tel:0220681176`
     - `02-123-4567<br>010-1234-5678` → `tel:021234567`
     - 「+82-2-123-4567」 → `tel:+8221234567`
     - 「1330」 → `tel:1330`
     - 「문의: 없음」 → 링크 없음
   - 브레드크럼 시군구(화면·BreadcrumbList).
   - 이웃: 0건, 그리고 「목록은 있으나 모두 끝난 행사」 → 절 없음.
   - SSR `<img>`: https 그대로 · tong http → https · 그 밖 http → 없음 · 사진 없음 → 없음.
   - JSON-LD: license 절대값 `it`(Type1 → 제1유형 URL, Type3 → 제3유형 URL, Type2·null → 속성 없음) + 골든 새 케이스 + 패리티.
   - 관광지(12) 국·영 골든 HTML 추가(갱신은 `UPDATE_RENDER_GOLDEN=1`).
   - 색인 매핑 계약 게이트.
2. S2-7 30곳 재측정: 「전」은 v2 재색인 뒤 같은 30곳, 같은 집계 스크립트로 받는다. 기대값을 미리 적는다:
   - [U1] 휴무 누락 2 → 1(4811 은 휴무가 옮겨 가는 단서라 UNKNOWN 유지).
   - 요금 칸 「정보 없음」 11건: 재색인 전에 11개 id 의 반복정보 행 `infoname`·`serialnum`·`infotext` 원문과 SR-2.2 일치 여부를 `verifications/s2-7-expected.md` 표에 먼저 적고, 기대값은 「요금 칸 「정보 없음」 11 → (11 − 일치 id 수)」이고, 일치한 id 는 각각 요금 칸이 「정보 없음」이 아니어야 한다. 3종 이름에 들지 않는 id 는 이유와 함께 「남는 건」으로 옮긴다(이름 목록은 이 표를 보고 늘리지 않는다 — 늘리려면 스펙 개정).
   - 입장 UNKNOWN 9건 중 13354 는 반복정보 요금 행이 없어 남는다. 나머지 8건은 재색인 전에 각 id 의 반복정보 요금 행 원문으로 기대값(FREE·PAID·UNKNOWN)을 같은 파일 `verifications/s2-7-expected.md` 표에 먼저 적는다.
   - 안 바뀌는 id 는 이유와 함께 「남는 건」으로 둔다.
3. 화면: 390×844(가시 664px)에서 요금·쉬는 날·길찾기 요소의 `getBoundingClientRect().bottom ≤ 664` 를 CDP 로 잰다(30곳 중 표본 5곳, 국·영). 1280×800 도 같다. 측정 전에 로드된 번들에 이번에 넣은 심볼이 있는지 확인하고, 옛 번들 측정은 버린다. 가독성 우선 — 못 맞추면 실측과 이유를 남긴다.
4. 구조화 데이터: 표본 5 URL 을 validator.schema.org 로 오류 0. Google 리치 결과 테스트는 표본 3 URL 을 사용자 몫으로 넘기고(Q2), 결과를 받기 전까지 S3-7 은 「구현 완료·검증 대기」다.
5. 회귀 주입(임시 사본) — 아래 각각이 빨간불을 내야 한다:
   - 괄호 여는 말 처리 삭제 → 77 단언 빨강
   - 휴무 이동 말 판정 삭제 → 4811 UNKNOWN 단언 빨강
   - `AttractionFee` 반복정보 폴백 삭제 → 빨강
   - 태스클릿에서 `feeText` 전달 삭제 → 태스클릿 단언 빨강
   - `SearchAttractionService` 매핑 한 줄 삭제 → 서비스 단언 빨강
   - 확인 상태 null 폴백 삭제 → 「출처: 정보 없음」 단언 빨강
   - 요금 행 `escapeHtml` 제거 → XSS 단언 빨강
   - FE 방문 요약 문구 한쪽만 변경 → 패리티 빨강
   - SSR 방문 요약을 개요 뒤로 → 순서 단언 빨강
   - ImageObject license 매핑 뒤바꿈 → 절대값 단언과 골든 패리티 빨강
   - 색인 매핑에서 새 필드 삭제 → 계약 게이트 빨강
   - SSR 에서 `feeText` 에 `sourceText` 다시 걸기 → XSS 단언·「<어린이> 무료」 단언 빨강
   - `AttractionFee` 단일 객체(`Map`) 분기 삭제 → 단일 객체 케이스 빨강
   - Kotlin `attractionPhone` 에서 `(?:\+82[- ]?)?` 삭제 → 「+82-2-123-4567」 골든 패리티 빨강
   - FE 「이용 안내」에서 `repeatInfoRows` 제외 → FE 남는 행 단언 빨강
   - 파서 `admission()` 에 `stripTags` 다시 걸기 → 「<어린이> 무료」 UNKNOWN 단언 빨강
6. 문서: 구현 뒤 `search/glossary.md` 3-1 절에 「방문 요약」「확인 상태」「행동 줄」「배지 줄」「feeText」를 등록한다. 「방문 요약」 항목의 금지/주의 열에는 「「방문 정보 요약」/「At a glance」는 행사·숙박·코스의 배지 절 제목이고(FE 탭 이름은 「방문 정보」) 방문 요약과 다르다」를 적는다.

## Existing Code to Leverage
`AttractionPageRenderer.kt:364-388(attractionBody),448(visitorInfo),466(badges),528(regionSection),553-558,622,635,739(sourceLine),223(primaryJsonLd),330(breadcrumb)`, `AttractionPage.tsx:232-248,297,320-381,385-393,415,440-474,521-542,574-581`, `AttractionAttributeParser.kt:34,48,59-74,107,173-185`, `AttractionApiReindexTasklet.kt:221-229`, `copy.mjs:653,662,755,784`, `attractionJsonLdGolden.test.ts`, `AttractionJsonLdParityTest.kt`, `RegionAggregator.kt:43,54`, `AttractionDtos.kt:140,159`, `PlaceApiClient.kt:32-80,177-218`, `SearchAttractionService.kt:240`, `build.gradle.kts:538`, `attractionJsonLdGolden.test.ts:30`, `sync_tour.py:277`, `placeView.ts:267`, `placeAttributes.ts:187`, `AttractionSeoText.kt:12-13,46,74`, `CourseStops.kt:18-33`, `AttractionApiReindexTasklet.kt:439-446`, `placeView.ts:306-327`, `placeAttributes.ts:165,279`, `AttractionInfoTabs.tsx`, `googleMaps.ts:44-59`, `FooterLinksParityTest.kt`, `footerLinksGolden.test.ts`, `AttractionPageRendererTest.kt:145-154,186-195,303-326`, `AttractionPage.test.tsx:134-153,440-456`, `AttractionPage.tsx:256,407,443-459,498`, `AttractionPageRenderer.kt:376,449-453,566-577`.

## Out of Scope
공식 홈페이지 수집(TourAPI `homepage` 필드 적재 — 외부 데이터 3규칙대로 후속 스펙), `sameAs`, 사진별 creator(원천에 없음), 수집일·검수일 신설, `dateModified`, 날씨·대기질 절 변경. 영문 반복정보 요금 행 이름(영문 요금 칸은 이번에 변화 없음 [U5]), 영문 휴무 괄호 단서, SSR 사진 크기·https 적재 치환(S2-5), 계획 S3-7 의 creator·sameAs(원천 없음). SSR 행동 줄의 길찾기 링크(FE 전용 [U7]), 입장 무료/유료 배지 문구의 별도 표시(요금 칸 값이 같은 정보).
