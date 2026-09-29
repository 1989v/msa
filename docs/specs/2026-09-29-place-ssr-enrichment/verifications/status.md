# 그룹 검증 기록

| 그룹 | 명령 | 결과 |
|---|---|---|
| TG1 | `./gradlew :search:domain:test --tests '*AttractionAttributeParserTest' --tests '*ClosedTodayTest' --tests '*RegionAggregatorTest'` | AttractionAttributeParserTest 11/0 · ClosedTodayTest 4/0 · RegionAggregatorTest 8/0 (tests/failures) |
| TG1 | `./gradlew verifyArchitecture` | exit=0 |
| TG1 | 회귀 주입 | 시도 코드 제외 → `expected:<2> but was:<3>` · 해석 못 한 휴무 무시 → `29 assertions failed` · UTC 요일 → ClosedTodayTest FAILED · 복원 후 초록 |
| TG2 | `./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' --tests '*AttractionsIndexMappingTest' --tests '*PlaceApiClientTest' :search:app:test --tests '*AttractionSearchDocumentTest' verifyArchitecture :search:app:compileKotlin` | exit=0 · Tasklet 10/0 · Mapping 3/0 · PlaceApiClient 10/0 · SearchDocument 3/0 |
| TG2 | 회귀 주입 | region→null failures=3 · parking→null `expected YES but was UNKNOWN` · 읽기 문서 sigunguName 삭제 → verifySearchIndexContract FAILED · enabled:false 삭제 → 매핑 테스트 실패 |
| TG2 | 운영 기준선(배포 전) | attractions_20260928193032 docs 59,735 · 283MB |
| TG2+ | 영문 시도 이름 `PlaceApiClientTest` | 12/0 · 회귀 주입(영문 분기 끔) `Values differed at keys 11` |
| TG3 | `./gradlew :search:app:test --tests '*AttractionPage*' --tests '*AttractionShellProviderTest' --tests '*AttractionJsonLdParityTest' verifyArchitecture` | Service 3/0 · Renderer 17/0 · Controller 5/0 · ShellProvider 4/0 · Parity 7/0 |
| TG3 | `npx vitest run src/seo src/pages/place` | 9 files · 146 passed · 골든 재생성 diff 없음 |
| TG3 | 회귀 주입 | escape 제거 · data-seo-multi 제거 · copy.mjs 필드 제거 · findById 2회 · 30초 백오프 제거 → 각각 빨간불 |
| TG3+ | 상세 응답 속성·지역 필드 `SearchAttractionServiceTest` | 21/0 · 회귀 주입(closureState 매핑 삭제) `Expected "WEEKLY" but actual was null` · search:app 전체 21 classes 135/0 |
| TG2 수정 | 운영 재색인이 1차 훑기에서 14분 멈춤 — place 클라이언트 시간 제한 없음 + OFFSET 페이징(OFFSET 59000 = 4,892ms, 키셋 266ms, 버퍼 풀 128MB, 행 평균 6KB) | 키셋 `afterId` + 연결 5초·응답 60초 |
| TG2 수정 | `./gradlew :place:feature:test (Service·Controller·SchemaIntegration) :search:batch:test (Tasklet·PlaceApiClient) verifyArchitecture :content:app:compileKotlin` | Service 5/0 · Controller 2/0 · SchemaIntegration(Testcontainers MySQL) 2/0 · Tasklet 11/0 · PlaceApiClient 15/0 · RoundTrip 1/0 |
| TG2 수정 | 회귀 주입 | afterId→0L SchemaIntegration FAILED · 1차/2차 쪽 번호 전달 Tasklet FAILED · timeout 제거 PlaceApiClient FAILED |
