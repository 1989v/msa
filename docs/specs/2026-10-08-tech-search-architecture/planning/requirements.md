# 요구사항 — `/tech/search` 검색 아키텍처·시퀀스 현황 페이지

## 목표
1. 공개 페이지 `https://1989v.com/tech/search` 에서 **관광지 검색**(place 허브·상세·지역)과 **통합 검색**(ADR-0090)의 아키텍처 다이어그램·시퀀스 다이어그램·현재 쓰는 검색 기법/요소 표를 한 화면에서 읽을 수 있다.
2. 원본은 레포 안 마크다운 하나이고, 다이어그램은 mermaid 펜스에서 **빌드타임에 SVG 로 렌더**된다(런타임 mermaid 없음). 프리렌더에도 같은 HTML 이 실려 크롤러·llms.txt 가 본다.
3. 검색 기법이 바뀌면 이 문서가 함께 바뀌도록 **게이트**가 있다 — 「현재 값」을 코드 상수와 대조하는 테스트(드리프트 게이트) + doc-index 연결 + 체크리스트 한 줄.

## 브라운필드 지도 (탐색 에이전트 2026-10-08, 경로는 레포 루트 기준)
- **제약 ①** portal-fe Docker context = `portal-fe/`(`portal-fe/Dockerfile`, `.github/workflows/images.yml:322`), 재빌드 트리거도 `portal-fe/*` 뿐(`:169`). → 원본 마크다운은 `portal-fe/src/content/` 에 둔다. `docs/` 에 두려면 사본 + 동기화 게이트(선례 `code-dictionary/feature/src/test/kotlin/.../AtlasGraphExportSpec.kt:10-35`)가 필요해 한 파일 원칙(KISS)에 어긋난다.
- **라우팅** `portal-fe/src/App.tsx:226-233` — `/tech`·`/tech/d/:domain`·`/tech/c/:conceptId`(ConceptAtlasPage), `/tech/:category`(TechGlossaryPage). 정적 세그먼트 점수(10 > 3)로 순서와 무관하게 이긴다. `techCategoryFromSlug('search')` 는 null(`copy.mjs:893`).
- **nginx** `portal-fe/nginx.conf:153` 이 `/tech/<name>` 을 `prerender/tech/<name>.html` 로 먼저 찾는다 → `prerender/tech/search.html` 만 내보내면 된다. 서브도메인은 apex 로 301.
- **면·토큰** ConceptAtlasPage 는 `useHeritageSurface()`(`ConceptAtlasPage.tsx:25`, `hooks/useHeritageSurface.ts:109-131` cleanup 이 dark 복귀)와 `--kh-*`(`src/styles/k-heritage.css`)를 쓴다. dark 고정·`--ko-*` 는 TechGlossaryPage 뿐. 메모 `reference_tech_page_no_kh_tokens` 는 반만 맞다.
- **프리렌더** `portal-fe/scripts/prerender-seo.mjs`: `renderPortalPages`(`:1584-1616`)가 `PORTAL_PAGES` 를 돌며 `prerender${path}.html` 을 낸다(본문 분기 `:1607`). sitemap 배열 `:675`, `portalLlmsTxt` `:1676-1697`(`/tech` 줄 `:1689`), robots 전부 허용. `copy.mjs` `PORTAL_PAGES` `:961-`(`/tech` `:967`), `portalTitle`·`portalUrl`·`ogCardUrl`·`breadcrumbJsonLd`. 테스트 게이트 `src/seo/__tests__/copy.test.ts:165` 가 `Object.keys(PORTAL_PAGES)` 를 정확 배열로 단언. 선례 `prerenderPlace.test.ts`·`prerenderDeal.test.ts`. 빌드 체인 `package.json:9` = `tsc -b && vite build && node scripts/prerender-seo.mjs && node scripts/strip-html-comments.mjs`.
- **fencesvg** npm `^0.11.2`(소스 `1989v/fencesvg`). API `inlineDiagrams(markdown, opts)`, `renderDiagram(source, {accent?, idPrefix?}) → {svg, caption, warnings}`; Node 에선 DOM 이 없어 `EDITORIAL` 로 떨어지고 색은 `var(--fs-*)`. 출력 계약: `<style>`·`<use>` 없음, 빈 줄 없음, `role="img"`. 유일한 사용처는 블로그 런타임(`src/pages/blog/markdown.ts:24-31`, DOMPurify 가 DOM 필요라 Node 에선 못 씀). `.fs-figure`·`.fs-source` CSS `Blog.css:1087-1170`. 작업 트리는 `npm ci` 실설치 **0.11.2**(락과 동일). 간선 라벨은 파이프 표기로 제한. `marked ^18` 의존성 있음.
- **규칙** `docs/conventions/blog-diagram.md`: 펜스 5종, `%% caption:` 필수, sequence `rect` 불가, LR 5단 넘으면 TB, 최대 80rem, 빈 줄 금지, `<style>`·`<use>`·script·foreignObject 금지, 색은 currentColor + 토큰 하나.
- **원천 문서** ADR-0090(D1~D8: 사이드카 `search-embed`, `query_vectors` 캐시, `hybrid[function_score(BM25), knn]` RRF, 모델 harrier-oss-v1-270m 640차원, unified 7 type(`SearchUnifiedService.ALL_TYPES`; ADR 의 `region` 은 코드에 없음), 미적중 P99 500ms, QU 는 BM25 레그만) · ADR-0065 · ADR-0071 · ADR-0103(SSR·`attraction_similar`·clickBoost 스위치 꺼짐) · ADR-0104 · ADR-0105(nearby 묶음·엣지 캐시 s-maxage 1h) · `search/CLAUDE.md:44-96` · `docs/conventions/latency-budget.md:64-65`(적중 150ms 실측 74.6 / 미적중 500ms 실측 354) · `scripts/search-eval/README.md`(판정 세트·3구성 nDCG@10·CronJob 05:30 KST·−0.03 실패) · `k8s/base/search/deployment.yaml:33-34` MODEL_REF · `:36-37` HYBRID_ENABLED.
- **코드 요소** `search/batch/src/main/resources/opensearch/attractions-index.json`(nori_user 사전 200줄 인라인·동의어 10·jamo edge_ngram·knn 640 cosinesimil hnsw m16 ef_c128 sq) · `unified-index.json`(nori+english, knn 없음) · `UnifiedSearchController.kt:12` → `SearchUnifiedService` → `QueryIntent.analyze` → 관광지는 `SearchAttractionUseCase`, 나머지는 `UnifiedSearchAdapter.kt:23-81`(multi_match title^3 tags^2 + ln1p(popularity)) · 묶음 순서 `:101-114` · `SearchAttractionService.kt:91-110,172-193` · `AttractionSearchAdapter.kt`(KEYWORD_FIELDS `:76`, hybrid `:628-631`, vectorLeg filtered HNSW + rescore `:690-700`, `paginationDepth` `:713-721`, 분류 가중치 3.0/0.35 `AttractionRankingProperties.kt:18-22` + clickBoost `:749`, 오타 교정 `:360-376`, 자동완성 접두×6·형태소×1·자모×0.3 `:447-`) · `HybridSearchPipelineInitializer.kt:55-67`(rrf rank_constant 60) · `QueryNormalizer`·`Jamo`·`CategoryLexiconAdapter` · `NearbyAttractionsService.kt:8-38`(4종) · FE `placeApi.ts:404,433,467,521`, `searchApi.ts:79` · 게이트웨이 `GatewayRouteConfig.kt:369-373`(`/api/search/**` 공개, `gateway/README.md:25` 의 「JWT 필요」는 코드와 불일치 — 보고만).
- **doc-index** `docs/standards/doc-index-tracking.md`: CI 차단은 대기, portal-fe 는 `source_roots` 밖. 연결은 문서 머리 `<!-- source: ... -->` 또는 `docs/doc-index.json` `manual_links`. 이 워크트리는 `ai` 서브모듈 미초기화라 `doc_map.py` 를 못 돌린다(메인 체크아웃에서).
- **선례** 아틀라스(정적 JSON + 게이트), `ontologyMermaid` gradle 태스크, `PrivacyPage.tsx`(TSX 본문·`.kh-table`), `ServiceCatalogPage.tsx` 는 라우트 없는 고아(보고만).

