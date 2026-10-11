<!-- source: portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/PlacePage.css, portal-fe/src/pages/place/AttractionPage.tsx, portal-fe/src/pages/place/placeAttributes.ts, portal-fe/src/analytics/events.ts, search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/SearchAttractionUseCase.kt, search/app/src/main/kotlin/com/kgd/search/application/attraction/service/SearchAttractionService.kt, analytics/app/src/main/kotlin/com/kgd/analytics/application/popularity/usecase/AggregateAttractionPopularityUseCase.kt -->
# Specification: place 허브 결과 카드 · 모바일 상세 하단 행동 바

> 2026-10-11. 사용자 지적 「place.1989v.com 목록이 아무것도 안 바뀐 것 같다」에 대한 답이다. 허브 카드는 지금도 사진·제목·현지명·분류·주소·개요 2줄이고(`PlacePage.tsx:2122-2227`), 벤치마크 리포트 §3.1 의 5순위(결과 카드)와 10순위(모바일 고정 액션 바 + 섹션 점프 탭)가 남아 있다. 브라운필드 근거는 `planning/requirements.md` 가 정본이다.
> ADR 은 필요 없다. 응답 필드 하나를 더하고(스키마·색인 매핑 불변), 인기 집계 제외 섹션 둘을 더한다(ADR-0095 「`clicks` 의 뜻」 절에 한 줄). 브랜드 면이라 DESIGN.md §12 토큰과 `docs/design/k-heritage.html` 견본을 따르고 hex 는 쓰지 않는다.
> 사용자 판단이 필요한 것은 권고 기본값으로 정했다(`context/open-questions.yml`, `answered-default`). 뒤집히면 해당 SR 과 `tasks.md` 를 먼저 고친다.
> 2026-10-11 리뷰 심판(`context/review-verdict.md`) 반영본이다. BLOCK D-1(용어)·D-2(무장애 조건)와 REVISE 전부를 SR·tasks 에 넣었고, 사용자 판단 11건은 Q9~Q19(+ U-7 의 찜 기준일 Q20)로 기록했다.
> 용어(Q10): 카드에 붙는 것은 **카드 상태 배지**다. `search/glossary.md` 의 「배지 줄」(상세 방문 요약 뒤 `visit-badges`)과 다른 것이다.

## Goal
허브 결과 카드가 「어디 · 오늘 가도 되는지 · 무엇이 되는지」를 한 줄씩 준다. 시군구 라벨, 카드 상태 배지(확인된 값만, 최대 3), 거리, 이 사이트 찜 수(하한 3)다. 리뷰·평점·순위는 데이터가 없어 만들지 않는다. 카드 높이는 지금보다 늘지 않는다. 390×844 상세에서는 행동 줄이 화면 위로 지나가면 하단 행동 바(길찾기·찜·공유·전화)가 나타나고, 절 이동 줄로 요약·가는 법·방문 정보·주변에 바로 간다. 새 클릭은 원장에 남되 인기 집계를 부풀리지 않는다. 기기×사이트 4조합에서 새 글자는 모두 4.5:1 이상이다.

## User Stories
- 허브 방문자로서, 카드만 보고 어느 동네인지와 오늘 정기휴무인지를 알고 싶다.
- 반려동물·휠체어 동반 방문자로서, 상세를 열기 전에 확인된 조건을 보고 싶다.
- 휴대폰 방문자로서, 상세를 읽어 내려가다가 손을 올리지 않고 길찾기·전화를 누르고 싶다.
- 스크린리더 사용자로서, 같은 행동이 두 번 읽히지 않고 절 이동 뒤 그 절 제목부터 듣고 싶다.

## Specific Requirements

### SR-1 검색 응답에 시군구 이름 (search)
1. `SearchAttractionUseCase.AttractionSearchResult` 에 `sigunguName: String? = null` 을 더한다. KDoc: 「시군구 이름(언어별) — 목록·단건 모두. 재색인이 이름표를 못 받은 회차·지역 집계가 없는 문서는 null」.
2. `SearchAttractionService.toResult` 에서 `sigunguName = region?.sigunguName` 을 **summarize 와 상관없이** 채운다. `region`(`:328`)은 지금처럼 단건에만 싣는다. 응답 크기는 문서당 이름 하나다.
3. 색인 매핑·재색인·서버 렌더는 바꾸지 않는다. 이름은 이미 색인 문서에 있다(`AttractionSearchDocument.kt:92`, `AttractionApiReindexTasklet.kt:573`).
4. FE `placeApi.ts` `Attraction` 에 `sigunguName?: string | null` 한 줄(주석: 목록·단건 모두, 옛 응답에는 없다).
5. 응답이 읽는 색인 필드 계약: 루트 `build.gradle.kts` `searchReadRequired["attractions"]`(`:537-`)에 `sigunguName` 과 주석(「목록 카드 지역 라벨이 읽는다」)을 더한다. 지금 이 목록에 없어(`sigungu` 검색 0건) `searchReadOmitted` 로 빠져도 게이트(`:602-611`)가 막지 못한다. 확인은 `verifySearchIndexContract`.

