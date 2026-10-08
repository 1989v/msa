# 검증 기록

| 그룹 | 명령 | 결과 |
|---|---|---|
| 1 | `./gradlew :common:test --tests '*ShortCode*' --tests '*ShortLinks*' --tests '*ShortLinkPath*' --tests '*CrawlerUserAgents*'` | exit 0 · ShortCodeTest 13/0 · ShortLinkPathTest 12/0 · ShortLinksTest 10/0 · CrawlerUserAgentsTest 18/0 (메인 세션 재실행) |
| 1 | 골든 벡터 회귀 주입(M1 …27→…29, 임시 사본) | 골든 2건 FAILED, 원복 사본 13/0 — 구현자 보고 |
| 2 | `./gradlew :common:test --tests '*ShortLinks*' --tests '*ShortLinkRedirects*' --tests '*ShortCode*' --tests '*ShortLinkPath*' :code-dictionary:domain:test --tests '*ResumeShareLink*' --tests '*ResumeAccessPolicy*' :code-dictionary:feature:test --tests '*ResumeShortLink*' --tests '*RetentionRunner*' --tests '*ResumeAdmin*' :atlas:app:test --tests '*AtlasContextLoadSpec' verifyLayerDependencies` | exit 0 · 11 스위트 70/0 · AtlasContextLoadSpec 7/0 skipped 0 (실제 MySQL) (메인 세션 재실행) |
| 2 | 회귀 주입(크롤러 판정 제거·로그에 경로, upsert `+1` 제거, `ascii_bin` 제거) | 컨트롤러 2건·실제 MySQL 3건 FAILED — 구현자 보고 |
| 2 | V22 백필 500행 별도 컨테이너 | 500행 고유·형식 일치 — 구현자 보고 |
