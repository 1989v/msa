<!-- source: portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/PlacePage.css, portal-fe/src/pages/place/RegionSheet.tsx, portal-fe/src/pages/place/RegionDrilldown.tsx, portal-fe/src/pages/place/AttractionPage.tsx, portal-fe/src/components/shell/KhSheet.tsx, portal-fe/src/styles/kh-shell.css, search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt -->
# Specification: place 화면 다듬기 — 데스크톱 허브 첫 카드 · 링크·대비 결함 · 상세 행동 줄

> 2026-10-10. 입력은 2026-10-09 운영 실측이다. 데스크톱 허브 첫 카드 y 438(`docs/specs/2026-10-09-place-hub-mobile-perf/verifications/pre-measure.md:9` — 헤더 20–83 · 툴바 99–378 · 본문 394–)과 상세 390 길찾기 폴드 안 4/10(`docs/specs/2026-10-09-place-detail-first-screen/verifications/screens.md` 재측정 절)을 쓴다. 대비 셋(2.03·2.79·4.09)은 토큰 값으로 다시 계산해도 같다.
> ADR 은 필요 없다. 화면 구성과 CSS 만 바꾸고 의존·스키마·API 는 그대로다. 브랜드 면이라 `docs/design/k-heritage.html` 견본과 DESIGN.md §12 토큰을 따르고 hex 는 쓰지 않는다.
> 2026-10-11 리뷰 판정(`context/review-verdict.md`, keep 34 / demote 1)을 반영했다. 사용자 판단 여섯 건은 권고 기본값으로 반영했고 확인 대기다(`context/open-questions.yml` Q3·Q6–Q10, `status: answered-default`).

## Goal
1440×900 허브에서 첫 결과 카드가 y ≤ 320 에 온다. 카드 글자(제목·meta·주소)·주 버튼·언어 토글·시트 글자는 기기×사이트 4조합 모두 4.5:1 이상이다. 예외는 0건 속성 칩(`.place-chip.is-empty`, opacity 0.4)으로, 이번 판정에서 빼고 실측값만 보고한다(Q6). 390×844 상세에서 길찾기가 표본 10/10 폴드(가시 664) 안에 온다. 계측(SEARCH trigger·필터 적용)과 기존 테스트 단언은 그대로 지킨다. 넓은 화면 시트·다이얼로그는 키보드 포커스를 가두고 닫히면 연 자리로 돌려준다.

## User Stories
- 데스크톱 방문자로서, 허브를 열면 필터 벽을 지나지 않고 바로 결과를 보고 싶다.
- 방문자로서, 카드 제목이 링크 기본색이 아니라 사이트 글자색으로 읽히고 버튼 글자가 다크에서도 보이길 바란다.
- 키보드 사용자로서, 필터 다이얼로그를 닫으면 누른 버튼으로 포커스가 돌아오길 바란다.
- 휴대폰 방문자로서, 상세를 열자마자 길찾기를 누르고 싶다.

## Specific Requirements