### SR-2 카드 정보 판정 — 순수 함수 하나 (`placeAttributes.ts`)
1. `cardFacts(a: Attraction, lang: PlaceLang, today: string /* YYYY-MM-DD KST */)` 가 `{ regionLabel: string | null; badges: Array<{ code: CardBadgeCode; text: string }>; distance: string | null; saved: { count: number; label: string } | null }` 을 돌려준다. 카드는 이 결과만 그린다. 날짜는 호출부가 **렌더마다** `todayKst()`(`seo/eventSchedule`)로 넘긴다 — 함수 안에서 시계를 읽지 않고, 호출부는 날짜를 메모하지 않는다(자정을 넘겨 다시 그리면 새 날짜).
2. **지역 라벨**: ko `「{sidoName} {sigunguName}」`, en `「{sigunguName}, {sidoName}」`. 시군구가 없거나 시도와 같으면(세종) 시도만, 둘 다 없으면 null. 공백은 trim. 시도 약칭 표는 만들지 않는다(새 지식 사본이 된다).
3. **카드 상태 배지 후보와 순서** — 확인된 값만, 최대 3개, 넘치면 뒤를 버린다(전부는 상세가 보여 준다). 순서는 휴무 → 무료 → 반려 → 무장애 → 주차다. 반려·무장애 동반 방문자(사용자 스토리 2)의 조건이 상한 3에서 먼저 잘리지 않게 주차를 맨 뒤에 둔다(Q14). 켠 칩과 같은 배지를 앞당기는 연동은 하지 않는다(YAGNI).

   | 순서 | code | 조건 | ko | en |
   |---|---|---|---|---|
   | 1 | `closedToday` | `WEEKLY` 이고 오늘(KST) 요일 ∈ `closedWeekdays` | 오늘은 정기휴무일 | Regular closing day today |
   | 1 | `weeklyClosed` | `WEEKLY` 이고 오늘이 아님 | {요일·요일} 휴무 (예: 월·화 휴무) | Closed Mon, Tue |
   | 1 | `alwaysOpen` | `ALWAYS_OPEN` | 연중무휴 | Open every day |
   | 2 | `free` | `attrAdmission = FREE` | 입장 무료 | Free admission |
   | 3 | `pet` / `petPartial` | `petPolicy = ALLOWED` / `PARTIAL` | 반려동물 동반 / 반려동물 일부 구역 | Pets allowed / Pets in some areas |
   | 4 | `barrierFree` | `barrierFree` 에 목록 필터 정밀 3종(`WHEELCHAIR`·`ELEVATOR`·`RESTROOM`) 중 하나 이상 | 무장애 시설 | Accessible facilities |
   | 5 | `parking` | `attrParking = YES` | 주차 가능 | Parking |

   - `closedToday` 는 규칙 기준이지 단정이 아니다(Q12). 보이는 글자 「오늘은 정기휴무일」에 접근성 이름 「오늘은 정기휴무일(매주 {요일} 휴무 규칙 기준)」/「Regular closing day today (weekly rule: {day})」을 붙인다. 명절 휴무를 모르는 것은 칩 문구(「(명절 제외)」 `placeAttributes.ts:55`)와 같은 한계다.
   - `barrierFree` 판정(Q11)은 같은 파일의 `BARRIER_FREE_CHIPS`(`placeAttributes.ts:41-45`, search `AttractionAccessibility.FILTER_CODES` 와 같은 셋 — 라벨 정밀도 95% 이상만)의 코드로 한다. 사본 목록을 만들지 않는다. 원천 코드에는 `PROMOTION`·`LACTATION_ROOM` 같은 저정밀·비시설 코드가 있어(`AttractionAccessibility.kt:18-46`) 「코드가 하나 이상」이면 필터에 안 걸리는 곳에도 배지가 붙는다. 영문은 무장애 원천이 0 이라(`placeAttributes.ts:47-51`) 실제로 나오지 않지만 문구 뜻은 맞춘다.

   - 그리지 않는 것: `NO_WEEKLY` · `UNKNOWN` · null · 요일 없는 `WEEKLY`(`closureBadge` 와 같은 판정, `placeAttributes.ts:318-321`), 주차 `NO`·`UNKNOWN`, 입장 `PAID`·`UNKNOWN`, 반려 `UNKNOWN`. 배지가 없다는 것은 「아니다」가 아니다 — 카드에서는 부정값을 말하지 않고 상세의 「정보 없음」 칸이 그 몫이다.
   - 「영업 중」「지금 열림」은 쓰지 않는다. 원천에 시각이 없고 명절 휴무를 모른다(칩 문구 「오늘 정기휴무일 아님(명절 제외)」 `placeAttributes.ts:55` 와 같은 조심).
   - 행사 유형(`placeKind === 'event'`)은 속성 배지를 내지 않는다. 기간·상태는 지금처럼 `EventLine` 이 맡는다.
   - 요일 문자는 기존 `KO_DAY`·`EN_DAY`·`WEEK_ORDER`(`placeAttributes.ts:308-312`)를 쓴다. en 카드 요일은 세 글자(Mon)로 줄이는 표 하나를 같은 자리에 둔다.
