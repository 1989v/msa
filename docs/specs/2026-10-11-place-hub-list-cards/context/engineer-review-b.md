# Engineer Review (b) — test-strategy · domain · usecase

대상: `docs/specs/2026-10-11-place-hub-list-cards/` (spec.md · tasks.md · planning/requirements.md · context/open-questions.yml)
2026-10-11. 경로는 레포 루트 기준이다. 리뷰 기준은 hns 0.15.1 체크리스트 셋이다.

| 관점 | 판정 | 이슈 수 |
|---|---|---|
| test-strategy | REVISE | 9 |
| domain | BLOCK | 4 (차단 2) |
| usecase | REVISE | 8 |

---

## 1. test-strategy — REVISE

### TS-1 행동 바 테스트 파일이 찜·계측을 대역으로 바꿔 둬서 두 단언을 만들 수 없다 (체크 3 대역 경계)
- 근거: `portal-fe/src/pages/place/__tests__/AttractionPage.test.tsx:16-20` 에서 `FavoriteButton` 을 상태 없는 `<button data-testid="fav">` 로 대역 처리했다. 같은 파일 `:32-35` 에서는 `track: vi.fn()` 으로 막아 뒀다.
- 이 상태로는 tasks 5.1 의 두 단언이 성립하지 않는다.
  - 「바 별을 누르면 제목 옆 별 `aria-pressed` 도 바뀐다」: 대역에 `aria-pressed` 가 없다.
  - 「(실제 트래커 대기열) 같은 view 의 행동 줄 길찾기 뒤 바 길찾기는 한 건」: `track` 이 vi.fn 이라 중복 거르기(`analytics/tracker.ts:26-34`)를 타지 않는다.
- 수정안: 새 파일 `AttractionPage.actionBar.test.tsx` 를 만든다. `PlacePage.tracking.test.tsx:16-23` 처럼 tracker·FavoriteButton 은 진짜를 쓰고 `wishlistApi` 만 대역으로 둔다. 판정 근거는 `pendingForTest()` 대기열이다. 계측·찜 동기 단언은 이 파일로 옮기고, tasks 5.1·5.4 의 실행 목록에 넣는다.

### TS-2 matchMedia 대역이 `max-width` 질의에 늘 false 를 돌려준다 (체크 3)
- 근거: `AttractionPage.test.tsx:51-56` 의 대역은 `matches: query.includes('min-width') ? wide : false` 다. SR-4.1 은 `useMediaQuery` 로 「≤640」을 판정하라고 한다. 질의를 `(max-width: 640px)` 로 쓰면 「좁은 화면」 기본값에서도 바가 영영 안 그려진다. 그러면 「>640 미표시」 단언이 아무 회귀에서나 초록이 된다.
- 수정안: 질의 문자열을 스펙에 고정하고(예: `(max-width: 640px)` — CSS `PlacePage.css:872` 와 같은 글자), 대역이 그 질의에 응답하도록 tasks 5.1 에 적는다. 또는 `not (min-width: 641px)` 로 써서 기존 대역 규칙을 따르게 한다.

### TS-3 R2(UTC 요일) 주입이 KST 개발 기기에서는 빨강을 내지 않는다 (체크 5 · 회귀 주입)
- 근거: spec SR-8.9 R2 는 「`new Date().getDay()`(UTC)」라고 적었다. 그런데 `getDay()` 는 UTC 가 아니라 **로컬 시간대** 요일이다. KST 기기(이 레포의 개발 환경)에서는 KST 요일과 같아서 초록이 난다. 시스템 시각을 고정하지 않으면 결과가 실행한 요일에 따라서도 달라진다. vitest 설정에 TZ 고정이 없다(`portal-fe` 의 vite/vitest 설정·package.json 에서 `TZ` 검색 0건).
- `cardFacts` 는 `today: 'YYYY-MM-DD'` 를 받는다(SR-2.1). 그래서 실제로 일어날 법한 회귀는 `new Date(today).getDay()` 다. UTC 자정으로 파싱한 뒤 로컬 요일을 읽어서, 음수 오프셋 브라우저(영문 사용자)에서 하루 앞 요일이 된다.
- 수정안
  - ① 테스트에서 `process.env.TZ='America/Los_Angeles'`(또는 vitest `env.TZ`)와 `vi.setSystemTime('2026-10-12T15:30:00Z')`(UTC 월 / KST 화)를 고정한다. `closedWeekdays:['TUE']` 에 `today=todayKst()` 를 넘겨 `closedToday` 를 기대한다.
  - ② R2 를 `new Date(today).getDay()` 와 `new Date().getDay()` 두 줄로 나눠, 둘 다 빨강인지 적는다.
  - ③ 호출부 회귀(허브가 `new Date().toISOString().slice(0,10)` 를 넘김)는 `cardFacts.test` 가 못 잡는다. `PlacePage.test` 에 같은 시각을 고정한 카드 배지 단언을 하나 더한다.

