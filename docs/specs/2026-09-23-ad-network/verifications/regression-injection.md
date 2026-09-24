# 회귀 주입 기록 — 광고 네트워크 (ads)

검사가 무는지를 결함을 넣어 빨간불로 확인한 기록이다 (`planning/test-quality.md` §회귀 주입, 규칙 gate-must-be-proven).
주입은 워킹트리가 아니라 임시 사본에서 하고, 빨간불을 본 뒤 원래 코드로 돌려 초록불을 다시 본다.

## 대상별 결과

「근거」 열 — **로그**: 이 문서에 실행 출력이 있다 · **기록**: 그룹 구현 기록·커밋 본문이 「빨간불 확인」을 적었지만 대상별 출력은 남지 않았다 · **미확인**: 확인 기록이 없다 · **FINDING**: 주입했는데 해당 검사가 빨간불을 내지 않았다.

2026-09-24 재주입은 모두 HEAD `1bc7d09e` 의 임시 worktree(스크래치 디렉토리)에서 했고, 주입마다 `git checkout -- .` 로 되돌린 뒤 같은 스펙을 다시 돌렸다. 실행은 `./gradlew <task> --tests '<스펙>' --no-daemon -q`, 건수는 JUnit XML(`TEST-*.xml`)에서 읽었다.