### SR-1 데스크톱 허브 필터 — 모바일과 같은 「한 줄 + 펼치기」
1. 넓은 화면(`MOBILE_QUERY` false)도 툴바를 **검색 줄 + 필터 한 줄 + 요약 줄**로 그린다. 필터 한 줄은 좁은 화면과 같은 요소(지역 트리거 · 핵심 분류 칩 `QUICK_CATEGORIES` · 「필터 N」)와 같은 핸들러를 쓴다. `{isMobile && (<div className="place-filter-bar">…)}`(`PlacePage.tsx:1547`)의 `isMobile` 조건을 지워 두 폭이 같은 코드를 탄다(Q1).
2. 「필터 N」의 N 과 요약 줄은 지금 `activeFilterConditions` 결과를 그대로 쓴다(`PlacePage.tsx:1403-1409`). 규칙 사본을 만들지 않는다.
3. 필터 시트는 폭과 상관없이 `filterSheetOpen` 일 때만 `KhSheet` 를 그린다. 넓은 화면에서는 className 에 `kh-sheet--dialog` 를 더해 가운데 다이얼로그로 띄운다. 좁은 화면(768–899px 포함)은 지금 바텀시트 그대로다. `FilterSheetFrame`(`PlacePage.tsx:1951-1971`)은 `if (!mobile) return <>{children}</>;`(`:1964`) 분기가 사라지면 open 확인과 className 선택만 남으므로 **호출부에 인라인하고 함수를 지운다**. 시트 안 내용(분류 전부 · 지도 오버레이 · 행사 상태 · 속성 칩 · 설명)과 핸들러·계측은 바꾸지 않는다.
4. 넓은 화면에서 지도 오버레이 칩을 **켜는 순간 다이얼로그를 닫는다**(Q10). 다이얼로그 뒤 veil 이 먹빛 62% 에 `backdrop-filter: blur(24px)`(`kh-shell.css:122-133`)라 열어 둔 채로는 지도 반응이 안 보인다. 좁은 화면 `listFirst` 의 전환 규칙(스펙 E SR-1.6, `PlacePage.tsx:451-` 주석)과 같은 모양이 된다. 끄는 동작과 오버레이 값·질의 규칙은 그대로다.
5. 필터 한 줄 CSS 를 좁은 화면 미디어 쿼리(`PlacePage.css:945` `@media (max-width: 899.98px)`) 밖으로 옮긴다. 옮기는 규칙은 `.place-filter-bar`·`.place-filter-row`·`.place-filter-row .place-region-trigger`·`.place-filter-row > .place-chip, .place-filter-row > .place-filter-open`·`.place-filter-open`·`.place-filter-summary`·`.place-filter-sheet-body`·`.place-filter-sheet .place-filters, .place-filter-sheet .place-attr-chips`(`:1015-1069`)이다. 다이얼로그 본문 규칙이 미디어 쿼리 안에 남으면 1440 다이얼로그에서 칩이 가로 스크롤 한 줄로 그려진다.
6. 넓은 화면 트리거 폭을 제한한다. `.place-region-trigger` 는 `width: 100%`(`:1750`)이고 필터 한 줄 안에서 `flex: 1 1 auto`(`:1028`)라 1440 에서 한 줄 전체로 늘어난다. `@media (min-width: 900px)` 에서 `.place-filter-row .place-region-trigger { flex: 0 1 16rem; }` 로 둔다. 좁은 화면은 지금 그대로다. 넓은 화면에서도 한 줄이 줄바꿈 없이 들어가야 한다. 간격은 `--ko-space-*`, 색은 `--ko-*`·`--kh-*` 토큰만 쓴다.
7. 계측 불변: 같은 클릭은 같은 `triggerRef`·`changedRef`·SEARCH 를 낸다. 분류 칩은 `category`, 속성 칩은 `attribute`, 행사 상태는 `eventStatus`, 지역은 `region` 이다. 시트·다이얼로그를 여닫는 동작은 계측하지 않고 질의(`query` 메모)도 바꾸지 않는다.
8. 공용 `KhSheet`(`components/shell/KhSheet.tsx`) 포커스 처리(Q7). 지금은 열 때 패널로 포커스를 옮기기만 하고(`:27`) 효과 정리(`:35-38`)에 복원·Tab 순환이 없다. 넓은 화면은 이번 변경으로 인라인 칩이 다이얼로그 안으로 들어가므로, 이것이 없으면 키보드 사용자가 새로 잃는 접근이 된다.
   - 열 때 `document.activeElement` 를 기억하고, 닫힐 때(효과 정리) 그 요소가 문서에 남아 있으면 포커스를 돌려준다.
   - 패널 안에서 Tab·Shift+Tab 이 마지막·첫 포커스 가능 요소에서 반대쪽 끝으로 돈다.
   - 공용 컴포넌트라 사용처 8곳(SR-5.2)이 함께 바뀐다. `ServiceExplorer`·`PickSheet` 의 같은 결함도 이것으로 고쳐진다.
9. 데스크톱 필터 클릭 수는 늘어난다. 첫 카드 y ≤ 320 을 위해 감수한다(결정, Q9).

   | 조작 | 전 | 후 |
   |---|---|---|
   | 핵심 셋 밖의 분류 하나 | 1 | 3(필터 열기 · 칩 · 닫기) |
   | 속성 칩 k 개 | k | k+2 |
   | 시도 하나 | 1 | 3(트리거 · 시도 행 · 「전체」 행) |
   | 핵심 분류 칩(전체·자연·행사) | 1 | 1 |

