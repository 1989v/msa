<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs, portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/RegionPage.tsx -->
# 관광 검색 보완 — 한국어·영어

Google·네이버 웹게임 목표를 유지하며 관광 Google 영어 검색을 별도 목표로 추가했다. 공통 본문 보완은 양쪽 검색엔진에 적용되지만 색인과 순위는 각각 확인해야 한다.

- [통합 유입 계획](../../plans/2026-10-12-search-growth-ko-en.md)
- [유지보수 범위·확정 본문](spec.md)
- [구현·검증](implementation.md)
- [직접 검색·콘솔 현황](search-audit.md)
- [기존 CSV의 언어·국가 집계](gsc-language-baseline.json)
- [결정](context/key-decisions.md) · [진행](context/progress.md)

본문 변경 구현은 커밋 `b21ebdfcb0505163ea8f2afd140db9363d05acba`에 있다. 운영 배포는 아직 하지 않았다. 새 본문이 초기 HTML·런타임에 나오도록 준비한 것이며 색인·순위 개선 완료를 뜻하지 않는다.