| 대상 | 그룹 | 넣은 결함 (file:line) | 빨간불 (실패 테스트 · 메시지 · 건수) | 복원 뒤 | 근거 |
|---|---|---|---|---|---|
| ★U1 분개 합 ≠ 0 | 3 | `LedgerTransaction.kt:28` 합 0 `require` 제거 | `LedgerTransactionTest` 「분개 합이 0 이 아닌 거래 / 복원으로 만들려 하면 / 거부한다」 — 8건 중 1 실패 | 8/0 | **로그** |
| ★U3 수익 배분 내림 + 나머지 | 3 | `RevenueSplit.kt:19` `x / 10_000` → `(x + 5_000) / 10_000` (내림 → 반올림) | `RevenueSplitTest` 「퍼블리셔 몫은 내림, 나머지는 수수료」 — `(charge 1) expected:<0L> but was:<1L>`, `(charge 7) expected:<4L> but was:<5L>` — 1건 중 1 실패 (표 기반 1건) | 1/0 | **로그** |
| ★U12 거대 이미지 디코딩 전 거절 — (a) 헤더 가로·세로 검사 제거 | 7 | `CreativeImageRules.kt:32` `if (header.width > MAX_DIMENSION \|\| …)` → `if (false)` | `CreativeUploadIntegrationSpec` 「가로 2001px」 `expected:<400> but was:<200>` — 9건 중 1 실패. **폭탄 케이스(20000×20000)는 초록** | 9/0 | **로그 · FINDING** (아래) |
| ★U12 — (b) 헤더 검사 전에 디코딩 | 7 | `CreativeImageService.kt:24-25` `transcoder.reencode(...)` 를 `inspect(...)` 앞으로 | 「300KB 안에 든 20000×20000 PNG — 디코더를 부르지 않고 거절한다」 `expected:<2> but was:<3>` (디코더 호출 수) 외 「가로 2001px」「300KB + 1 바이트」「1000×1000」 — 9건 중 4 실패 | 9/0 | **로그** |
| ★I1 같은 노출 토큰 두 번 | 5 | `EventCounterRedisAdapter.kt:155` Lua `if not redis.call('SET', marker, '1', 'NX', 'PX', markerTtl) then` → `if false then` | `EventAcceptanceIntegrationSpec` 「과금은 한 번, 두 번째는 duplicate」 `expected:<0> but was:<1>` (스펙 :101 `second.accepted shouldBe 0`) · 「PTTL 이 토큰의 남은 수명 이상이다」 `-2 should be >= 6000000` — 12건 중 2 실패 | 12/0 | **로그** |
| ★I7 토큰 몰아 제출 | 5 | `EventCounterRedisAdapter.kt:166` Lua `elseif cmp.hour + charge > cmp.hourCap` → `elseif false` | 「상한을 넘는 몫은 over_budget 이고 과금하지 않는다」 `expected:<2> but was:<4>` (`accepted shouldBe 2`) — 12건 중 1 실패 | 12/0 | **로그** |
| ★I2 정산 재실행 | 6 | `LedgerTransaction.kt:39` `"SETTLE:$campaignId:${hourKst.format(HOUR_KEY)}"` → `"SETTLE:$campaignId"` | `SettlementIntegrationSpec` 「같은 캠페인의 두 시각은 각각 한 번씩 청구된다」 `expected:<99600000L> but was:<99850000L>` (지갑 잔액 — 둘째 시각이 청구되지 않음, 스펙 :95) · 「셋 모두 정산」「그 날 청구 합은 일예산을 넘지 않고」 `expected:<3L> but was:<0L>` (키 접두어로 센 거래 수, :74·:124) — 6건 중 3 실패 | 6/0 | **로그** |
| ★I5 집계 UPSERT 재실행 | 6 | `HourlyStatsAdapter.kt:47` `impressions = :impressions, clicks = :clicks, spend_micros = :spend` → `impressions = impressions + :impressions, …` | `AggregationIntegrationSpec` 「집계 값은 언제나 Redis 카운터의 절대값이다」 `impressions expected:<3L> but was:<6L>`, `clicks 1→2`, `spendMicros 600→1200` — 4건 중 1 실패 | 4/0 | **로그** |
| 충전·정산 격리 수준 | 6 | `READ COMMITTED` → `REPEATABLE READ` | 동시 충전 한도 경계 (I3) | 그룹 6 재검증 155건 실패 0 | 기록 (그룹 6 구현 기록) — 이번에 재주입하지 않음 |
| ★C1 TM 한정자 누락 | 2 | `LedgerService.kt:36` `@Transactional("adsTransactionManager", isolation = …)` → `@Transactional(isolation = …)` | ① 빌드 게이트 `verifyTransactionQualifiers` exit 1 — 「LedgerService.kt: @Transactional(isolation = Isolation.READ_COMMITTED) — 한정자가 이 클래스에 없다」 ② `EngagementContextLoadSpec` 「충전하고 다시 읽은 잔액이 충전액과 같다」 `IllegalTransactionStateException: No existing transaction found for transaction marked with propagation 'mandatory'` — 7건 중 1 실패 | 게이트 exit 0 · 7/0 | **로그** (주: ② 는 잔액 불일치가 아니라 어댑터의 `MANDATORY` 전파가 먼저 던져 빨간불이 난다) |
| ★C6 소유자 본인 과금 0 | 4 | `DecisionService.kt:232` `billable = memberId != account.memberId` → `billable = true` | `DecisionIntegrationSpec` 「X-User-Id 가 캠페인 소유 회원이면 … 두 토큰 모두 과금하지 않는다」 `Accepted(… billable=true …) is of type TokenVerification.Accepted but expected TokenVerification.Rejected` — 13건 중 1 실패 | 13/0 | **로그** |
| 결정 경로 DB 무접근 · Redis 명령 수 | 4 | 결정 경로에 조회 추가 | `DecisionIntegrationSpec` (MySQL `Com_*` · `INFO commandstats`) | 그룹 4 재검증 117건 실패 0 | 기록 — 이번 범위 밖 |
| 게이트웨이 라우트 · Host 허용 목록 | 8 | — | `AdsRouteSpec` (`Host: rt.1989v.com` → 404) | 그룹 8 재검증 14/0 | 기록 — 이번 범위 밖 |
| analytics 사본 | 9 | — | `AnalyticsCopyIntegrationSpec` | 그룹 9 재검증 209건 실패 0 | 기록 — 이번 범위 밖 |
| 「미정산 지출 차감 제거」 [test C-1] (I8) — 결정 경로 | 4 | `DecisionService.kt:187` `WalletHeadroom.of(…, counters.advertiserSpendByHour(account.advertiserId), now)` → `WalletHeadroom.of(…, emptyMap(), now)` | `DecisionIntegrationSpec` 「잔액 − 정산 뒤 광고주 지출이 1회 과금액이면 나가고, 0 이면 빠진다」 `expected:<true> but was:<false>` (지출 1,000,000 = 잔액인데 광고가 나감) — 13건 중 1 실패 | 13/0 | **로그** |
| 「미정산 지출 차감 제거」 — 도메인 정책 | 3 | `WalletHeadroom.kt:38` `Available(snapshotBalanceMicros - unsettled.values.sum())` → `Available(snapshotBalanceMicros)` | `WalletHeadroomTest` 「10·11시 지출만 뺀다」 `expected:<6500L> but was:<10000L>` · 「여유가 0 이하라 … 감당하지 못한다」 `expected:<false> but was:<true>` · 「가장 이른 지출 시각부터」 `9900 → 10000` — 5건 중 3 실패 | 5/0 | **로그** |
| F5 `useImpression` | 10 (R3) | 계획: 훅 대신 즉시 보고 → 50% 미만도 보고 | FE 테스트 | — | **이월** — FE 그룹 10 몫 |