### TS-4 R6 주입은 컴파일되지 않는 회귀다 (체크 5)
- 근거: `SectionId` 는 닫힌 유니온이다(`portal-fe/src/analytics/events.ts:27-59`). `sectionId: 'ACTION_BAR'` 는 `tsc -b` 에서 막힌다. vitest 는 타입을 지우고 돌아서 빨강이 나긴 하지만, 그것은 「컴파일되는 회귀만」(SR-8.9 머리말) 규칙에 어긋난다.
- 수정안: R6 를 컴파일되는 회귀로 바꾼다. 예를 들어 「바 길찾기 payload 에서 `placement` 를 뺌」(행동 줄 클릭과 구별이 사라짐)이나 「바 길찾기를 `sectionId: 'MAP_LINK'` 로」(유니온 안의 값).

### TS-5 analytics 테스트는 :86 한 줄이 아니라 다섯 줄을 고쳐야 한다 (체크 1)
- 근거: `analytics/app/src/test/kotlin/com/kgd/analytics/infrastructure/popularity/ClickHouseAttractionPopularityAdapterTest.kt:60,72,77,79` 가 SQL 문자열 `NOT IN ('MAP_LINK', 'FAVORITE', 'DIRECTIONS', 'SHARE')` 를 리터럴로 단언한다. 목록은 `joinToString` 으로 보간된다(`ClickHouseAttractionPopularityAdapter.kt:43-44`). 그래서 상수에 둘을 더하면 이 네 단언도 깨진다. spec SR-8.1·tasks 3.1 은 `:86` 만 적었다.
- 수정안: tasks 3.1 에 「:60·72·77·79 의 SQL 리터럴도 여섯으로(삽입 순서 `…, 'SHARE', 'PHONE', 'SECTION_JUMP'`)」를 더한다. 이 덕분에 R7 은 상수 단언과 SQL 단언 양쪽에서 빨강이 난다. 기대 단언 이름 둘을 regression-injection.md 에 함께 적는다.

### TS-6 SR-8.4 「Tab 으로 바 칸을 돌 때 포커스 요소 bottom ≤ 바 top」은 성립할 수 없는 조건이다 (체크 5)
- 근거: spec SR-8.4 마지막 문장. 바 칸은 바 안에 있어서 늘 bottom > 바 top 이다. WCAG 2.4.11 대상은 바에 **가려지는 본문** 포커스다(SR-4.6).
- 수정안: 「바가 보이는 상태에서 Tab 으로 본문 링크·버튼을 끝까지 돌 때, 포커스 요소 bottom ≤ 바 top(바 칸 자신은 제외)」로 고친다. R9(`scroll-padding-bottom` 제거)가 이 측정에서 빨강이 나는지 함께 적는다.

### TS-7 기준선과 배포 후 측정이 같은 장면이라는 보장이 없다 (체크 4 테스트 데이터)
- 근거: TG1.1 과 SR-8.2 는 둘 다 「운영 허브 필터 없음 첫 10장」이다. 허브 결과는 매일 재색인과 자동 시도 선택을 따라 바뀐다. 기준선과 배포 후의 10장이 다른 관광지면 높이 중앙값 비교가 장면 차이를 잰다.
- 수정안: TG1 에서 첫 10장의 id 를 기록하고, 배포 후에는 같은 id 를 비교한다(빠진 id 는 표에 적는다). 표본 질의는 고정 질의 둘(예: 서울 무질의, 「궁」)로 정한다.