### SR-2 데스크톱 지역 선택 — 트리거 + 시트
1. 넓은 화면도 지역 트리거가 `RegionSheet` 를 연다(넓은 화면은 `kh-sheet--dialog`). `RegionSheet` 에 `className` 을 넘길 선택 prop 을 하나 더한다. 조건부 렌더 `regionSheetOpen && isMobile`(`:1584`)에서 `isMobile` 을 지운다. 인라인 `onClose={() => setRegionSheetOpen(false)}`(`:1590`)은 `closeRegionSheet = useCallback(() => setRegionSheetOpen(false), [])` 로 고정한다. `KhSheet` 는 `onClose` 가 바뀔 때마다 패널로 포커스를 옮기기 때문이다(`:451` 주석, `closeFilterSheet` 와 같은 이유).
2. 시군구 질의 조건 `enabled: sidoCode != null && (isMobile || sigunguCode != null)`(`:691`)은 그대로 둔다. `:686-687` 주석만 「지역 트리거 라벨(두 폭 공통)과 0건 화면 문구가 쓴다 · RegionSheet 와 같은 캐시 키」로 고친다.
3. 근거: 인라인 칩 드릴다운은 고른 시도에 따라 높이가 달라진다(경기 시군구 31개). 「시군구 30개가 화면 절반을 덮는 칩 벽」(`RegionSheet.tsx:9`)이라 어떤 상태에서도 y ≤ 320 을 지킬 수 없다.
4. 드릴다운의 가까운 시도 처리를 `RegionSheet` 로 옮긴다(Q2). `origin` prop 을 더하고 시도 목록에만 적용한다.
   - 정렬: `googleMaps.ts` 의 `nearestRegion` 을 그대로 import 한다. 사본을 만들지 않는다(ADR-0071:69-71 「드릴다운 정렬도 같은 함수를 쓴다」).
   - 배지: 가장 가까운 시도 행에 `<span className="place-region-near">` 를 문구 그대로(`L.near`, 지금 `RegionDrilldown.tsx:104`) 단다.
   - 근거 정정: 정렬은 `nearestRegion`(ADR-0071 §3)이다. 시트는 선택을 바꾸지 않는다(드릴다운 규칙 승계). 첫 진입 자동 선택 1회(ADR-0071:67)는 지금 그대로 둔다.
5. 허브가 `RegionDrilldown` 을 더 쓰지 않으면 `RegionDrilldown.tsx` 와 import(`PlacePage.tsx:31`)를 지운다(다른 사용처 없음, grep 확인 2026-10-11). CSS 는 grep 으로 나눈 다음 목록대로 한다.
   - 지운다: `.place-region`(`PlacePage.css:1658`) · `.place-region-sep`(`:1671`) · `.place-chip.active .place-region-count`(`:1687`).
   - 남긴다: `.place-region-crumbs`(RegionPage:188 · GuidePage:45 · GuideIndexPage:26) · `.place-region-list`(RegionPage:222) · `.place-region-count`(RegionSheet:87,115,132) · `.place-region-hint`(PlacePage:1746 · RegionSheet:62) · `.place-region-near`(SR-2.4 배지).

### SR-3 카드 링크 색 (기존 결함)
1. `a.place-card` 에 `color: inherit; text-decoration: none;` 을 준다. 허브 `PlaceCard`(`PlacePage.tsx:2090`)와 지역 `RegionPage.tsx:246,273` 의 `<Link className="place-card">` 가 같은 규칙을 받는다. `button.place-card`(`PlacePage.css:1735`)는 그대로다.
2. 링크 카드의 키보드 포커스는 `:focus-visible` 에 `outline: var(--ko-focus-ring)` 으로 보이게 한다(frontend-design.md §6 상태). hover 는 지금 `.place-card:hover` 그대로다.
3. 같은 카드 안 같은 꼴 결함도 고친다(Q8). `.place-card-meta` 글자(`PlacePage.css:490` `var(--kh-ocher, var(--ko-accent-primary))`)는 `var(--kh-ocher-text, var(--ko-accent-primary))` 로, `.place-card-addr`(`:495` `--ko-text-muted`)는 `--ko-text-secondary` 로 바꾼다. 각각 한 줄이고 다크 heritage 는 `--kh-ocher-text` 가 원색이라 값이 그대로다.