## FINDING

- **U12 폭탄 케이스는 헤더 가로·세로 검사를 단독으로 지키지 못한다.** 테스트 폭탄은 20000×20000(1:1)이고 지면은
  1.91:1 만 허용한다. 가로·세로 검사를 빼도 뒤의 비율 검사가 디코딩 전에 거절하므로 「디코더를 부르지 않고 거절한다」가
  초록으로 남는다. 가로·세로 검사를 무는 것은 「가로 2001px」(2001×1048) 하나뿐이다. 운영에서는 1.91:1 비율의
  20000×10471 폭탄이 비율 검사를 통과하므로, 가로·세로 검사가 유일한 방어선이 된다. 폭탄 픽스처를 지면 비율에 맞추면
  (예: 20000×10471) 이 테스트가 가로·세로 검사를 직접 문다 — 테스트 보강 여부는 부모 판단.
- 그 밖의 참고(FINDING 아님): I2 에서 실패한 셋 중 둘은 원장 거래를 `SETTLE:{id}:` 키 접두어로 세는 단언이라 키 형식에
  묶여 있다. 행동(돈)으로 무는 단언은 「두 시각은 각각 한 번씩 청구된다」의 지갑 잔액 한 건이다.
- 「미정산 지출 차감」의 수락 경로(`EventAcceptanceIntegrationSpec`)는 주입하지 않았다 — 수락 Lua 는 캠페인 예산(시간당
  상한·일예산·총예산)만 보고 광고주 지갑 여유는 보지 않으므로 이 주입이 들어갈 자리가 없다. 수락 쪽 캠페인 미정산
  합산은 「총예산 — 정산 완료 시각 뒤의 미정산 지출까지 더해 본다」 케이스가 대상이며 이번에 주입하지 않았다.

## 남은 것

- 격리 수준(I3)·결정 경로 DB 무접근·게이트웨이·analytics 사본 행은 「기록」 그대로다 — 이번 범위(12.4 지정 9건) 밖
- U12 폭탄 픽스처 비율 (위 FINDING)
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

### 12.4 재주입 9건 (2026-09-24)

임시 사본: `git worktree add --detach <scratch>/ads-inject HEAD` (HEAD `1bc7d09e`) + 서브모듈 gifticon·auth 초기화. 끝나고 `git worktree remove --force` 로 지웠다.
각 줄 = 주입 뒤 결과 → `git checkout -- .` 뒤 결과. 건수는 JUnit XML 의 `tests / failures`.

```
U3   :ads:domain:test  --tests '*RevenueSplitTest*'                  exit=1  1/1 failed  → exit=0  1/0
U12a :ads:feature:test --tests '*CreativeUploadIntegrationSpec*'     exit=1  9 tests completed, 1 failed (가로 2001px)
U12b :ads:feature:test --tests '*CreativeUploadIntegrationSpec*'     exit=1  9 tests completed, 4 failed   → exit=0  9/0
I1   :ads:feature:test --tests '*EventAcceptanceIntegrationSpec*'    exit=1  12 tests completed, 2 failed  → exit=0  12/0
I2   :ads:feature:test --tests '*SettlementIntegrationSpec*'         exit=1  6 tests completed, 3 failed   → exit=0  6/0
I5   :ads:feature:test --tests '*AggregationIntegrationSpec*'        exit=1  4 tests completed, 1 failed   → exit=0  4/0
I7   :ads:feature:test --tests '*EventAcceptanceIntegrationSpec*'    exit=1  12 tests completed, 1 failed  → exit=0  12/0
C1   ./gradlew verifyTransactionQualifiers                           exit=1  「트랜잭션 한정자 위반 (ADR-0058/0093)」 → exit=0
C1   :engagement:app:test --tests '*EngagementContextLoadSpec*'      exit=1  7 tests completed, 1 failed   → exit=0  7/0
C6   :ads:feature:test --tests '*DecisionIntegrationSpec*'           exit=1  13 tests completed, 1 failed  → exit=0  13/0
I8   :ads:feature:test --tests '*DecisionIntegrationSpec*'           exit=1  13 tests completed, 1 failed  → exit=0  13/0
I8d  :ads:domain:test  --tests '*WalletHeadroomTest*'                exit=1  5 tests completed, 3 failed   → exit=0  5/0
```

