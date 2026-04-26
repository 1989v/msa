---
spec: seven-split-crypto-trading
date: 2026-04-24
status: test-strategy-draft
depends-on:
  - planning/requirements.md
  - context/open-questions.yml
standards:
  - docs/standards/test-rules.md (Kotest BehaviorSpec + MockK)
  - docs/adr/ADR-0002-kotlin-coroutine.md
  - docs/adr/ADR-0012-idempotent-consumer.md
  - docs/adr/ADR-0015-resilience-strategy.md
---

# Test & Quality Strategy — seven-split-crypto-trading

본 문서는 `requirements.md`의 FR/NFR을 검증하기 위한 레이어별 테스트 전략·골든셋 규약·정합성(invariant) 테스트 규칙을 정의한다. 코드 예제는 실 구현 시의 바인딩이 아닌 **규약 수준 예시**이다.

---

## 1. 목표 & 원칙

- **결정론 우선**: 전략 엔진은 동일 입력에 동일 출력. 난수/시간 의존성을 주입형으로 격리(`Clock`, `RandomSource`).
- **Clean Architecture 경계별 분리**: `:domain` 테스트는 Spring Context 없이 돌아야 한다(`test-rules.md` 원칙).
- **BehaviorSpec + Given/When/Then**: 규칙 서술형 이름을 사용한다 (`describe 세븐스플릿 매수 트리거`).
- **테스트 피라미드**: 단위(도메인 규칙) > 모듈 통합(어댑터·Repository) > 컨테이너 통합(Testcontainers) > E2E(백테스트 골든셋) 순으로 비중.
- **SLO 테스트는 별도 게이트**: 성능 테스트는 일반 CI에서 제외하고 주기(nightly) 잡으로 돌린다.

---

## 2. 레이어별 테스트 범위

### 2.1 `:seven-split:domain` (순수 도메인)
- **Framework 의존 금지** (Spring, JPA, WebClient 등). Kotest + MockK만 사용.
- **대상**:
  - `SplitStrategyConfig` 유효성 검증 (회차 1~50, 익절 배열 길이, `entryGapPercent < 0`)
  - `RoundSlot` 상태 전이: `EMPTY → PENDING_BUY → FILLED → PENDING_SELL → CLOSED → EMPTY`
  - 매수 트리거 규칙: **직전 회차 매수가 × (1 + entryGapPercent/100) >= 현재가** 시 체결 가능
  - 매도 트리거 규칙: **회차별 독립 익절** (`filledPrice × (1 + tp/100) <= 현재가`)
  - 전 회차 소진 후 추가 하락 시 대기 (FR-ENG-06)
  - 슬롯 재사용 (FR-ENG-05)
  - 손절 없음 invariant (어떤 경로로도 STOP_LOSS 이벤트가 발생하지 않음)
- **도구**: Kotest BehaviorSpec, MockK, kotest-property(값 생성기).
- **예시 네이밍**:
  ```
  Given 5회차 활성 전략
   And 1회차 100,000 KRW에 체결됨
   When 현재가 97,000 KRW로 하락
   Then 2회차 매수 트리거가 발동된다
  ```

### 2.2 `:seven-split:app` (서비스·어댑터·Repository)
- Spring Context 사용. `@DataJpaTest`/`@JsonTest`/개별 슬라이스 선호.
- **대상**:
  - `ExchangeAdapter` 구현체(빗썸/업비트) — **가짜 서버(MockWebServer)** 로 HTTP 응답 스텁
  - `OutboxPublisher` — Kafka 테스트 컨테이너 또는 `spring-kafka-test` embedded kafka
  - `RoundSlotJpaRepository` — H2/MariaDB Testcontainers
  - `TenantId` 필터 적용 (모든 Repository 쿼리에 tenantId 조건 주입 확인)
  - Idempotent Consumer(ADR-0012) 회귀 테스트