4. **거리**: `distanceKm != null` 일 때 기존 `distanceLabel(Math.round(distanceKm * 1000))`(`placeAttributes.ts:483`, 서버 렌더와 같은 표기)로. `distanceLabel` 은 m 를 반올림하지 않으므로(`` `${meters}m` ``) 호출부가 정수로 넘긴다. 테스트 값: `0.4567` → 「457m」, `0.9996` → 「1.0km」. 지금 카드의 `toFixed(1)km` 는 이것으로 바꾼다. 「내 위치에서」 같은 기준점 문구는 붙이지 않는다 — 허브 geo 는 내 주변·지도 영역·제안 셋에서 오고(`PlacePage.tsx:1432-1467`) 상태가 출처를 들고 있지 않다(Q4).
5. **찜 수**: `savedCount >= SAVED_MIN`(`visitSignals.ts:23` import, 사본 금지)일 때만 `「찜 {n}」`/`「Saved {n}」`. 카드가 통째로 `<a>`(`PlacePage.tsx:2162-2166`)라 span 의 `aria-label` 은 읽히지 않는다 — 보이는 「찜 n」은 `aria-hidden`, 바로 옆에 시각 숨김 텍스트 「이 사이트 회원 {n}명이 찜」/「Saved by {n} members of this site」를 둔다. 실제로 잰 유일한 평가 신호라 넣는다. 수는 검색 응답 시점 값이고 기준일은 표기하지 않는다(색인 갱신 주기 안의 값, Q19).
6. **순위 번호는 붙이지 않는다**(Q2). 허브는 `relevance`·`distance`·`eventStart` 만 보낸다(`PlacePage.tsx:502`). 관련도·거리 순서의 번호는 인기 순위로 읽힌다.

### SR-3 허브 카드 마크업·CSS
1. `PlaceCard`(`PlacePage.tsx:2122-2227`) 본문을 이 순서로: 제목 h3 → 현지명(있으면) → meta 줄 `분류 · 지역 라벨 · 거리 · 찜 N`(있는 것만, `.place-card-meta`) → `EventLine`(행사) → 카드 상태 배지 `<ul class="place-card-badges">`(배지가 있을 때만) → 개요 **1줄**(`.place-card-overview` clamp 2 → 1). **주소 줄은 허브 카드에서 뺀다** — 지역 라벨이 대신하고 주소는 상세·사이드 패널에 있다(Q1). 사진·찜 별·링크·클릭 처리는 그대로다.
2. meta 줄은 한 줄이다. 지역 라벨 칸만 줄어들고(`min-width: 0; overflow: hidden; text-overflow: ellipsis`) 분류·거리·찜은 줄지 않는다. 390 폭에서 지역 라벨이 0px 로 줄 수 있으므로 SR-8.2 에서 `clientWidth ≥ 48px` 을 잰다. 미달이면 라벨을 meta 줄에서 빼 주소 줄 자리(개요 앞 한 줄)로 옮긴다(Q18). 색은 지금 `.place-card-meta`(`--kh-ocher-text` 폴백) 그대로다.
3. 카드 상태 배지는 **항상 한 줄**이다. 배지 `line-height` 를 고정하고 `flex-wrap: wrap` + `max-height: calc(배지 line-height + 위아래 padding·테두리)`(= SR-8.2 의 24px 과 같은 값) + `overflow: hidden` 으로 넘친 배지는 통째로 숨는다(잘린 배지가 보이지 않게). 상한 3은 그대로다(Q19). 배지 모양은 상태 표시 9999px(`PlacePage.css:1455`). 글자 `0.72rem`, 색 `--ko-text-secondary`, 테두리 `--ko-border-default`. `closedToday` 만 글자 `--ko-accent-text` 폴백 `--ko-accent-primary` + 굵게 — 색만으로 뜻을 나르지 않는다(글자가 말한다).
4. 카드 높이는 늘지 않는다(개요 −1줄 · 주소 −1줄 · 상태 배지 +1줄). 판정은 SR-8.2.
5. 지역 페이지(`RegionPage.tsx:280-330`)의 카드는 이번에 바꾸지 않는다(Q3). `.place-card-addr` 규칙은 그쪽이 쓰므로 남긴다.

