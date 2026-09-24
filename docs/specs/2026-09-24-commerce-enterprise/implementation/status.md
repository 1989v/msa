# Status — 검증 증거

## TG1 아웃박스 보강 (2026-09-24)
- `./gradlew :common:test --tests '*Outbox*' :commerce:app:test --tests '*OutboxRelayIntegration*' --tests '*CommerceContextLoad*'`
  - OutboxJpaAdapterSpec tests=2 failures=0 · OutboxPollingPublisherSpec tests=5 failures=0
  - OutboxRelayIntegrationSpec tests=5 skipped=0 failures=0 · CommerceContextLoadSpec tests=2 failures=0
- 회귀 주입: JSON 직렬화기로 되돌리면 `expected:<'{'> but was:<'"'>` · SKIP LOCKED 제거 시 중복 발행 검출
- 미확인: CI=true + Docker 부재 시 실패(로컬에서 Docker 우회를 막지 못해 재현 못 함)
