# Task Breakdown: place 허브 결과 카드 · 모바일 상세 하단 행동 바

Total Task Groups: 6. 정본 `spec.md`, 브라운필드 근거 `planning/requirements.md`. 표준 `docs/standards/test-rules.md`, `docs/standards/fe-visual-verification.md`(4조합 · `scripts/cdp-chrome.sh` start·측정·stop 한 명령), `docs/conventions/frontend-design.md`, DESIGN.md §12 + `docs/design/k-heritage.html`(hex 금지).
사용자 판단 스무 건(Q1~Q20 — Q9~Q20 은 리뷰 심판 `context/review-verdict.md` 반영분)은 권고 기본값으로 진행한다(`context/open-questions.yml` 전부 `answered-default`). 용어: 카드에 붙는 것은 「카드 상태 배지」다(상세의 「배지 줄」과 다르다, Q10). 뒤집히면 해당 SR 과 이 문서를 먼저 고친다.
usage(5h·7d 최댓값) ≥ 85% 이면 아래 Verify 의 범위를 더 좁힌다. 전체 스위트는 돌리지 않는다. OCI 는 `ssh msa-oci` 로만 접근한다(로컬 kubectl 금지).

### Task Group 1: 배포 전 기준선 측정
**Dependencies:** None · **Phase:** 측정(코드 변경 없음)
- [ ] 1.1 측정 스크립트를 스크래치패드에 만든다(판정 근거 = 대상 페이지가 낸 DOM 사각형·계산 스타일·`layout-shift` 항목). 고정 질의 둘(필터 없음 + 지역 하나)을 정하고, 운영 허브 390×844·1440×900 × ko·en 첫 10장의 **관광지 id** · 카드 높이(중앙·최대)·첫 카드 y·페이지 `scrollWidth`, 로드 CLS 3회 중앙값을 적는다. 같은 id 8장의 배포 전 캡처(390 ko·en)를 `verifications/screens/before/` 에 남긴다(SR-8.2 변화량 비교용)
- [ ] 1.2 상세 표본 10곳(직전 스펙 `2026-10-10-place-screen-polish` 의 id + 전화 없는 곳 1 이상) × 390×844: 행동 줄 bottom·길찾기 폴드 여부·`.place-detail-first` bottom(이동 줄이 놓일 y)·로드+끝까지 스크롤 CLS 3회 중앙값
- [ ] 1.3 색인 채움률: `ssh msa-oci` 로 OpenSearch `attractions` 별칭에 lang 별 `_count`(전체 / `exists regionTypeCount AND exists sigunguName` — 응답 `region()` 이 `regionTypeCount` 조건이라(`AttractionSearchDocument.kt:192-200`) 이것이 화면 기대치다 / 배지 축별: `closureState` ∈ {WEEKLY, ALWAYS_OPEN} · `attrAdmission=FREE` · `petPolicy` ∈ {ALLOWED, PARTIAL} · `barrierFree` ∈ {WHEELCHAIR, ELEVATOR, RESTROOM} · `attrParking=YES` / `savedCount` 있음)를 잰다. 축별 채움률은 배지 순서(Q14)가 상한 3에서 무엇을 자르는지 보는 근거다
- [ ] 1.4 Verify: `scripts/cdp-chrome.sh list` 에 이 세션 크롬 0 → 결과를 `verifications/pre-measure.md` 에 쓴다

### Task Group 2: 검색 응답 `sigunguName` (SR-1)
**Dependencies:** None · **Phase:** search
- [ ] 2.1 테스트: `SearchAttractionServiceTest` 에 「목록 결과는 region 이 null 이어도 sigunguName 이 있다」·「단건은 sigunguName 과 region.sigunguName 이 같다」·「region 이 없는 문서는 null」 세 단언
- [ ] 2.2 구현: `AttractionSearchResult.sigunguName` + KDoc, `toResult` 에 `sigunguName = region?.sigunguName`(summarize 분기 밖). 루트 `build.gradle.kts` `searchReadRequired["attractions"]` 에 `sigunguName` + 주석 「목록 카드 지역 라벨이 읽는다」(SR-1.5). 색인 매핑·렌더러는 손대지 않는다
- [ ] 2.3 Verify: `./gradlew :search:app:test --tests '*SearchAttractionServiceTest' --tests '*AttractionPageRendererTest' --tests '*VisitSummaryParityTest' --rerun` + `./gradlew verifySearchIndexContract` + `git diff --exit-code -- search/app/src/test/resources/render/`

