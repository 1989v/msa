# 그룹 검증 기록

| 그룹 | 명령 | 결과 |
|---|---|---|
| TG1 | `./gradlew :search:domain:test --tests '*AttractionAttributeParserTest' --tests '*ClosedTodayTest' --tests '*RegionAggregatorTest'` | AttractionAttributeParserTest 11/0 · ClosedTodayTest 4/0 · RegionAggregatorTest 8/0 (tests/failures) |
| TG1 | `./gradlew verifyArchitecture` | exit=0 |
| TG1 | 회귀 주입 | 시도 코드 제외 → `expected:<2> but was:<3>` · 해석 못 한 휴무 무시 → `29 assertions failed` · UTC 요일 → ClosedTodayTest FAILED · 복원 후 초록 |
| TG2 | `./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' --tests '*AttractionsIndexMappingTest' --tests '*PlaceApiClientTest' :search:app:test --tests '*AttractionSearchDocumentTest' verifyArchitecture :search:app:compileKotlin` | exit=0 · Tasklet 10/0 · Mapping 3/0 · PlaceApiClient 10/0 · SearchDocument 3/0 |
| TG2 | 회귀 주입 | region→null failures=3 · parking→null `expected YES but was UNKNOWN` · 읽기 문서 sigunguName 삭제 → verifySearchIndexContract FAILED · enabled:false 삭제 → 매핑 테스트 실패 |
| TG2 | 운영 기준선(배포 전) | attractions_20260928193032 docs 59,735 · 283MB |