### 2.3 Kafka·시세 스트림 (Coroutine Flow)
- **Turbine**(kotlinx-coroutines-test + turbine) 또는 Kotest `runTest`로 Flow 수집 검증.
- WebSocket 끊김 → 5s 재연결 → 10s REST 폴백 시나리오를 **Virtual Time**으로 시뮬레이션.
- Kafka 멀티파티션에서 `tenantId|symbol` 키 순서 보장 테스트.

### 2.4 백테스트 시뮬레이터
- ClickHouse는 **고정 CSV fixture**로 대체 (의존성 고립). 별도 Testcontainers(ClickHouse) 테스트는 nightly.
- 시간 재생은 `FakeClock` 주입. 30일치 분봉 재생 시간은 SLO 테스트에서만 측정.

### 2.5 REST API / Presentation
- `@WebMvcTest` + MockMvc, 실 전략은 MockK 로 대체.
- `ApiResponse<T>` 포맷 (`docs/architecture/api-response.md`) 계약 준수 검증.

### 2.6 FE (대시보드/리더보드) — 범위 개략
- Vitest + React Testing Library.
- 주요 테스트: 회차 카드 렌더, 체결 타임라인 오버레이, 리더보드 정렬 토글, 긴급 청산 확인 모달.
- Playwright E2E는 Phase 2 이후 선택.

---

## 3. Kotest BehaviorSpec 규칙

- 클래스명: `XxxSpec` (예: `SevenSplitBuyTriggerSpec`).
- 상속: `BehaviorSpec({ ... })`.
- `given("...")` / `when("...")` / `then("...")` 한국어 서술 허용 (`docs/standards/test-rules.md` 예시 준수).
- **공유 가변 상태 금지** — 각 `given` 블록은 자체 fixture 생성.
- `MockK`는 `mockk<T>(relaxed = false)` 기본, `every { }`/`verify { }` 쌍을 명시.
- 픽스처는 `fixtures/` 하위 파일로 추출 (`SplitFixtures.kt`).

---

## 4. 백테스트 골든셋 정책

### 4.1 골든셋 구성
- **데이터**: `src/test/resources/golden/bithumb/btc-krw-2024-03.csv` (예시 경로), 빗썸 분봉 1개월.
- **포맷**: `timestamp(ISO-8601), open, high, low, close, volume`.
- **시드 구성**: 최소 3종 — `tight`(좁은 변동폭), `normal`, `volatile`(급락 포함).

### 4.2 골든 결과
- 각 시드별로 `expected.json` 저장: 총 체결 수, 회차별 회전 횟수, 실현손익, MDD, 최종 잔고.
- 엔진 변경 시 **JSON diff**로 회귀 판정.
- 의도적 규칙 변경 시에만 `expected.json` 업데이트하고 ADR에 근거를 기록한다.

### 4.3 실행·CI
- `./gradlew :seven-split:app:goldenTest` 커스텀 태스크 (태그 `golden`).
- PR 필수 체크에 포함, 실패 시 diff 요약을 PR 코멘트로 노출(선택).

---

## 5. 정합성(Invariant) 테스트

다음은 **어떤 경로로도 깨지면 안 되는** 불변식이다. 속성 기반 테스트(kotest-property)로 보호한다.

- **INV-01 (손절 없음)**: 어떤 시나리오에서도 `StopLoss` 이벤트는 발행되지 않는다.
- **INV-02 (회차 독립 매도)**: 슬롯 i의 매도는 슬롯 i의 매수가에만 의존한다. 평균단가 입력을 강제 주입해도 규칙이 참조하지 않음.
- **INV-03 (동일 매수 금액)**: 원칙 6 — 모든 회차 매수 명목 금액이 `initialOrderAmount`와 동일하다 (부분 체결 보정은 별도 정책으로 분리).
- **INV-04 (Outbox 일관성)**: 상태 전이 커밋 시 반드시 대응 도메인 이벤트가 Outbox에 append된다.
- **INV-05 (tenantId 강제)**: 어떤 Repository 쿼리도 `tenantId` 조건 없이 실행되지 않는다 — `@TenantAware` AOP/필터 테스트로 강제.
- **INV-06 (Idempotent 주문)**: 동일 `orderId` 재전송 시 거래소 신규 주문이 발생하지 않는다.
- **INV-07 (파라미터 범위)**: `roundCount ∈ [1,50]`, `entryGapPercent < 0`, 모든 `takeProfitPercentPerRound[i] > 0`.