### TS-8 운영 제외 목록 확인이 「이미지 태그」라 대상이 아니라 배포 행위를 잰다 (체크 1)
- 근거: SR-8.6 「`POST_SELECTION_SECTIONS` 가 여섯인지 이미지 태그로 확인」. 태그는 내가 무엇을 배포했는지만 말하고, 집계가 실제로 빼는지는 말하지 않는다.
- 수정안: 다음 03:30 KST 집계 뒤 시험 viewId 의 관광지에 대해 두 값을 비교한다. 하나는 `attraction_popularity_daily.clicks`, 다른 하나는 같은 날 원장에서 `section_id NOT IN (여섯)` 으로 다시 센 값이다. 둘이 같고 `PHONE`·`SECTION_JUMP` 행이 원장에 있으면 통과다. 집계 전이면 「대기」로 적는다.

### TS-9 빠진 단언·회귀 주입 (체크 5)
- `PHONE` 을 제외 목록에서 빼는 회귀가 없다(R7 은 `SECTION_JUMP` 만). R7b 로 추가한다.
- 거리: `distanceLabel(meters)` 는 `${meters}m` 를 그대로 찍는다(`portal-fe/src/pages/place/placeAttributes.ts:483-485`). `distanceKm`(소수) × 1000 을 반올림하지 않으면 「345.6m」·「345.59999999m」가 나온다. `cardFacts.test` 에 `0.3456 → '346m'`, `0.9996 → '1.0km'` 를 넣는다(SR-2.4 에 반올림 한 줄 추가).
- PlacePage 의 다른 테스트 파일(`PlacePage.layout`·`interpret`·`relax`·`langSwitch`·`loginReturn.test.tsx`)이 카드 마크업에 기댈 수 있다. tasks 4.3 실행 목록은 넷뿐이다. 주소 줄 제거 뒤 `src/pages/place/__tests__/PlacePage*.test.tsx` 전부를 돌린다(범위 지정이라 usage 게이트에 걸리지 않는다).

---

## 2. domain — BLOCK

### D-1 [차단] 「배지 줄」이 사전과 다른 뜻으로 쓰였다
- 스펙 결정: SR-3.1 「배지 줄 `<ul class="place-card-badges">`」, SR-3.3 「배지 줄은 항상 한 줄이다」, tasks 5.3 「카드 배지 줄 견본」.
- 사전 정의: `search/glossary.md:94` **배지 줄** = 「방문 요약에 칸이 없는 배지 — 신용카드·유모차 대여·많이 클릭한 곳 — 를 「 · 」로 이은 한 줄 … `<p data-place-section="visit-badges">`」. 상세 화면의 것이고 구성도 다르다.
- 체크리스트 규칙상(사전과 다른 뜻) BLOCK 이다. 고치는 일 자체는 이름만 바꾸면 된다.
- 수정안: 스펙·tasks·k-heritage 견본·DESIGN.md 표의 이름을 **「카드 상태 배지」**(CSS `.place-card-badges` 는 그대로 둬도 된다)로 바꾼다. `search/glossary.md` 에 항목을 하나 더한다: 정의, 「상세 배지 줄과 다르다」, 「부정값·UNKNOWN 은 내지 않는다」. `/hns:glossary --conflict 배지 줄`.

### D-2 [차단] 「무장애 편의」 배지의 조건이 무장애 필터·속성 랜딩의 정의와 다르다
- 스펙 결정: SR-2.3 표 5행 「`barrierFree` 코드가 하나 이상 → 무장애 편의 / Accessibility info」.
- 코드 근거
  - `search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionAccessibility.kt:59-63`: 목록 필터로 여는 코드는 라벨 정밀도 95% 이상인 `WHEELCHAIR`·`ELEVATOR`·`RESTROOM` 셋뿐이고 「여기 없는 코드는 … 버린다」.
  - 같은 파일 `:18-46`: `flags` 에는 `PROMOTION`(홍보물)·`STROLLER`·`LACTATION_ROOM`·`INFANT_ETC`·`PUBLIC_TRANSPORT` 같은 코드도 들어간다. 실제 표본 `search/app/src/test/resources/attraction/reindex-capture.json:255` 에도 있다.
  - 속성 랜딩 `barrier-free` 도 같은 칩 정의를 쓴다(`search/glossary.md:97`, `portal-fe/src/pages/place/placeAttributes.ts:41-45` `BARRIER_FREE_CHIPS`).