### SR-4 주 버튼 · 언어 토글 글자색
1. `.place-btn.primary`(`PlacePage.css:148`)의 `color` 를 `var(--kh-hanji, var(--ko-surface-0))` 으로 바꾼다. 라이트에서는 `--ko-surface-0` = 한지라 값이 같다. 다크에서는 청자 위 한지로 8.62:1(계산값)이 된다.
2. 같은 값을 다시 적는 `.place-btn.primary.place-view-toggle` 블록(`:1010-1012`)과 그 주석(`:1008-1009`)은 지운다. 한 규칙이 한 곳에만 있게 한다.
3. 대상은 `.place-btn.primary` 를 쓰는 다섯 곳 전부다. 허브 「검색」(`:1496`) · 「이 지역 검색」(`:1872`) · 보기 전환(`:1905`) · 허브 상세 패널 「지도에서 보기」(`:2022`) · 지역 페이지 허브 링크(`RegionPage.tsx:237`).
4. 비활성 primary 는 없다 — 측정하지 않는다. `.place-btn:disabled`(`:143`)와 `.place-btn.primary`(`:148`)는 명시도가 같고 primary 가 뒤라 primary 글자색이 이기지만, 다섯 사용처 중 `disabled` 를 받는 primary 가 없다.
5. 언어 토글(Q3). 활성 `.place-lang-btn.active`(`:82-85`, 청자 위 `--ko-surface-0`, 다크 2.03:1)는 SR-4.1 과 같은 `var(--kh-hanji, var(--ko-surface-0))` 로, 비활성 `.place-lang-btn`(`:77` `--ko-text-muted`, 라이트 4.23:1 리뷰어 계산값)은 `--ko-text-secondary` 로 바꾼다. place 전용 버튼이다.

### SR-5 공용 시트 제목 · 시트 글자 대비
1. `.kh-sheet-label`(`kh-shell.css:184`)의 색을 `var(--kh-ocher-text, var(--ko-text-muted))` 로 바꾼다. 라이트 heritage 는 `#8a6346`(토큰 `--kh-ocher-text`)이 시트 바탕 `--ko-surface-1` 위에서 4.82:1(계산값)이다. 다크 heritage 는 `--kh-ocher-text` = 황토 원색이라 5.59:1 로 값이 그대로다. heritage 밖은 `--kh-*` 가 없어 폴백 `--ko-text-muted` 그대로다.
2. 영향 조사(사용처 전부를 4조합 실측): `KhSheet` label 사용처는 8곳이다. GNB 메뉴 · `KhTabBar` · `ServiceExplorer` · `PickSheet`(place·game·blog·shop 뽑기) · 블로그 `SpaceSwitcher` · place 필터 시트 · `RegionSheet` · 허브 모바일 상세 시트(`PlacePage.tsx:1916` `<KhSheet label={L.attractionLabel}`). 시트 바탕을 덮는 변형은 없다(`dsp-sheet`, `dispenser.css:158` 은 패딩 변수만 둔다). 모두 `--ko-surface-1` 기준으로 잰다.
3. 시트 속성 설명 `.place-attr-caption`(`PlacePage.css:226`)과 속성 건수 `.place-attr-count`(`:213`)를 `--ko-text-muted` → `--ko-text-secondary` 로 바꾼다. 설명은 4.09 → 8.53:1(계산값)이다. 같은 이유로 `.place-card-local` 이 이미 secondary 를 쓴다(`:474-475` 주석).
4. 필터 시트·지역 시트 안의 글자 노드를 전부 훑어 4.5:1 미만이 하나도 없음을 잰다(SR-8.2). 0건 칩 `.place-chip.is-empty`(`:222` `opacity: 0.4`)는 판정에서 빼고 실측값만 보고한다(Q6). 그 밖에 고치지 않은 것이 걸리면 목록으로 보고한다.