### SR-4 모바일 상세 하단 행동 바 (≤640px)
1. 대상 폭은 상세 머리띠가 sticky 가 되는 `max-width: 640px`(`PlacePage.css:872-886`)이다. 그보다 넓으면 그리지 않는다. `useMediaQuery('(max-width: 640px)')`(`pages/place/useMediaQuery.ts`)로 판정하고 질의 문자열을 이것으로 고정한다. 기존 `AttractionPage.test.tsx:52` 의 matchMedia 대역은 `min-width` 가 아닌 질의를 늘 false 로 돌려 이 질의를 시험할 수 없다 — 바 테스트는 새 파일(SR-8.1)에서 `max-width`·`min-width` 를 폭 변수로 계산하는 대역을 쓴다.
2. **중복 노출 정책**: 바는 상세 행동 줄(`.place-detail-actions`, `AttractionPage.tsx:412`)이 화면 위로 지나갔을 때만 보인다. IntersectionObserver 로 행동 줄을 보고, `rootMargin` 위쪽을 sticky 머리띠 높이만큼 뺀다(`-{--place-header-h}px 0px 0px 0px`, ≤640 에서 `.place-header` 가 `position: sticky; top: 0`, `PlacePage.css:879-882`). `!isIntersecting && boundingClientRect.bottom < rootBounds.top` 일 때만 표시한다 — 행동 줄이 머리띠 밑으로 들어간 순간부터다. 첫 화면(행동 줄이 폴드 안, 직전 스펙 10/10)에서는 숨는다. 숨을 때는 `hidden` 속성으로 접근성 트리·탭 순서에서도 빠진다. 바에 `display` 를 주므로 `.place-action-bar[hidden] { display: none }` 을 명시한다(없으면 작성자 `display` 가 `hidden` 을 이긴다). IntersectionObserver 가 없으면 바를 그리지 않는다(행동 줄이 남아 있다).
3. 칸(왼→오, 같은 폭): **길찾기**(`googleMapsDirectionsUrl(attraction)`, 행동 줄과 같은 주소, 새 탭) · **찜**(`FavoriteButton` 그대로 — 상태는 같은 `useFavorites` 라 제목 옆 별과 함께 바뀐다) · **공유**(`SharePanel` 재사용, `channels` 는 `navigator.share` 가 있으면 `['share']`, 없으면 `['copy']` — 복사 쪽이 「복사됨」을 보여 준다. 주소 규칙은 `SharePanel` 그대로 단축 주소 → canonical. 칸 글자는 `SharePanel` 의 글자 그대로 — share 「공유」/copy 「링크 복사」(`SharePanel.tsx:5`), Q16) · **전화**(`phone.href` 가 있을 때만, `AttractionPage.tsx:278-279` 판정 재사용). 전화가 없으면 세 칸이다.
4. 각 칸은 아이콘 + 보이는 글자(길찾기·찜·공유·전화 / Directions·Save·Share·Call, 공유 칸은 위 SharePanel 글자). 누르는 영역은 칸 전체이고 44×44px 이상(frontend-design.md §4·§9).
   - **공유 칸 — (a)안**: 공용 `SharePanel` 은 고치지 않는다(Out of Scope). 자체 `role="group"`(`SharePanel.tsx:80`)이 바의 group 안에 중첩되는 것은 허용한다. 버튼 색(`SharePanel.css:14` `--ko-text-secondary`·테두리)은 판 바탕(`--kh-giwa`)에서 대비가 모자라므로 바 범위 CSS(`.place-action-bar .share-panel__btn`)로만 덮는다 — 테두리 없음, 칸 전체 폭·높이, 글자·포커스 링은 판 위 토큰. 바에 `.kh-slab` 범위(`k-heritage.css:297-305`)를 쓰면 `--ko-text-*` 가 판 위 색으로 바뀌어 글자색은 토큰만으로 풀린다. 포커스 링은 그 범위가 바꾸지 않으므로 따로 준다.
5. **찜 칸**: `FavoriteButton` 은 자식을 받지 않고(`FavoriteButton.tsx:94-105`) 44×44 고정·별 색 `--ko-text-secondary`·포커스 outline `--ko-text-primary`(라이트에서 기와색 — 판 위에서 안 보임)·켜짐 `--kh-yeonji` 다(`Favorite.css:15-26`). 바 범위 덮어쓰기 `.place-action-bar .favorite-btn` 으로 폭·높이 100%(칸 전체가 버튼), 꺼짐·켜짐 별 색과 포커스 링을 판 위에서 ≥3:1 인 토큰으로 준다. 보이는 글자 「찜」/「Save」는 버튼 위에 겹친 `aria-hidden` + `pointer-events: none` 요소이고, 이름은 `FavoriteButton` 의 접근성 문구가 말한다(문구에 「찜」이 들어 있다).
6. 모양: `.kh-tabbar` 와 같은 면 — 배경 `var(--kh-giwa, var(--ko-surface-1))`, 위 테두리 `var(--kh-slab-border, var(--ko-border-subtle))`, `padding-bottom: env(safe-area-inset-bottom)`, `position: fixed; left: 0; right: 0; bottom: 0; z-index: 200`(sticky 층 — 시트 300·사진 보기 1000 아래). 글자는 판 위 글씨 `var(--kh-hanji, var(--ko-text-primary))`. 높이 56px + safe-area.
7. 덮임 방지: ≤640 상세에서 `.place-page` 하단 여백과 `scroll-padding-bottom` 을 바 높이 + safe-area 로 **처음부터** 둔다. 범위는 상세 전용 — `html:has(.place-action-bar)` 선택자로 걸어, 바가 마운트된 동안에만 적용되고 언마운트(허브로 돌아감)하면 저절로 풀린다(정리 코드 없음). 허브에는 적용되지 않는다(SR-8.4 단언). 같은 범위에서 로그인 복귀 알림 `.favorite-resume-notice`(`Favorite.css:118-132`, z 40 — 바 z 200 밑에 깔린다)의 `bottom` 을 바 높이만큼 올린다. 마지막 내용이 바 아래 깔리지 않고, 키보드 포커스가 바에 가리지 않는다(WCAG 2.4.11). 여백은 문서 끝에만 붙어 위 내용을 밀지 않는다.
8. 그룹 `role="group"` + `aria-label`(「이 관광지 바로 하기」/「Quick actions」). 등장 전환은 두지 않는다 — `hidden`(`display: none`)에서 나올 때 전환을 걸려면 `@starting-style` 이 필요하고, 그만한 이득이 없다(즉시 표시라 `prefers-reduced-motion` 분기도 없다).

