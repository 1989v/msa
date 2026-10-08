# Task Breakdown: `/tech/search` 검색 아키텍처·시퀀스 현황 페이지

## Overview
Total Task Groups: 5

- 작업 트리: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl` (branch `place-stage2`, origin/main `06550592a` 위). 메인 트리 금지. `portal-fe/node_modules` 는 `npm ci` 실설치(fencesvg 0.11.2, marked 18.0.9).
- 정본: `spec.md`(3라운드 SHIP). 판정 기록 `context/review-verdict-round{1,2,3}.md`, 실측 `context/probe-2026-10-08.md`.
- 표준: `docs/standards/test-rules.md`, `docs/conventions/blog-diagram.md`, `docs/conventions/blog-writing.md`(용어), `docs/standards/fe-visual-verification.md`, DESIGN.md §12·`styles/k-heritage.css`(hex 금지), 루트 CLAUDE.md(최소 수정·「검사는 대상의 산출물」·회귀 주입·하네스 변경 원장).
- vitest 는 범위 지정만. 렌더·드리프트·프리렌더 테스트는 `// @vitest-environment node`. 새 체크아웃에서는 vitest·tsc 전에 `node scripts/render-content.mjs`.
- 구현자는 커밋하지 않는다 — 메인이 검증 재실행 후 경로 지정 커밋.

### Task Group 1: 렌더 스크립트 + 빌드 배선 (SR-2, SR-6.1 렌더 테스트)
**Dependencies:** None
**Phase:** render
**Required Skills:** Node ESM, marked 18 renderer, fencesvg, shell/YAML
- [x] 1.0 Complete 렌더·배선
  - [x] 1.1 `portal-fe/src/content/__tests__/renderContent.test.ts`(node 환경, `../../../scripts/render-content.mjs` import) — SR-6.1 의 렌더 케이스 전부: 펜스 3종 md → `svg[role=img]` 3·`figcaption` 3·SVG 안 빈 줄 0·`language-mermaid` 0·`<th scope="col"` > 0·`<table class="kh-table"`·출력 `id` 중복 0·heading id + headings[]·§4 행 `<tr id>`·한글 slug 링크 href 가 날 한글로 대응 id 와 일치 / throw: sequence `rect` 1줄 · caption 삭제 · 없는 앵커 `[x](#nope)` · `[x](javascript:alert(1))` · `<base href>` · `<div>\n<img src="/x" onerror="x">\n</div>` · `<div>\n<svg/onload=x>\n</div>` · 금칙 패턴(예 `foo.svc.cluster.local`)
  - [x] 1.2 `portal-fe/scripts/render-content.mjs`: export `renderContent(markdown, { idPrefix, gitSha }) → { html, headings, warnings }`(SR-2.1 — 펜스 i 마다 `renderDiagram(src, { idPrefix: `${idPrefix}d${i}` })`, `<figure class="fs-figure">…<figcaption>`, `marked.use({ renderer: { heading, table, tablerow, tablecell, link } })` ①~⑤, 주석 제거), 실패 조건 SR-2.3 ①~⑨(throw 메시지에 원인), 직접 실행 가드(`import.meta.url === pathToFileURL(argv[1])`) 아래 main: md 읽기 → `src/pages/tech/generated/search-architecture.json`(`{ html, headings, updated, sourceHash, gitSha }`) 쓰기, 실패 시 exit 1. idPrefix 는 `ts-`.
  - [x] 1.3 1.1 테스트용 최소 md 픽스처는 테스트 안 문자열로(원본 md 는 TG2). 임시 원본 `portal-fe/src/content/search-architecture.md` 를 펜스 1개짜리 뼈대로 만들어 main 이 도는지 확인(TG2 가 본문을 채운다).
  - [x] 1.4 배선 4곳(SR-2.4): `package.json` build·dev 두 줄 · `portal-fe/Dockerfile` — `ARG GIT_SHA="dev"` 를 `:41` RUN 앞으로 올리고 그 RUN 머리에 `node scripts/render-content.mjs &&`(:54 쪽 ARG 사용처는 그대로 동작해야 한다) · `.github/workflows/ci.yml` frontend-gate Type check 앞 `Render content` 스텝 · `.claude/hooks/hns/compile-changed.sh:26` 서브셸에 `node scripts/render-content.mjs &&`. `portal-fe/.gitignore` 에 `/src/pages/tech/generated/search-architecture.json`. `docs/standards/agent-behavior.md:31` 문단 끝 한 문장, `docs/changelog/harness-changelog.md` 한 줄(5열 형식).
  - [x] 1.5 Verify: `cd portal-fe && node scripts/render-content.mjs && npx vitest run src/content/__tests__/renderContent.test.ts && npx tsc -b; git check-ignore src/pages/tech/generated/search-architecture.json`
