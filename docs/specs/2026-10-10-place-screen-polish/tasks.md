# Task Breakdown: place 화면 다듬기 — 데스크톱 허브 첫 카드 · 링크·대비 결함 · 상세 행동 줄

Total Task Groups: 5. 정본 `spec.md`(2026-10-11 리뷰 판정 반영, `context/review-verdict.md`). 표준 `docs/standards/test-rules.md`, `docs/standards/fe-visual-verification.md`, `docs/conventions/frontend-design.md`, DESIGN.md §12 + `docs/design/k-heritage.html`(hex 금지).
사용자 판단 여섯 건은 권고 기본값으로 진행한다(`context/open-questions.yml` `answered-default`). 뒤집히면 해당 SR 과 이 문서를 먼저 고친다.
usage(5h·7d 최댓값) ≥ 85% 이면 아래 Verify 의 범위를 더 좁힌다. 전체 스위트는 돌리지 않는다.

### Task Group 1: 배포 전 기준선 측정
**Dependencies:** None · **Phase:** 측정(코드 변경 없음)
- [ ] 1.1 측정 스크립트를 스크래치패드에 만든다. 판정 근거는 대상 페이지가 낸 DOM 사각형·픽셀이다. 운영 1440×900(국·영, 필터 없음·속성 2개 — SR-8.1 재현 절차)의 첫 카드 top 과 툴바 자식별 top·height, 데스크톱 layout-shift 합(3회 중앙값)을 잰다
- [ ] 1.2 같은 스크립트로 4조합 대비 기준선을 잰다(SR-8.2 의 「계산값 글자색 + 바탕 층 합성」 정의). 허브·RegionPage 카드 제목 색·밑줄·meta·주소(hover·focus 포함), primary 다섯 곳(hover 포함), 언어 토글 활성·비활성, 시트 라벨 8곳, 필터·지역 시트 글자 전부(`.is-empty` 는 별도 열), 참고로 바닥글 낙관
- [ ] 1.3 상세 표본 10곳 × 390·1280 의 요금·쉬는 날·길찾기 bottom 과 actions 높이가 스펙 D 재측정 값과 같은지 본다(드리프트 확인). 보조 표본(쉬는 날 긴 순 · 전화 링크 없음, 국·영 각 10곳)의 전 값도 잰다
- [ ] 1.4 Verify: `scripts/cdp-chrome.sh list` 에 이 세션 크롬 0 → 결과를 `verifications/pre-measure.md` 에 쓴다

### Task Group 2: 데스크톱 허브 필터 한 줄 + 지역 시트 + 시트 포커스 (SR-1 · SR-2 · SR-9 일부)
**Dependencies:** TG1 · **Phase:** portal-fe
- [ ] 2.1 테스트(SR-7.1 허브 항목). 고치기 전에 7개 파일의 단언 수를 기록한다.
  - 새 단언: 넓은 화면 필터 바 존재·열기 전 시트 내용 없음·다이얼로그 class, 오버레이 칩을 켜면 다이얼로그 닫힘, 속성·분류·행사·지역의 넓은/좁은 짝 단언 + 절대값 고정(`trigger:'attribute'`·`changed`·`attributes` 리터럴), `RegionSheet` origin → 첫 시도 행 + `.place-region-near` 배지 + 선택 불변, `KhSheet` 포커스 복원·Tab 순환·Shift+Tab 순환
  - 기존 파일 갱신: `PlacePage.test.tsx` · `PlacePage.relax.test.tsx` · `PlacePage.langSwitch.test.tsx` · `PlacePage.tracking.test.tsx` · `PlaceLanding.test.tsx` · `PlacePage.loginReturn.test.tsx` · `PlacePage.layout.test.tsx`(`:320` 기대 뒤집기). 칩은 「필터」를 여는 단계를 더하고 `within(dialog)` 로 찾는다. 지역은 트리거 → 시도 행 → 시군구 행 세 단계, 요소는 `.place-region-row[aria-current]`. 다이얼로그 밖 버튼 전에는 Escape 로 닫는다. 질의·SEARCH 단언은 그대로 두고 단언 수를 전·후로 기록한다
- [ ] 2.2 구현
  - 필터 바 `isMobile` 조건 제거, `FilterSheetFrame` 인라인 후 함수 삭제(넓은 화면은 `kh-sheet--dialog`), 넓은 화면 오버레이 켜면 다이얼로그 닫기
  - `RegionSheet` 의 `className`·`origin` prop, `nearestRegion` import(사본 금지) + `place-region-near` 배지, `closeRegionSheet` useCallback, 시군구 질의 조건 유지 + `:686-687` 주석 수정
  - 허브에서 `RegionDrilldown` 제거(파일·import 삭제). CSS 는 `.place-region`·`-sep`·`.place-chip.active .place-region-count` 만 지우고 crumbs·list·count·hint·near 는 남긴다
  - 필터 한 줄·시트 본문 CSS(SR-1.5 목록)를 미디어 쿼리 밖으로, 넓은 화면 트리거 `flex: 0 1 16rem`
  - `KhSheet` 열 때 activeElement 기억 → 정리에서 복원, 패널 안 Tab 순환
  - 주석 동기화: `RegionSheet.tsx:6-13,120`, `PlacePage.tsx:686-687,1546,1550,1707,1947-1950`