### SR-6 상세 행동 줄을 방문 요약 위로 (권고안 B)
1. FE·SSR 모두 첫 화면 순서를 「제목(h1)·찜 → 전화 줄 → **행동 줄** → 방문 요약 → 배지 줄 → 개요 …」로 바꾼다. 스펙 D SR-1.1 의 「FE·SSR 같은 순서」는 그대로 지킨다.
   - FE: `AttractionPage.tsx` 의 `place-detail-actions` 블록(`:413-`)을 `place-visit`(`:396`) 앞, 제목 아래 전화 줄(`:394`) 다음으로 옮긴다.
   - SSR: `AttractionPageRenderer.kt:445-450` 에서 `append(actions(…))`(`:450`)를 전화 줄(`:444`) 다음, `if (typed == null) {`(`:446`) 앞으로 옮긴다.
2. 방문 요약의 칸·값·문구·접기는 바꾸지 않는다. 그래서 `visit-summary-golden.json`(데이터 패리티)은 바이트가 그대로여야 한다. 렌더 골든 HTML 의 diff 는 actions 절 위치뿐이고 `attraction-ko`·`attraction-en`·`attraction-http-image-ko` 세 파일에만 생긴다. 유형별 절이 있는 문서(`event-*`·`stay-*`·`course-ko`)는 방문 요약이 없어 actions 의 상대 위치가 같으므로 바이트가 그대로다.
3. 권고 근거(B 행동 줄 위로 vs A 긴 칸 「더 보기」 접기):
   - 확실성: B 는 길찾기 bottom ≈ 요약 시작 y(220~337) + 행동 줄 높이라 원문 길이와 상관이 없다. A 는 13808(61px)·12933(93px)을 넘기려면 칸마다 3~5줄을 접어야 하고, 영문 제목 두 줄이 만드는 25~30px 는 줄이지 못한다.
   - 정보: A 는 사람이 보러 온 이용시간·쉬는 날 줄을 접는다. 스펙 D 목표(요금·휴무·길찾기 첫 화면)와 부딪친다. B 는 아무것도 숨기지 않는다.
   - 패리티: A 는 FE 전용 접기를 새 패리티 예외로 만들고, 상태(`aria-expanded`)와 테스트가 는다. B 는 두 렌더러의 절 순서만 바꾼다.
   - 대가: 요약이 행동 줄 높이만큼 내려간다. 1줄 약 44px · 줄바꿈 약 90px 는 **잰 값이 아닌 추정**이다. 재측정 최댓값(12933 쉬는 날 533, `screens.md:97`)에 90 을 더하면 623 < 664 지만, SR-8.3 에서 표본별 actions 높이와 요금·쉬는 날·길찾기 셋을 실측해 판정한다. 쉬는 날이 넘치는 표본이 생기면 A 를 후속으로 올리고 보고한다(Q4).
4. 행동 줄 내용·계측(`MAP_LINK`·`DIRECTIONS`(`AttractionPage.tsx:429,451`)·전화)·제목 아래 전화 줄 규칙(스펙 D SR-2.6)은 그대로다.