---

## 6. 성능·SLO 테스트 (별도 잡)

- **Gatling 또는 k6**으로 틱 입력 → 주문 송신 지연 측정.
- **기준치** (Q-A):
  - p50 ≤ 200ms
  - p95 ≤ 500ms
  - p99 ≤ 1s
- **백테스트 재생**: 30일치 분봉 단일 전략 ≤ 5분.
- **WS 복구**: 끊김 주입 후 재연결 ≤ 5s, 10s 이상 지속 시 REST 폴백 활성화 (통합 테스트).
- 회귀 감시는 nightly / release 후보 직전에만 실행 (CI-normal에서는 skip).

---

## 7. 알림(Telegram) 테스트

- MockWebServer로 Telegram Bot API 스텁.
- **케이스**:
  - 체결 성공 시 메시지 포맷·멘션 포함 검증
  - API 5xx 3회 실패 → 감사 로그에 최종 실패 기록
  - Bot Token 평문 로깅 금지 invariant (로그 캡처 후 정규식 검사)
- Phase 2 이후 이메일 어댑터 추가 시 동일 포트 계약 테스트 재사용.

---

## 8. 보안 테스트

- **API Key 암호화 왕복 테스트**: 저장 → 로드 → 복호화 후 바이트 일치.
- **평문 노출 금지**: 모든 DTO/ApiResponse 직렬화 결과에 API Secret 미포함.
- **감사 로그**: Key 조회/주문 실행/긴급 청산 3종 이벤트에 `actor`, `tenantId`, `timestamp`, `action`, `resource` 필드 보장.
- **테넌트 격리**: 다른 테넌트 `strategyId`로 조회 시 `403` 또는 `404` (정보 누출 최소화).

---

## 9. 회귀(Regression) 보호

- PR 필수 체크: `:seven-split:domain:test`, `:seven-split:app:test`, 골든셋, 린트.
- 주요 엔진 규칙 변경 시 ADR 추가 + 골든셋 업데이트 커밋 분리.
- 릴리즈 태그 직전 nightly: 성능/WS 복구/Testcontainers(ClickHouse·Kafka 실컨테이너) 풀 스위트.

---

## 10. 커버리지 목표

| 대상 | 라인 커버리지 | 분기 커버리지 |
|---|---|---|
| `:seven-split:domain` | **≥ 90%** | ≥ 85% |
| `:seven-split:app` (executor, strategy service) | ≥ 80% | ≥ 70% |
| 거래소 어댑터 | ≥ 75% (실 네트워크 제외) | - |
| FE 대시보드 핵심 컴포넌트 | ≥ 70% | - |

수치는 품질 게이트 가이드이며, 숫자 맞추기식 테스트 작성은 금지한다 (behavior-first).

---

## 11. 오픈 이슈 (test-quality 관점)

- **TQ-OQ-01**: 골든셋의 소스 데이터(빗썸 분봉) 라이선스/재배포 가부 확인 — 저장소 커밋 vs LFS vs 외부 버킷 결정 필요.
- **TQ-OQ-02**: ClickHouse Testcontainers 이미지 + schema 재사용 방식 확정 (analytics 서비스와 공용 가능 여부).
- **TQ-OQ-03**: WebSocket 끊김 주입을 위한 **프록시 기반 Chaos** 툴 선정 (toxiproxy vs 자체 Fake).
- **TQ-OQ-04**: 성능 SLO 측정 환경 표준화 (로컬 개발기 vs CI runner vs 전용 노드).

이 목록은 Plan 단계 착수 전 `context/open-questions.yml`로 승격 검토.
