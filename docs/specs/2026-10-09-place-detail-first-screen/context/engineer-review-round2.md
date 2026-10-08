# spec-review 2라운드 — 관광지 상세 첫 화면 (`spec.md`, 심판 편집 E1~E9 반영본)

범위: 1라운드에서 판정된 34건은 다시 열지 않는다. 이 문서에는 E1~E9 편집으로 **새로 생긴 결함**만 적는다.
근거는 모두 워크트리 `wt-impl` 기준이다. 체크리스트는 hns 0.15.1 경로를 썼다(0.16.1 에는 없다).

| 차원 | 판정 | 새 이슈 |
|---|---|---|
| architecture | REVISE | 3 |
| implementation | REVISE | 3 |
| test-strategy | REVISE | 4 |
| usecase | REVISE | 3 |
| domain | SHIP (반영 대조) | 0 |
| security | SHIP (반영 대조) | 0 (implementation I2-1 과 연결) |

---

## architecture — REVISE

**A2-1 `AttractionFee.text(useFee, infoRaw)` 를 쓰려면 domain 이 JSON 을 풀어야 한다** (체크: Layer & Dependency / 패턴 일관성)
- 스펙: `spec.md:28` 「규칙 원본은 search:domain 순수 함수 `AttractionFee.text(useFee, infoRaw)`」, `:33` 「태스클릿이 `AttractionFee.text(attraction.useFee, attraction.infoRaw)` 를 계산」. 여기서 `infoRaw` 는 JSON 문자열이다.
- 코드: `search/domain/build.gradle.kts:7-8` 를 보면 Jackson 은 `testImplementation` 에만 있다. 기존 선례 `CourseStops.kt:18` 은 「입력은 infoRaw 를 JSON 으로 푼 값(List · Map · String · null)」이고, `CourseStops.kt:28` 은 `parse(info: Any?, …)` 를 받는다. JSON 은 batch 가 `AttractionApiReindexTasklet.kt:441` `introReader.readValue(raw, Any::class.java)` 로 푼다.
- 수정안: 시그니처를 `AttractionFee.text(useFee: String?, info: Any?)` 로 바꾼다. 태스클릿이 `infoRaw` 를 한 번 풀어 코스 파서와 요금 함수에 같이 넘긴다. 단일 객체·배열을 둘 다 받는 것도 `CourseStopsParser.parse` 와 맞춘다(`CourseStops.kt:29-33`).

**A2-2 SSR 행동 줄(`data-place-section="actions"`)의 길찾기·전화 규칙이 Kotlin 에 없어 사본이 새로 생긴다** (체크: 패턴 일관성 / 규칙 원본 한 곳)
- 스펙: `spec.md:47` 「길찾기는 지금 「구글 지도에서 보기」 링크를 요약 아래로 올린다」. `:23` 은 SSR 에도 `actions` 절을 둔다.
- 코드: 길찾기 링크는 FE 에만 있다. `portal-fe/src/pages/place/googleMaps.ts:44-59` 의 3단 폴백(place_id → 이름+주소 → 좌표)과 `encodeURIComponent` 가 그것이다. `AttractionPageRenderer.kt` 에서 `google`·`구글` 을 grep 하면 0건이다. `tel:` 추출 정규식(`spec.md:48`)도 FE·SSR 두 벌이 된다.
- 수정안: SSR 에 길찾기 URL·`tel:` 추출을 옮긴다고 명시한다. FE↔SSR 패리티 골든(`spec.md:119`)의 대상에 행동 줄(전화 href·지도 href)을 더한다. URL 인코딩은 `encodeURIComponent` 와 같은 규칙이어야 한다(`URLEncoder` 는 공백을 `+` 로 바꾼다). 「SSR 행동 줄은 전화만」으로 줄이는 것도 방법이다. 어느 쪽이든 스펙에 적는다.

