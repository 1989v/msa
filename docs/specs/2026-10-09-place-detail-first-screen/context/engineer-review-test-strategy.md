# Engineer Review — test-strategy (1라운드)

대상: `docs/specs/2026-10-09-place-detail-first-screen/spec.md` (SR-5 검증 계획 중심)
근거 범위: 스펙 · `context/open-questions.yml` · `docs/standards/test-rules.md` · 기존 테스트(파서·렌더러·JSON-LD 패리티·태스클릿·FE 상세) · `build.gradle.kts` 계약 게이트 · S2-7 대조 증거.

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 요구사항마다 테스트가 있나 | 부분 — SR-2.3·SR-4 의 **배선**(태스클릿·place DTO) 테스트 없음 (T1), FE↔SSR 문구 패리티 없음 (T4) |
| 2 | 테스트 레이어 배정 | 부분 — 파서 단위 테스트만으로 SR-2.3 을 판정 (T1) |
| 3 | 목 경계 | 통과 — FE 는 `placeApi` 만 목(`AttractionPage.test.tsx:7`), 렌더러·패리티는 실제 렌더러를 쓴다 |
| 4 | 테스트 데이터 전략 | 부분 — 기존 픽스처 행과 충돌하는 기대값 미정 (T2), 새 골든 케이스 모양 미정 (T3) |
| 5 | 경계·부정 케이스 | 부분 (T5) |
| 6 | 명명 규칙 | 통과 — 기존 파일에 추가하는 계획이고 모두 BehaviorSpec / vitest 관례를 따른다 |

## 이슈

### T1. 파서 입력 확장(SR-2.3)이 실제 색인 경로에 닿는지 재는 테스트가 없다 — 체크 1·2
- 스펙 SR-5.1 은 「파서 v3(… 반복정보 요금 무료·금액)」을 파서 단위로만 잰다.
- 그런데 지금 파서 입력 `AttractionAttributeSource` 에는 `infoRaw` 자리가 없고(`AttractionAttributeParser.kt:10-16`), 호출하는 곳은 태스클릿 한 군데다(`AttractionApiReindexTasklet.kt:221-229`). 파서 테스트는 테스트가 직접 만든 `AttractionAttributeSource` 를 넣으므로(`AttractionAttributeParserTest.kt:159-173`) 태스클릿이 `infoRaw` 를 안 넘겨도 초록이다. 운영 값은 하나도 안 바뀐다.
- `source`·`copyrightDivCd` 도 같다. 계약 게이트는 매핑과 클래스의 **필드 이름**만 맞춰 본다(`build.gradle.kts:581-611`). place DTO 가 값을 안 실어 배치가 null 을 받아도 게이트는 통과한다.
- 수정안:
  1. `AttractionApiReindexTaskletTest` 에 기존 속성 케이스(`:285-310`)와 같은 모양으로 추가한다. `useFee=null` + `introRaw`/`infoRaw` 에 「입장료: 무료」 행 → bulk 문서 `attrAdmission == "FREE"`, 금액 행 → `"PAID"`. `source`·`copyrightDivCd` 를 단 dto → bulk 문서에 같은 값.
  2. `PlaceApiClientTest`(`:209-213` 모양)에 두 필드 역직렬화 케이스를 넣는다. place 쪽은 응답 DTO 직렬화 테스트에 두 필드를 넣는다.
  3. SR-5.5 회귀 주입에 「태스클릿에서 반복정보 전달 삭제 → 태스클릿 단언 빨강」을 더한다. 지금 목록의 「반복정보 요금 폴백 삭제」는 파서 안의 폴백만 잰다.
  4. `searchReadRequired`(`build.gradle.kts:538-550`)에 `source`·`copyrightDivCd` 를 넣는다. 서버 렌더가 읽는 필드다. 안 넣으면 읽기 클래스에서 빠졌을 때 `searchReadOmitted` 에 사유 한 줄만 적어도 게이트가 통과한다(`:605-609`).