### FINDING 해소 (2026-09-24)

U12 폭탄 케이스가 1:1 이라 비율 검사가 먼저 거절해 가로·세로 검사를 빼도 물지 않았다. 지면 비율(1.91:1)에 맞는 20000×10471 폭탄 케이스를 추가했다.

| 주입 | 빨간불 | 되돌린 뒤 |
|---|---|---|
| `CreativeImageRules.kt` 가로·세로 검사 `if (false)` | 10건 중 2 실패 — 새 1.91:1 폭탄 `expected:<400> but was:<200>`, 가로 2001px | 10/0 |

### R3 FE 회귀 주입 (2026-09-24, 메인 세션 직접 실행 — 리베이스 뒤)

| 주입 | 빨간불 | 되돌린 뒤 |
|---|---|---|
| F5 `AdCard` 가 `useImpression` 을 우회해 즉시 보고 | 3 실패 — `expected [ 'imp-token' ] to deeply equal []` (50% 미만·1초 미만·정상 1회) | 5/5 |
| F1 `AdSlot` 이 AdSense `unfilled` 뒤 HOUSE 로 가지 않음 | 2 실패 — `expected <ins …> to be null` | 16/16 |
| F6 방침 문구 25→24시간 | 1 실패 — `to contain '최대 25시간'` | 6/6 |

실행 로그 원문:
```text
== F5 즉시 보고(useImpression 우회) RED
   × AdCard > 면적 50% 미만은 오래 보여도 노출이 아니다 8ms
     → expected [ 'imp-token' ] to deeply equal []
   × AdCard > 1초를 못 채우고 나가면 노출이 아니다 2ms
     → expected [ 'imp-token' ] to deeply equal []
   × AdCard > 면적 50% 이상으로 1초 보이면 노출 토큰을 한 번 보낸다 2ms
     → expected [ 'imp-token' ] to deeply equal []
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/ads/__tests__/AdCard.test.tsx > AdCard > 면적 50% 미만은 오래 보여도 노출이 아니다
== F5 즉시 보고(useImpression 우회) restored GREEN
      Tests  5 passed (5)
== F1 unfilled 뒤 HOUSE 로 안 감 RED
   × AdSlot — 채움 순서 > AdSense 가 unfilled 를 적으면 HOUSE 로 간다 6ms
     → expected <ins …(6)></ins> to be null
   × AdSlot — 채움 순서 > AdSense 도 HOUSE 도 없으면 자리를 숨기고 EMPTY 를 알린다 3ms
     → expected <aside class="ad-slot" …(2)>…(2)</aside> to be null
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/ads/__tests__/AdSlot.test.tsx > AdSlot — 채움 순서 > AdSense 가 unfilled 를 적으면 HOUSE 로 간다
AssertionError: expected <ins …(6)></ins> to be null
 FAIL  src/components/ads/__tests__/AdSlot.test.tsx > AdSlot — 채움 순서 > AdSense 도 HOUSE 도 없으면 자리를 숨기고 EMPTY 를 알린다
== F1 unfilled 뒤 HOUSE 로 안 감 restored GREEN
      Tests  16 passed (16)
== F6 방침 24시간 RED
   × 광고 — 빈도 제한 식별자 보관 시간 > Redis 빈도 키 TTL 상수와 방침이 같은 시간을 말한다 4ms
     → expected '광고 빈도 제한용 방문자 식별자</strong> — 같은 광고가 한…' to contain '최대 25시간'
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/pages/__tests__/privacyRetention.test.ts > 광고 — 빈도 제한 식별자 보관 시간 > Redis 빈도 키 TTL 상수와 방침이 같은 시간을 말한다
AssertionError: expected '광고 빈도 제한용 방문자 식별자</strong> — 같은 광고가 한…' to contain '최대 25시간'
      Tests  1 failed | 5 passed (6)
== F6 방침 24시간 restored GREEN
      Tests  6 passed (6)
```
