---
parent: 5-spring-transactional
type: preview
created: 2026-05-01
---

# Spring Transactional 심화 — Preview

> 학습자 수준: 중급(intermediate, 10년차 백엔드) · 전체 예상 시간: 12h · 목표: 면접 대비 + msa ADR (Architecture Decision Record, 아키텍처 결정 기록)-0020/0022/0012 실무 연결
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: P3 풀팩 · 학습 순서: Top-down (메커니즘 → 전파/격리 → 분리 패턴 → 코드베이스)

---

## 멘탈 모델: "프록시 → 트랜잭션 메타 → 라우팅 → 분리"

`@Transactional` 은 표면상 한 줄짜리 애노테이션이지만 그 뒤에 4개의 직교적 메커니즘이 직렬로 끼어 있다. 면접에서 "동작하지 않는 경우" 류 질문을 방어하려면 이 4계층을 통째로 그릴 수 있어야 한다.

```
  ┌────────────────────────────────────────┐
  │  Layer 4: 외부 IO 분리                 │
  │  - Outbox / TransactionalEventListener │
  │  - Saga (분산 트랜잭션 대안)           │
  └─────────────────┬──────────────────────┘
                    │ "트랜잭션 밖에서 무엇을 할 것인가"
  ┌─────────────────┴──────────────────────┐
  │  Layer 3: 트랜잭션 메타의 사용         │
  │  - readOnly → Routing/FlushMode        │
  │  - 전파/격리 → 중첩, 분기 결정         │
  └─────────────────┬──────────────────────┘
                    │ "메타가 어떻게 흐르나"
  ┌─────────────────┴──────────────────────┐
  │  Layer 2: TransactionInterceptor       │
  │  - PlatformTransactionManager.begin    │
  │  - Synchronization, Resource binding   │
  │  - 롤백 규칙 (RT/Error vs Checked)     │
  └─────────────────┬──────────────────────┘
                    │ "누가 호출하나"
  ┌─────────────────┴──────────────────────┐
  │  Layer 1: AOP Proxy                    │
  │  - CGLIB / JDK Dynamic Proxy           │
  │  - self-invocation 함정                │
  │  - 클래스/메서드/인터페이스 위치       │
  └────────────────────────────────────────┘
```

**핵심 5문장만 외운다**:
1. `@Transactional` 은 **프록시 기반 AOP (Aspect-Oriented Programming, 관점 지향 프로그래밍)** — 외부 호출(프록시)만 가로채고, 같은 빈 내부 호출(self-invocation)은 무력화된다.
2. 기본 롤백은 `RuntimeException` / `Error` 만. **Checked Exception 은 기본 미롤백** — 필요하면 `rollbackFor`.
3. `readOnly = true` 의 본질은 두 가지: **Hibernate FlushMode.MANUAL → dirty check skip** + **TransactionSynchronizationManager.isCurrentTransactionReadOnly() → 라우팅 키**.
4. 외부 IO (Input/Output, 입출력)(HTTP/Kafka) 와 DB 트랜잭션은 **반드시 분리한다**. msa 는 `{Entity}TransactionalService` 분리 + Outbox 폴링 패턴이 표준.
5. 중첩 `@Transactional` 에서 **예외를 catch 해도 rollback-only 마킹은 되돌릴 수 없다** → `UnexpectedRollbackException`.

---

## 소주제 지도

> 14개 deep file 로 분할. 각 파일 평균 1.0~1.5h.

### Phase 1: 기본 메커니즘 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | AOP 프록시 + 위치 규칙 | [01-aop-proxy-basics.md](01-aop-proxy-basics.md) | CGLIB/JDK 차이, 인터페이스/클래스/메서드 어디에 붙여야 하나 |
| 02 | 기본 롤백 규칙 | [02-default-rollback-rules.md](02-default-rollback-rules.md) | RT/Error 롤백, Checked 미롤백의 EJB 역사적 이유, `rollbackFor` |
| 03 | Self-invocation 함정 | [03-self-invocation.md](03-self-invocation.md) | 같은 클래스 내부 호출 → 프록시 우회. self 주입 / AopContext / 클래스 분리 |