## 범위
### R1 원본 문서 `portal-fe/src/content/search-architecture.md`
- 머리: 제목, 「기준 커밋/갱신일」 줄, `<!-- source: ... -->` 인용 주석(search·place·k8s·ADR 경로).
- §1 아키텍처(flowchart, `%% caption:`): 브라우저 → nginx/엣지(ADR-0105) → gateway `/api/search/**` → search:app → OpenSearch(`attractions`·`unified`·`regions`·`query_vectors`) · `search-embed` 사이드카 · Redis(미적중 ZSET) · place(SSOT, `attraction_embedding`) → search:batch 재색인(alias swap) · 평가 CronJob.
- §2 관광지 검색 시퀀스 셋(sequenceDiagram): ① 허브 검색(QueryIntent → BM25 레그 + 벡터 레그(캐시 적중/미적중 → 사이드카) → RRF → 분류 가중치·clickBoost → 응답) ② 자동완성(접두·형태소·자모 + 오타 교정) ③ 상세 주변 4종 묶음 + 엣지 캐시.
- §3 통합 검색 시퀀스: 타입 의도 → 관광지는 ②의 하이브리드, 나머지 type 은 unified BM25 + 인기도 → 묶음 순서 규칙 → 부분 실패 격리.
- §4 기법/요소 표: 항목 · 현재 값 · 켜짐 · 근거(file:line) · ADR — 분석기/사전/동의어, 자모 자동완성, 오타 교정, 하이브리드(BM25+HNSW, RRF 60), 모델·차원·인코더, 질의 벡터 캐시, 쿼리 언더스탠딩, 분류 가중치, clickBoost(꺼짐), 페이지네이션 깊이, 엣지 캐시, 지연 예산, 판정 세트·nDCG·일일 평가, 색인 방식(배치·alias), 계측(ADR-0095, S1-12b).
- §5 갱신 규칙 한 단락: 검색 ADR·`search/`·`k8s/base/search/` 를 바꾸면 이 문서의 해당 행을 같이 고친다. 드리프트 게이트가 몇 값을 잡는다.
### R2 빌드타임 렌더 `portal-fe/scripts/render-content.mjs`
- 입력 md → `inlineDiagrams`(fencesvg, Node) → `marked.parse` → 출력 `portal-fe/src/generated/search-architecture.json`(`{ html, headings[], updated, sourceHash }`). fencesvg `warnings` 가 있으면 **빌드 실패**. 출력 HTML 에 `<script`·`<style`·`<use`·`foreignObject` 가 있으면 실패(신뢰 원본이지만 계약 검사).
- `package.json` build 체인의 `vite build` 앞에 넣는다(프리렌더도 같은 JSON 을 읽는다). 생성물은 커밋하지 않는다(Q1 닫힘). 렌더 스텝은 package.json(build·dev)·Dockerfile·ci.yml 세 곳 같은 순서(사용자 결정 ④).
### R3 페이지 `portal-fe/src/pages/tech/SearchArchitecturePage.tsx`
- lazy 라우트 `/tech/search`(`/tech/:category` 앞). `useHeritageSurface()`, `useSeo(PORTAL_PAGES['/tech/search'])`, GNB `pageLabel="IT"` + NAV(아틀라스·홈·이 페이지). 생성 HTML 을 그대로 그린다(빌드 산출물, 신뢰). 좌측/상단 목차(headings), 표는 `.kh-table`, 그림은 `.fs-figure` 규칙 + `--fs-*` 를 `--kh-*` 로 매핑, 폭 넘치는 그림은 가로 스크롤(블로그 breakout 선례). 모바일 16px 거터, 가로 넘침 없음. 라이트/다크 둘 다.
### R4 SEO·프리렌더
- `PORTAL_PAGES['/tech/search']` = `{ title: portalTitle('검색 아키텍처'), description }` + `copy.test.ts:165` 키 배열. 프리렌더 본문 분기(`/tech/search` → 생성 HTML 전체), sitemap 한 줄, llms.txt 한 줄, JSON-LD `TechArticle` + `BreadcrumbList`.
### R5 게이트·문서 연결
- `portal-fe/src/content/__tests__/searchArchitecture.drift.test.ts`: 표의 「현재 값」 9개를 코드에서 읽어 대조 — spec SR-5.1 이 정본(가중치는 `application.yml:72-73`, 모델 ref 는 매니페스트 둘).
- `docs/doc-index.json` `manual_links` 한 항목, 루트 `CLAUDE.md` Frontend 표 한 줄 + Key Conventions 한 줄, `docs/architecture/` 에 짧은 포인터 문서(`search-overview.md` → 원본 위치·갱신 규칙 3줄).
### R6 검증
- vitest: render 스크립트 단위(펜스 → `role="img"` SVG, warnings → throw, 금지 태그 → throw), drift 게이트, `copy.test`, 프리렌더 테스트(`/tech/search` 출력에 h1·table·svg·canonical), 페이지 렌더(목차·HTML 주입·Surface 훅 호출). `tsc -b`, `npm run build`(생성물 → 프리렌더 파일 존재). 배포 뒤 CDP: 라이트/다크 × 데스크톱/모바일 4조합 `scrollWidth <= innerWidth`, SVG 개수 ≥ 4, 표 ≥ 1, 크롤러 UA 응답(프리렌더 HTML)에 table·svg 포함, Lighthouse 1회.

