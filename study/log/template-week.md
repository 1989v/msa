---
week: YYYY-WNN
period: YYYY-MM-DD ~ YYYY-MM-DD
review-pass: 1 | 2 | 3
target-hours: 12
actual-hours: ?
---

# YYYY-WNN 회독 일지

## 1. 이번 주 목표

- [ ] (예) 주제 #2 JVM Phase 1-2 1회독 완료
- [ ] (예) 주제 #15 Connection Pool Phase 3 (코드 grounding) 정독
- [ ] (예) 면접 카드 30분 회독 (시나리오 A)

## 2. 회독 진척

| 주제 | 회독 회차 | 진척 | 시간 | 산출물 |
|---|---|---|---|---|
| #2 JVM | 1회독 | Phase 1 (01-05) | 4h | (자기 요약 1p) |
| #15 Pool | 2회독 | 15-codebase-audit 정독 | 2h | 적용 후보 노트 |

## 3. 발견 / 인사이트

- (예) `HikariPool-1 - Connection is not available` 에러 진단 워크플로 1단부터 5단까지 명확해짐
- (예) `@Transactional(readOnly=true)` 안에서 entity 수정 시 silent fail — 안티패턴 1개 추가 인지

## 4. 적용 후보 (코드/문서)

- (예) `common/.../HikariConfig.kt` 에 `leak-detection-threshold` 누락 → ticket 후보
- (예) ADR-0029 implementation plan Phase 0 → PR-1 작성 가능

## 5. 면접 회독

| 카드 | 30초 답변 가능? | 약점 |
|---|---|---|
| Q "GC 로그에서 어떤 지표를 봐야 하나요?" | △ | pause time / throughput / allocation rate 한 번 더 확인 필요 |

## 6. 다음 주 계획

- [ ] (예) 주제 #2 Phase 2 1회독 + 면접 카드 30개
- [ ] (예) 주제 #6 Kafka 1회독 시작

## 7. 자가 평가 (1-5점)

- 회독 깊이: ?/5
- 코드 grounding 검증: ?/5
- 면접 답변 자신감: ?/5
- 시간 투자 만족도: ?/5

## 8. 후속 ticket / PR

- (예) `addNotRetryableExceptions` 적용 PR draft 작성
- (예) `study/docs/00-VERIFICATION-REPORT.md` §4 R1 follow-up