### SR-5 모바일 상세 절 이동 줄 (≤640px)
1. `<nav class="place-jump" aria-label="이 페이지 안에서 이동">` 을 `.place-detail-first` 바로 뒤(같은 `article.place-detail` 안)에 둔다(Q15). 요약(`section.place-visit`, `AttractionPage.tsx:489`)·가는 법(`AttractionAccess`, `:469`)은 `.place-detail-first`(`:370`) **안**이라 이 줄보다 위에 있다 — 그 둘은 위로 거슬러 가는 이동이고, sticky 라 스크롤해 내려온 뒤 누르는 쓰임이다. 행동 줄 바로 뒤로 옮기는 안은 폴드 재측정이 따라와서 택하지 않았다. `position: sticky; top: var(--place-header-h, 0px); z-index: 200`, 높이 44px 고정. 머리띠 높이는 `.place-header` 에 ResizeObserver 를 달아 `.place-page` 의 `--place-header-h` 로 쓴다(머리띠가 두 줄로 접혀도 겹치지 않게).
2. 링크(있는 절만, 이 순서): 요약 → `section.place-visit` · 가는 법 → `AttractionAccess` 절 · **방문 정보** → `AttractionInfoTabs` 의 `div.place-info-tabs`(`AttractionInfoTabs.tsx:71`, 탭 이름 「방문 정보」/「At a glance」 `:20`) · 주변 → `NearbyExplore` 절. 「이용 안내」(`section.place-detail-info`, `AttractionPage.tsx:626`)는 사이드 절이고 링크 글자와 대상이 어긋나므로 쓰지 않는다. 각 대상에 `id`(`place-sec-summary`·`-access`·`-info`·`-nearby`)와 `tabIndex={-1}` 을 달고, 제목 없는 대상(`div.place-info-tabs`)에는 `aria-label` 을 단다(포커스가 옮겨졌을 때 읽힐 이름). 링크 표시는 렌더 시점에 동기로 알 수 있는 조건으로만 판정한다(요약 있음 · 가는 법 데이터 있음 · 정보 탭 항목 있음 · 주변은 좌표 있음). `NearbyExplore` 는 목록이 비면 null 이라(`NearbyExplore.tsx:201`) 대상이 없을 수 있다 — 클릭 때 `getElementById` 가 null 이면 아무것도 하지 않는다. 둘 미만이면 줄을 그리지 않는다. 줄 높이는 고정이다.
3. 링크는 `href="#place-sec-…"` 실주소다. 클릭은 기본 동작을 막고 `scrollIntoView` 뒤 그 절에 `focus({ preventScroll: true })` 로 포커스를 옮긴다(스크린리더가 절 이름부터 읽는다, 포커스가 스크롤 위치를 다시 바꾸지 않는다). `scroll-margin-top` 은 머리띠 + 이동 줄 높이다. 기본 동작을 막으므로 해시는 주소에 생기지 않는다 — `history.replaceState` 는 쓰지 않는다(라우터 상태를 `null` 로 덮는다). 공유 주소는 어차피 `SharePanel` 의 canonical 이다.
4. 현재 절 강조(스크롤 스파이)는 하지 않는다(Q5). 링크 글자 `--ko-text-secondary`, hover·focus 는 `--ko-text-primary` + 밑줄 긋기, `:focus-visible` 은 `--ko-focus-ring`.
5. 데스크톱은 그리지 않는다. 서버 렌더도 그리지 않는다(SR-7).

### SR-6 계측 (ADR-0095 규약)
1. **카드**: 지금 카드 노출(`useImpression`, `ATTRACTION_LIST`)·클릭(`source: 'card'`, `PlacePage.tsx:2167-2189`) 그대로에 `payload.badges` = `cardFacts` 가 낸 배지 code 배열(빈 배열 포함, 한 줄 clamp 로 화면에서 숨은 것도 포함 — 상한 3 안이라 차이는 폭 넘침뿐)을 더한다. 노출·클릭 둘 다 — 배지별 CTR 을 볼 수 있게. 키는 바뀌지 않는다.
2. **행동 바**: 기존 섹션을 그대로 쓰고 `payload.source: 'action_bar'` 만 더한다 — 카드 클릭의 `{ source: 'card' }`·지도 `{ source: 'map' }`(`PlacePage.tsx:1136,2179`)과 같은 어휘다. `placement` 는 쓰지 않는다 — 광고 지면(`AdSlot placement="attraction-end"`, `AttractionPage.tsx:707`)·common `Placement`(`docs/context-map.md:65`)와 이름이 겹친다(Q17). 길찾기 `DIRECTIONS` `{ kind: 'google_maps_directions', source }`, 공유 `SHARE` `{ kind: 'attraction', channel, source }`, 찜은 `FavoriteButton` 의 `FAVORITE` 그대로(source 없음, 컴포넌트를 바꾸지 않는다). 기존 행동 줄 클릭의 payload 는 바꾸지 않는다(없음 = 행동 줄).
   - 중복 키에 payload 가 없어(`tracker.ts:20-28`, `EventCollectDtos.kt:60-68`) 같은 view 에서 행동 줄 길찾기 뒤 바 길찾기는 버려진다. 「view 당 그 행동의 첫 위치」로 읽는다 — `SHARE` 채널 주석(`events.ts:53-57`)과 같은 규칙이고 `events.ts` 주석에 한 줄 적는다.
