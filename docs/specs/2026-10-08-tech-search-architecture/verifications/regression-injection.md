# 회귀 주입 13건 (SR-6.3) · 통합 검증 (SR-6.2)

2026-10-08 KST, TG4 커밋(8b755467d) 위 작업 트리. 한 건씩 「적용 → 명령(빨강) → `git checkout -- <파일>` → `git diff --quiet -- <파일>` → 렌더 → 같은 명령(초록)」. 명령은 `portal-fe/` 에서 돌렸다. 드리프트 명령은 `npx vitest run src/content/__tests__/searchArchitecture.drift.test.ts`(아래 「드리프트」).

## 회귀 주입

| # | 주입 | 명령 | 빨간불 한 줄 | 되돌림 확인 |
|---|---|---|---|---|
| ① | md 첫 sequence 펜스에 `rect rgb(200,200,200)` 1줄 | `node scripts/render-content.mjs` | `[render-content] ① 그림 경고 2건 — 펜스 1: rect 블록은 아직 지원하지 않는다 / 펜스 1: SVG 를 만들지 못했다` (exit 1) | diff 0 · 재실행 exit 0 「그림 5장, heading 9개」 |
| ② | 5펜스 중 마지막(통합 검색) 하나의 `%% caption:` 접두 삭제 | `node scripts/render-content.mjs` | `[render-content] ① 그림 경고 1건 — 펜스 4: 캡션이 없다.` (exit 1) | diff 0 · exit 0 「그림 5장」 |
| ③ | `application.yml` `sight-weight: 3.0` → `3.5` | 드리프트 | `AssertionError: 관광 분류 가중치: 문서 값과 코드 값이 다르다: expected '3.0' to be '3.5'` (1 failed) | diff 0 · 11 passed |
| ④ | `deployment.yaml` `SEARCH_ATTRACTION_HYBRID_ENABLED` `"true"` → `"false"` | 드리프트 | `AssertionError: 하이브리드 켜짐: 문서 값과 코드 값이 다르다: expected 'true' to be 'false'` | diff 0 · 11 passed |
| ⑤ | `deployment.yaml` 모델 ref `@31de22b` → `@31de22c` | 드리프트 | `AssertionError: 임베딩 모델 ref: 문서 값과 코드 값이 다르다: expected 'microsoft/harrier-oss-v1-270m@31de22b…' to be 'microsoft/harrier-oss-v1-270m@31de22c…'` | diff 0 · 11 passed |
| ⑥ | md §4 `RRF rank_constant` 값 `60` → `61` | 드리프트 | `AssertionError: RRF rank_constant: 문서 값과 코드 값이 다르다: expected '61' to be '60'` | diff 0 · 11 passed |
| ⑦ | md §4 키 `RRF rank_constant` → `RRF 순위 상수` | 드리프트 | `AssertionError: §4 표에서 RRF rank_constant 행을 못 찾음: expected undefined to be defined` | diff 0 · 11 passed |
| ⑧ | `copy.mjs` `PORTAL_PAGES['/tech/search']` 항목 제거 | `npx vitest run src/seo/__tests__/copy.test.ts src/content/__tests__/prerenderTechSearch.test.ts` | `FAIL copy.test.ts > 프리렌더 대상 경로가 모두 정의돼 있다` · `prerenderTechSearch.test.ts: TypeError: Cannot read properties of undefined (reading 'title') ❯ renderTechSearchHtml prerender-seo.mjs:1658` (Failed Tests 2 + 파일 1) | diff 0 · 35 passed |
| ⑨ | `App.tsx` `<Route path="/tech/search">` 줄 제거 | `npx vitest run src/__tests__/routes.test.tsx` | `AssertionError: expected '페이지를 찾을 수 없습니다' to be '검색 아키텍처 — 관광지 검색과 통합 검색'` (1 failed) | diff 0 · 2 passed |
| ⑩ | 생성 JSON 삭제 | `npx tsc -b` | `src/__tests__/routes.test.tsx(9,23): error TS2307: Cannot find module '../pages/tech/generated/search-architecture.json'` (exit 2, TS2307 3건) | 렌더로 재생성 · tsc exit 0 |
| ⑪ | md 첫 펜스 `%% caption:` 접두 삭제 후 Dockerfile 렌더 단계 재현 | `GIT_SHA=inject11 node scripts/render-content.mjs && echo REACHED_TSC` | `[render-content] ① 그림 경고 1건 — 펜스 1: 캡션이 없다.` (exit 1, `REACHED_TSC` 미출력 — tsc 로 안 간다) | diff 0 · exit 0 + `REACHED_TSC` |
| ⑫ | 생성 JSON 삭제 → 원본 훅, 다시 삭제 → 렌더를 뺀 훅 사본(사본의 `render-content` 0회) | `CLAUDE_PROJECT_DIR="$PWD" HNS_FILES=portal-fe/src/App.tsx .claude/hooks/hns/compile-changed.sh` / 같은 접두로 사본 | 원본: exit 0, 「그림 5장, heading 9개」를 쓰고 통과 · 사본: `src/__tests__/routes.test.tsx(9,23): error TS2307: Cannot find module '../pages/tech/generated/search-architecture.json'` (exit 2) | 훅 파일 diff 0(사본은 스크래치패드) · 렌더로 재생성 |
| ⑬ | `deployment.yaml` env 에 `SEARCH_ATTRACTION_CLICK_BOOST_ENABLED: "true"` 추가 | 드리프트 | `AssertionError: clickBoost 켜짐: 문서 값과 코드 값이 다르다: expected 'false' to be 'true'` | diff 0 · 11 passed |

13/13 빨강 → 초록. 끝난 뒤 `git status --short -- search k8s .claude` 빈 출력.

참고: ⑨ 의 `Error: AggregateError` 줄은 초록 실행에도 1회 나온다(jsdom 네트워크 소음, 판정과 무관).

## 통합 (SR-6.2)

```
$ cd portal-fe && node scripts/render-content.mjs && npx vitest run src/content src/pages/tech src/seo src/__tests__/routes.test.tsx src/pages/atlas && npx tsc -b && npm run build
[render-content] …/portal-fe/src/pages/tech/generated/search-architecture.json — 그림 5장, heading 9개
 Test Files  14 passed (14)
      Tests  133 passed (133)
✓ built in 905ms
[seo] 프리렌더 184개 페이지 · 게임 82종 (https://api.1989v.com)
EXIT=0

dist/prerender/tech/search.html: role="img" 5 (md 펜스 5) · <h1 1
$ git check-ignore portal-fe/src/pages/tech/generated/search-architecture.json
portal-fe/src/pages/tech/generated/search-architecture.json
```
