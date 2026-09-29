# 그룹 검증 기록

| 그룹 | 명령 | 결과 |
|---|---|---|
| TG1 | `./gradlew :search:domain:test --tests '*AttractionAttributeParserTest' --tests '*ClosedTodayTest' --tests '*RegionAggregatorTest'` | AttractionAttributeParserTest 11/0 · ClosedTodayTest 4/0 · RegionAggregatorTest 8/0 (tests/failures) |
| TG1 | `./gradlew verifyArchitecture` | exit=0 |
| TG1 | 회귀 주입 | 시도 코드 제외 → `expected:<2> but was:<3>` · 해석 못 한 휴무 무시 → `29 assertions failed` · UTC 요일 → ClosedTodayTest FAILED · 복원 후 초록 |
