# 회귀 주입 기록 — 광고 네트워크 (ads)

검사가 무는지를 결함을 넣어 빨간불로 확인한 기록이다 (`planning/test-quality.md` §회귀 주입, 규칙 gate-must-be-proven).
주입은 워킹트리가 아니라 임시 사본에서 하고, 빨간불을 본 뒤 원래 코드로 돌려 초록불을 다시 본다.

## 대상별 결과

「근거」 열 — **로그**: 이 문서에 실행 출력이 있다 · **기록**: 그룹 구현 기록·커밋 본문이 「빨간불 확인」을 적었지만 대상별 출력은 남지 않았다 · **미확인**: 확인 기록이 없다.

| 대상 | 그룹 | 넣은 결함 | 빨간불이 난 테스트 | 복원 | 근거 |
|---|---|---|---|---|---|
| ★U1 분개 합 ≠ 0 | 3 (12 에서 재실행) | `LedgerTransaction` 초기화 블록의 `require(entries.sumOf { it.amountMicros } == 0L)` 제거 | `LedgerTransactionTest` — 「분개 합이 0 이 아닌 거래 / 복원으로 만들려 하면 / 거부한다」 (8건 중 1 실패) | 원본 복사 → 8건 실패 0 | **로그** (아래) · 그룹 3 기록 |
| ★U3 수익 배분 내림 + 나머지 | 3 | 계획: floor → round | `RevenueSplitTest` | 그룹 3 재검증 75건 실패 0 | 기록 (tasks.md 그룹 3 「U1·U3 빨간불 확인」) |
| ★U12 거대 이미지 디코딩 전 거절 | 7 | 계획: 헤더 크기 검사 제거 → 디코더 호출 발생 | `CreativeUploadIntegrationSpec` (디코더 계측기 호출 수, 정상 업로드 +1 대조군) | 그룹 7 재검증 202건 실패 0 | 기록 (그룹 7 「회귀 주입 3건」) — 대상별 목록 미기록 |
| ★I1 같은 노출 토큰 두 번 | 5 | 계획: 일회성 표식(SETNX) 제거 | `EventAcceptanceIntegrationSpec` | 그룹 5 재검증 141건 실패 0 | 기록 (그룹 5 「회귀 주입 4건」) — 대상별 목록 미기록 |
| ★I7 토큰 몰아 제출 | 5 | 계획: 수락 단계 상한 확인 제거 | `EventAcceptanceIntegrationSpec` (`over_budget`) | 같음 | 기록 (그룹 5) — 대상별 목록 미기록 |
| ★I2 정산 재실행 | 6 | 계획: 멱등 키에서 시각 제거 | `SettlementIntegrationSpec` | 그룹 6 재검증 155건 실패 0 | 기록 (그룹 6 「회귀 주입 5건」) — 대상별 목록 미기록 |
| ★I5 집계 UPSERT 재실행 | 6 | 계획: 절대값 UPSERT → 증분 더하기 | `AggregationIntegrationSpec` | 같음 | 기록 (그룹 6) — 대상별 목록 미기록 |
| 충전·정산 격리 수준 | 6 | `READ COMMITTED` → `REPEATABLE READ` | 동시 충전 한도 경계 (I3) | 같음 | 기록 (그룹 6 구현 기록 「주입으로 확인」) |
| ★C1 TM 한정자 누락 | 2 | 계획: ads `@Transactional` 한 곳의 한정자 제거 → 잔액 불일치 | `EngagementContextLoadSpec` (충전 뒤 잔액 재조회 = 충전액) | 그룹 2 재검증 7/0 | 기록 (그룹 2 「회귀 주입 6종」) — 대상별 목록 미기록 |
| ★C6 소유자 본인 과금 0 | 4 | 계획: 결정 시점 본인 판정 끄기 → 과금 발생 | `DecisionIntegrationSpec` | 그룹 4 재검증 117건 실패 0 | 기록 (그룹 4 「회귀 주입 8건」) — 대상별 목록 미기록 |
| 결정 경로 DB 무접근 · Redis 명령 수 | 4 | 결정 경로에 조회 추가 | `DecisionIntegrationSpec` (MySQL `Com_*` 증감 · `INFO commandstats`, 대조군 포함) | 같음 | 기록 (그룹 4 커밋 본문) |
| 게이트웨이 라우트 · Host 허용 목록 | 8 | — | `AdsRouteSpec` (`Host: rt.1989v.com` → 404) | 그룹 8 재검증 14/0 | 기록 (그룹 8 「회귀 주입 2건」) — 대상별 목록 미기록 |
| analytics 사본 | 9 | — | `AnalyticsCopyIntegrationSpec` | 그룹 9 재검증 209건 실패 0 | 기록 (그룹 9 「회귀 주입 3건」) — 대상별 목록 미기록 |
| 「미정산 지출 차감 제거」 [test C-1] | 4·5 | 계획: 예산 판정에서 미정산 지출을 빼지 않게 | `DecisionIntegrationSpec` · `EventAcceptanceIntegrationSpec` | — | **미확인** — 어느 그룹 기록에도 이 주입이 따로 적혀 있지 않다 |
| F5 `useImpression` | 10 (R3) | 계획: 훅 대신 즉시 보고 → 50% 미만도 보고 | FE 테스트 | — | **이월** — FE 그룹 10 미착수 |

## 남은 것

- 「기록」 행은 구현자가 빨간불을 봤다고 적은 것이고, 대상별 실행 출력은 이 문서에 없다. 증거를 남기려면
  U3·U12·I1·I2·I5·I7·C1·C6 을 임시 사본에서 하나씩 다시 주입해 실패 줄을 여기 붙인다
- 「미정산 지출 차감 제거」는 주입 기록이 없다 — 위 재주입 때 함께 한다
- F5 는 그룹 10 에서

## 실행 로그

### U1 (2026-09-24 재실행)

임시 사본: 워크트리를 `build`·`.gradle`·`.git` 을 뺀 채 스크래치 디렉토리로 복사.

```
# 주입: LedgerTransaction.kt:28 의 합 0 검사를 주석으로 바꿈
$ ./gradlew :ads:domain:test --tests '*LedgerTransactionTest*' --no-daemon -q
8 tests completed, 1 failed
BUILD FAILED in 17s
# 실패 테스트: LedgerTransactionTest > 분개 합이 0 이 아닌 거래 > 복원으로 만들려 하면 > 거부한다

# 복원: 원본 파일 복사
$ ./gradlew :ads:domain:test --tests '*LedgerTransactionTest*' --no-daemon -q
exit 0 — TEST-...LedgerTransactionTest.xml: tests="8" skipped="0" failures="0"
```