- [ ] 2.3 Verify: `cd portal-fe && npx vitest run src/pages/place src/components/shell && npx tsc -b` → 7개 파일 단언 수 전·후 표

### Task Group 3: CSS 결함 (SR-3 · SR-4 · SR-5 · SR-9 견본)
**Dependencies:** TG2(같은 CSS 파일) · **Phase:** portal-fe + docs
- [ ] 3.1 테스트: 단위 게이트가 없음을 기록한다(jsdom 은 CSS 를 계산하지 않는다). 대신 TG1 스크립트를 로컬 프리뷰에 돌려 고치기 전 빨강(`#0000ee`·2.03·2.79·4.09·카드 meta·addr·언어 토글)을 먼저 확인한다
- [ ] 3.2 구현: `a.place-card` 색·밑줄·`:focus-visible`, `.place-card-meta` → `--kh-ocher-text` 폴백, `.place-card-addr` → secondary, `.place-btn.primary` 글자색 + 전환 버튼 중복 블록·주석 삭제, `.place-lang-btn.active` → `--kh-hanji` 폴백, `.place-lang-btn` → secondary, `.kh-sheet-label` → `--kh-ocher-text` 폴백, `.place-attr-caption`·`.place-attr-count` → secondary. `.is-empty` 는 건드리지 않는다(Q6). `k-heritage.html` 견본에 `--ocher-text` 정의 후 `.label` 에 적용(`footer .mark` 는 그대로)
- [ ] 3.3 Verify: `cd portal-fe && npx vitest run src/pages/place src/components && npx tsc -b && npm run build` → 로컬 프리뷰에 TG1 스크립트를 돌려 4조합이 모두 ≥ 4.5:1 인지 본다(프리뷰 번들에 새 CSS 가 있는지 먼저 확인)

### Task Group 4: 상세 행동 줄 위로 (SR-6 · SR-9 일부)
**Dependencies:** None · **Phase:** portal-fe + search
- [ ] 4.1 테스트: `AttractionPage.test.tsx:1296-1319` 에 actions → visit-summary 단언을 더하고 `order` 배열·테스트 이름·`:1317` 주석을 새 순서로. `AttractionPageRendererTest:206` 절 순서 기대 수정
- [ ] 4.2 구현: FE `place-detail-actions` 블록을 전화 줄(`:394`) 다음·`place-visit` 앞으로, SSR `append(actions(…))` 를 `Renderer.kt:444` 전화 줄 다음·`if (typed == null)` 앞으로. 계측(`MAP_LINK`·`DIRECTIONS`·전화)은 그대로. KDoc `:424-428`·`search/glossary.md:95` 동기화. 렌더 골든 재생성(`UPDATE_RENDER_GOLDEN=1`) — diff 가 `attraction-ko`·`attraction-en`·`attraction-http-image-ko` 세 파일의 actions 이동뿐이고 event·stay·course 는 바이트 불변인지 확인
- [ ] 4.3 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx src/pages/place/__tests__/visitSummaryGolden.test.ts` + `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*VisitSummaryParityTest' --rerun` + `git diff --exit-code -- search/app/src/test/resources/render/visit-summary-golden.json` + `git diff --stat -- search/app/src/test/resources/render/golden/` 가 세 파일뿐

### Task Group 5: 회귀 주입 · 배포 · CDP 측정
**Dependencies:** TG1–4
- [ ] 5.1 회귀 주입(SR-7.3)을 임시 워크트리에서 한다. 주입마다 빨강과 빨강을 낸 단언 이름을 남기고, 대조군은 초록이어야 한다. trigger 주입은 `SearchTrigger` 유니온의 다른 멤버로 하고 사본 `npx tsc -b` 통과를 기록한다. CSS 는 바꾼 줄을 하나씩 되돌린 사본 빌드를 프리뷰로 재서 「색 ≠ `--ko-text-primary`」·「대비 < 4.5」 빨강을 본다(데이터가 없으면 같은 클래스 요소를 주입해 잰다) → `verifications/regression-injection.md`
- [ ] 5.2 커밋 직전 `git diff --cached` 에 핵심 라인(필터 바 조건 제거·dialog class·KhSheet 포커스 복원·near 배지·primary color·lang 토글·ocher-text·actions 순서)이 있는지 본다 → 푸시 → 이미지·배포 확인
- [ ] 5.3 운영 번들 최신 확인(SR-8.4) 뒤 SR-8.1~8.3 을 측정한다(허브 1440 첫 카드 y·layout-shift 3회 중앙값 전후·다이얼로그 가로 넘침, 4조합 대비(hover·focus·RegionPage 카드 포함), 상세 10곳 × 2폭 + actions 높이 + 보조 표본) → `verifications/screens.md`
- [ ] 5.4 Verify: `scripts/cdp-chrome.sh clean` 뒤 `scripts/cdp-chrome.sh list` 에 이 세션 크롬 0, 판정 표에 y ≤ 320 · 대비 ≥ 4.5 · 길찾기 10/10 결과를 적는다. 미충족이면 실측 값과 이유를 적는다. `.is-empty`·바닥글 실측값은 판정 밖 열로 보고한다