### SR-7 단위 검증 · 회귀 주입
1. vitest 를 더한다. 기존 단언은 지우거나 약하게 하지 않는다. `mobile` 값을 바꿔 통과시키지 않는다. 파일별 단언 수를 바꾸기 전·후로 기록해 줄지 않았음을 보인다.
   - 영향받는 기존 테스트 7개 파일(넓은 화면 `matches:false` 에서 툴바 칩을 바로 누르거나 필터 바 부재를 단언한다):
     `PlacePage.test.tsx:92-106,163,341-356` · `PlacePage.relax.test.tsx:126,154,167,170,180,255,258,277,281,304`(`:80` matches false) · `PlacePage.langSwitch.test.tsx:62,70-78`(`:40`) · `PlacePage.tracking.test.tsx:241`(`:56`) · `PlaceLanding.test.tsx:217,279`(`:89`) · `PlacePage.loginReturn.test.tsx:165`(`:63` `MOBILE_QUERY` 만 토글) · `PlacePage.layout.test.tsx:320`(넓은 화면 `.place-filter-bar` 없음 단언 → 있음으로 뒤집히는 유일한 기대 변경).
   - 바뀌는 단계: 분류·속성·행사 칩은 「필터」를 여는 한 단계가 더해진다. 지역은 드릴다운 칩 한 번이 「트리거 → 시도 행 → 시군구 행」 세 단계가 되고, 요소도 `.place-chip` 에서 `.place-region-row[aria-current]` 로 바뀐다(`relax.test.tsx:180,255` 「종로구」).
   - 이름 중복: 다이얼로그가 열리면 「전체」·「자연」·「행사」가 필터 한 줄과 다이얼로그에 하나씩 생긴다. 다이얼로그 안 칩은 `within(getByRole('dialog', { name: '필터' }))` 로 찾는다. jsdom 은 aria-modal 뒤 요소 클릭을 막지 않으므로, 다이얼로그 밖 버튼(relax 패널 등)을 누르기 전에 Escape 로 닫는 단계를 넣어 실제 흐름과 맞춘다.
   - 넓은 화면(`mobile=false`): 툴바에 `.place-filter-bar` 가 있다. 속성 칩·행사 상태·오버레이 칩은 「필터」를 열기 전에는 DOM 에 없다. 연 다이얼로그는 `getByRole('dialog', { name: '필터' })` 로 찾고 `kh-sheet--dialog` 를 갖는다. 오버레이 칩을 켜면 다이얼로그가 닫힌다(SR-1.4).
   - 넓은/좁은 짝 단언: 속성 칩·분류 칩(한 줄)·행사 상태·지역 시트 각각 같은 클릭의 두 폭 결과가 같은지에 더해, **절대값을 고정한다**. 예: 속성 칩은 `track` SEARCH payload 의 `trigger: 'attribute'`·`changed`, `searchAttractions` 인자의 `attributes` 값을 기대 리터럴로 단언한다. 두 폭이 같은 `toggleAttribute` 를 타므로 상대 비교만으로는 trigger 주입에 빨강이 나지 않는다.
   - 넓은 화면 지역 트리거 → `RegionSheet` 가 열리고 `kh-sheet--dialog` 다. `origin` 이 있으면 가장 가까운 시도가 **첫 시도 행**(첫 `<li>` 「전체 지역」 다음)이고 그 행에 `.place-region-near` 배지(문구 그대로)가 있으며, 선택은 바뀌지 않는다.
   - `KhSheet`: ① 연 버튼으로 닫은 뒤 `document.activeElement` 가 연 버튼이다 ② 마지막 포커스 요소에서 Tab → 첫 요소 ③ 첫 요소에서 Shift+Tab → 마지막 요소.
   - 링크 카드·주 버튼·언어 토글·시트 라벨 색은 jsdom 이 CSS 를 계산하지 않아 단위로 재지 않는다. SR-8 에서 잰다.
   - 상세: 기존 순서 테스트 `AttractionPage.test.tsx:1296-1319` 에 「`[data-place-section="actions"]` 가 `visit-summary` 보다 앞」 단언을 더하고 `order` 배열의 actions 자리를 옮긴다. 테스트 이름과 `:1317` 주석 「길찾기는 요약 아래로 옮겼다」를 새 순서로 고친다.
2. Kotest 는 `AttractionPageRendererTest:206` 절 순서 기대를 「제목 → 행동 줄 → 방문 요약 → 배지 줄 → …」로 고친다. 렌더 골든을 다시 만들고(`UPDATE_RENDER_GOLDEN=1`) diff 가 SR-6.2 의 세 파일 actions 절 이동뿐인지 본다. `VisitSummaryParityTest` 는 고치지 않고 초록이어야 한다.
3. 회귀 주입은 임시 사본(`git worktree add` 로 만든 별도 트리)에서 하고, 주입마다 빨강과 **빨강을 낸 단언 이름**을 `verifications/regression-injection.md` 에 남긴다. 주입은 컴파일되는 회귀여야 한다 — FE 주입은 사본에서 `npx tsc -b` 통과를 함께 기록한다.
   - 필터 바 `isMobile` 조건 되살리기 → 넓은 화면 필터 바 단언 빨강.
   - 속성 칩 핸들러의 trigger 를 `SearchTrigger` 유니온의 다른 멤버(예 `'category'`)로 → 짝 단언의 절대값 단언 빨강.
   - 넓은 화면에서 시트 내용을 바로 그리게 되돌리기 → 「열기 전 없음」 빨강.
   - `RegionSheet` 정렬 제거 / 배지 제거 → 첫 시도 행 단언 / 배지 단언 빨강.
   - `KhSheet` 포커스 복원 제거 → 복원 단언 빨강.
   - FE·SSR 행동 줄 위치 되돌리기 → 각 순서 단언 빨강.
   - 렌더 골든: SSR actions 위치를 되돌린 렌더러로 `UPDATE_RENDER_GOLDEN` 없이 실행 → 골든 대조 단언 빨강.
   - CSS(SR-3~5)는 단위 게이트가 없다. 바꾼 CSS 줄(`a.place-card` 색 · primary 글자색 · 언어 토글 · `.kh-sheet-label` · `.place-attr-caption`·`-count` · 카드 meta·addr)을 **하나씩** 옛 값으로 되돌린 사본 빌드를 SR-8 스크립트로 잰다. 판정은 「카드 제목 색 ≠ `--ko-text-primary`」 또는 「대비 < 4.5」다. 해당 클래스를 가진 데이터가 화면에 없으면 같은 클래스의 요소를 DOM 에 넣어 잰다(`fe-visual-verification.md:137`).