- 결과: 수유실만 있는 곳에도 카드가 「무장애 편의」를 단다. 무장애 칩으로 거르면 그곳은 빠진다. 같은 화면에서 배지와 필터가 서로 다른 말을 한다. 정밀도 미검증 코드를 근거로 하므로 스펙 자신의 「확인된 값만」(SR-2.3) 원칙에도 어긋난다. 휠체어 동반자(User Story 2)에게는 거짓 신호가 된다.
- 국문과 영문의 뜻도 갈린다: ko 「무장애 편의」(시설이 있다)와 en 「Accessibility info」(정보가 있다)는 다른 주장이다.
- 수정안(사람 판단 필요): 조건을 `FILTER_CODES` 셋 중 하나 이상으로 좁힌다. FE 는 `BARRIER_FREE_CHIPS` 의 코드 목록을 import 하고 사본을 만들지 않는다. 문구는 ko 「휠체어·승강기 등」 대신 판정과 같은 범위로 두고, en 도 같은 주장(「Wheelchair access」 류)으로 맞춘다.

### D-3 「placement」가 세 번째 뜻을 얻는다 (REVISE)
- 근거
  - `docs/context-map.md:65`: **Placement** = common `Placement`(추천·검색 노출 위치)와 ads **지면**(`AdPlacement`)은 다른 개념이다.
  - 같은 상세 화면이 이미 광고 지면 `placement="attraction-end"` 를 쓴다(`portal-fe/src/pages/place/AttractionPage.tsx:707`).
  - 스펙은 원장 payload 에 `placement: 'action_bar'`(SR-6.2)를 새로 만든다.
- 같은 원장의 카드·지도 클릭은 「클릭이 화면 어디서 왔나」를 이미 `payload.source` 로 적는다(`PlacePage.tsx:1136,1307,2179` — `'map'`·`'card'`).
- 수정안: `payload.source: 'action_bar'` 로 기존 어휘를 다시 쓴다. 또는 새 이름을 쓰되 analytics 사전에 항목을 더한다. SR-6.2·6.3, tasks 5.1, R6 문구를 같이 바꾼다.

### D-4 인기 집계 제외가 블랙리스트라 상세에 버튼이 늘 때마다 같은 누수가 되풀이된다 (REVISE, 후속 가능)
- 근거: ADR-0095 `docs/adr/ADR-0095-impression-click-pipeline.md:130-132` 는 2026-10-08 에 제외 목록을 만들었고 10-09 에 길찾기·공유를 추가했다. 이번 스펙이 셋째로 전화·절 이동을 추가한다. 집계는 화면 종류로 거르지 않는다(spec SR-6.4).
- 「잡히게 만드는 것보다 쓸 수 없게」라는 원칙에 비추면, 「목록 선택」 섹션의 **허용 목록**(`ATTRACTION_LIST`·`MAP_OVERLAY`·`NEARBY_*` …)이 이 불변식을 구조로 지킨다. 지금 방식은 새 섹션을 빠뜨리면 조용히 부푼다.
- 수정안: 이번 범위를 바꾸지 않더라도 open-questions 에 Q9(허용 목록 전환)를 남기고 ADR-0095 한 줄 갱신 때 함께 적는다.

체크리스트 나머지: BC 경계(search 응답 필드 · analytics 상수 · FE)는 API 경계를 지킨다. 응답에 평평한 `sigunguName` 을 더하는 것은 search BC 안의 일이다(SR-1). 「행동 줄」·「방문 요약」·「정보 없음」은 사전(`search/glossary.md:92,95`, `placeAttributes.ts:364-365`)과 같은 뜻으로 쓰였다.

---

## 3. usecase — REVISE

### U-1 「눈에 띄게 바뀌었다」를 판정하는 완료 조건이 없다 — 사용자 지적에 대한 답이 측정되지 않는다
- 근거: 스펙의 출발점은 「목록이 아무것도 안 바뀐 것 같다」다(spec.md:4). 그런데 완료 조건(SR-8.2~8.8)은 높이·대비·CLS·겹침뿐이다. 바뀐 정도를 재는 항목은 없다.
- 배지는 확인된 긍정값에만 붙는다. 영문은 반려동물 채움이 0 이고 무장애 원천이 국문뿐이다(`placeAttributes.ts:47-51`). 그래서 en 허브와 속성이 빈 지역에서는 카드 변화가 「주소 → 시도 시군구」와 「개요 2줄 → 1줄」뿐일 수 있다. 사진 88px·제목·별은 그대로다(SR-3.1).
- 수정안
  - ① TG1 과 6.4 에 같은 표본으로 「첫 10장 중 배지 ≥1 카드 수 · 지역 라벨 보이는 카드 수 · 찜 표시 카드 수」를 ko·en 별로 잰다. 기준선은 정의상 0 이다.
  - ② TG1.3 채움률로 기대치를 미리 계산하고, en 배지 카드가 예컨대 3/10 미만이면 사용자 확인 질문(Q9 후보: en 은 NO_WEEKLY 「매주 쉬는 요일 없음」처럼 확인된 사실 배지를 열지)으로 올린다.
  - ③ 비포/애프터 캡처: 지금은 배포 후 캡처만 있다(SR-8.8). TG1 에 **같은 8장**(390·1440 × ko·en × light·dark, 같은 질의·같은 id)을 기준선으로 남기고, 6.4 에서 나란히 비교한 표를 만든다. 사용자에게 보여 줄 증거가 이것이다.

