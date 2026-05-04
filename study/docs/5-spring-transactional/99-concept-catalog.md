---
parent: 5-spring-transactional
seq: 99
title: Spring @Transactional 개념 카탈로그 — Full-Coverage + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://docs.spring.io/spring-framework/reference/data-access/transaction.html
  - https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html
  - https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html
---

# 99. Spring @Transactional 개념 카탈로그

> **목적** — 5-spring-transactional 의 14+ deep file + Spring Framework 6.x / Spring Data JPA 공식 기준 빠진 영역 발굴 (REQUIRES_NEW + suspend/resume 동작, ChainedTxManager, Reactive TX, AbstractRoutingDataSource 패턴, TransactionTemplate vs declarative, SavePoint 사용 등).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| Propagation 7종 | REQUIRED / REQUIRES_NEW / NESTED / SUPPORTS / NOT_SUPPORTED / MANDATORY / NEVER | ✅ |
| Isolation | DEFAULT + 4 ANSI level | ✅ |
| Proxy AOP 한계 | self-invocation, static, private | ✅ |
| 외부 IO 분리 | "TX 안 외부 호출 금지" 원칙 (ADR-0020) | ✅ |
| readOnly | 최적화 + replica routing 힌트 | ✅ |
| Rollback rules | rollbackFor / noRollbackFor / unchecked default | ✅ |
| timeout | 트랜잭션 타임아웃 | ✅ |
| msa 적용 | ADR-0020 코드 grounding | ✅ |

### 1-A. 갭 진단

