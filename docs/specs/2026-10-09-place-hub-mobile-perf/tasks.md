# Task Breakdown: place 모바일 허브 변형 + 성능 (S2-3a · S2-3b · S2-5)

Total Task Groups: 5. 정본 `spec.md`(개정 3). 표준 `docs/standards/test-rules.md`, `docs/standards/fe-visual-verification.md`, DESIGN.md.

### Task Group 1: 사진 주소 https (SR-4.2)
**Dependencies:** None · **Phase:** portal-fe + search
- [x] 1.1 테스트: `secureImageUrl.test.ts`(규칙 표), 렌더 단위(허브·상세(갤러리)·지역·뽑기 시트·통합 검색) http 픽스처 → `img[src^="http://tong."]`·`[data-src^=…]`·backgroundImage 0 + https 전제 단언, Kotlin `AttractionSeoTextTest`·렌더러 http 사례(og:image·secure_url·JSON-LD image), `secure-image-golden.json` 패리티, `attractionJsonLdGolden` http 사례
- [x] 1.2 `copy.mjs` `secureImageUrl` + `placeView.ts` 재노출, Kotlin `AttractionSeoText.secureImageUrl`, 적용 지점 전부(SR-4.2 목록)
- [x] 1.3 CI 단계 「Secure image golden fixture is current」(ci.yml footer 단계 뒤)
- [x] 1.4 Verify: `cd portal-fe && npx vitest run src/seo src/pages/place src/pages/search src/components && npx tsc -b` + `./gradlew :search:domain:test --tests '*AttractionSeoTextTest' --rerun` + `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*AttractionJsonLdParityTest' --tests '*SecureImage*' --rerun`

### Task Group 2: 모바일 두 변형 + 필터 압축 (SR-1 · SR-2 · SR-3)
**Dependencies:** TG1 · **Phase:** portal-fe
- [x] 2.1 테스트 `PlacePage.layout.test.tsx` + `placeView.test.ts` 증보(SR-5.1 목록 전부, matchMedia 목 교체, 기존 모바일 테스트는 시트 열고 같은 단언)
- [x] 2.2 `parseMobileLayout`·`activeFilterCount`(placeView.ts), `DEFAULT_MOBILE_LAYOUT='listFirst'`, mapRequested·지도 effect·결과 패널·하단 버튼·진입 fit(rAF·pickingRegion)·대안 흐름, 필터 한 줄·KhSheet 시트(onClose useCallback), mapSplit 38vh
- [x] 2.3 Verify: `cd portal-fe && npx vitest run src/pages/place && npx tsc -b`

### Task Group 3: 성능 소작업 (SR-4.1 · 4.3 · 4.4)
**Dependencies:** TG2 · **Phase:** portal-fe + search
- [x] 3.1 테스트: eager 2·fetchpriority·width/height(사진 있는 카드 픽스처), `<main>` 페이지당 하나(FE 셋 + SSR), 프리렌더 preconnect 가 허브 두 파일에만
- [x] 3.2 구현: 카드 img 속성, `renderPlaceHubs` head preconnect, `<main>` 래퍼(FE `.place-body`, SSR 본문 + shellBody 사본 주석), CLS 대책은 before 측정의 layout-shifts 노드 보고 결정(없으면 생략·보고)
- [x] 3.3 Verify: vitest 범위 + `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --rerun` + 렌더 골든 재생성 diff 확인

### Task Group 4: 기준선 측정 (배포 전)
**Dependencies:** None
- [x] 4.1 Lighthouse before 15회(`scratchpad/lh-stage2.sh before`) → `evidence/stage2/lh/before/`
- [x] 4.2 1440×900 첫 카드 y·390×844 폴드 안 카드 수(현재 운영)

### Task Group 5: 회귀 주입 · 배포 · 전후 비교
**Dependencies:** TG1–4
- [x] 5.1 회귀 주입(SR-5.3, 임시 워크트리) → `verifications/regression-injection.md`
- [x] 5.2 다른 프리렌더 산출물 diff(SR-5.5)
- [x] 5.3 배포 → Lighthouse after 15회 → 판정 표 → `verifications/perf-before-after.md`
- [ ] 5.4 CDP 두 변형 × 390·1440 캡처, 폴드 표, 4조합 대비, 지도 왕복 bounds → `verifications/screens.md`