### U-2 사용자 스토리 2(반려·휠체어)와 배지 순서가 충돌한다
- 근거: User Story 2 는 「상세를 열기 전에 확인된 조건」(spec.md:13)을 원한다. 그런데 SR-2.3 은 순서를 휴무 → 무료 → 주차 → 반려 → 무장애로 두고 3개에서 자른다. 주차 YES 가 흔하면 반려·무장애가 가장 먼저 잘린다.
- 수정안: 그 축의 칩이 켜져 있으면 해당 배지를 맨 앞에 올린다. 아니면 변별력이 낮은 주차를 반려·무장애 뒤로 내린다. 어느 쪽이든 `cardFacts` 입력에 고른 칩을 넣을지를 SR-2.1 에 적는다. TG1.3 에 축별 채움률(주차 YES 비율)을 더해 근거로 쓴다.

### U-3 「오늘 정기휴무」 문구가 명절·대체 개관을 단정한다 (정보 없음 ≠ 불가와 같은 경계)
- 근거: SR-2.3 은 「영업 중」을 금지한 이유로 「명절 휴무를 모른다」를 들었다(spec.md:41). 하지만 반대 방향도 같다. 「월요일이 공휴일이면 개관, 다음 날 휴관」 같은 규칙은 원천 요일 코드에 없다. 그런 날 「오늘 정기휴무 / Closed today (weekly)」는 틀린 단정이 된다. 칩은 한계를 문구에 적어 둔다(`placeAttributes.ts:52,55`).
- 수정안: 규칙을 말하는 문구로 바꾼다 — ko 「오늘은 정기휴무일」, en 「Regular closing day today」. 접근성 이름에 「매주 {요일} 휴무 규칙 기준」을 붙이고, 이 판정 근거를 SR-2.3 에 한 줄 적는다.
- 확인한 것: 시간대 판정은 일관된다. 서버 `openToday` 필터도 KST(`SearchAttractionService.kt:213` `ClosedToday.todayKst(clock)`)라, 「오늘 정기휴무일 아님」 칩을 켠 목록에 이 배지가 함께 뜨는 모순은 없다. 이 교차 불변식을 `PlacePage.test` 단언 하나로 고정하기를 권한다.

### U-4 지역 라벨이 meta 줄에서 통째로 사라질 수 있다
- 근거: SR-3.2 는 meta 줄을 한 줄로 두고 「지역 라벨 칸만 줄어든다」고 한다. 390 폭에서 본문 폭은 대략 236px 이다(카드 패딩 0.7rem·사진 5.5rem·gap 0.75rem — `PlacePage.css:434-472`). 글꼴은 mono 0.72rem(`:500-508`)이다. 분류 + 거리 + 「찜 N」이 이 폭을 다 쓰면 주소를 대신하려던 지역 라벨이 0px 이 된다. 시도는 약칭 없이 「서울특별시」 원문이다(SR-2.2).
- 수정안
  - ① SR-8.2 에 「390 ko·en 첫 10장에서 지역 라벨 보이는 폭 ≥ 4글자(또는 `clientWidth` ≥ 48px)」를 더한다.
  - ② 더 단순한 안도 있다. 지역 라벨을 빠진 주소 줄 자리에 한 줄로 두면 높이 계산이 같고(−주소 +지역) meta 줄은 지금 그대로다.