### SR-8 화면 측정 (CDP, `docs/standards/fe-visual-verification.md`)
1. 허브 1440×900: 첫 `.place-card` 의 `getBoundingClientRect().top` ≤ 320 이어야 한다(못 맞추면 Q5). 국·영, 필터 없음·속성 2개 건 상태를 잰다. 툴바 자식별 top·height 를 함께 적는다. 1024×768 은 참고값으로만 적는다.
   - 상태 재현: 전은 인라인 속성 칩 둘을 차례로 누른다. 후는 「필터」 열기 → 같은 속성 칩 둘 → 다이얼로그 닫기다. 두 쪽 모두 SEARCH 응답이 그려진 뒤 잰다. 후의 y 는 **다이얼로그를 닫은 뒤** 잰다.
   - 레이아웃 이동: `PerformanceObserver('layout-shift')` 합을 배포 전·후 같은 조건에서 3회씩 재고 중앙값을 비교한다. 후가 전보다 크면 안 된다.
   - 1440 다이얼로그(필터·지역)는 `scrollWidth ≤ clientWidth` 다(가로 넘침 없음).
2. 대비(기기 light/dark × 사이트 light/dark 4조합): 허브·RegionPage 카드 제목 색이 `--ko-text-primary` 와 같고 `text-decoration-line: none` 이다. 아래 글자·배경 대비가 모두 ≥ 4.5:1 이다. 대비는 **글자의 계산값 색과, 글자 뒤로 바탕을 칠한 층들(`background-color`·불투명도)을 합성한 색**으로 계산한다.
   - 「검색」·「이 지역 검색」·보기 전환·지역 페이지 허브 링크. primary 는 hover 상태도 잰다.
   - 허브·RegionPage 카드 제목·meta·주소. 카드는 hover·`:focus-visible` 상태도 잰다.
   - 언어 토글 활성·비활성.
   - SR-5.2 의 시트 라벨 8곳.
   - 필터·지역 시트 안 글자 전부(`.is-empty` 는 실측값만 별도 열에, Q6).
   - 참고(판정 밖): 바닥글 `.site-footer-mark`(`Footer.css:42`) 실측값.
3. 상세 390×844(가시 664)와 1280×800(가시 800): 스펙 D 재측정과 같은 표본 10곳(국 77·4811·16151·12933·2961, 영 13863·13808·18083·14580·14367)을 잰다. 요금·쉬는 날·길찾기 bottom 과 **표본별 actions 높이** 표를 전→후 열로 만들고 셋 다 10/10 을 기준으로 둔다. 보조 표본으로 쉬는 날 원문이 긴 순 · 전화 링크가 없는 레코드를 국·영 각 10곳 더 잰다(판정 참고, 넘치면 Q4). 같은 6초 대기·사람 UA 를 쓴다.
4. 측정 전에 운영 응답이 이번 번들인지 확인한다. 이번에 넣은 심볼(예: `kh-sheet--dialog` 가 든 허브 청크, SSR 순서)이 있어야 하고, 없으면 그 측정은 버린다. 브라우저는 `scripts/cdp-chrome.sh` 로 start·측정·stop 을 한 명령으로 돌린다.

