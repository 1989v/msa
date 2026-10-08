# spec-review 심판 2라운드: 관광지 상세 첫 화면 (`docs/specs/2026-10-09-place-detail-first-screen/spec.md`)

13건을 모두 유지했고, 강등·기각은 없습니다. 인용 위치 두 곳이 틀렸지만 발견의 내용 자체는 맞아서 반증할 수 없었습니다.
- T2-3 은 `spec.md:259` 를 인용했는데, 이건 1라운드 판정문의 줄 번호입니다. 스펙에서 같은 문장은 `spec.md:97` 에 있습니다.
- U2-2 는 「`infoname` 은 스펙·리뷰 문서에만 있다」고 했지만, `placeView.ts`·`placeView.test.ts`·place 쪽 테스트에도 나옵니다. 다만 요금 행 이름(입장료·관람료·이용요금) 표본은 레포 어디에도 없으므로 핵심 주장은 그대로 성립합니다.

리뷰어가 「(경미)」로 적은 4건(A2-3·I2-3·T2-4·U2-3)은 리뷰어 등급대로 MINOR 로 두었습니다. BLOCK 은 없습니다.

## 1. 묶음 표

| 묶음 | 내용 | 포함 발견 | 판정 |
|---|---|---|---|
| C1 | `feeText` 를 두 번 정규화한다. XSS 기대값이 성립하지 않는다 | I2-1 · T2-1 | 유지 REVISE |
| C2 | `AttractionFee` 입력 형식(JSON 은 batch 가 푼다). 단일 객체·`serialnum`·깨진 JSON 경계. 파서 헬퍼 경로 | A2-1 · T2-3 · A2-3 | 유지 REVISE (A2-3 MINOR) |
| C3 | 방문 요약이 「이용 안내」를 통째로 대체하면 정보가 사라진다. 칸별 값 규칙이 없다 | I2-2 · U2-1 | 유지 REVISE, 사용자 판단 U2 개정 |
| C4 | SSR 행동 줄 규칙이 두 벌이 된다. 패리티는 `<dl>` 만 잰다. 전화가 두 번 나온다 | A2-2 · T2-2 · U2-3 | 유지 REVISE (U2-3 MINOR), 사용자 판단 U7 신설 |
| C5 | 「요금 정보 없음 11 → 0」의 근거가 없다 | U2-2 | 유지 REVISE |
| C6 | 선행 조건·배포 순서는 main 푸시 시점으로만 지킬 수 있다 | I2-3 | 유지 MINOR |
| C7 | 고칠 기존 단언 목록이 모자란다 | T2-4 | 유지 MINOR |

## 2. 발견별 판정 JSON