### Phase 2: 전파 · 격리 · readOnly (5개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 04 | 전파 속성 7종 | [04-propagation-7.md](04-propagation-7.md) | REQUIRED / REQUIRES_NEW / NESTED 등 7개 전수, 선택 기준 표 |
| 05 | 격리 수준과 DB 실제 동작 | [05-isolation-levels.md](05-isolation-levels.md) | 4 (+1) 격리, InnoDB REPEATABLE READ 의 phantom 차단, MVCC 와 lock |
| 06 | **readOnly 심화 (writable 과의 비교)** | [06-readonly-vs-writable.md](06-readonly-vs-writable.md) | FlushMode.MANUAL, snapshot 미보관, MySQL setReadOnly, silent failure 안티패턴 |
| 07 | **Replica routing 패턴** | [07-replica-routing-pattern.md](07-replica-routing-pattern.md) | AbstractRoutingDataSource + LazyConnectionDataSourceProxy 결합, msa 11서비스 표준 |
| 08 | 클래스 레벨 + AOP catch 함정 | [08-class-level-pitfalls.md](08-class-level-pitfalls.md) | 클래스 레벨 위험, 내부 try-catch + UnexpectedRollbackException |

### Phase 3: 외부 IO 분리 + 프로그래밍 방식 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 09 | 외부 IO 분리 패턴 | [09-external-io-separation.md](09-external-io-separation.md) | TransactionalService 분리, Outbox 폴링, @TransactionalEventListener (AFTER_COMMIT), Saga |
| 10 | TransactionTemplate / 프로그래밍 방식 | [10-transaction-template.md](10-transaction-template.md) | 코드로 트랜잭션 제어, Reactive 환경에서의 위치 |

### Phase 4: msa 코드베이스 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 11 | msa ADR-0020/0022 + 11 서비스 매핑 | [11-msa-mapping.md](11-msa-mapping.md) | DataSourceConfig 표준, ProductTransactionalService/OrderTransactionalService 분석 |
| 12 | msa Outbox + Saga 적용 분석 | [12-msa-outbox-saga.md](12-msa-outbox-saga.md) | inventory/fulfillment Outbox 폴링, ADR-0012 idempotent consumer 결합, Saga 후보 |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 13 | msa 개선 제안 종합 | [13-improvements.md](13-improvements.md) | TransactionalEventListener 도입, stickiness ADR (read-after-write), Outbox 정리 폴리시 |
| 14 | 면접 Q&A 카드 | [14-interview-qa.md](14-interview-qa.md) | 4 Phase × 6~10 카드 = 35+ 카드, readOnly 신규 질문 포함 |

---

## 개념 관계도

```
                 ┌───────────────────────────┐
                 │  AOP Proxy (Layer 1)      │
                 │  CGLIB / JDK              │
                 └──────────────┬────────────┘
                                │ 호출 시 전 / 후
                                ▼
                 ┌───────────────────────────┐
                 │  TransactionInterceptor   │
                 │  - 전파 속성 분기          │
                 │  - 롤백 규칙 적용          │
                 └──────────────┬────────────┘
                                │ TransactionSynchronizationManager
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
  │ Hibernate flush │ │ Routing key     │ │ AfterCommit hook │
  │ (readOnly →     │ │ (master/replica)│ │ (Outbox / Event) │
  │  MANUAL)        │ │                 │ │                  │
  └─────────────────┘ └─────────────────┘ └─────────────────┘
                                │
                                ▼
                 ┌───────────────────────────┐
                 │  Connection / DataSource  │
                 │  (LazyConnectionProxy)    │
                 └───────────────────────────┘
```

---

## 학습 시작 전 한 장 치트시트

### "@Transactional 이 동작 안 한다" 5대 원인

