# Verification Status

| 그룹 | 명령 | 결과 |
|---|---|---|
| 1 | `./gradlew :common:test --tests '*AnalyticsEventTest*' :recommendation:feature:test --tests '*RecommendationEventConsumerTest*'` | RecommendationEventConsumerTest tests=8 failures=0 · AnalyticsEventTest tests=4 failures=0 (2026-09-23) |
| 2 | `./gradlew :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*' :engagement:app:check verifyArchitecture :ads:domain:check :ads:feature:check` | EXIT=0 · EngagementContextLoadSpec tests=7 failures=0 · AdsSchemaIntegrationSpec tests=7 failures=0 (메인이 재실행, 2026-09-23) |
| 3 | `./gradlew :ads:domain:test :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*' verifyArchitecture` | EXIT=0 · ads:domain 9 스펙 75건 실패 0 · engagement 7/0·7/0 · 도메인 spring/jakarta import 0 (메인 재실행, 2026-09-23) |
| 4 | `./gradlew :ads:domain:test :ads:feature:test --tests '*DecisionIntegrationSpec*' --tests '*CandidateIndexIntegrationSpec*' :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*' verifyArchitecture` | EXIT=0 · 합계 117건 실패 0 (Decision 12/0 · CandidateIndex 5/0 · Context 7/0 · Schema 7/0) (메인 재실행, 2026-09-23) |
| 5 | `./gradlew :ads:domain:test :ads:feature:test --tests '*EventAcceptanceIntegrationSpec*' --tests '*ClickRedirectIntegrationSpec*' --tests '*AssetIntegrationSpec*' --tests '*DecisionIntegrationSpec*' --tests '*CandidateIndexIntegrationSpec*' :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*' verifyArchitecture` | EXIT=0 · 합계 141건 실패 0 (Event 12/0 · Click 7/0 · Asset 2/0 · Decision 13/0 · Index 5/0) · engagement 강제 재실행 7/0(16.6s)·7/0(6.1s) (메인 재실행, 2026-09-24). 첫 재검증은 스펙 간 id 충돌로 4 실패 → 수정 |
| 6 | 전체 ads 통합 스펙 8종 + engagement 2종 + domain + verifyArchitecture, `--rerun-tasks` | EXIT=0 · 69s · 합계 155건 실패 0 (Ledger 4/0 · Aggregation 4/0 · Settlement 6/0 포함) (메인 재실행, 2026-09-24) |