**A2-3 (경미) `AttractionAttributeSource.useFee` 가 쓰이지 않는 필드로 남는다**
- 스펙: `spec.md:33` 은 「`AttractionAttributeSource` 에 `feeText` 를 더하고, `admission()` 은 `useFee` 대신 `feeText`」라고 한다.
- 코드: `useFee` 를 읽는 곳은 `AttractionAttributeParser.kt:13` 선언과 `:34` 의 `admission(source.useFee)` 하나뿐이다. 바꾸고 나면 이 필드는 아무도 읽지 않는다.
- 수정안: 「더한다」를 「`useFee` 를 `feeText` 로 바꾼다」로 고친다. 테스트 헬퍼(`AttractionAttributeParserTest.kt:159-173`)도 함께 바꾼다.

## implementation — REVISE

**I2-1 `feeText` 를 두 번 정규화하면 원문이 지워지고, XSS 단언과도 어긋난다** (체크: 기존 코드와 충돌)
- 스펙 안의 모순:
  - `spec.md:30` 은 `sourceText` 를 거친 값을 색인 `feeText` 에 싣는다.
  - `:50` 은 출력 때 다시 「요금 … 모두 `sourceText` → `escapeHtml`」을 거치게 한다.
  - `:112` 는 XSS 기대값을 「SSR 에 `&lt;img` 만」으로 둔다.
- 코드:
  - `AttractionSeoText.kt:12-13` 이 정규화는 한 번만이라고 못 박는다: 「값 하나에 정규화는 한 번만 — … 두 번 걸면 `&lt;PARASITE&gt;` 가 `<PARASITE>` 를 거쳐 지워진다」.
  - 두 번째 `sourceText` 의 `TAG` 제거(`AttractionSeoText.kt:23,51`)가 색인에 실린 `<img …>` 를 통째로 지운다. 그러면 SSR 에 `&lt;img` 가 남지 않아 `:112` 단언이 빨개진다.
  - 정상 원문 「&lt;어린이&gt; 무료」 같은 것도 사라진다.
  - FE 도 모든 행에 `sourceText` 를 다시 건다(`AttractionPage.tsx:458`). FE 와 SSR 이 같이 틀리므로 패리티 골든으로는 잡히지 않는다.
- 수정안: SR-2.2 에 「`feeText` 는 정규화된 평문이다. SSR 은 `escapeHtml` 만 걸고, FE 는 그대로 텍스트로 넣는다」를 적는다. SR-2.7 목록의 「요금」은 「`feeText` 제외, 폴백 `useFee` 는 `sourceText` → `escapeHtml`」로 고친다. 이렇게 하면 `:112` 기대값이 그대로 성립한다.

**I2-2 [U2] FE 「이용 안내」를 통째로 대체하면 SSR 에 없던 원천 행까지 사라진다** (체크: 기존 코드와 충돌)
- 스펙: `spec.md:21` 은 「방문 요약은 SSR `visitorInfo` 와 `badges` 두 절을 대체한다. FE 의 같은 두 절도 같다」고 한다.
- 코드:
  - SSR `visitorInfo` 는 4행이다(`AttractionPageRenderer.kt:449-453`).
  - FE 「이용 안내」는 그보다 넓다. `parkingFee`·`infoCenter`(`AttractionPage.tsx:448-449`), `introRows`(`:455`), 반복정보 전체 `repeatInfoRows`(`:456`)가 더 있다. 주석도 이 절의 역할을 이렇게 적고 있다: 「원천이 준 것을 다 보여준다 — 상세는 이 관광지에 대해 아는 전부를 내는 자리다」(`:441-442`).
  - 배지에는 신용카드·유모차 대여도 있다(`AttractionPageRenderer.kt:491-500`). 그런데 SR-2.1 칸 목록(`spec.md:27`)에는 이 둘이 없어 흡수할 칸이 없다.
- 수정안: 대체 범위를 「방문 요약과 겹치는 행(이용시간·쉬는날·이용요금·주차)과 배지」로 한정한다.
  - 나머지 행(주차요금·문의·intro·반복정보)은 「이용 안내」에 남긴다. 요금 칸으로 올라간 반복정보 요금 행을 거기서 뺄지 남길지도 정한다.
  - 신용카드·유모차는 칸을 더하거나, 「많이 클릭한 곳」처럼 요약 아래 한 줄로 둔다.
  - SSR `visitorInfo` 4행은 전부 겹치므로 SSR 쪽 결론은 바뀌지 않는다.