3. **새 섹션 둘**: `PHONE`(전화 — 행동 줄·바 모두, payload `{ source? }`)과 `SECTION_JUMP`(절 이동, payload `{ target: 'summary'|'access'|'info'|'nearby' }`). `events.ts` `SectionId` 유니온에 더한다. 둘 다 노출은 보내지 않는다. 중복 키에 payload 가 없으므로(`tracker.ts:26-28`) **`PHONE`·`SECTION_JUMP` 도 view 당 첫 건만 남는다** — 두 번째 절 이동(다른 target)은 버려진다. 그래서 절 이동 지표는 「target 별 횟수」가 아니라 「이동을 쓴 view 비율」로 읽는다(Q5 의 후속 판단 기준).
4. **인기 집계 제외**: `AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS` 에 `PHONE`·`SECTION_JUMP` 를 더한다. 집계는 화면 종류로 거르지 않으므로(`ClickHouseAttractionPopularityAdapter.kt:43-66`) 빼지 않으면 상세의 절 이동·전화가 「목록 선택」으로 세어져 `clicks`·`unique_clickers`·`clickBoost` 가 부푼다. ADR-0095 「`clicks`·`unique_clickers` 의 뜻」 절에 한 줄 더한다. 이 제외는 거부 목록이라 새 상세 섹션마다 같은 일을 반복해야 한다(spec 스스로 「화면 종류로 거르지 않으므로」). 이번 범위는 거부 목록을 유지하고, 허용 목록(목록 선택 섹션만 센다) 전환 검토는 ADR 의 같은 줄과 Q9 에 기록만 한다.
5. 배포 순서: analytics 의 제외 목록이 FE 보다 먼저거나 같은 날 03:30 KST 집계 전에 떠 있어야 한다. 같은 푸시로 내보내고 SR-8.6 에서 확인한다. 순서가 어긋나 집계가 먼저 돌았으면 analytics 배포 뒤 `reaggregateRecent(n)`(`AggregateAttractionPopularityUseCase.kt:20`)으로 그 날짜들을 다시 집계한다.

### SR-7 서버 렌더·프리렌더 — 바꾸지 않는다 (판단)
1. 허브·지역 프리렌더 목록은 제목 링크 목록이다(`prerender-seo.mjs:1294-1311,1447`). 카드가 아니고, 배지 중 휴무는 **오늘** 기준이라 빌드 시점에 굳히면 다음 날 틀린다(응답에 행사 상태를 싣지 않는 것과 같은 이유, `SearchAttractionUseCase.kt` `eventStart` KDoc).
2. 상세 서버 렌더의 행동은 전화 하나(`AttractionPageRenderer.kt:626`)이고 화면은 `createRoot` 로 본문을 갈아 끼운다(`main.tsx:31`). 하단 바·이동 줄은 상호작용이라 서버 렌더에 두지 않는다. FE/SSR 골든(`visit-summary-golden.json`·`render/golden/`)은 바이트 불변이어야 한다(SR-8.1).
3. 지역 라벨을 프리렌더 목록에 넣는 것은 색인 가치 판단이 따로 필요해 후속으로 둔다(Q6).