1. **PlatformTransactionManager 종류** — DataSource / JpaTransactionManager / JtaTransactionManager / R2dbcTransactionManager / ReactiveTransactionManager
2. **ChainedTransactionManager** — 다중 자원 (best-effort 1PC)
3. **TransactionTemplate** (programmatic) vs declarative
4. **TransactionAwareDataSourceProxy** — outside-Spring DataSource 사용 시
5. **TransactionSynchronization / TransactionSynchronizationManager** — afterCommit / afterCompletion
6. **TransactionPhase events** (@TransactionalEventListener) — BEFORE_COMMIT / AFTER_COMMIT / AFTER_ROLLBACK / AFTER_COMPLETION
7. **SavePoint** — JDBC level + Spring abstraction
8. **REQUIRES_NEW 의 실제 동작** — outer suspend, new TX, inner commit, outer resume
9. **NESTED** — JDBC SavePoint 활용
10. **AbstractRoutingDataSource** — readOnly → reader, write → writer routing
11. **Reactive TX** (R2DBC + ReactiveTransactionManager) — `TransactionalOperator`
12. **Coroutine + @Transactional** — Spring 6 의 suspend 함수 지원
13. **JTA / Distributed TX** — Atomikos / Narayana — 회피 가이드
14. **Two-phase commit (XA)** — DB 가 지원하는 전제 + 회피 사유
15. **Local Transaction + Outbox** — 분산 시 권장 (#7 #19 cross)
16. **Read-only TX 의 진짜 효과** — flush mode MANUAL, snapshot 가시성, replica 라우팅
17. **noRollbackForClassName / rollbackForClassName** — 문자열 룰
18. **Propagation 의 thread-binding 모델** — ThreadLocal 기반의 한계 (Virtual Thread 영향?)
19. **JTA + JMS + DB** — 다중 자원 트랜잭션 패턴
20. **Spring Boot 의 자동 구성** — `spring.transaction.default-timeout` / `rollback-on-commit-failure`
21. **TransactionInterceptor 내부** — @Transactional 의 advice
22. **AbstractPlatformTransactionManager 의 상태 머신** (begin/commit/rollback/cleanup)
23. **Connection 점유 시간 분석** — long-running TX 의 풀 고갈 (#15 cross)
24. **MDL + long-running TX 충돌** (#4 cross) — Online DDL 위험

---

## 2. 카테고리별 개념 트리

### A. Propagation 7종 동작

| Propagation | 외부 TX 있음 | 외부 TX 없음 |
|---|---|---|
| REQUIRED (default) | join | new |
| REQUIRES_NEW | suspend outer + new | new |
| NESTED | SavePoint | new |
| SUPPORTS | join | non-TX |
| NOT_SUPPORTED | suspend outer + non-TX | non-TX |
| MANDATORY | join | exception |
| NEVER | exception | non-TX |

> 핵심 함정: **REQUIRES_NEW 는 동일 thread 에서 outer 의 connection 을 suspend** — connection pool 2 개 점유.

### B. PlatformTransactionManager 종류

| TM | 용도 | 상태 |
|---|---|---|
| DataSourceTransactionManager | JDBC 직접 | ✅ |
| JpaTransactionManager | JPA + JDBC 동시 | ✅ |
| JtaTransactionManager | XA 분산 | ★ 신규 (회피 가이드) |
| ChainedTransactionManager | 다중 자원 best-effort | ★ 신규 |
| ReactiveTransactionManager / R2dbcTransactionManager | Reactive | ★ 신규 |

### C. AOP 동작 / 한계

| 함정 | 원인 | 회피 |
|---|---|---|
| Self-invocation | this.method() — proxy bypass | self proxy 주입 또는 분리 |
| static method | proxy 적용 안 됨 | 일반 메서드 |
| private method | 동일 | public/package |
| final class/method | CGLIB 불가 (JDK proxy 는 interface) | non-final |
| 클래스 레벨 @Transactional | 상속 + 모든 메서드에 적용 | 신중히 |

### D. TransactionTemplate (programmatic)

```java
new TransactionTemplate(txManager).execute(status -> {
    // ...
    if (cond) status.setRollbackOnly();
    return result;
});
```

- **언제**: 동적 트랜잭션 결정, batch loop, 외부 IO 분리 패턴
- declarative 와 혼용 가능

### E. Synchronization / 이벤트

| 개념 | 정의 | 상태 |
|---|---|---|
| TransactionSynchronizationManager | 현재 TX 상태 조회 | 🟡 |
| @TransactionalEventListener (phase) | BEFORE_COMMIT / AFTER_COMMIT / AFTER_ROLLBACK | ★ 신규 |
| afterCommit 콜백 — 외부 알림 표준 | Outbox 와 결합 | ★ 신규 |

### F. SavePoint / NESTED

| 개념 | 정의 | 상태 |
|---|---|---|
| JDBC SavePoint | 부분 롤백 | ★ 신규 |
| Spring NESTED → SavePoint | DataSource TM 만 지원 | ★ 신규 |

### G. Reactive TX

| 개념 | 정의 | 상태 |
|---|---|---|
| TransactionalOperator | reactive programmatic | ★ 신규 |
| @Transactional + Mono/Flux | reactive declarative (Spring 5.2+) | ★ 신규 |
| R2DBC + R2dbcTransactionManager | reactive JDBC | ★ 신규 |
| Coroutine + @Transactional | Spring 6 suspend 지원 | ★ 신규 |

### H. 다중 자원 / 분산

| 개념 | 정의 | 상태 |
|---|---|---|
| ChainedTransactionManager | 자원 N 개 best-effort 1PC | ★ 신규 |
| JTA (XA) | 분산 — 회피 권장 | ★ 신규 |
| **Outbox 패턴** | DB TX 안에서 outbox 만 → 외부 발행은 별도 (현재 권장) | ✅ (#7) |
| **CDC (Debezium)** | binlog → Kafka → consumer | ✅ (#19) |

### I. Read/Write 분리

| 개념 | 정의 | 상태 |
|---|---|---|
| readOnly=true | flush MANUAL + replica routing 힌트 | ✅ |
| AbstractRoutingDataSource | TransactionSynchronizationManager 의 readOnly 조회 → reader 라우팅 | ★ 신규 |
| LazyConnectionDataSourceProxy | TX 시작 시점에야 connection 획득 | 🟡 |

### J. 운영 / 진단

| 개념 | 정의 | 상태 |
|---|---|---|
| `spring.jpa.show-sql` / `org.hibernate.SQL` | SQL 로깅 | ✅ |
| HikariCP TX leak 진단 | leakDetectionThreshold | 🟡 (#15) |
| TX boundary 와 connection 점유 분석 | profile 기반 | 🟡 |
| MDL + long-running TX (#4) | 운영 사고 패턴 | ✅ |
| Virtual Thread + @Transactional | ThreadLocal 영향 (현재 호환) | ★ 신규 |

---

## 3. 우선 심화 후보 Top-8

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **REQUIRES_NEW 의 connection 점유 분석** | 풀 고갈 사고 단골 |
| 2 | **@TransactionalEventListener (AFTER_COMMIT) + Outbox** | 안전한 외부 발행 표준 |
| 3 | **AbstractRoutingDataSource + readOnly routing** | R/W 분리 표준 (#15 cross) |
| 4 | **TransactionTemplate** (programmatic) | 외부 IO 분리 + batch |
| 5 | **Reactive TX (R2DBC / Coroutine)** | reactive 진입 시 |
| 6 | **ChainedTransactionManager** | 다중 자원 best-effort |
| 7 | **NESTED + SavePoint** | 부분 롤백 시나리오 |
| 8 | **Virtual Thread + @Transactional 의 호환성** | Loom 도입 시 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Spring TX 특화:
- §3 → "Propagation × 외부 TX 매트릭스" 1개
- §6 → 등가 패턴 (programmatic vs declarative)
- §8 → ADR-0020 + msa repo grounding (어떤 코드가 외부 IO 분리 위반인지)

---

## 5. 참고 자료

- Spring Framework Reference (TX): https://docs.spring.io/spring-framework/reference/data-access/transaction.html
- Spring Data JPA (TX): https://docs.spring.io/spring-data/jpa/reference/jpa/transactions.html
- "Spring in Action" (5e/6e)
- ADR-0020 (msa) — `@Transactional` 사용 규칙