### Task Group 3: 인기 집계 제외 섹션 + 이벤트 유니온 (SR-6.3·6.4)
**Dependencies:** None · **Phase:** analytics + portal-fe
- [ ] 3.1 테스트: `ClickHouseAttractionPopularityAdapterTest` 의 `NOT IN (...)` 리터럴 다섯 곳 — SQL 단언 `:60·72·77·79` 와 기대 집합 `:86` — 을 `MAP_LINK·FAVORITE·DIRECTIONS·SHARE·PHONE·SECTION_JUMP` 로 먼저 바꿔 빨강을 본다
- [ ] 3.2 구현: `AggregateAttractionPopularityUseCase.POST_SELECTION_SECTIONS` 에 둘 추가, `events.ts` `SectionId` 에 `PHONE`·`SECTION_JUMP`(주석: 선택 뒤 행동, 집계 제외, 노출 없음) + `DIRECTIONS`·`SHARE` 주석에 「위치는 payload `source`(`'action_bar'`), view 당 첫 위치」 한 줄, `PHONE`·`SECTION_JUMP` 주석에 「view 당 첫 건 — 지표는 이동을 쓴 view 비율」. ADR-0095 「`clicks`·`unique_clickers` 의 뜻」에 「전화·절 이동은 2026-10-11 추가. 거부 목록이라 상세 섹션마다 반복된다 — 허용 목록 전환 검토(spec Q9)」
- [ ] 3.3 Verify: `./gradlew :analytics:app:test --tests '*ClickHouseAttractionPopularityAdapterTest'` + `cd portal-fe && npx tsc -b`

### Task Group 4: 허브 카드 (SR-2 · SR-3 · SR-6.1)
**Dependencies:** TG2(타입), TG3(유니온) · **Phase:** portal-fe
- [ ] 4.1 테스트
  - 새 `src/pages/place/__tests__/cardFacts.test.ts`: 카드 상태 배지 표의 행마다(ko·en, `closedToday` 「오늘은 정기휴무일」+ 접근성 이름의 규칙 기준), KST 경계(`process.env.TZ='Asia/Seoul'` 고정 + `vi.setSystemTime`, `today` 인자로 — UTC 15:00 의 다음 날), 요일 없는 WEEKLY·NO_WEEKLY·UNKNOWN·주차 NO·입장 PAID 미표시, 최대 3·순서(휴무→무료→반려→무장애→주차), 무장애: `PROMOTION`·`LACTATION_ROOM` 만 → 무배지 · `ELEVATOR` 하나 → 「무장애 시설」, 행사 무배지, 지역 라벨 셋(시군구+시도 / 시도만 / 세종 / 없음), 거리 `0.4567`→「457m」·`0.9996`→「1.0km」, 찜 2 → null · 3 → 표시
  - `PlacePage.test.tsx:334` 개요 단언 갱신 + 카드에 `.place-card-addr` 없음 · `.place-card-badges` 항목 · meta 줄 지역 라벨 · 찜 수는 보이는 「찜 n」이 `aria-hidden` 이고 시각 숨김 문구가 있음 · `PlaceCard` 가 `todayKst()` 값을 넘김(호출부 단언)
  - `PlacePage.tracking.test.tsx`: 카드 노출·클릭 `payload.badges` = `cardFacts` 가 낸 code 배열(빈 배열 포함), 기존 키·`source` 단언 불변
  - 고치기 전 이 파일들의 단언 수를 기록한다