### SR-8 검증·완료 조건
1. **단위·통합(테스트 먼저)**: search `SearchAttractionServiceTest` — 목록 결과에 `sigunguName` 이 있고 `region` 은 null. analytics `ClickHouseAttractionPopularityAdapterTest` 의 `NOT IN (...)` 리터럴 다섯 곳(`:60·72·77·79` SQL 단언, `:86` 기대 집합)에 둘 추가. FE `__tests__/cardFacts.test.ts` — 표의 행마다, KST 경계(UTC 15:00 = 다음 날, `process.env.TZ='Asia/Seoul'` 고정 + `vi.setSystemTime`), UNKNOWN·NO·PAID 미표시, 최대 3·순서(휴무→무료→반려→무장애→주차), 무장애 저정밀 코드만 있으면 무배지, 행사 무배지, 지역 라벨 셋, 거리 두 값, 찜 하한 2·3. 호출부(`PlaceCard`)가 `todayKst()` 를 넘기는지 `PlacePage` 테스트에서 단언한다. `PlacePage.test.tsx:334`(개요) 갱신 + 카드에 주소 없음·카드 상태 배지 항목. `PlacePage.tracking.test.tsx` 에 노출·클릭 `payload.badges`. 새 `AttractionPage.actionBar.test.tsx` — 기존 `AttractionPage.test.tsx` 는 `FavoriteButton` 대역(`:16-20`, `aria-pressed` 없음)과 `track: vi.fn()`(`:32-35`)이라 찜 동기·계측 대기열을 단언할 수 없다. 새 파일은 진짜 `tracker`·`FavoriteButton` 을 쓰고 `wishlistApi` 만 대역, 대기열은 `pendingForTest()`(`tracker.ts:122`)로 읽는다. 640 이하에서 IO 콜백 전 바 `hidden`, 행동 줄이 머리띠 밑으로 지나가면 표시, 넓은 폭 미표시, 전화 없으면 세 칸, 바 길찾기 클릭이 `DIRECTIONS` + `source:'action_bar'` 로 대기열에, 찜 두 별 동기, 이동 줄이 있는 절만 · 클릭 뒤 포커스가 그 절 · 두 번째 이동은 대기열에 없음. 골든 `git diff --exit-code`. 판정 근거는 모두 대상 함수·컴포넌트가 낸 값이다.
2. **카드 높이·변화량(CDP, 배포 후 운영)**: 390×844·1440×900, ko·en. 표본은 TG1 이 정한 고정 질의 둘(필터 없음 + 지역 하나)의 첫 10장이고 TG1 이 관광지 id 를 기록한다 — 배포 후에는 같은 id 를 비교한다(순서가 바뀌면 id 로 맞춘다). **변화량**: ko·en 별로 카드 상태 배지·지역 라벨·찜이 붙은 카드 수(/10)를 적고, 같은 id 8장의 배포 전·후 캡처를 나란히 둔다. en 에서 배지 붙은 카드가 3/10 미만이면 사용자에게 다시 묻는다(Q13). 390 지역 라벨 `clientWidth` ≥ 48px. 카드 높이 중앙값 ≤ 기준선 중앙값(TG1) 이고 390 ko 중앙값 ≤ 120px, 최댓값 ≤ 기준선 최댓값. 카드 상태 배지 줄 높이 ≤ 한 줄(24px, SR-3.3 의 `max-height` 와 같은 값), 카드·페이지 `scrollWidth ≤ clientWidth`. 첫 카드 y 는 기준선 ±4px(카드 내용은 툴바를 바꾸지 않는다).
3. **대비(CDP 4조합 — 기기 light/dark × 사이트 light/dark)**: 카드 meta·지역 라벨·찜·카드 상태 배지(일반·`closedToday`), 바 글자(판 위, 공유 칸 「공유」/「링크 복사」 포함), 이동 줄 링크(기본·hover·focus) 전부 ≥ 4.5:1. 측정은 계산된 글자색과 실제 바탕 층 합성(`fe-visual-verification.md` §4.5). 바 아이콘(찜 별 꺼짐·켜짐 포함) ≥ 3:1, 포커스 링(바 칸 셋·공유 버튼·찜 버튼·이동 링크) ≥ 3:1.
4. **상세 390×844(표본 10곳 — 직전 스펙과 같은 id + 전화 없는 곳 1 이상 포함)**: 첫 화면 바 숨김 10/10, 행동 줄 bottom < 머리띠 bottom 까지 스크롤하면 300ms 안에 표시 10/10, 바 높이 ≤ 56px + safe-area, 칸 44×44 이상, 문서 끝까지 내리면 마지막 요소 bottom ≤ 바 top. 행동 줄 길찾기 폴드 안 10/10 유지(직전 스펙 회귀 없음). 이동 줄 top ≥ 머리띠 bottom(겹침 0px), 링크 클릭 뒤 `document.activeElement` = 그 절, 절 top ≥ 이동 줄 bottom. Tab 으로 본문을 돌 때 포커스 요소(바 칸 제외 — 바 칸은 바 안에 있어 늘 바 top 아래다) bottom ≤ 바 top. 허브 390 에서 `html` 의 `scroll-padding-bottom` 은 `auto`(상세 전용 범위 확인).
5. **CLS**: 상세 390 로드 + 끝까지 스크롤 + 이동 링크 1회, `layout-shift`(`hadRecentInput` false) 합 3회 중앙값 ≤ 기준선 + 0.01 이고 ≤ 0.1. 허브 390·1440 로드 합도 같은 기준.
6. **원장 도착·집계 제외**: 사람 UA 로 설정한 CDP 세션(크롤러 UA 는 202/accepted=0 로 버려진다)에서 바 길찾기·공유·전화·이동 링크를 한 번씩 누른 뒤, `ssh msa-oci` 로 ClickHouse `analytics.events` 에 그 viewId 의 `DIRECTIONS`(payload `source`)·`PHONE`·`SECTION_JUMP` 행이 있는지 본다. 제외는 대상의 산출물로 본다 — 다음 03:30 KST 집계 뒤 그 날짜·그 관광지의 `attraction_popularity_daily.clicks` 가 원장에서 여섯 섹션을 뺀 재집계와 같은지 대조한다(이미지 태그는 근거가 아니다). 집계 전이면 「대기」로 적는다.
7. **응답 채움률**: 배포 후 허브 첫 페이지 ko·en 각 3질의(SR-8.2 의 고정 질의 둘 + 하나)에서 `sigunguName` non-null 비율을 적고, TG1 의 색인 채움률과 같은지 본다. 낮으면 화면은 시도로 물러나므로 실패가 아니라 보고다.
8. **측정 대상 최신 확인**: 운영 번들에 이번에 넣은 심볼(`place-card-badges`·`place-action-bar`·`place-jump`)이 있는지 먼저 보고, 없으면 그 측정은 버린다. 캡처(390·1440 × ko·en × light·dark 허브, 390 상세 바 표시·이동 줄)를 `verifications/screens/` 에 남긴다.
9. **회귀 주입**(임시 사본에서, 컴파일되는 회귀만) — 각 주입에 빨강과 그 단언 이름을 적고 대조군은 초록이어야 한다.

   | # | 주입 | 잡아야 할 것 |
   |---|---|---|
   | R1 | `sigunguName` 을 `if (summarize) null else …` 로 | `SearchAttractionServiceTest` 목록 단언 |
   | R2 | `cardFacts` 가 요일을 `new Date().getDay()` 로 / `new Date(today).getDay()` 로 계산(두 변형) | `cardFacts.test` KST 경계(TZ 고정 + `setSystemTime` — 로컬 KST 기기에서도 빨강) |
   | R2b | `PlaceCard` 가 `today` 를 상수 날짜로 넘김 | `PlacePage` 호출부 단언 |
   | R3 | 주차 `NO`·`UNKNOWN` 에 「주차 불가」 배지 | `cardFacts.test` 미표시 |
   | R4 | 배지 상한 3 제거 | `cardFacts.test` 최대 3 |
   | R4b | 무장애 조건을 `barrierFree.length > 0`(아무 코드)으로 되돌림 | `cardFacts.test` 저정밀 코드만이면 무배지 |
   | R5 | 바 표시 조건을 항상 true 로 | `AttractionPage.actionBar.test` 첫 화면 hidden |
   | R6 | 바 길찾기 payload 에서 `source` 제거 | `AttractionPage.actionBar.test` 계측 단언 |
   | R7 | `POST_SELECTION_SECTIONS` 에서 `SECTION_JUMP` 빼기 | `ClickHouseAttractionPopularityAdapterTest` |
   | R7b | `POST_SELECTION_SECTIONS` 에서 `PHONE` 빼기 | `ClickHouseAttractionPopularityAdapterTest` |
   | R8 | 배지 글자를 `var(--kh-ocher)` 원색으로 | CDP 대비 라이트 < 4.5 |
   | R9 | `scroll-padding-bottom` 제거 | CDP 본문 포커스 가림(SR-8.4 의 Tab 단언이 빨강) |
   | R9b | `.place-action-bar .favorite-btn` 덮어쓰기 제거 | CDP 바 아이콘·포커스 링 < 3:1 |
   | R10 | 이동 줄 `top: 0`(머리띠 변수 무시) | CDP 겹침 > 0 |
   | 대조 | 무관한 주석 한 줄 | 전부 초록 |

