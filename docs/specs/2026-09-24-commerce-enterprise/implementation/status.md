# Status — 검증 증거

## TG1 아웃박스 보강 (2026-09-24)
- `./gradlew :common:test --tests '*Outbox*' :commerce:app:test --tests '*OutboxRelayIntegration*' --tests '*CommerceContextLoad*'`
  - OutboxJpaAdapterSpec tests=2 failures=0 · OutboxPollingPublisherSpec tests=5 failures=0
  - OutboxRelayIntegrationSpec tests=5 skipped=0 failures=0 · CommerceContextLoadSpec tests=2 failures=0
- 회귀 주입: JSON 직렬화기로 되돌리면 `expected:<'{'> but was:<'"'>` · SKIP LOCKED 제거 시 중복 발행 검출
- 미확인: CI=true + Docker 부재 시 실패(로컬에서 Docker 우회를 막지 못해 재현 못 함)

## TG2 보안·결함 (2026-09-24)
- `./gradlew :product:feature:test --tests '*ProductController*' :inventory:feature:test --tests '*Reservation*' :gateway:test --tests '*RouteAuth*' --tests '*GatewayRouting*' :order:feature:test --tests '*OrderStats*' :search:batch:compileKotlin :commerce:app:test --tests '*CommerceContextLoad*'` → exit 0
  - ProductControllerAuthTest 8/0 · OrderReservationTest 6/0 · ReservationStockSyncEventTest 4/0 · InventoryReservationLockOrderTest 1/0 · GatewayRouteAuthSpec 9/0 · GatewayRoutingSpec 17/0 · OrderStatsControllerTest 4/0 · CommerceContextLoadSpec 4/0 (skipped 0)
- `npx tsc --noEmit -p tsconfig.app.json` portal-fe 0 · admin 0 (`-p .` 는 files:[] 라 0개 파일 검사 — tasks.md 명령 수정)
- 회귀 주입: 권한 무조건 통과 → 3 실패 · 게이트웨이 쓰기 라우트 userConfig → 1 실패 · 부족 라인 건너뛰기 → 4 실패
