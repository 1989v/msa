# 검증 상태

## TG1 렌더·배선 — PASS (2026-10-08 KST, 메인 재실행)
```
$ rm generated JSON && node scripts/render-content.mjs   → 그림 1장, heading 2개, RENDER=0
$ npx vitest run src/content/__tests__/renderContent.test.ts → Tests 13 passed (13)
$ npx tsc -b → TSC=0
$ git check-ignore src/pages/tech/generated/search-architecture.json → 경로 출력
$ grep -c 'ARG GIT_SHA' Dockerfile → 1 (렌더 RUN 바로 앞)
```
- 배선 4곳 diff 확인(package.json build·dev · Dockerfile · ci.yml Render content · compile-changed.sh). 구현자가 빨간불(모듈 없음 · link 오버라이드 제거 · 경고 검사 끔)을 본 뒤 초록.

## TG3 페이지·라우트·SEO 빌더 — PASS (메인 재실행)
```
$ node scripts/render-content.mjs && npx vitest run src/pages/tech src/__tests__/routes.test.tsx src/seo/__tests__/copy.test.ts src/pages/atlas
 Test Files  4 passed (4)   Tests  44 passed (44)
$ npx tsc -b → TSC=0 · eslint(수정 파일) → 0 · CSS hex 0건
```
- 구현자가 빨간불 4 failed(라우트가 용어집으로 감·NAV 없음·copy 배열·빌더 없음)를 본 뒤 초록. 요약은 생성 html 을 첫 `<h2` 에서 나눠 `<section aria-label="요약">` + 목차와 한 격자(64rem 이상).

## TG2 원본 문서·드리프트 게이트 — PASS (메인 재실행, TG3 테스트와 함께)
```
$ node scripts/render-content.mjs → 그림 5장, heading 9개, RENDER=0
$ npx vitest run src/content src/pages/tech src/__tests__/routes.test.tsx src/seo/__tests__/copy.test.ts src/pages/atlas
 Test Files  6 passed (6)   Tests  68 passed (68)
$ npx tsc -b → TSC=0 · 생성 html 의 h1 1개 · 금칙 패턴 grep 0
```
- 구현자 회귀 주입 7건(md 값·키 이름·yml 가중치·HYBRID·모델 ref 해시·CLICK_BOOST env·근거 경로) 전부 빨강 → 되돌림. 그림 고유 폭 412~615px(390 비율 ≤ 1.6).
