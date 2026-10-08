# 진행 상태

- 현재 그룹: 6 (묶음 공유 막대·수신 화면·GA 로더)
- 완료: TG5 로그인 복귀 — 메인 재실행: vitest src/pages/place src/components/favorite src/auth 17 files / 310 passed, tsc exit 0
- 열린 질문: 상세 화면 resumed CLICK 의 viewId 가 관광지 응답 전 값일 수 있음(허브는 확인됨)
- 완료: TG4 게이트웨이·인그레스 — 메인 재실행: GatewayRouteAuthSpec 62/0, ShortLinkRouteSpec 9/0, oci-arm 렌더에 apex path /c 1건
- TG8 메모: gateway/docs/service.md 라우트 표 두 줄
- 완료: TG1(06bb99b0a), TG2+TG3 한 커밋 — 메인 재실행 2026-10-09 01:28 KST: wishlist 10개 스위트 전부 failures 0·skipped 0 (CollectionShareServiceTest 14, CollectionShareControllerTest 8, SharedCollectionControllerTest 5, ShareDisabledDispatchTest 2, MemberEventConsumerTest 3, WishlistSchemaIntegrationSpec 9 …), AccountContextLoadSpec 5/0, 레이어·트랜잭션·테스트 규칙 게이트 통과
- 새 테스트가 처음부터 초록이라 회귀 감지는 TG8 회귀 주입에서 확인
- 범위 밖 기존 결함(보고만): 탈퇴 시 wishlist_collection 행이 남는다
- TG8 메모: wishlist/CLAUDE.md API 표·공개 경로 문장
