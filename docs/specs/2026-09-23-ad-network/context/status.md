# Verification Status

| 그룹 | 명령 | 결과 |
|---|---|---|
| 1 | `./gradlew :common:test --tests '*AnalyticsEventTest*' :recommendation:feature:test --tests '*RecommendationEventConsumerTest*'` | RecommendationEventConsumerTest tests=8 failures=0 · AnalyticsEventTest tests=4 failures=0 (2026-09-23) |
| 2 | `./gradlew :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*' :engagement:app:check verifyArchitecture :ads:domain:check :ads:feature:check` | EXIT=0 · EngagementContextLoadSpec tests=7 failures=0 · AdsSchemaIntegrationSpec tests=7 failures=0 (메인이 재실행, 2026-09-23) |
| 3 | `./gradlew :ads:domain:test :engagement:app:test --tests '*EngagementContextLoadSpec*' --tests '*AdsSchemaIntegrationSpec*' verifyArchitecture` | EXIT=0 · ads:domain 9 스펙 75건 실패 0 · engagement 7/0·7/0 · 도메인 spring/jakarta import 0 (메인 재실행, 2026-09-23) |
