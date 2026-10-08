# 진행 상태

- 현재 그룹: 6 (용어집·회귀 주입·nginx 계약·배포)
- 완료: TG5 편집 페이지 — 메인 재실행 05:42 KST: render-content 편집 3장, vitest src/pages/place src/seo src/content src/pages/tech routes 39 files / 580 passed, tsc exit 0, 초안 3장 lint --body-only PASS. /tech/search 산출물 동일(cmp)
- 초안 3장 전부 draft(검수·게시 사용자): 서울 무료 실내 · 서울 고궁 반나절(요금 전부 정보 없음 — 주제 재검토 권고) · 제주 반려동물
- 완료: TG4 SPA 프리셋 화면 — 메인 재실행 05:27 KST: vitest src/pages/place src/seo routes 33 files / 518 passed, tsc exit 0
- 결정(근거 보고): 프리셋이 로그인 복귀 상태를 이긴다(SR-2.5·2.6). 랜딩에서 로그인 복귀 시 조건은 초기 상태로 — 필요하면 상태를 주소에 묶는 스펙 필요
- 완료: TG3 프리렌더·sitemap·llms·nginx — 메인 재실행 05:18 KST: prerenderPlaceLandings·prerenderPlace 54 passed, tsc exit 0, check-nginx-place-landings·legacy-regions·place-feed 모두 PASSED(실제 nginx)
- 사용자 확인: 프리렌더가 통째로 실패(SPA 만 배포)하면 랜딩 20개가 404 — 그대로 둘지 빌드를 세울지
- TG6 메모: 랜딩↔지역 location 순서 주입은 무동작, 옛 지역 301 블록과의 순서가 실제로 무는 곳
- 완료: TG2 선정 스크립트 — 메인 재실행: selectPlaceLandings 20 passed. 목록 20건(국 15·영 5, 은퇴 0), 운영 API GET 900회(04:52~04:58 KST)
- 사용자 확인: 건수 순 + 합산 20 이라 영문 free 0·국문 pet 1 — 균형을 원하면 Q4 재판단
- 완료: TG1 상수·슬러그 표·랜딩 문구 — 메인 재실행: landingDecisions·landingMeta·placeApi 3 files / 20 passed, tsc exit 0
- 구현자가 정한 문형(사용자 확인): title 「{heading} — 지도·가는 길 | K-관광」/「— Map & Directions | K-Tour」, 영문 sentence 형식. 「시도 약칭」 규칙은 없음 — 지금은 「부산광역시 중구 …」
- 6.5 빌드 전 확인 05:53 KST: `npm run build` exit 0, `[seo] place 속성 랜딩 프리렌더 20장`, dist/prerender/regions/*/*.html 20 = 목록 20(모집단 밖 0), 중복 게이트 통과, 편집 페이지 3장
