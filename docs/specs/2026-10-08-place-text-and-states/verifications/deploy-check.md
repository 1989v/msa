# 배포 뒤 확인 (SR-7.5) — 2026-10-08

배포: search·portal-fe·search-batch `ecf54be`(롤아웃 1/1 확인), CSS 후속 `e113e2d`. 측정은 일반 Chrome UA.

| 항목 | 결과 | 방법 |
|---|---|---|
| 영문 허브 첫 화면 카드 | 30/30 에 엔티티·태그 0 (1단계 S1-6 은 3/30) | 헤드리스 크롬 CDP, `.place-card-overview` 텍스트 |
| 선택 패널 3개 | 3/3 그려짐(1324·1355·679자), 엔티티·태그 0 | CDP, `a.place-card` 클릭 → `.place-detail-overview` |
| 영문 목록 API 120건 | overview 엔티티·태그 0 | `GET /api/search/attractions?lang=en&size=30&page=0..3` |
| 통합 검색 영문 관광지 요약 | 25/25 에 엔티티·태그 0 (게임·개념 hit 도 함께 응답) | `GET /api/search/unified?q=…&lang=en` 5개 질의 |
| 영문 칩 조건 | 오늘 열림 6,604 · 주차 11,331 · 무료 입장 343 · 웰니스 92, 국문 전용 7종 영문 0 | `GET /api/search/attractions?lang=en&facets=true` |
| 0건 화면 | 데스크톱·모바일 모두 버튼 셋(검색어·지역·모두 해제), 가로 넘침 없음 | CDP, 검색어 `qzxqzxqzx` |
| 원래 검색어 검색 | `경복굼` → `correctedKeyword=경복궁`, `exact=true` → `null` | API |
| 템플스테이 | ko 「템플스테이」 0 → 74건, en 「temple stay」 0 → 397건 | API `totalElements` |
| 분류 사전 갱신 | `분류 사전 갱신: ko 667건, en 585건`(13:23:33Z) | search 로그 |
| 파서 v2 | 미확인 — 다음 정기 재색인(`attraction-reindex` 21:30 UTC = 10-09 06:30 KST) 뒤 `attributeParserVersion` 2 와 영문 `N/A` 주차 문서의 `attrParking=UNKNOWN` 건수를 확인 | — |

스크린샷: `scratchpad/cdp-place-b/hub-en.jpg`, `zero-1280.jpg`, `zero-390.jpg`(세션 스크래치패드).