```json
[
  {"id":"A2-1 AttractionFee.text(useFee, infoRaw) 는 domain 이 JSON 을 풀어야","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/build.gradle.kts","line":8,"quote":"testImplementation(\"tools.jackson.core:jackson-databind\")"},
               {"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/CourseStops.kt","line":18,"quote":"입력은 infoRaw 를 JSON 으로 푼 값(List · Map · String · null)이다."},
               {"file":"search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt","line":441,"quote":"val parsed = runCatching { introReader.readValue(raw, Any::class.java) }"}],
   "reason":"domain 의 main 소스에는 Jackson 이 없고, JSON 은 batch 가 풀어 domain 에 넘기는 선례가 실제로 있다."},
  {"id":"A2-2 SSR 행동 줄 길찾기·전화 규칙이 Kotlin 에 없어 사본 생김","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/pages/place/googleMaps.ts","line":51,"quote":"const base = 'https://www.google.com/maps/search/?api=1';"},
               {"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":375,"quote":"if (!doc.tel.isNullOrEmpty()) append(\"<p>${escapeHtml(doc.tel)}</p>\")"}],
   "reason":"렌더러에서 google·maps 를 grep 하면 0건이고, search 쪽 main 에는 encodeURIComponent 에 해당하는 코드가 없다(URLEncoder 도 0건)."},
  {"id":"A2-3 AttractionAttributeSource.useFee 가 죽은 필드로 남음","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":34,"quote":"freeAdmission = admission(source.useFee),"}],
   "reason":"domain main 에서 useFee 를 읽는 곳은 :13 선언과 :34 뿐이다(AttractionDocument.useFee 는 다른 클래스다)."},
  {"id":"I2-1 feeText 이중 정규화로 원문 소실·XSS 단언 불성립","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt","line":12,"quote":"값 하나에 정규화는 한 번만 — 태그 제거 → 엔티티 디코드 순서라 두 번 걸면 `&lt;PARASITE&gt;` 가 … 지워진다"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":50,"quote":"새로 나가는 원문 값(요금·쉬는 날·…)은 모두 `sourceText` → `escapeHtml` 순서다"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":112,"quote":"SSR 에 `<img` 없이 `&lt;img` 만."}],
   "reason":"색인에 이미 `<img …>` 평문이 실려 있으므로, 출력 때 sourceText 가 TAG 를 다시 지우면 :112 의 기대값이 나올 수 없다. 스펙 문장과 코드 계약을 둘 다 인용했지만 리뷰어 등급(REVISE)을 유지한다."},
  {"id":"I2-2 [U2] FE 이용 안내 통째 대체로 원천 행 소실","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"portal-fe/src/pages/place/AttractionPage.tsx","line":441,"quote":"원천이 준 것을 다 보여준다 — 상세는 이 관광지에 대해 아는 전부를 내는 자리다."},
               {"file":"portal-fe/src/pages/place/AttractionPage.tsx","line":456,"quote":"...repeatInfoRows(attraction.infoRaw),"},
               {"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":492,"quote":"attributes.creditCard, if (en) \"Credit cards accepted\" else \"신용카드 가능\","}],
   "reason":"FE 「이용 안내」에는 주차요금·문의·intro·반복정보가 더 있고, 배지에는 SR-2.1 칸이 없는 신용카드·유모차가 있다."},
  {"id":"I2-3 선행 조건·배포 순서를 막는 지점 없음","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":".github/workflows/images.yml","line":5,"quote":"branches: [main]"},
               {"file":".github/workflows/images.yml","line":155,"quote":"search/batch/*)                            JVM_SVCS+=\" search-batch\" ;;"}],
   "reason":"main 에 푸시하면 경로별로 이미지가 함께 만들어지므로, 순서는 푸시 시점으로만 통제할 수 있다."},
  {"id":"T2-1 XSS 기대값이 SR-2.2·2.7 과 어긋남","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionSeoText.kt","line":23,"quote":"private val TAG = Regex(\"<[^>]*>\")"}],
   "reason":"I2-1 과 같은 뿌리다(묶음 C1). C1 을 고치면 :112 와 회귀 주입 :135 가 함께 성립한다."},
  {"id":"T2-2 패리티 골든이 <dl> 만 잼, tel 소속 미정","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":119,"quote":"FE 방문 요약 함수의 출력(칸 이름·값)을 골든 JSON 으로 쓰고"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":104,"quote":"`tel:` 기대값:"}],
   "reason":"전화 추출 규칙은 FE·SSR 두 벌인데 둘을 맞추는 장치가 스펙에 없다."},
  {"id":"T2-3 기존 요금 픽스처 경로·반복정보 형식 경계 누락","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/test/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParserTest.kt","line":118,"quote":"parse(useFee = row.raw).freeAdmission.name shouldBe row.expected"},
               {"file":"portal-fe/src/pages/place/placeView.ts","line":324,"quote":"order: Number.isFinite(serial) ? serial : i"},
               {"file":"docs/specs/2026-10-09-place-detail-first-screen/spec.md","line":97,"quote":"반복정보만 「무료」 → FREE, 금액 → PAID."}],
   "reason":"인용 위치(:259)는 틀렸지만 같은 문장이 :97 에 있다. 헬퍼 경로와 단일 객체·serialnum 경계가 스펙에 없다."},
  {"id":"T2-4 고칠 기존 단언 목록 부족","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionPageRendererTest.kt","line":153,"quote":"root shouldContain \"<dt>이용시간</dt><dd>09:00~18:00\\n입장 마감 17:00</dd>\""},
               {"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionPageRendererTest.kt","line":192,"quote":"val order = listOf(\"매주 화요일 휴무\", \"접근성 정보\", \"웰니스 관광\", \"종로구 관광지 120곳\")"}],
   "reason":"두 단언이 실재하고, [U2] 를 적용하면 바뀌어야 한다."},
  {"id":"U2-1 칸별 값 규칙이 요금·확인 상태에만","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAttributeParser.kt","line":131,"quote":"\"전구역동반가능\" to PetPolicy.ALLOWED,"},
               {"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":567,"quote":"val icons = BarrierFreeInfo.ICONS.filter { (code, _) -> code in info.flags }"}],
   "reason":"원문과 해석값 중 무엇을 어떤 형식으로 내는지 정해지지 않았다. 무장애 칸에는 AttractionAttributes 쪽 출처조차 없다(속성 6종에 무장애가 없다)."},
  {"id":"U2-2 「요금 정보 없음 11 → 0」 근거 없음","verdict":"keep","severity":"REVISE",
   "evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage2/s2-7-fact-check.md","line":45,"quote":"요금 원문(`useFee`)이 비었는데 반복정보(`infoRaw`)에 입장료·관람료가 있음: 11건"}],
   "reason":"레포의 infoname 표본은 '내국인예약안내'·'코스안내'뿐이라, 11건의 실제 행 이름이 3종 목록에 드는지 확인한 기록이 없다."},
  {"id":"U2-3 전화가 두 번 나옴","verdict":"keep","severity":"MINOR",
   "evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":375,"quote":"if (!doc.tel.isNullOrEmpty()) append(\"<p>${escapeHtml(doc.tel)}</p>\")"},
               {"file":"portal-fe/src/pages/place/AttractionPage.tsx","line":407,"quote":"{attraction.tel && <p className=\"place-detail-tel\">{attraction.tel}</p>}"}],
   "reason":"제목 아래 전화 줄이 SSR·FE 양쪽에 실제로 있다."}
]
```