**I2-3 (경미) 선행 조건과 배포 순서를 실제로 막는 지점이 없다** (체크: 마이그레이션·롤백)
- 스펙: `spec.md:73` 은 「v2 확인 **뒤에** v3 search:batch 를 배포」, `:74` 는 「search:batch → 재색인 → search:app·portal-fe」 순서다.
- 사실: main 이 곧 배포 브랜치이고, 커밋 하나에서 이미지가 같이 만들어진다(메모리 `project_flyway_immutable.md` · `project_ci_test_gate_blocks_images.md`). 그래서 이 순서는 「main 푸시 시점」으로만 지킬 수 있다.
- 수정안: SR-4.2 를 「v2 확인 전에는 이 변경을 main 에 푸시하지 않는다」로 바꾼다. SR-4.3 에는 「한 커밋에 같이 배포돼도 폴백(`:75-76`)이 있어 순서가 어긋나도 안전하다. 순서는 재색인 시각에만 걸린다」를 한 줄 더한다.

## test-strategy — REVISE

**T2-1 XSS 기대값이 SR-2.2·2.7 과 어긋난다** — I2-1 과 같은 뿌리다(`spec.md:112` ↔ `:30`·`:50`, `AttractionSeoText.kt:12-13`). I2-1 을 정한 뒤 기대값을 다시 확인한다. 회귀 주입 「요금 행 `escapeHtml` 제거」(`:135`)가 빨간불을 내는지도 그 결정에 달려 있다.

**T2-2 패리티 골든이 `<dl>` 방문 요약만 잰다** (체크: 기준마다 테스트)
- 스펙: `spec.md:119` 의 골든 대상은 「칸 이름·값」뿐이다. `tel:` 기대값(`:104-111`)은 FE 와 Kotlin 중 어느 쪽 테스트인지 정해져 있지 않다.
- 근거: A2-2 대로 전화 추출·지도 URL 규칙이 두 벌이 된다. 그런데 이 둘을 맞추는 장치가 없다.
- 수정안: 패리티 골든에 행동 줄(전화 href·표시 원문·지도 href)을 넣는다. `tel:` 7사례는 골든 케이스로 양쪽이 같은 표를 쓰게 한다.

**T2-3 기존 요금 픽스처가 어느 경로로 들어가는지와 반복정보 형식 경계가 빠졌다** (체크: 테스트 데이터·경계)
- 스펙: `spec.md:259` 는 「반복정보만 「무료」 → FREE, 금액 → PAID」만 적는다.
- 코드:
  - 기존 `useFee` 픽스처 행은 `parse(useFee = row.raw)` 로 판정한다(`AttractionAttributeParserTest.kt:116-118`). `admission()` 이 `feeText` 를 읽게 되면 헬퍼를 어떻게 넘길지가 없다.
    - raw 를 그대로 `feeText` 에 넣으면 운영 경로(`sourceText` 를 거친 값)와 다른 입력을 재게 된다.
  - 반복정보는 배열이 아닐 수 있다. 「원천 자체는 1건이면 객체 하나」(`CourseStops.kt:18-19`)다. FE 는 배열만 받는다(`placeView.ts:314`).
  - `serialnum` 이 수가 아니면 FE 는 원래 순서로 둔다(`placeView.ts:324`).
- 수정안:
  - 헬퍼는 `AttractionFee.text(row.raw, null)` 을 거쳐 `feeText` 를 만든다고 적는다.
  - `AttractionFee.text` 케이스를 셋 더한다: 단일 객체 `infoRaw`, `serialnum` 이 수가 아님, JSON 이 깨짐 → null.

**T2-4 (경미) 고칠 기존 단언 목록이 모자란다**
- `spec.md:113` 은 `:145-150`·`:189-195` 만 든다.
- `AttractionPageRendererTest.kt:152-154` 도 `visitorInfo` 의 `<dt>이용시간</dt><dd>…</dd>` 를 단언한다. `:192` 는 [U2] 로 사라지는 배지 문구 「매주 화요일 휴무」를 순서 표지로 쓴다. 이 둘도 목록에 넣는다.

## usecase — REVISE