**Acceptance Criteria:**
- 렌더 테스트 전부 통과(구현 전 빨강을 본 뒤), `tsc -b` 0, check-ignore 가 경로를 출력, `Dockerfile` 의 `ARG GIT_SHA` 가 `:41` RUN 앞에 하나만.

### Task Group 2: 원본 문서 + 드리프트 게이트 (SR-1, SR-5)
**Dependencies:** Task Group 1
**Phase:** content
**Required Skills:** 검색 코드 읽기(Kotlin·OpenSearch 매핑·k8s yaml), mermaid(fencesvg 5종 제한), 기술 글쓰기
- [x] 2.0 Complete 문서·게이트
  - [x] 2.1 `portal-fe/src/content/__tests__/searchArchitecture.drift.test.ts`(node): SR-5.1 9값(값마다 존재 단언 후 `toBe`, clickBoost·하이브리드는 env 우선 규칙, 모델 ref 는 매니페스트 둘), SR-5.2 구조 게이트(머리 `<!-- source -->` 경로·§4 근거 열 파일 존재), 머리 주석에 「CI 체크아웃에서만 돈다」.
  - [x] 2.2 `portal-fe/src/content/search-architecture.md` 본문(SR-1.1~1.7): 머리·요약 불릿 5~6(값 없음, §4 행 앵커 `#slug`)·§1 flowchart·§2 sequence 3·§3 sequence 1·§4 표(셀 규칙: 게이트 값은 행당 백틱 토큰 하나, 상태 열은 k8s env 기준)·§5 갱신 규칙. **모든 값과 흐름은 코드에서 직접 읽는다** — spec SR-1.3·1.4·1.5 의 교정(가중치는 키워드 레그 안·상업 의도면 BM25 그대로·벡터 레그 필터에 검색어 포함·통합 검색 대상 타입 결정·관광지 외 6종은 잔여 검색어·평가 KST 07:30)을 그대로 반영. 레인은 프로세스·저장소만, `rect` 금지, 간선 라벨 파이프 표기, 모든 펜스 `%% caption:`. 용어는 「쿼리 벡터 캐시(`query_vectors`)」, 과제 번호 금지, 공개 판단 기준(SR-1.7).
  - [x] 2.3 Verify: `cd portal-fe && node scripts/render-content.mjs && npx vitest run src/content/__tests__/searchArchitecture.drift.test.ts src/content/__tests__/renderContent.test.ts` + 생성 JSON 의 SVG 수 == 펜스 수(5)를 한 줄로 출력.
**Acceptance Criteria:**
- 드리프트 9값 초록, 렌더 성공(그림 5장), 금칙 패턴 0.

### Task Group 3: 페이지·라우트·SEO 빌더 (SR-3, SR-4.1)
**Dependencies:** Task Group 1
**Phase:** page
**Required Skills:** React, react-router 7, vitest+RTL, CSS 토큰
- [x] 3.0 Complete 페이지
  - [x] 3.1 테스트: `src/pages/tech/__tests__/SearchArchitecturePage.test.tsx`(목차 링크 수 == headings, `useHeritageSurface` 호출, 요약 블록, `data-source-hash`, 「빌드 커밋 · 문서 갱신」 줄) · `src/__tests__/routes.test.tsx`(`history.pushState('/tech/search')` → `render(<App />)` → `findByRole('heading',{level:1})` 이 이 페이지, 용어집 아님) · 아틀라스 NAV 링크 1개(기존 아틀라스 테스트 파일이 있으면 거기, 없으면 routes.test 에서 `/tech` 렌더) · `copy.test.ts:165` 배열에 `'/tech'` 바로 뒤 `'/tech/search'`.
  - [x] 3.2 `copy.mjs`: `PORTAL_PAGES['/tech/search']`(`'/tech'` 바로 뒤) + export `techArticleJsonLd(updated)`.
  - [x] 3.3 `src/pages/tech/SearchArchitecturePage.tsx`+`.css`: SR-3.2~3.5(useSeo 는 canonical + jsonLd, `type` 없음), 생성 JSON import, `.fs-figure` 규칙과 `--fs-*` → `--kh-*` 매핑, figure 안 가로 스크롤, 16px 거터. `App.tsx` lazy + 라우트, `ConceptAtlasPage.tsx` NAV 한 줄.
  - [x] 3.4 Verify: `cd portal-fe && node scripts/render-content.mjs && npx vitest run src/pages/tech src/__tests__/routes.test.tsx src/seo/__tests__/copy.test.ts src/pages/atlas && npx tsc -b && npx eslint src/pages/tech src/App.tsx src/pages/atlas/ConceptAtlasPage.tsx src/seo/copy.mjs`