SUMMARY: keep 13 / demote 0 / dismiss 0
NOTES: `admission()` 은 입력에 다시 `stripTags` 를 건다(`AttractionAttributeParser.kt:176`). 그래서 디코드된 `feeText`(「<어린이> 무료」)를 넣으면 판정이 v2 의 UNKNOWN 에서 FREE 로 바뀔 수 있다. 판정문에 없는 새 사항이라 여기 한 줄로만 남긴다. 아래 E-7 의 단언 목록에 `AttractionPageRendererTest.kt:303-326`·`AttractionPage.test.tsx:134-153,440-456` 을 넣은 것은 T2-4 대처를 빠짐없이 하려고 심판이 더한 부분이다.

## 3. spec.md 편집 목록

[U2]·[U7] 이 붙은 문장은 권고 기본값입니다. 사용자가 다르게 고르면 그 문장만 바꿉니다.

**E-1. 6행(개정 문단) 끝에 한 문장 추가**
`개정 2026-10-09(2) — 2라운드 심판(13건 전건 유지, `context/review-verdict-round2.md`) 반영: U2 를 「겹치는 행·배지만 대체」로 좁혔고(정보 손실 없음), U7 「SSR 행동 줄은 전화만」을 더했다.`

**E-2. SR-1 전체 교체**
```
### SR-1 첫 화면 순서 (FE · SSR 같은 순서)
1. 브레드크럼(허브 › 시도 › 시군구 — 색인 `sigunguName`·`ldongSignguCd` 가 없으면 시도까지) → 제목(h1)·찜 → **방문 요약**(SR-2) → 배지 줄(SR-2.1, 있을 때만) → 행동 줄(SR-2.6) → 개요(좁은 화면 접기 유지) → 이하 기존 절 순서 유지.
2. 방문 요약·배지 줄은 `typeSection` 이 null 인 유형(행사·숙박·여행코스를 뺀 전부)에만 붙는다. 행사·숙박·코스는 지금 유형별 절과 배지 절을 그대로 두고 행동 줄만 붙인다.
3. [U2] 일반 유형에서 방문 요약은 **겹치는 것만** 대체한다. 원천 행은 하나도 화면에서 빠지지 않는다.
   - SSR: `visitorInfo`(4행 — 이용시간·쉬는날·이용요금·주차, `AttractionPageRenderer.kt:449-453`)는 전부 방문 요약 칸과 겹치므로 일반 유형에서 내지 않는다. `badges` 절(「방문 정보 요약」/「At a glance」)도 일반 유형에서 내지 않는다 — 내용은 아래처럼 칸과 배지 줄로 옮긴다.
   - FE: 「이용 안내」에서 이용시간·쉬는날·이용요금·주차·문의(`infoCenter`) 다섯 행만 뺀다(`AttractionPage.tsx:443-449`). 주차요금(`parkingFee`)·`introRows`·`repeatInfoRows` 는 지금 자리·순서·`sourceText` 한 번 그대로 남긴다. 반복정보의 요금 행도 남긴다 — 어느 행이 요금인지 고르는 규칙 사본을 FE 에 두지 않기 위해서다. 남는 행이 없으면 절을 내지 않는다(지금 규칙). `AttractionInfoTabs` 에 넘기는 `badges`(`AttractionPage.tsx:256,498`)는 일반 유형에서 빈 목록으로 넘긴다. 탭과 그 안의 지역 절은 그대로 둔다.
   - 배지 흡수: 정기휴무(연중무휴·매주 ○요일 휴무)·주차 가능/불가·반려동물 동반은 SR-2.1 표의 해당 칸 첫 줄로 옮긴다. 입장 무료/유료는 요금 칸 값(`feeText`, 판정의 입력 그 자체)과 같은 정보라 따로 내지 않는다. 칸이 없는 신용카드·유모차 대여와 「많이 클릭한 곳」은 배지 줄로 남긴다.
4. FE 사진 히어로는 방문 요약 **아래**로 내린다. 데스크톱은 2열(왼쪽 요약·행동, 오른쪽 히어로)로, 지금 높이를 넘지 않게 — 세부 배치는 DESIGN.md 토큰과 `docs/design/k-heritage.html` 견본을 따른다.
5. SSR 은 FE 와 같은 순서로 절을 낸다. 절마다 `data-place-section` 속성(visit-summary · visit-badges · actions · same-category-nearby)을 붙인다. visit-badges 는 항목이 있을 때만, actions 는 전화 항목이 있을 때만 낸다. [U6] JSON-LD `BreadcrumbList` 도 시군구 단계를 넣는다(copy.mjs `attractionBreadcrumbJsonLd` 와 Kotlin `breadcrumbJsonLd` 를 함께 바꾸고 골든 사례에 넣는다).
6. 패리티 예외 — SSR 과 FE 가 다른 것은 아래 셋뿐이다:
   - 「같은 분류 가까운 곳」은 SSR 전용 절이다. FE 는 「주변 탐색」에 합쳐 두며(`AttractionPage.test.tsx:140`) 이번에 바꾸지 않는다.
   - FE 「이용 안내」에 남는 행(주차요금·intro·반복정보)은 FE 전용이다. SSR `visitorInfo` 는 지금도 4행뿐이었다.
   - [U7] 행동 줄의 길찾기 링크는 FE 전용이다. SSR 행동 줄은 전화만 낸다 — SSR 에 지도 URL 규칙과 `encodeURIComponent` 대응 사본을 만들지 않는다.
```

