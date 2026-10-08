# 진행 상태

- 현재 그룹: 4 (SPA 프리셋 화면)
- 완료: TG3 프리렌더·sitemap·llms·nginx — 메인 재실행 05:18 KST: prerenderPlaceLandings·prerenderPlace 54 passed, tsc exit 0, check-nginx-place-landings·legacy-regions·place-feed 모두 PASSED(실제 nginx)
- 사용자 확인: 프리렌더가 통째로 실패(SPA 만 배포)하면 랜딩 20개가 404 — 그대로 둘지 빌드를 세울지
- TG6 메모: 랜딩↔지역 location 순서 주입은 무동작, 옛 지역 301 블록과의 순서가 실제로 무는 곳
- 완료: TG2 선정 스크립트 — 메인 재실행: selectPlaceLandings 20 passed. 목록 20건(국 15·영 5, 은퇴 0), 운영 API GET 900회(04:52~04:58 KST)
- 사용자 확인: 건수 순 + 합산 20 이라 영문 free 0·국문 pet 1 — 균형을 원하면 Q4 재판단
- 완료: TG1 상수·슬러그 표·랜딩 문구 — 메인 재실행: landingDecisions·landingMeta·placeApi 3 files / 20 passed, tsc exit 0
- 구현자가 정한 문형(사용자 확인): title 「{heading} — 지도·가는 길 | K-관광」/「— Map & Directions | K-Tour」, 영문 sentence 형식. 「시도 약칭」 규칙은 없음 — 지금은 「부산광역시 중구 …」