- [ ] 4.2 구현: `placeAttributes.ts` `cardFacts`(무장애는 같은 파일 `BARRIER_FREE_CHIPS` 코드로 판정, 사본 금지 · 거리는 `distanceLabel(Math.round(km*1000))`) + en 세 글자 요일 표, `PlaceCard` 본문 재배치(주소 제거·개요 1줄·카드 상태 배지 `<ul>`·meta 칸·찜 수 시각 숨김 문구), 렌더마다 `todayKst()`, 노출·클릭 payload. CSS `.place-card-meta` 칸 줄임 규칙, `.place-card-badges`(`line-height` 고정 + `max-height: calc()` 한 줄 = 24px, 9999px, 토큰만), `.place-card-overview` clamp 1. `.place-card-addr` 규칙은 남긴다(RegionPage)
- [ ] 4.3 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/cardFacts.test.ts src/pages/place/__tests__/PlacePage src/pages/place/__tests__/PlaceLanding.test.tsx && npx tsc -b`(경로 접두 `PlacePage` 로 `PlacePage*.test.tsx` 전부) → 단언 수 전·후 표

### Task Group 5: 모바일 상세 하단 행동 바 + 절 이동 줄 (SR-4 · SR-5 · SR-6.2·6.3)
**Dependencies:** TG3 · **Phase:** portal-fe + docs
- [ ] 5.1 테스트(새 `AttractionPage.actionBar.test.tsx` — 기존 파일은 `FavoriteButton` 대역·`track: vi.fn()` 이라 찜·대기열을 단언할 수 없다. 진짜 `tracker`·`FavoriteButton`, `wishlistApi` 만 대역, 대기열은 `pendingForTest()`. IntersectionObserver 목(`rootBounds` 포함), matchMedia 대역은 `(max-width: 640px)`·`min-width` 를 폭 변수로 계산)
  - ≤640: IO 콜백 전 `.place-action-bar` 가 `hidden`, 행동 줄 `isIntersecting:false, bottom < rootBounds.top` 이면 표시, `isIntersecting:true` 로 돌아오면 다시 hidden. IO 생성 인자 `rootMargin` 위쪽이 머리띠 높이만큼 음수. >640: 바·이동 줄 없음. IO 없음: 바 없음. 허브(`PlacePage`) 렌더에는 `.place-action-bar` 가 없다(상세 전용 `:has` 범위의 전제)
  - 칸: 전화 href 있으면 넷·없으면 셋, 길찾기 href = 행동 줄 길찾기 href, 공유는 `navigator.share` 유무로 `share` 「공유」/`copy` 「링크 복사」 버튼
  - 계측(실제 트래커 대기열): 바 길찾기 → `DIRECTIONS` + `source:'action_bar'`, 바 공유 → `SHARE` + `channel`·`source`, 전화(행동 줄·바) → `PHONE`, 이동 링크 → `SECTION_JUMP` + `target`. 같은 view 의 행동 줄 길찾기 뒤 바 길찾기는 한 건, 두 번째 이동 링크(다른 target)도 대기열에 없다(중복 규칙 고정)
  - 찜: 바 별을 누르면 제목 옆 별 `aria-pressed` 도 바뀐다
  - 이동 줄: 있는 절만 링크(「방문 정보」는 `div.place-info-tabs` 대상, `aria-label` 있음), 둘 미만이면 없음, 클릭 뒤 `document.activeElement` 가 그 절이고 `location.hash` 가 비어 있다(`replaceState` 없이), 대상이 DOM 에 없으면 클릭이 아무것도 하지 않는다
- [ ] 5.2 구현: 바 컴포넌트(상세 파일 안 또는 `AttractionActionBar.tsx`), 행동 줄 ref + IO(`rootMargin` 머리띠), 전화 링크 `PHONE` 계측, 절 `id`·`tabIndex`·`aria-label`, 이동 줄 + 머리띠 ResizeObserver(`--place-header-h`), 이동 클릭 `scrollIntoView` + `focus({preventScroll:true})`. CSS: ≤640 바·`.place-action-bar[hidden]{display:none}`(전환 없음)·`html:has(.place-action-bar)` 범위의 하단 여백·`scroll-padding-bottom`·`.favorite-resume-notice` bottom 올림·바 범위 `.share-panel__btn`·`.favorite-btn` 덮어쓰기(칸 전체·판 위 색·포커스 링)·이동 줄 sticky·`scroll-margin-top`. 토큰만. 공용 `SharePanel`·`FavoriteButton` 은 고치지 않는다
- [ ] 5.3 문서: `docs/design/k-heritage.html` 모바일 앱 셸 견본에 「상세 하단 행동 바(기와 먹빛 판)」와 「카드 상태 배지」 견본, DESIGN.md §12 컴포넌트 표 한 줄(이름은 「카드 상태 배지」, CSS 클래스 `.place-card-badges` 는 그대로). `search/glossary.md` 에 「카드 상태 배지」 항목 — 「허브 결과 카드의 확인된 상태 배지(최대 3). 상세 「배지 줄」과 다르다 · 부정값·UNKNOWN 미표시」
- [ ] 5.4 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx src/pages/place/__tests__/AttractionPage.actionBar.test.tsx src/pages/place/__tests__/visitSummaryGolden.test.ts src/components/share src/components/favorite && npx tsc -b && npm run build`