**E-3. SR-2 전체 교체**
```
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
3. 입장 무료 판정(도메인 `freeAdmission`, 색인 `attrAdmission`): `AttractionAttributeSource.useFee` 를 `feeText` 로 **바꾼다**(필드를 더하지 않는다 — 바꾸고 나면 `useFee` 를 읽는 곳이 없다). `admission()` 은 `source.feeText` 를 읽는다 — 표시와 같은 값이다. 규칙 표는 지금 그대로 쓴다. 태스클릿(`AttractionApiReindexTasklet.kt:221-229`)은 SR-2.2 에서 계산한 같은 값을 파서와 문서에 넘긴다. 파서 KDoc(`AttractionAttributeParser.kt:6-8`)은 「요금은 place `use_fee` + 반복정보 요금 행 폴백, 규칙은 `AttractionFee` 한 곳」으로 고친다. 파서 `VERSION` 2 → 3.
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
   - 중복 제거: FE 「이용 안내」의 문의 행은 SR-1.3 대로 뺀다. 제목 아래 전화 줄(SSR `AttractionPageRenderer.kt:375` · FE `AttractionPage.tsx:407`)은 행동 줄이 `tel` 을 원문으로 쓸 때(= `infoCenter` 가 빔)만 뺀다. `infoCenter` 가 있으면 행동 줄이 `tel` 을 보여 주지 않으므로 제목 아래 줄을 지금대로 남긴다.
7. 출력 순서(렌더러 계약 `AttractionPageRenderer.kt:41`):
   - `feeText` 는 `escapeHtml` 만 건다(SR-2.2).
   - 그 밖에 새로 나가는 원문 값(요금 폴백 `useFee`·이용시간·쉬는 날·주차·반려동물 원문·전화·시군구·이웃 제목·`alt`·`containedInPlace.name`)은 모두 `sourceText` → `escapeHtml` 순서다.
   - `tel:` href 도 `escapeHtml` 을 거친다.
```

