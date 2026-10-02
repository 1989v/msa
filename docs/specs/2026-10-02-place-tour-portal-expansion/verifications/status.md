| TG | 검증 | 결과 |
|---|---|---|
| TG1 | 표본 정제 게이트 (패턴 강화 후) | 현재 표본 exit 0 · 88자 base64 주입 exit 1 · 원복 exit 0 |
| TG2 | place:domain 3클래스 + place:feature 8클래스(통합 포함) + content 컴파일 + verifyArchitecture·verifySearchIndexContract | 57 tests · skip 0 · fail 0 · 통합 테스트가 실제 MySQL 에 V23 적용 |
| TG2 | 회귀 주입 11종(구현 에이전트) | 전부 빨간불 |
| TG3 | pytest 4파일(categorize·sync_tour_portal·backfill_pick·upsert_fields) + smoke_test + 픽스처 키 검사 | 24 passed · SMOKE OK · exit 0 |
| TG3 | 회귀 주입 12종(구현 에이전트, 임시 사본) | 전부 빨간불 |
