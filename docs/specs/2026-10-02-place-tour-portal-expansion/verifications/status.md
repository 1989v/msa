| TG | 검증 | 결과 |
|---|---|---|
| TG1 | 표본 정제 게이트 (패턴 강화 후) | 현재 표본 exit 0 · 88자 base64 주입 exit 1 · 원복 exit 0 |
| TG2 | place:domain 3클래스 + place:feature 8클래스(통합 포함) + content 컴파일 + verifyArchitecture·verifySearchIndexContract | 57 tests · skip 0 · fail 0 · 통합 테스트가 실제 MySQL 에 V23 적용 |
| TG2 | 회귀 주입 11종(구현 에이전트) | 전부 빨간불 |
| TG3 | pytest 4파일(categorize·sync_tour_portal·backfill_pick·upsert_fields) + smoke_test + 픽스처 키 검사 | 24 passed · SMOKE OK · exit 0 |
| TG3 | 회귀 주입 12종(구현 에이전트, 임시 사본) | 전부 빨간불 |
| TG4 | kustomize 렌더: schedule `10 18 * * *` · deadline 540 · backoff 0 · timeZone 없음 · NP 28 불변 | 일치 · 540→900 주입 시 판정 exit 1 |
| TG4 | verifyArchitecture | exit 0 |
| TG4 4.6 | 기준선(ops-before.txt) | 59,682행 합계. 첫 실행이 파생 테이블+TEXT 로 MySQL liveness 실패 → 03:05 UTC 재시작 1회(약 1분). 범위 집계로 고쳐 재실행, ping 최대 1.08s, 재시작 없음 |
| TG5 | search:domain EventScheduleTest·CourseStopsParserTest·EventScheduleGoldenTest + verifyArchitecture | 18/0 · 7/0 · 1/0 · exit 0 |
| TG5 | 회귀 주입 11종 + 문구 변경 시 골든 해시 변화(구현 에이전트) | 전부 빨간불 · 7b72ff01 → 255e2221 |
| 배포 ① 첫 수집 | tour-portal-sync 1회차 | 코스 1,000 · 영문 숙박 207 적재. 행사 국·영 bulk 500(tel 123자 > varchar 100) · 국문 숙박 TourAPI SSL 시간 초과 → V24(fe952815) |
| V24 | PlaceSchemaIntegrationSpec(실제 MySQL v24) | 5/0 · V24 제거 시 Data too long for column 'tel' 로 1 실패 |
| TG6 | search batch·domain·app 14클래스 + verifyArchitecture·verifySearchIndexContract | 160 tests · 0 실패 · exit 0 |
| TG6 | 회귀 주입 8종 + 끝난 행사 placement 비우기 | 전부 빨간불 |