**E-4. SR-3.1 교체**
- 바꿀 문장: `1. 사실 표: SSR 방문 요약을 `<dl data-place-section="visit-summary">`(이름·값 쌍)로 낸다 — FE 와 같은 칸·같은 문구(SR-5.1 패리티 골든으로 잰다).`
- 새 문장: `1. 사실 표: SSR 방문 요약을 `<dl data-place-section="visit-summary">`(이름·값 쌍, SR-2.1 표의 칸 순서)로 내고, 배지 줄은 바로 뒤 `<p data-place-section="visit-badges">` 로 낸다 — FE 와 같은 칸·같은 문구(SR-5.1 패리티 골든으로 잰다).`

**E-5. SR-4.2·4.3 교체** (SR-4.1·4.4·4.5 는 그대로)
```
2. 선행 조건: 2026-10-09 06:30 KST 정기 재색인 로그에서 `attribute parser v2` 와 영문 N/A 주차 UNKNOWN 건수를 확인해 `docs/specs/2026-10-08-place-text-and-states/verifications/deploy-check.md` 에 적기 **전에는 이 변경을 main 에 푸시하지 않는다** — main 푸시가 곧 이미지 생성이고(`.github/workflows/images.yml:5`), 다음 정기 재색인이 v3 로 돈다. S2-7 「전」 값도 v2 재색인 뒤 같은 30곳으로 다시 받는다.
3. 배포 순서: search:batch(색인) → 재색인 → search:app·portal-fe(표시). 한 커밋으로 함께 배포돼 표시가 먼저 나가도 아래 폴백이 있어 안전하다 — 순서가 걸리는 것은 재색인 시각뿐이다. 새 필드가 없을 때의 폴백:
   - 확인 상태 칸은 「출처: 정보 없음」, 바닥 출처 줄은 지금 고정 문구.
   - `feeText` 가 없으면 요금 칸은 `sourceText(useFee)` 다(SR-2.1 표).
```