**Acceptance Criteria:**
- 테스트·tsc·eslint 0, 기존 /tech 변경은 NAV 한 줄뿐.

### Task Group 4: 프리렌더·sitemap·llms (SR-4.2~4.4)
**Dependencies:** Task Group 2, Task Group 3
**Phase:** seo
**Required Skills:** Node 스크립트, 기존 prerender 구조
- [ ] 4.0 Complete 프리렌더
  - [ ] 4.1 `src/content/__tests__/prerenderTechSearch.test.ts`(node): 입력 = 실제 md 를 `renderContent` 한 반환값. 단언 SR-4.4 전부 + `<title>` 에 「검색 아키텍처」 + 「JSON 없이(`undefined`·`{ html: '' }`) → throw」.
  - [ ] 4.2 `prerender-seo.mjs`: export `renderTechSearchHtml(shell, generated)`, `renderPortalPages(shell, concepts, { searchArchitecture })` 반복 안 `path === '/tech/search'` 분기(같은 파일 두 번 쓰지 않음), `main()` 에서 JSON 읽기 + 형식 검사 실패 시 `PartialSeoFailure`, sitemap 배열·`portalLlmsTxt` 각 한 줄. JSON-LD 는 copy.mjs 의 같은 빌더.
  - [ ] 4.3 Verify: `cd portal-fe && node scripts/render-content.mjs && npx vitest run src/content/__tests__ src/seo/__tests__ && npx tsc -b && npm run build && ls dist/prerender/tech/search.html && grep -o 'role="img"' dist/prerender/tech/search.html | wc -l`
**Acceptance Criteria:**
- 기존 seo 테스트 포함 전부 초록, `dist/prerender/tech/search.html` 의 `role="img"` 수 == 5.

### Task Group 5: 문서 연결·회귀 주입·통합 검증 (SR-5.3, SR-6.2·6.3)
**Dependencies:** Task Group 1~4
**Phase:** verify
**Required Skills:** git, vitest, shell
- [ ] 5.0 Complete 검증
  - [ ] 5.1 `docs/doc-index.json` `manual_links` 한 항목, `docs/architecture/search-overview.md` 3줄, 루트 `CLAUDE.md` Frontend 표·Key Conventions 각 한 줄.
  - [ ] 5.2 회귀 주입 13건(SR-6.3, ⑫ 는 `CLAUDE_PROJECT_DIR="$PWD"` 접두와 순서 「지움 → 원본(exit 0) → 지움 → render 뺀 사본(TS2307)」) — 각각 빨간불 한 줄 → `git checkout --` 되돌림 → 초록. `verifications/regression-injection.md` 표.
  - [ ] 5.3 통합: `cd portal-fe && node scripts/render-content.mjs && npx vitest run src/content src/pages/tech src/seo src/__tests__/routes.test.tsx src/pages/atlas && npx tsc -b && npm run build`, `git status --short` 가 의도한 파일만.
**Acceptance Criteria:**
- 13/13 빨간불 → 초록, 통합 명령 0.

## Execution Order
1. TG1 (렌더·배선)
2. TG2 (문서·드리프트) ‖ TG3 (페이지) — 파일 겹침 없음
3. TG4 (프리렌더)
4. TG5 (문서 연결·주입·통합)