### Task Group 6: 회귀 주입 · 배포 · 운영 측정 (SR-8)
**Dependencies:** TG1–5
- [ ] 6.1 로컬 프리뷰(빌드 산출물에 `place-card-badges`·`place-action-bar`·`place-jump` 가 있는지 먼저 확인)에 TG1 스크립트를 돌려 4조합 대비·카드 높이·바 표시·겹침·포커스 가림을 미리 본다
- [ ] 6.2 회귀 주입 R1–R10 + R2b·R4b·R7b·R9b + 대조군(spec SR-8.9)을 임시 워크트리에서 한다. 단위 주입은 빨강 단언 이름을, CSS 주입은 사본 빌드를 프리뷰로 잰 값을 남긴다 → `verifications/regression-injection.md`
- [ ] 6.3 커밋 직전 `git diff --cached` 에 핵심 라인(`sigunguName = region?.sigunguName` 이 summarize 밖 · `searchReadRequired` 의 `sigunguName` · `POST_SELECTION_SECTIONS` 여섯 · `cardFacts` · `BARRIER_FREE_CHIPS` 판정 · `.place-card-badges` · 바 IO 조건 · `source: 'action_bar'` · `scroll-padding-bottom` · `--place-header-h`)이 있는지 본다 → 푸시 → search·analytics·portal-fe 이미지와 배포를 확인한다(analytics 가 다음 03:30 KST 집계 전에 떠 있는지. 늦었으면 배포 뒤 `reaggregateRecent(n)` 으로 그 날짜를 다시 집계)
- [ ] 6.4 운영 번들 최신 확인(SR-8.8) 뒤 SR-8.2~8.7 을 측정한다. 카드는 TG1 의 같은 id 로 비교하고 같은 8장의 배포 후 캡처를 `verifications/screens/after/` 에 두어 전·후를 나란히 놓는다(ko·en 변화량 표 — en 배지 카드 3/10 미만이면 사용자에게 묻는다). 원장 확인은 사람 UA 세션 + `ssh msa-oci` ClickHouse 조회, 집계 제외는 03:30 뒤 `attraction_popularity_daily.clicks` 와 원장 재집계 대조(집계 전이면 「대기」) → `verifications/screens.md`
- [ ] 6.5 Verify: `scripts/cdp-chrome.sh clean` 뒤 `scripts/cdp-chrome.sh list` 에 이 세션 크롬 0. 판정 표에 카드 높이 중앙값(≤ 기준선·≤120px) · 카드 상태 배지 한 줄 · 변화량(ko·en 배지·지역·찜 카드 수) · 390 지역 라벨 ≥ 48px · 대비 ≥ 4.5 · 바 아이콘·포커스 링 ≥ 3 · 바 첫 화면 숨김 10/10 · 표시 10/10 · 길찾기 폴드 10/10 · CLS ≤ 기준선+0.01 · 원장 행 존재 · `sigunguName` 채움률을 적는다. 미충족은 실측 값과 이유를 적는다