**E-6. SR-5.1 첫 두 묶음(`AttractionFee.text`·파서 v3 픽스처) 교체**
```
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
     - 테스트 헬퍼(`AttractionAttributeParserTest.kt:159-173`)의 `useFee` 인자를 `feeText` 로 바꾼다. tsv `useFee` 행은 `parse(feeText = AttractionFee.text(row.raw, null))` 로 운영과 같은 경로를 거친다. 기존 19행 기대값은 그대로여야 하고, 바뀌는 행이 있으면 원문·이유를 적고 기대값을 고친다.
     - 반복정보만 「무료」 → FREE, 금액 → PAID(`AttractionFee.text(null, info)` 결과를 `feeText` 로).
     - `fixtures.size` 단언을 새 행 수로 고친다.
```

**E-7. SR-5.1 의 나머지 항목 교체**

태스클릿·XSS·순서·패리티 항목을 아래처럼 바꾸거나 더하고, 나머지는 그대로 둡니다.
```
   - 태스클릿: `useFee=null` + `infoRaw` 무료 행 → bulk `attrAdmission=FREE`·`feeText`, 금액 행 → PAID, `infoRaw` 가 깨진 JSON → `feeText` 는 useFee 기준이고 코스 경고 동작은 그대로. `source`·`copyrightDivCd` 를 단 dto → bulk 에 같은 값. 재색인 캡처(`AttractionReindexCaptureTest`)에도 세 필드를 넣는다.
   - 방문 요약 칸 값(Kotlin·FE 각각, 국·영): 쉬는 날 Weekly+원문 두 줄 · AlwaysOpen · Unknown 이면 원문만. 주차 NO 는 「주차 불가」, UNKNOWN+원문 없음은 「정보 없음」. 반려동물 ALLOWED 문구 · UNKNOWN 이면 원문. 무장애 긍정 항목 「 · 」 · 없음이면 「정보 없음」. `attributes` null 옛 문서는 원문 줄만. 배지 줄은 신용카드·유모차·많이 클릭한 곳 순서이고, 항목 0 이면 절 없음.
   - FE 「이용 안내」(일반 유형): 주차요금·intro·반복정보(요금 행 포함)가 남고, 이용시간·쉬는날·이용요금·주차·문의 행은 없다. 행사·숙박·코스는 지금과 같다.
   - 전화 중복: `infoCenter` 빔 + `tel` 있음 → 제목 아래 전화 줄 없음, 행동 줄에 `tel`. 둘 다 있음 → 둘 다 보인다.
   - XSS: 요금 행 `infotext` 에 `&lt;img src=x onerror=alert(1)&gt;` 와 `"` → `feeText` 는 평문 `<img src=x onerror=alert(1)>`, SSR 에 `<img` 없이 `&lt;img` 와 `&quot;` 만. FE 는 방문 요약 안에 `img` 요소 0개, 같은 글자가 텍스트로 보인다.
   - 순서 단언: 골든과 별개로 `data-place-section` 표지 기준, `order.none { it < 0 }` + `order shouldBe order.sorted()`. 새 순서·새 절에 맞춰 고칠 기존 단언:
     - SSR `AttractionPageRendererTest.kt:145-150`(「이용 안내」 표지)
     - `:152-154`(`<dt>이용시간</dt>` — 방문 요약 `<dl>` 의 이용시간 칸으로 대상 이동)
     - `:186-195`(「매주 화요일 휴무」 표지·「배지 뒤」 제목)
     - `:303-326`(「입장 무료」<「많이 클릭한 곳」 순서·`<h2>방문 정보 요약</h2>` — `visit-badges` 줄로)
     - FE `AttractionPage.test.tsx:134-153`(「이용 안내」 h2 순서)·`:440-456`(At a glance 탭의 「Closed on Tuesdays」 — 방문 요약 쉬는 날 칸으로)
     - FE 는 DOM 순서 단언.
   - FE↔SSR 방문 요약 패리티: FE `visitSummary` 의 출력(칸 이름·값·배지 줄)을 골든 JSON(`search/app/src/test/resources/render/visit-summary-golden.json`)으로 쓴다. Kotlin 은 렌더된 `<dl>`·`visit-badges` 에서 뽑아 `FooterLinksParityTest` 의 `decodeHtml` 로 되돌린 뒤 비교한다. 케이스는 feeText 있음·useFee 만·둘 다 없음 × source 있음·없음 × 국·영, 그리고 SR-2.1 표의 해석·원문 조합 각 1건.
   - 전화 패리티: copy.mjs `attractionPhone` 의 출력 `{text, href}` 를 골든 JSON(`search/app/src/test/resources/render/phone-golden.json`)으로 쓰고, Kotlin `attractionPhone` 이 같은 입력에 같은 값을 낸다. 케이스는 위 `tel:` 7사례 + 「관광안내전화1330」(한글 바로 뒤 대표번호 → `tel:1330`). 렌더된 SSR `actions` 절의 href 도 한 건 대조한다.