## 범위 밖
- 코드사전·블로그·혜택·랭킹 검색 면(사용자 결정 ③), 상품 검색(Thompson 리랭커 등)은 표에 「범위 밖」 한 줄만.
- 런타임 mermaid, 편집 UI, DB 원본, 다이어그램 자동 생성(코드 스캔).
- `gateway/README.md:25` 불일치·`ServiceCatalogPage` 고아 정리(보고만).
- 메모 `reference_tech_page_no_kh_tokens` 정정은 세션이 따로.

## 제약
- 최소 수정: App.tsx 라우트 2줄, copy.mjs 1항목, prerender 3곳 + 본문 분기, package.json build·dev 2줄, **Dockerfile 1줄(+ARG 위치), ci.yml 1스텝, ConceptAtlasPage NAV 1줄**, 새 파일(md·스크립트·페이지·css·테스트). 기존 /tech 화면 변경 0.
- 다이어그램 표기는 fencesvg 0.10 과 0.11 둘 다 읽는 것만(간선 라벨 `-->|x|`). 빈 줄 금지·caption 필수.
- 토큰은 `k-heritage.css` 만, hex 금지(DESIGN.md).
- 이미지는 portal-fe 하나만 다시 굽는다.

## 재사용
`inlineDiagrams`·`renderDiagram`(fencesvg) · `marked` · prerender `compose`·`shellBody`·`metaTags`·`escapeHtml`·`emit` · copy `portalTitle`·`portalUrl`·`ogCardUrl`·`breadcrumbJsonLd` · `useHeritageSurface` · `useSeo` · `.kh-table`·`.kh-section-head` · `Blog.css` `.fs-figure` 규칙 · 테스트 선례 `prerenderPlace.test.ts`·`copy.test.ts`.

## 실패 의미 · 관측
- 렌더 실패(warnings·금지 태그)는 빌드 실패 — 조용히 빈 페이지가 나가지 않는다. 드리프트 실패는 CI 실패 — 코드만 바꾸고 문서를 안 고친 PR 이 막힌다.
- 관측: 배포 뒤 `curl -A Googlebot https://1989v.com/tech/search` 에 `<table` 과 `role="img"` 가 있는지, CDP 4조합 캡처.