## Existing Code to Leverage
- `placeAttributes.ts` — `closureBadge` 판정·`KO_DAY`/`EN_DAY`/`WEEK_ORDER`(`:308-328`), `BARRIER_FREE_CHIPS`(`:41-45`), `distanceLabel`(`:483`), `placeKind`(`:493`). `visitSignals.ts` `SAVED_MIN`. `seo/eventSchedule` `todayKst`.
- `EventLine.tsx`(행사 줄), `FavoriteButton`, `SharePanel`(`channels` prop), `attractionPhone`·`googleMapsDirectionsUrl`.
- `useImpression`·`track`(ADR-0095), `useMediaQuery`.
- `.kh-tabbar` 면 토큰(`kh-shell.css:32-44`), 허브 보기 전환의 고정 배치(`PlacePage.css:1076-1088`), `.place-badge`(`:1455-1462`).
- CDP: `scripts/cdp-chrome.sh` start·측정·stop 을 한 명령으로, 직전 스펙 측정 스크립트(`docs/specs/2026-10-10-place-screen-polish/verifications/scripts/`)의 대비·폴드 측정 함수.

## Out of Scope
- 「가봤다」(리포트 #9), 리뷰·평점, 순위 번호, 허브 인기순 정렬(Q2).
- 지역 페이지 카드(Q3), 허브 데스크톱 사이드 패널, 데스크톱 하단 바·이동 줄.
- 프리렌더·서버 렌더 목록 변경(Q6), 색인 매핑·재색인, 분석 대시보드·배지별 CTR 리포트.
- `FavoriteButton`·`SharePanel` 공용 컴포넌트 수정.

## Open Questions
`context/open-questions.yml` — Q1 주소 줄 제거 · Q2 순위 번호 · Q3 지역 페이지 카드 · Q4 거리 기준점 문구 · Q5 스크롤 스파이 · Q6 프리렌더 지역 라벨 · Q7 바 폭 기준 640 · Q8 행동 바 계측 키(`source`) 중복 규칙 · Q9 제외 목록 허용 목록 전환 검토 · Q10~Q19 리뷰 심판 사용자 판단(용어·무장애·휴무 문구·변화량·배지 순서·이동 줄 위치·공유 칸·계측 키 이름·지역 라벨 배치·넘친 배지) · Q20 찜 수 기준일 표기. 전부 권고 기본값으로 진행한다.