```

**E-8. SR-5.2 의 「요금 칸 「정보 없음」 11 → 0.」 교체**
`요금 칸 「정보 없음」 11건: 재색인 전에 11개 id 의 반복정보 행 `infoname`·`serialnum`·`infotext` 원문과 SR-2.2 일치 여부를 `verifications/s2-7-expected.md` 표에 먼저 적고, 기대값은 「일치하는 id 수 → 0」으로 둔다. 3종 이름에 들지 않는 id 는 이유와 함께 「남는 건」으로 옮긴다(이름 목록은 이 표를 보고 늘리지 않는다 — 늘리려면 스펙 개정).` 같은 줄 아래 「입장 UNKNOWN 9건」의 「표에 먼저 적는다」도 같은 파일 `verifications/s2-7-expected.md` 를 가리키게 합니다.

**E-9. SR-5.5 회귀 주입 목록 끝에 추가**
```
   - SSR 에서 `feeText` 에 `sourceText` 다시 걸기 → XSS 단언·「<어린이> 무료」 단언 빨강
   - `AttractionFee` 단일 객체(`Map`) 분기 삭제 → 단일 객체 케이스 빨강
   - Kotlin `attractionPhone` 패턴 한 글자 변경 → 전화 골든 패리티 빨강
   - FE 「이용 안내」에서 `repeatInfoRows` 제외 → FE 남는 행 단언 빨강
