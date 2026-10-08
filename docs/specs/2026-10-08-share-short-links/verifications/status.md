# 검증 기록

| 그룹 | 명령 | 결과 |
|---|---|---|
| 1 | `./gradlew :common:test --tests '*ShortCode*' --tests '*ShortLinks*' --tests '*ShortLinkPath*' --tests '*CrawlerUserAgents*'` | exit 0 · ShortCodeTest 13/0 · ShortLinkPathTest 12/0 · ShortLinksTest 10/0 · CrawlerUserAgentsTest 18/0 (메인 세션 재실행) |
| 1 | 골든 벡터 회귀 주입(M1 …27→…29, 임시 사본) | 골든 2건 FAILED, 원복 사본 13/0 — 구현자 보고 |
| 2 | `./gradlew :common:test --tests '*ShortLinks*' --tests '*ShortLinkRedirects*' --tests '*ShortCode*' --tests '*ShortLinkPath*' :code-dictionary:domain:test --tests '*ResumeShareLink*' --tests '*ResumeAccessPolicy*' :code-dictionary:feature:test --tests '*ResumeShortLink*' --tests '*RetentionRunner*' --tests '*ResumeAdmin*' :atlas:app:test --tests '*AtlasContextLoadSpec' verifyLayerDependencies` | exit 0 · 11 스위트 70/0 · AtlasContextLoadSpec 7/0 skipped 0 (실제 MySQL) (메인 세션 재실행) |
| 2 | 회귀 주입(크롤러 판정 제거·로그에 경로, upsert `+1` 제거, `ascii_bin` 제거) | 컨트롤러 2건·실제 MySQL 3건 FAILED — 구현자 보고 |
| 2 | V22 백필 500행 별도 컨테이너 | 500행 고유·형식 일치 — 구현자 보고 |
| 3·4 | `./gradlew :game:feature:test --tests '*GameShortLink*' --tests '*GameRetentionRunner*' --tests '*GameQueryService*' --tests '*EstimatedMinutes*' --tests '*GameSchemaIntegrationSpec*' :blog:feature:test --tests '*BlogShortLink*' --tests '*BlogRetentionRunner*' --tests '*BlogSchemaIntegrationSpec*' verifyLayerDependencies :content:app:compileTestKotlin` | exit 0 · 9 스위트 57/0 (GameSchemaIntegrationSpec 16/0 V105 적용, BlogSchemaIntegrationSpec 1/0 V2 적용) (메인 세션 재실행) |
| 3·4 | 회귀 주입 4건(isPlayable→목록 사본, 크롤러 판정 제거, publiclyVisible→목록 사본, runCatching 제거) | 각각 FAILED, 원복 cmp 일치 — 구현자 보고 |
| 5 | `./gradlew :common:test --tests '*ClickContext*' :game:feature:test --tests '*GameShortLink*' :blog:feature:test --tests '*BlogShortLink*' :place:feature:test --tests '*AttractionShortLink*' --tests '*PlaceRetentionRunner*' :search:app:test --tests '*AttractionSearchControllerShortUrl*' :content:app:test --tests '*ContentContextLoadSpec' verifyLayerDependencies` | exit 0 · 8 스위트 49/0 · ContentContextLoadSpec 11/0 skipped 0 (실제 MySQL) (메인 세션 재실행) |
| 5 | 회귀 주입: game TM 한정자 제거 → ContentContextLoadSpec 1 FAILED(`No active transaction`), @JsonUnwrapped 제거·isActive 판정 제거 → 각 FAILED | 구현자 보고 |