**U2-1 칸별 값 규칙이 요금·확인 상태에만 있다** (체크: 대체 흐름·경계 / AC 추적)
- 스펙: `spec.md:27` 은 칸 7개를 나열한다. 그런데 값 규칙은 요금(`:28-31`)과 확인 상태(`:40-45`)에만 있다. `:21` 「배지의 해석값(연중무휴·주차 가능 등)은 해당 칸 값으로 흡수」만으로는 다음이 정해지지 않는다.
  - 원문(`restDate`·`parking`·`petAcmpyType`)과 해석값(`attributes.*`)을 둘 다 쓰는지, 어느 쪽을 먼저 쓰는지.
  - 원문은 있는데 해석이 UNKNOWN 이면 무엇이 보이는지.
- 근거:
  - 반려동물 원문은 「전구역동반가능」 같은 코드성 문자열이다(`AttractionAttributeParser.kt:131`).
  - 무장애 칸은 아래 「접근성 정보」 절(`AttractionPageRenderer.kt:380`)과 겹친다.
  - 패리티 골든은 FE 와 SSR 이 같은지만 재고, 그 값이 맞는지는 재지 않는다.
- 수정안: SR-2.1 아래에 칸 → (원문 필드, 해석값, 표시 형식, 「정보 없음」 조건) 표를 둔다.

**U2-2 「요금 정보 없음 11 → 0」이 근거 없이 단정돼 있다** (체크: 사후 조건)
- 스펙: `spec.md:123` 은 「11 → 0」을 무조건으로 적는다. 반면 입장 판정 8건은 「원문으로 기대값을 먼저 적는다」(`:124`)로 다룬다.
- 근거:
  - S2-7 은 행 이름을 「입장료·관람료가 있음」으로만 적었다(`s2-7-fact-check.md:45`).
  - 레포에서 `infoname` 을 grep 하면 이 스펙과 리뷰 문서밖에 나오지 않는다. SR-2.2 의 이름 3종이 그 11건을 다 덮는지 확인된 적이 없다.
- 수정안: 11개 id 의 실제 `infoname` 을 재색인 전에 표로 먼저 적는다. 덮지 못하는 id 는 「남는 건」으로 옮긴다.

**U2-3 (경미) 전화가 두 번 나온다**
- 스펙: `spec.md:48` 이 행동 줄에 전화를 둔다.
- 코드: SSR 은 제목 아래에 이미 `<p>${tel}</p>` 를 낸다(`AttractionPageRenderer.kt:375`). FE 「이용 안내」에도 `infoCenter` 행이 있다(`AttractionPage.tsx:449`).
- 수정안: 행동 줄로 옮길 때 기존 두 자리를 빼는지 정한다.

## domain — SHIP (1라운드 반영 대조)
- D1 요금 소유 → `spec.md:28-33`(`AttractionFee` 한 곳, KDoc 개정)에 반영.
- D2 방문 요약과 기존 절의 관계, glossary → `:21`(U2 대체), `:140` 에 반영.
- D3 이웃 절 이름 유지, FE 합침 → `:24`, `:54` 에 반영.
- D4 place 불변, 집계 문장 재사용 → `:69`, `:55` 에 반영.
- D5 바닥 출처 줄 분리 → `:45` 에 반영.
- U2 를 기본값(대체)으로 골랐으므로 domain 재리뷰 조건(`review-verdict-round1.md:314`)에 해당하지 않는다. I2-2 는 대체의 **범위** 문제라 implementation 에서 다뤘다.

## security — SHIP (1라운드 반영 대조)
- S-1 출력 순서 → `spec.md:50`, XSS 단언 `:112`, 회귀 주입 `:135` 에 반영.
- S-2 `tel:` 이어 붙이기 → `:48` 의 단일 번호 추출과 `:104-111` 사례에 반영.
- 덧붙임: `feeText` 이중 정규화(I2-1) 때문에 XSS 단언 기대값이 성립하지 않는다. 결함은 implementation·test-strategy 에서 판정했고, 고친 뒤에도 출력 경로에는 `escapeHtml` 이 그대로 남으므로 새 노출은 없다.

VERDICT: REVISE
