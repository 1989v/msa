# 진행 상태

- 현재 그룹: 4 (게이트웨이 라우트·apex 인그레스 /c)
- 완료: TG1(06bb99b0a), TG2+TG3 한 커밋 — 메인 재실행 2026-10-09 01:28 KST: wishlist 10개 스위트 전부 failures 0·skipped 0 (CollectionShareServiceTest 14, CollectionShareControllerTest 8, SharedCollectionControllerTest 5, ShareDisabledDispatchTest 2, MemberEventConsumerTest 3, WishlistSchemaIntegrationSpec 9 …), AccountContextLoadSpec 5/0, 레이어·트랜잭션·테스트 규칙 게이트 통과
- 새 테스트가 처음부터 초록이라 회귀 감지는 TG8 회귀 주입에서 확인
- 범위 밖 기존 결함(보고만): 탈퇴 시 wishlist_collection 행이 남는다
- TG8 메모: wishlist/CLAUDE.md API 표·공개 경로 문장
