# Task Breakdown: 신뢰 페이지 연결 + 상세 SSR ETag (S2-9 · S2-8)

## Overview
Total Task Groups: 5. 정본은 `spec.md`(3라운드 심판 반영). 표준: `docs/standards/test-rules.md`, `docs/standards/fe-visual-verification.md`, `docs/conventions/frontend-design.md`, root `DESIGN.md`(hex 직접 입력 금지).

### Task Group 1: 데이터 출처 상수 · 게이트 · 페이지
**Dependencies:** None
**Phase:** fe
**Required Skills:** React/TS, vitest(node 환경), Markdown 파싱
- [ ] 1.0 Complete group
  - [ ] 1.1 `portal-fe/src/pages/__tests__/dataSources.test.ts` 먼저: 정규화 함수 + `compare(ledgerText, rows)`(SR-1.4 ①~③), 비고 대조 ①②③(상수 값 기준·이름 집합), 상설 부정 셋, 「〃·**·백틱 없음」, 실패 메시지 안내
  - [ ] 1.2 `portal-fe/src/seo/dataSources.mjs` — `DATA_SOURCES`(데이터·원천·라이선스·비고), `DATA_SOURCE_NOTICES`(공공누리 안내·CC BY 4.0 「가공함」·KOGL 각주)
  - [ ] 1.3 `DataSourcesPage.tsx`(PrivacyPage.css 재사용, `.kh-table`), `App.tsx` 라우트, `copy.mjs` `PORTAL_PAGES['/data-sources']` + `copy.test.ts`, `nginx.conf:145` 정규식, sitemap 배열(`prerender-seo.mjs:687`), llms `## 참고` 한 줄
  - [ ] 1.4 `AboutPage.tsx:74-92` 요약 3줄 + 링크, `:13-14` 주석, `:23-24` description 참조, `ContactPage.tsx:71` 링크
  - [ ] 1.5 Verify: `cd portal-fe && npx vitest run src/pages/__tests__/dataSources.test.ts src/seo/__tests__/copy.test.ts && npx tsc -b`
**Acceptance:** 게이트 초록, 상수 행 집합 == 대장 §1, 비고 행 이름 집합 == 대장 「(행마다」 행 ∪ 대기 실시간 측정.

### Task Group 2: 바닥글 신뢰 링크 · 골든 패리티
**Dependencies:** None
**Phase:** fe + search
**Required Skills:** React/TS, vitest, Kotlin/Kotest, GitHub Actions
- [ ] 2.0 Complete group
  - [ ] 2.1 `portal-fe/src/seo/__tests__/footerLinksGolden.test.ts`(골든은 `siteFooter()` 출력에서만, 마지막 넷 == `TRUST_LINKS`), Footer 테스트(기대값은 `TRUST_LINKS` 에서), Kotlin 렌더러 골든 대조 테스트
  - [ ] 2.2 `copy.mjs` `TRUST_LINKS`(`{ path, label, labelEn }`, 방침·사이트 소개·연락처·데이터 출처), `prerender-seo.mjs` `siteFooter` export + 신뢰 링크 렌더(`${PORTAL_ORIGIN}${path}`, `escapeHtml`)
  - [ ] 2.3 런타임 `Footer.tsx:47-55` 를 `TRUST_LINKS` map 으로(상대 경로, `lang==='en'` 이면 `labelEn`)
  - [ ] 2.4 `AttractionPageRenderer.kt` `siteLinks()` 옆 신뢰 링크 함수, 골든 `search/app/src/test/resources/render/footer-links-golden.json`(vitest 가 씀), `UPDATE_RENDER_GOLDEN=1` 로 렌더 골든 9개 재생성(diff 가 `<footer>` 안뿐인지 확인)
  - [ ] 2.5 `ci.yml` JSON-LD 골든 단계 뒤 새 단계: `git diff --exit-code` + `git status --porcelain` 두 줄
  - [ ] 2.6 Verify: `cd portal-fe && npx vitest run src/seo/__tests__/footerLinksGolden.test.ts src/components` && `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*FooterLinks*' --rerun`
**Acceptance:** 골든 10링크(호스트 6 + 신뢰 4), Kotlin 대조 초록, 렌더 골든 diff 는 바닥글만.

### Task Group 3: `/about`·`/data-sources` 프리렌더 본문
**Dependencies:** Task Group 1
**Phase:** fe
**Required Skills:** Node 스크립트, vitest
- [ ] 3.0 Complete group
  - [ ] 3.1 테스트: `renderAboutHtml` 절 제목 넷(기대값은 상수 `heading`), `renderDataSourcesHtml` 행 수 == `DATA_SOURCES.length`, `rows` 에 `<b>&"` 행을 넘겨 이스케이프 확인
  - [ ] 3.2 About 절 상수를 `copy.mjs` 로(`{ heading, paragraphs: (string | { href, label })[][], items? }`), AboutPage 가 같은 상수로 렌더(`dangerouslySetInnerHTML` 금지)
  - [ ] 3.3 `renderPortalPages`(`prerender-seo.mjs:1596`)에 `/about`·`/data-sources` 분기, export 순수 함수 `renderAboutHtml(shell)`·`renderDataSourcesHtml(shell, rows = DATA_SOURCES)`
  - [ ] 3.4 Verify: `cd portal-fe && npx vitest run src/seo && npm run build && ls dist/prerender/data-sources.html dist/prerender/about.html`
**Acceptance:** 빌드 산출 두 파일에 본문·`<!--seo:prerendered-->`·대장 행(`GeoNames`).

### Task Group 4: 상세 SSR ETag/304
**Dependencies:** None
**Phase:** search
**Required Skills:** Kotlin, Spring MVC, MockMvc, Kotest
- [ ] 4.0 Complete group
  - [ ] 4.1 `AttractionPageControllerTest`: SR-4.3 사례 전부(첫 응답 헤더의 ETag 로 304·헤더 유지, `W/`, 다른 값 200, 개요만 바뀐 문서 → 200·새 ETag, 같은 id 국·영 ETag 같음, 언어 다른 두 문서 ETag 다름, 폴백·404 에 정상 ETag 실어도 200·ETag 없음), `Clock.fixed` 네 번째 인자
  - [ ] 4.2 `AttractionPageController.render()` `Page.Found` 분기에만 `.eTag(SHA-256 hex 앞 16자)`. `WebRequest` 파라미터 없음
  - [ ] 4.3 Verify: `./gradlew :search:app:test --tests '*AttractionPageControllerTest' --rerun`
**Acceptance:** 사례 전부 초록, 기존 Cache-Control·X-Render 유지.

### Task Group 5: 회귀 주입 · 통합 확인
**Dependencies:** Task Group 1–4
**Phase:** verify
- [ ] 5.0 Complete group
  - [ ] 5.1 SR-5.4 회귀 주입 12건을 임시 사본에서 한 건씩(컴파일되는 변경), 빨간 줄을 `verifications/regression-injection.md` 에
  - [ ] 5.2 `cd portal-fe && npx tsc -b && npx vitest run` 범위(바뀐 테스트 파일들), `./gradlew :search:app:test --tests '*AttractionPage*' --rerun`
  - [ ] 5.3 배포 뒤(SR-5.5 최신성 → 4링크 → `/data-sources` → SR-4.4 두 벌 측정) 결과를 `verifications/deploy-check.md` 와 계획서 진행 표 S2-8·S2-9 행에

## Execution Order
1. TG1 · TG2 · TG4 (서로 독립)
2. TG3 (TG1 의 `DATA_SOURCES` 필요)
3. TG5
