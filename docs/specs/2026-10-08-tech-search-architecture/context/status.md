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