### SR-9 문서 동기화
동작이 바뀌는 곳의 설명을 같은 변경에서 고친다.
1. `search/glossary.md:95` 「행동 줄 — 방문 요약(배지 줄) 다음 줄」 → 「제목 아래(전화 줄 다음), 방문 요약 앞 줄」.
2. `AttractionPageRenderer.kt:424-428` KDoc 절 순서 → 「제목 → 행동 줄 → 방문 요약 → 배지 줄 → 개요 …」.
3. `RegionSheet.tsx:6-13` 「(모바일 <900px 전용)」·RegionDrilldown 비교(`:9`,`:12`)와 `:120` 「호출자 계약은 RegionDrilldown 과 동일」 → 두 폭 공통 지역 선택 시트, 계약 설명은 이 파일 기준으로.
4. `PlacePage.tsx` 주석 4곳: `:686-687`(SR-2.2), `:1546`·`:1550`(「좁은 화면」 필터 한 줄), `:1707`(드릴다운), `:1947-1950`(FilterSheetFrame 「넓은 화면은 툴바에 그대로」 — 함수와 함께 지운다).
5. `AttractionPage.test.tsx:1317` 테스트 주석(SR-7.1).
6. `docs/design/k-heritage.html` 견본: `--ocher-text`(라이트 `--kh-ocher-text` 와 같은 값, 다크는 원색)를 정의해 `.label`(`:73`)에 쓴다. 시트 라벨(SR-5.1)과 같은 규칙이고 DESIGN.md:345-348 이 이미 그 규칙이다. `footer .mark`(`:230`)는 바닥글 결정(Q3, 보고만)을 따라 이번엔 그대로 둔다.

## Existing Code to Leverage
`PlacePage.tsx:31(RegionDrilldown import),451(closeFilterSheet useCallback 선례),684-692(시군구 질의),1403-1409(activeFilterConditions·요약 이름),1547-1582(필터 한 줄),1584-1592(RegionSheet),1594-1706(시트 내용),1708-1716(RegionDrilldown),1916(허브 모바일 상세 시트),1951-1971(FilterSheetFrame),2090(PlaceCard)` · `PlacePage.css:77-85(언어 토글),143-157,208-230,486-498(카드 meta·addr),945-(좁은 화면 미디어 쿼리 — 전환 버튼 1008-1012 · 필터 바·시트 본문 1015-1069),1658-1704(드릴다운),1735,1745-1760(지역 트리거)` · `RegionSheet.tsx` · `RegionDrilldown.tsx:55,104(nearestRegion·배지)` · `googleMaps.ts:129(nearestRegion)` · `KhSheet.tsx:26-39`(`kh-sheet--dialog`, `kh-shell.css:122-165,183-186`) · `k-heritage.css:30-33,126(--kh-ocher-text)` · `AttractionPage.tsx:394-466` · `AttractionPageRenderer.kt:424-450,530,601` · 테스트 SR-7.1 의 7개 파일 · `AttractionPage.test.tsx:1296-1319` · `AttractionPageRendererTest.kt:206,874` · `VisitSummaryParityTest.kt` · 렌더 골든 `search/app/src/test/resources/render/golden/` · 측정 스크립트 선례 `place-detail-first-screen/verifications/screens.md`(meas5).

## Out of Scope
- 방문 요약 긴 칸 접기(A)는 SR-6 실측이 넘칠 때의 후속이다(Q4).
- 바닥글 `Footer.css:42` 의 황토 낙관 글자(한지 위 2.89:1, DESIGN.md:347)는 로고타입이라 WCAG 1.4.3 예외이고 전 호스트 공용이라 고치지 않고 실측만 보고한다(Q3). k-heritage 견본 `footer .mark` 도 그대로다.
- 0건 칩 `.is-empty` 를 투명도 대신 muted 색 + 점선 테두리로 바꾸는 안은 후속이다(Q6 (b)).
- glossary 에 속성 칩·지도 오버레이·지역 트리거 용어를 올리는 일은 후속이다(리뷰 D1).
- 넓은 화면에서 분류 칩을 전부 한 줄에 펴는 안(Q1 대안), 허브 프리렌더 구조 변경, 시트 열고 닫기 계측은 하지 않는다.
- 모바일 허브(스펙 E 범위)는 바꾸지 않는다. 예외로 지역 시트의 가까운 시도 정렬·배지(Q2)와 `KhSheet` 포커스 처리(Q7)는 모바일에도 그대로 적용된다.
