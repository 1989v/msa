<!-- source: portal-fe/src/seo/copy.mjs, portal-fe/scripts/prerender-seo.mjs, portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/RegionPage.tsx -->
# 관광 검색 보완 — 한국어·영어

Google·네이버 웹게임 목표를 유지하며 관광 Google 영어 검색을 별도 목표로 추가했다. 공통 본문 보완은 양쪽 검색엔진에 적용되지만 색인과 순위는 각각 확인해야 한다.

- [통합 유입 계획](../../plans/2026-10-12-search-growth-ko-en.md)
- [유지보수 범위·확정 본문](spec.md)
- [구현·검증](implementation.md)
- [운영 배포·Google 후속 요청](rollout.md)
- [직접 검색·콘솔 현황](search-audit.md)
- [기존 CSV의 언어·국가 집계](gsc-language-baseline.json)
- [결정](context/key-decisions.md) · [진행](context/progress.md)

본문 변경 구현은 커밋 `b21ebdfcb0505163ea8f2afd140db9363d05acba`에 있고, **최종 운영 이미지 6a861be에서 관광 8URL 새 본문·정상 응답을 확인**했다. 사용자 승인 후 Google 영문 관광 4URL 색인 요청 접수와 게임 noindex 6개 재검증 시작을 확인했다. 공유 파일의 줄 위치를 참조하던 광고 드릴 동기화 문제도 해결됐으며 최신 전체 CI·이미지 빌드는 통과했다. 최종 재색인·순위 상승은 미확인이다. 상세 증거와 승인 범위는 rollout에 기록했다.