### U-5 절 이동 원장은 view 당 첫 이동만 남아서 Q5 결정의 근거가 되지 못한다
- 근거: 중복 키는 `(viewId, entityType, entityId, sectionId, action)` 이다(`portal-fe/src/analytics/tracker.ts:21-28`). `SECTION_JUMP` 의 `target` 은 payload 라서 같은 view 의 두 번째 이동은 버려진다. Q5 는 「SECTION_JUMP 원장을 보고 쓰임이 확인되면 스크롤 스파이」(open-questions.yml Q5)를 근거로 삼는다. SR-6.2 의 「view 당 첫 위치」 규칙도 길찾기·공유에만 적혀 있다.
- 수정안: SR-6.3 에 「`SECTION_JUMP`·`PHONE` 도 view 당 첫 건, target 분포는 첫 이동 분포」를 적는다. Q5 판단 지표를 「이동을 쓴 view 비율」로 바꾼다. tasks 5.1 의 「이동 링크 → SECTION_JUMP + target」 단언에 두 번째 이동이 버려지는 것을 함께 고정한다.

### U-6 `sigunguName` 이 지역 집계 유무에 묶여 색인 채움률과 다르게 나온다
- 근거: SR-1.2 는 `region?.sigunguName` 을 쓴다. 그런데 `region()` 은 `regionTypeCount` 가 있을 때만 만들어진다(`search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocument.kt:192-200`). 색인 평필드 `sigunguName`(`:92`)이 있어도 집계가 없으면 null 이다. TG1.3 은 `exists: sigunguName` 만 재고, SR-8.7 은 응답 채움률이 그것과 「같은지」를 본다. 그러면 차이가 실패로 오독된다.
- 수정안: TG1.3 에 `exists: regionTypeCount AND exists: sigunguName` 을 더해 기대치로 쓴다. 차이가 크면 평필드를 도메인으로 올리는 안을 후속으로 남긴다(지금 범위를 넓히라는 뜻은 아니다).

### U-7 예외·경계 흐름 몇 개가 비어 있다 (체크 2·5)
- 자정 경계: 허브를 연 채 KST 자정을 넘기면 배지가 어제 기준으로 남는다. SR-2.1 에 「`today` 는 렌더마다 `todayKst()`(메모 금지)」 또는 「다음 질의 때 갱신」 중 하나를 적는다.
- 공유 칸 글자: `navigator.share` 가 없으면 `SharePanel` 의 복사 버튼(`components/share/SharePanel.tsx:81`)이 칸을 차지한다. 그때 칸의 보이는 글자가 「공유」인지 「링크 복사」인지 SR-4.3·4.4 가 서로 다르게 읽힌다. 하나로 정한다.
- 찜 수 신선도: 「찜 N」은 재색인 날 값(`signalsAsOf`)이다. 카드 별을 눌러도 바뀌지 않는다. 상세 근거 줄처럼 접근성 문구에 기준일을 붙일지 정한다(가짜 신호는 아니고 SAVED_MIN import 도 맞다 — `visitSignals.ts:23`).

### U-8 순위 번호 · 가짜 평가 신호 — 확인 결과 문제 없음
- 리뷰·평점·순위 번호를 만들지 않는다(SR-2.6, Q2). 근거 `PlacePage.tsx:502` 가 허브 정렬이 관련도·거리·행사뿐임을 보여 준다. 찜 수는 하한 import·「이 사이트 회원」 출처 명시(SR-2.5)라 벤치마크 「평가 신호」 칸을 실측값으로만 채운다. 이 판단은 유지한다.

---

## 회귀 주입 R1~R10 점검 요약

| # | 컴파일됨 | 빨강 보장 | 조치 |
|---|---|---|---|
| R1 | O | O | — |
| R2 | O | **X** (KST 기기에서 초록, 실행 요일에 의존) | TS-3: TZ·시스템 시각 고정, `new Date(today).getDay()` 변형 추가, 호출부 단언 |
| R3 | O | O | — |
| R4 | O | 조건부 | 긍정 5개 픽스처를 명시 |
| R5 | O | O | — |
| R6 | **X** (`SectionId` 유니온) | — | TS-4: 유니온 안 값이나 payload 회귀로 |
| R7 | O | O (상수 + SQL 4줄) | TS-5 반영, R7b(`PHONE`) 추가 |
| R8 | O | O (`--kh-ocher` 는 한지 위 2.79:1, `PlacePage.css:506`) | CDP 스크립트가 종료 코드로 판정하게 |
| R9 | O | 조건부 | TS-6: 측정 대상을 본문 포커스로 고쳐야 빨강이 의미가 있다 |
| R10 | O | O | — |
| 추가 | — | — | 무장애 조건을 「아무 코드」로 되돌리는 주입(D-2 반영 뒤) |

VERDICT: BLOCK