```

**E-10. Existing Code to Leverage 끝에 추가**
`AttractionSeoText.kt:12-13,46,74`, `CourseStops.kt:18-33`, `AttractionApiReindexTasklet.kt:439-446`, `placeView.ts:306-327`, `placeAttributes.ts:165,279`, `AttractionInfoTabs.tsx`, `googleMaps.ts:44-59`, `FooterLinksParityTest.kt`, `footerLinksGolden.test.ts`, `AttractionPageRendererTest.kt:145-154,186-195,303-326`, `AttractionPage.test.tsx:134-153,440-456`, `AttractionPage.tsx:256,407,443-459,498`, `AttractionPageRenderer.kt:375,449-453,565-576`.

**E-11. Out of Scope 끝에 추가**
`SSR 행동 줄의 길찾기 링크(FE 전용 [U7]), 입장 무료/유료 배지 문구의 별도 표시(요금 칸 값이 같은 정보).`

## 4. 3라운드 재리뷰 차원

마지막 라운드라 「새로 생긴 결함」만 보게 범위를 좁혀야 합니다.
- **usecase**: SR-2.1 칸 표의 경계(두 줄 값, `attributes` null), U2 를 좁힌 범위에서 정보가 빠지지 않는지, E-8 표 절차.
- **implementation**: FE 「이용 안내」 행 제거 범위, `AttractionInfoTabs` 에 빈 `badges` 를 넘기는 것, 전화 줄 중복 규칙, SR-4.2 푸시 게이트.
- **test-strategy**: E-6·E-7·E-9 의 케이스·골든 두 개·회귀 주입이 각각 빨간불을 낼 수 있는지.
- **architecture**: `AttractionFee.text(useFee, info: Any?)` 경계, 전화 규칙을 copy.mjs 가 원본으로 갖고 Kotlin 이 골든으로 따르는 구조, U7.
- **security(대조만)**: `feeText` 는 `escapeHtml` 만, 나머지는 `sourceText → escapeHtml`. 출력 경로마다 이스케이프가 남는지만 봅니다.
- **domain(대조만)**: U2 기본값의 범위가 바뀌었으므로(1라운드 판정문 `:314` 조건), glossary 등록 목록에 「배지 줄」을 더할지만 봅니다.

## 5. 사용자 판단 항목 (권고 기본값)

| # | 질문 | 권고 기본값 | 근거 |
|---|---|---|---|
| U2 (개정) | 방문 요약이 기존 절을 어디까지 대체할지 | **겹치는 것만 대체.** SSR `visitorInfo` 4행·배지 절은 전부 겹치므로 일반 유형에서 내지 않는다. FE 「이용 안내」는 이용시간·쉬는날·이용요금·주차·문의 5행만 빼고 주차요금·intro·반복정보(요금 행 포함)는 남긴다. 배지는 칸으로 흡수하고, 칸이 없는 신용카드·유모차·「많이 클릭한 곳」은 요약 아래 배지 줄 | FE 주석(`AttractionPage.tsx:441-442`)의 「원천이 준 것을 다 보여준다」를 지키면서 첫 화면 중복도 없앤다. 반복정보 요금 행은 요금 칸과 겹치지만, 빼려면 FE 에 행을 고르는 규칙 사본이 생겨 SR-2.2 의 「규칙 한 곳」이 깨지므로 남긴다(원문 라벨이라 같은 줄이 두 번 보이는 것은 아니다). 대안 「통째 대체」는 주차요금·intro·반복정보가 상세에서 사라진다 |
| U7 (신설) | SSR 행동 줄에 길찾기 링크도 낼지 | **전화만.** 길찾기는 지금처럼 FE 전용(패리티 예외) | SSR 에 지도 URL 을 내려면 3단 폴백과 `encodeURIComponent` 대응을 Kotlin 에 새로 만들고 골든을 하나 더 둬야 한다(레포에 대응 코드 0건). 외부 지도 링크는 SSR 의 목적(고유 사실·색인)에 보태는 것이 없고, 첫 화면 측정(SR-5.3)은 FE 를 잰다. 넣기로 고르면 SR-1.6 셋째 줄을 지우고, SR-2.6 에 「`googleMapsSearchUrl` 을 copy.mjs 로 옮기고 Kotlin 이 골든으로 따른다」를, SR-5.1 에 지도 href 골든을 더한다 |

U1·U3·U4·U5·U6 은 1라운드 기본값 그대로 둡니다.

참고 경로(전부 워크트리 `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` 기준):
- `docs/specs/2026-10-09-place-detail-first-screen/spec.md`
- `docs/specs/2026-10-09-place-detail-first-screen/context/engineer-review-round2.md`
- `docs/specs/2026-10-09-place-detail-first-screen/context/review-verdict-round1.md`

이 판정문은 파일로 쓰지 않았습니다. 편집 목록 E-1 은 부모가 이 내용을 `context/review-verdict-round2.md` 로 저장한다는 전제로 그 경로를 적었습니다.