| 원인 | 메커니즘 | 회피 방법 |
|------|---------|----------|
| **Self-invocation** | 같은 빈 내부 호출은 프록시를 거치지 않음 | self 주입, AopContext, 클래스 분리 |
| **private 메서드** | 프록시는 외부에서 호출되는 public 메서드만 가로챔 | public 으로 변경 |
| **Checked Exception** | 기본 롤백 규칙은 RT/Error 만 | `rollbackFor = Exception::class` |
| **catch 후 정상 리턴** | 프록시가 예외를 못 봄 → 커밋 | catch 안에서 throw 하거나 `setRollbackOnly()` |
| **final 클래스/메서드 (CGLIB)** | CGLIB 가 서브클래스 못 만듦 | open 으로 변경 (Kotlin: kotlin-spring 플러그인) |

### Kotlin 특유 함정

- Kotlin 클래스는 기본 `final` → CGLIB 프록시 실패 → `kotlin-spring` 플러그인이 `@Component`/`@Transactional` 붙은 클래스를 자동 `open` 처리. 그 외 케이스는 명시적 `open` 필요.
- suspend 함수에 `@Transactional` 붙이면 정상 동작하지 않을 수 있음 → coroutine context 가 트랜잭션 동기화 ThreadLocal 과 분리됨. msa 의 `OrderService.execute(suspend)` 가 트랜잭션을 직접 안 가지고 `OrderTransactionalService` 로 위임하는 이유.

### 권장 기본값 (msa 표준)

| 상황 | 권장 |
|------|------|
| 단순 단일 쿼리 조회 | `@Transactional` 없음 |
| 여러 쿼리 + 스냅샷 일관성 | `@Transactional(readOnly = true)` |
| LazyLoading 사용 | `@Transactional(readOnly = true)` |
| 외부 API/Kafka 발행 포함 | **TX 분리 — `{Entity}TransactionalService` + Outbox** |
| 짧은 단일 쓰기 | `@Transactional` (메서드 레벨) |
| 클래스 레벨 `@Transactional` | 가급적 회피, 사용 시 조회 메서드는 `readOnly` 명시 |

### 절대 하지 말 것

- `@Transactional` 안에서 외부 HTTP/Kafka 호출
- 중첩 `@Transactional` 에서 내부 예외 catch
- `readOnly = true` 트랜잭션 안에서 entity 수정 (silent failure 또는 driver 예외)
- private 메서드에 `@Transactional`
- 같은 클래스 내부 메서드 호출에서 트랜잭션 기대
- `@Transactional` 클래스 레벨 + 일부 조회 메서드의 readOnly 미선언

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 14** Top-down. Phase 1-2 는 의존성 있음, Phase 3 부터는 어디든 점프 가능.
- **06 (readOnly) + 07 (Replica routing)** 는 본 학습의 핵심 신규 분량. 다른 자료에서 다루지 않는 깊이.
- **11-12 (msa 매핑)** 는 면접 답변 시 "실제 어떻게 쓰는가" 의 무기 — 회사 사례로 답할 수 있게 머리에 꽂아둔다.
- **14 (Q&A)** 는 회독용 — 학습 종료 후 1주일 간격 2-3회 회독.
- 코드 따라 작성 권장: 01 (CGLIB/JDK 비교 코드), 03 (self-invocation 재현), 06 (readOnly silent failure 재현), 07 (RoutingDataSource 직접 작성).

---

## 관련 다음 학습

- **#4 DB Index/Transaction** — 격리 수준이 InnoDB MVCC (Multi-Version Concurrency Control, 다중 버전 동시성 제어)/lock 으로 어떻게 구현되는지 깊게.
- **#15 Connection Pool** — `LazyConnectionDataSourceProxy` 가 connection 획득 시점을 늦추는 효과의 정량적 측정.
- **#7 Distributed Systems / #6 Kafka Internals** — Saga + Outbox 가 분산 환경에서 정확히 무엇을 보장하는가.
- **#3 Java/Kotlin Concurrency** — `ThreadLocal` 기반 `TransactionSynchronizationManager` 가 reactive 환경에서 깨지는 이유.
