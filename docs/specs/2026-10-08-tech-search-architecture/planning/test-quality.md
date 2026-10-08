# 테스트 전략 — `/tech/search`

| 수준 | 시나리오 | critical |
|---|---|---|
| unit (vitest, Node) | `render-content.mjs` 의 순수 함수: 펜스 3종(flowchart·sequence·table 섞인 md) → html 에 `role="img"` SVG 가 펜스 수만큼, caption `<figcaption>`, 빈 줄 없음; fencesvg `warnings` 1건 주입 → throw; `<script>` 포함 md → throw; headings 추출 | ✔ |
| unit (vitest) | **드리프트 게이트**: md §4 표의 값(RRF 60 · 가중치 3.0/0.35 · 모델 ref · knn 640/m16/ef128 · 사전 줄 수)을 코드 파일에서 파싱한 값과 `toBe` — 코드 쪽 값을 임시로 바꾸면 빨강 | ✔ |
| unit (vitest) | `copy.test.ts` 키 배열에 `/tech/search`; 프리렌더 `renderPortalPages` 출력 `prerender/tech/search.html` 에 h1·`<table`·`role="img"`·canonical `https://1989v.com/tech/search`·JSON-LD TechArticle | ✔ |
| component (vitest+RTL) | `SearchArchitecturePage` 가 생성 JSON 의 html 을 그리고 목차 링크 수 == headings 수, `useHeritageSurface` 호출(스파이) | |
| component | `tsc -b` · `npm run build`(생성물·프리렌더 파일 존재) | ✔ |
| e2e (배포 후) | CDP 4조합(라이트/다크 × 1280/390) `document.documentElement.scrollWidth <= window.innerWidth`, `svg[role=img]` ≥ 4, `table` ≥ 1, 크롤러 UA curl 응답에 `<table`·`role="img"`; 캡처 4장 | ✔ |

회귀 주입(각 1회): 펜스 하나 깨뜨리기(warnings) → 빌드 실패 · 코드 상수 바꾸기 → 드리프트 빨강 · `PORTAL_PAGES` 항목 제거 → copy·프리렌더 테스트 빨강 · 라우트 제거 → 페이지 테스트 빨강.

## 1라운드 심판 반영 (2026-10-08) — spec SR-6 이 정본
- 렌더: 실제 fencesvg 로 깨진 펜스(sequence `rect`·caption 삭제) → throw, svg 수 == 펜스 수, `language-mermaid` 0, `<th scope="col"`, `javascript:` href·`<base>`·금칙 패턴 → throw. 테스트는 `src/content/__tests__/` + `@vitest-environment node`.
- 드리프트: 9값, 양쪽 파서 꺼낸 직후 존재 단언.
- 프리렌더: `renderTechSearchHtml` 순수 함수 출력, `#root` 안 `<script` 없음, 생성 JSON 없음 → throw. `routes.test.tsx`. 아틀라스 NAV 링크.
- e2e: `data-source-hash` 대조 후에만 측정, 기기×사이트 4 × 뷰포트 2 = 8회, 그림별 390 폭 비율.
- 회귀 주입 11건(spec SR-6.3).
