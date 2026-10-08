# 검증 기록

| 그룹 | 명령 | 결과 |
|---|---|---|
| 1 | `./gradlew :common:test --tests '*ShortCode*' --tests '*ShortLinks*' --tests '*ShortLinkPath*' --tests '*CrawlerUserAgents*'` | exit 0 · ShortCodeTest 13/0 · ShortLinkPathTest 12/0 · ShortLinksTest 10/0 · CrawlerUserAgentsTest 18/0 (메인 세션 재실행) |
| 1 | 골든 벡터 회귀 주입(M1 …27→…29, 임시 사본) | 골든 2건 FAILED, 원복 사본 13/0 — 구현자 보고 |