### T2. 휴무 파서 v3 가 기존 픽스처의 의도적 UNKNOWN 과 부딪히는데 기대값이 정해져 있지 않다 — 체크 4·5
- 기존 픽스처는 괄호 단서가 붙은 문장을 일부러 UNKNOWN 으로 고정해 두었다.
  - `raw-fixtures.tsv:41` 「매주 월요일 (단, 월요일이 공휴일인 경우 그 다음날 휴무) / …」 → UNKNOWN
  - `raw-fixtures.tsv:79` 「Tuesdays (open if Tuesday is a national holiday and will be closed on the following weekday instead), January 1」 → UNKNOWN
  - 파서 주석 `AttractionAttributeParser.kt:54` 「다음날·전날처럼 요일을 확정할 수 없게 만드는 말 … UNKNOWN」
- S2-7 의 누락 2건은 성격이 다르다(`s2-7-fact-check.md:44`).
  - 77 운현궁 「(단, … 정상 개장)」은 요일이 그대로다.
  - 4811 서오릉 「(단, … 개방하며 그 다음 첫 번째 평일…」은 휴무일이 **옮겨 가는** 문장이다. 41행과 같은 종류다.
- SR-2.4 는 「공휴일이면 개장」만 예로 든다. 따라서 4811·41·79 행의 기대값을 스펙에서 읽어낼 수 없다.
- 지금 파서는 `,` 로 먼저 쪼갠다(`:65`). 그래서 괄호 안 「단,」 이 문장을 가르고, 괄호를 떼는 일은 쪼개기 **전에** 일어나야 한다. 이 순서를 재는 행도 필요하다.
- 수정안: SR-5.1 에 픽스처 표를 명시한다.
  - (a) 77 원문 전체 → `WEEKLY:MON`
  - (b) 4811 원문 전체 → 결정값. 휴무가 옮겨 가는 단서를 계속 UNKNOWN 으로 둘지 사람이 정한다.
  - (c) 41·79 행의 기대값을 유지할지 바꿀지
  - (d) 괄호 안에 쉼표가 없는 변형
  - (e) 영문 괄호 단서를 다루는지 여부

  `fixtures.size shouldBe 145`(`AttractionAttributeParserTest.kt:19`)를 새 행 수에 맞춘다는 것도 적는다. 그래야 회귀 주입 「괄호 단서 제거 처리 삭제 → 휴무 단언 빨강」이 어느 행에서 빨개지는지 정해진다.

### T3. 요금 입력 확장의 경계가 미정이고, 파서 픽스처 형식이 반복정보를 담지 못한다 — 체크 4·5
- 파서 픽스처 행은 `field lang expected raw` 네 칸이고, 요금 루프는 `parse(useFee = row.raw)` 한 입력만 넣는다(`AttractionAttributeParserTest.kt:116-119`). 「반복정보만 무료」 행을 같은 표에 넣을 자리가 없다.
- SR-2.2(표시)는 「`useFee` 가 비면 반복정보」로 **대체**하고, SR-2.3(판정)은 「`useFee` + 반복정보」로 **합친다**. 둘이 다르면 다음 경우의 기대값이 정해지지 않는다.
  - `useFee`=「무료」 + 반복정보 「입장료 3,000원」: 요금 칸은 「무료」인데 판정은 합친 입력에서 UNKNOWN 이 될 수 있다.
  - 반복정보 요금 행이 둘(입장료·관람료)일 때 어느 행을 쓰는지.
  - `useFee` 가 빈 문자열이거나 공백뿐일 때(`raw-fixtures.tsv:139` 같은 빈 행이 운영에 있다) 「비었다」로 보는지.
  - 행 이름 변형 「입장 료」「관람 료」(공백 무시)와 비슷한 이름 「주차요금」(제외).
- 수정안: 반복정보 케이스는 픽스처 표 대신 `given`/`then` 개별 케이스로 둔다(기존 `:124-127` 방식). 위 다섯 경우의 기대값을 SR-5.1 에 표로 적는다.

### T4. FE↔SSR 「같은 칸·같은 문구」(SR-3.1)를 재는 패리티가 없다 — 체크 1
- 요금 대체 규칙, 확인 상태 문구, `source` 폴백, 「정보 없음」 문구가 FE(`placeAttributes.ts:187` 등)와 Kotlin 렌더러에 각각 구현된다. SR-5.1 은 양쪽을 따로 단언할 뿐이다. 그러면 양쪽 테스트가 각자 자기 문자열을 기대값으로 들고 있어서, 한쪽 문구만 바뀌어도 둘 다 초록이다.
- 레포에는 이미 같은 문제를 푼 틀이 있다. `FooterLinksParityTest.kt:12-19`(프리렌더 출력에서 뽑은 골든 ↔ 서버 렌더 출력)와 `AttractionJsonLdParityTest.kt:20-28` 이다.
- 수정안: FE 쪽 방문 요약 함수의 **출력**(칸 이름·값 쌍)을 골든 JSON 으로 쓰고, Kotlin 이 렌더된 HTML 의 `<dl>` 에서 뽑아 비교하는 패리티 테스트를 SR-5.1 에 넣는다. 케이스는 useFee 있음, 반복정보만, 둘 다 없음, source 있음/없음, 국·영이다. 회귀 주입에 「한쪽 문구만 변경 → 패리티 빨강」을 더한다.

### T5. 스펙 규칙이 적힌 곳에 대응하는 경계·부정 케이스 누락 — 체크 5
- **`tel:` 정규화(SR-2.6)**: 「숫자·하이픈만 남긴다」를 그대로 따르면 「02-123-4567~8」이 「02-123-45678」(존재하지 않는 번호)이 되고, 「02-1234-5678, 02-…」은 두 번호가 붙는다. 「1330」, 「(내선 2)」, 정규화 후 빈 문자열(→ 링크 없음)도 케이스로 둔다. 기대값은 첫 번호만 쓰거나 링크를 빼는 것 중 하나로 스펙에 적는다.
- **SSR `<img>` https(SR-3.4)**: 원천은 http/https 를 섞어 준다(`placeView.ts:264-265`). http 입력을 https 로 올릴지 뺄지 정하고 케이스를 둔다. 지금 계획은 「https·크기·없음」뿐이다.
- **이웃 0건(SR-3.2)**: 렌더러는 끝난 행사를 걸러낸 **뒤** 비었는지 본다(`AttractionPageRenderer.kt:552-553`). 따라서 「목록은 있으나 모두 끝난 행사」 케이스가 0건 케이스에 함께 있어야 한다. 최대 5는 `RegionAggregator.NEAREST_LIMIT`(`RegionAggregator.kt:54,101`)가 자르니 렌더러 테스트에서 상한을 다시 잴 필요는 없다(중복 단언 금지).
- **집계 문장(SR-3.3)**: 「숫자가 없으면」이 null 인지 0 인지 정한다. 기존 픽스처에 `AttractionRegion("영등포구", 0, 0, …)`(`AttractionPageRendererTest.kt:580`)가 있으니 0 케이스를 그대로 쓴다.
- **확인 상태(SR-2.5)**: `modifiedAt` 이 없을 때(갱신일 부분 생략), `source` 에 TOURAPI·GOCAMPING 외의 값이 올 때.
- **JSON-LD license(SR-3.5)**: 골든 케이스 「Type1·Type3·없음」에 「그 밖의 값(예: Type2)」을 더한다. 「그 밖엔 license 없음」 규칙을 재는 케이스가 없다.

### T6. 골든은 정답이 아니라 「바뀌지 않음」만 잰다 — 순서·license 는 독립 단언이 필요하다 — 체크 1·4
- SSR 골든은 `UPDATE_RENDER_GOLDEN=1` 로 현재 출력을 그대로 기대값으로 쓴다(`AttractionPageRendererTest.kt:569-597`). JSON-LD 골든도 copy.mjs 출력을 그대로 쓴다(`attractionJsonLdGolden.test.ts:372-375`). 처음부터 틀리게 짜면 틀린 값이 골든이 된다. 골든은 「재생성」이 계획의 일부라서 처음 만들 때 바르다는 근거가 되지 못한다.
- 그리고 지금 SSR 골든 케이스는 행사·숙박·코스뿐이고 **관광지(12) 케이스가 없다**(`:577-587`). 「골든 HTML 재생성」으로는 이번 변경의 중심인 관광지 상세 첫 화면이 재지지 않는다.
- 수정안:
  1. 관광지 국·영 골든 케이스를 추가한다(방문 요약·이웃·사진·집계 문장이 모두 있는 문서).
  2. 순서 단언은 골든과 별개로 둔다. 기존 관용구 `order.none { it < 0 }` + `order shouldBe order.sorted()`(`:145-150`)를 따르고, 표지는 문구가 아니라 `data-place-section="…"` 속성으로 잡는다. 방문 요약과 배지가 「매주 화요일 휴무」 같은 같은 글을 둘 다 낼 수 있어서, `indexOf` 가 다른 절의 첫 등장을 집으면 순서가 틀려도 초록이다.
  3. 기존 순서 단언 `:145-150`(개요 → 방문 정보 → 배지)과 `:189-195` 를 새 순서로 고친다는 것을 명시한다. 지금 단언은 새 순서에서 빨개진다.
  4. license 는 `attractionJsonLdGolden.test.ts` 에 절대값 `it` 을 둔다(기존 `:305-311` 처럼). Type1 → 제1유형 URL, Type3 → 제3유형 URL, 그 밖 → 속성 없음. 지금 계획의 회귀 주입 「license 매핑 뒤바꿈 → 골든 패리티 빨강」은 copy.mjs **와** Kotlin 이 함께 틀린 경우를 못 잡는다.

### T7. 화면 측정(SR-5.3)의 판정 기준이 모호하다 — 체크 5
- 「y 좌표가 664 이하」가 요소의 위쪽인지 아래쪽인지 정해져 있지 않다. 위쪽만 보면 칸이 잘려 있어도 통과한다.
- 수정안:
  - `getBoundingClientRect().bottom ≤ 664` 로 정한다.
  - 측정 전에 로드된 번들에 이번에 넣은 심볼이 있는지 확인하는 줄을 넣는다. 옛 번들 측정은 버린다.
  - S2-7 재측정(SR-5.2)은 S2-7 때와 같은 집계 스크립트로 전후를 낸다. 집계 기준이 바뀌면 전후 표를 비교할 수 없다.

## 통과로 본 것
- JSON-LD 패리티는 색인 `_source` 를 실제 읽기 클래스로 역직렬화하고 **렌더된 HTML 에서** 블록을 꺼내 비교한다(`AttractionJsonLdParityTest.kt:47,58-60,84-85`). 대상의 산출물을 본다.
- 「색인 매핑에서 새 필드 삭제 → 계약 게이트 빨강」은 쓰기 클래스 대조(`build.gradle.kts:585-588`)로 실제 빨개지는 주입이다.
- `source` 폴백 회귀 주입은 기존 단언 `AttractionPageRendererTest.kt:550-556`(source 없는 문서의 고정 문구)이 이미 문다.

## 요약
차단 이슈는 없다. 핵심은 T1이다. 파서 단위 테스트는 태스클릿이 반복정보를 넘기지 않아도 초록이어서, SR-2.3 의 운영 효과(입장 UNKNOWN 9건 해소)를 재는 테스트가 계획에 없다. T2(4811 같은 「다음날 휴무」 단서의 기대값)는 스펙 작성자가 정해야 한다.

VERDICT: REVISE
