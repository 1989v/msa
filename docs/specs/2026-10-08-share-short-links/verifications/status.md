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
| 5 | 깨끗한 워크트리(HEAD 544dc0243 단독, 다른 세션 미커밋 변경 없음): 8개 모듈 `compileTestKotlin` + place·search 범위 테스트 | exit 0 · PlaceRetentionRunnerSpec 2/0 · AttractionShortLinkControllerTest 9/0 · AttractionSearchControllerShortUrlTest 4/0 |
| 6 | `./gradlew :gateway:test --tests '*ShortLinkRouteSpec' --tests '*GatewayRoutingSpec'` | exit 0 · ShortLinkRouteSpec 5/0 · GatewayRoutingSpec 19/0 (메인 세션) |
| 6 | 리미터 키 배선 — 한정자 없이 `ipKeyResolver` 생성자 인자만 둔 첫 구현 | ShortLinkRouteSpec 「두 요청 모두 ipKeyResolver 를 거친다」 FAILED(`@Primary` userKeyResolver 가 주입됨) → `@Qualifier` 후 통과. 검사가 실제 결함을 잡음 |
| 6 | `kubectl kustomize k8s/overlays/oci-arm` | exit 0 · apex 경로 `/api /ws /sse /svc /r /p /g /b → gateway`, `/ → portal-fe` |
