---
id: 7
title: 분산 시스템 이론 + 패턴
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [distributed-systems, cap, pacelc, saga, 2pc, idempotency, circuit-breaker]
difficulty: advanced
estimated-hours: 18
codebase-relevant: true
---

# 분산 시스템 이론 + 패턴

## 1. 개요

분산 시스템의 이론적 기반 (CAP, PACELC, FLP Impossibility, Consensus) 과 실전 패턴 (SAGA, 2PC, Idempotency, Retry, Circuit Breaker, 분산 락) 을 학습한다. MSA 아키텍처를 설계/운영하는 10년차 백엔드 개발자의 필수 지식.

msa 프로젝트가 이미 MSA 기반이라 모든 패턴이 적용 가능하며, ADR-0012/0015 와 직결.

## 2. 학습 목표

- CAP / PACELC / FLP 의 의미와 실제 시스템의 선택 근거 설명
- Consensus 알고리즘 (Paxos, Raft) 의 개념과 사용처 (etcd, ZooKeeper)
- 분산 트랜잭션: 2PC, 3PC, SAGA (Choreography vs Orchestration) 차이
- Idempotency 보장 방법 (Request ID, Deduplication key, 멱등 연산 설계)
- Retry 전략 (Exponential Backoff + Jitter), 멱등성과의 관계
- Circuit Breaker 패턴 (Resilience4j, Hystrix)
- 분산 락 (Redis RedLock, ZooKeeper) 의 한계와 사용처
- Event Sourcing, CQRS 의 장단점
- Eventually Consistent 의 실무 의미
- 면접 "CAP 에서 뭘 버리셨어요?" "SAGA 와 2PC 차이?" 같은 질문 방어

## 3. 선수 지식

- MSA 기본 개념
- HTTP/REST 통신
- 메시지 큐 기본

## 4. 학습 로드맵

### Phase 1: 기본 개념
- 분산 시스템 정의와 도전 과제 (네트워크 partition, 시간 동기화, 부분 장애)
- CAP 정리: Consistency / Availability / Partition Tolerance
- PACELC: Partition 시 C/A + Latency 시 C/L
- FLP Impossibility: 비동기 네트워크에서 결정론적 합의 불가능
- 결정적(Strong) vs 최종(Eventual) 일관성
- Consensus: 필요성과 쓰임
- Replica 구성 (Primary-Replica, Multi-Master)

### Phase 2: 심화
- Paxos vs Raft (Raft 가 이해하기 쉬움)
- Vector Clock, Lamport Clock
- 분산 트랜잭션:
  - 2PC (Two-Phase Commit) - 블로킹, coordinator 장애 문제
  - 3PC - 개선이지만 네트워크 분할에 취약
  - SAGA - 장기 트랜잭션, Compensating Transaction
    - Choreography: 이벤트 기반 (서비스 간 decoupling ↑, 추적 ↓)
    - Orchestration: 중앙 조정자 (추적 ↑, SPoF 위험)
- Idempotency 패턴:
  - Request ID 중복 탐지
  - Idempotency Key
  - Natural Idempotency (PUT, DELETE by ID)
  - 멱등 Consumer 구현 (DB UNIQUE, Redis SETNX)
- Retry 전략:
  - Exponential Backoff + Jitter
  - Max retry limit
  - Retry 가능 에러 구분 (5xx / timeout vs 4xx)
- Circuit Breaker:
  - Closed / Open / Half-Open 상태
  - Resilience4j 구현 패턴
  - Fallback 전략
- Bulkhead 패턴 (thread pool 격리)
- Rate Limiting 알고리즘: Token Bucket, Leaky Bucket, Sliding Window
- 분산 락:
  - Redis SETNX / Redisson RedLock (controversial)
  - ZooKeeper / etcd
  - 펜싱 토큰
- Event Sourcing: 상태 = 이벤트 순서
- CQRS: Command Query Responsibility Segregation
- Outbox Pattern: DB + Kafka 원자성 보장
- Exactly-Once 구현 전략

### Phase 3: 실전 적용
- msa 프로젝트 ADR-0012 (멱등 Consumer) 구현 리뷰
- ADR-0015 (Resilience Strategy) - Circuit Breaker, DLQ, Rate Limiting, CQRS
- inventory-fulfillment 의 SAGA 패턴 적용 가능성 (ADR-0011)
- gateway 의 Rate Limiting 구현 (Redis Token Bucket)
- product-inventory SSOT (ADR-0013) 와 일관성 모델

### Phase 4: 면접 대비
- "CAP 에서 AP 선택했다는 게 무슨 뜻인가요?"
- "SAGA Orchestration vs Choreography 선택 기준?"
- "2PC 가 현대 시스템에서 안 쓰이는 이유?"
- "멱등성이 왜 중요한가요? 어떻게 보장하나요?"
- "Circuit Breaker 가 언제 Half-Open 으로 바뀌나요?"
- "Redis 분산 락의 한계는?"
- "Eventual Consistency 를 실무에서 어떻게 다루나요?"

## 5. 코드베이스 연관성

- **ADR-0012**: `docs/adr/ADR-0012-idempotent-consumer.md`
- **ADR-0015**: `docs/adr/ADR-0015-resilience-strategy.md`
- **ADR-0011**: `docs/adr/ADR-0011-inventory-fulfillment-service.md`
- **ADR-0013**: `docs/adr/ADR-0013-product-inventory-ssot.md`
- **Gateway Rate Limiting**: `gateway/src/main/kotlin/...`
- **Kafka 멱등 Consumer**: `{service}/app/src/main/kotlin/**/messaging/**`
- **Architecture**: `docs/architecture/resilience-strategy.md`

## 6. 참고 자료

- "Designing Data-Intensive Applications" - Martin Kleppmann
- "Release It!" - Michael T. Nygard (Circuit Breaker, Bulkhead)
- Raft 논문 (In Search of an Understandable Consensus Algorithm)
- Martin Fowler 블로그 (CQRS, Event Sourcing, SAGA)

## 7. 미결 사항

- 이론 깊이: Raft/Paxos 내부 알고리즘 이해 vs 개념만
- 실습 포함: Resilience4j 실제 구현 실습?
- Event Sourcing 도입 가능성 검토 포함 여부

## 8. 원본 메모

분산 시스템 이론 + 패턴 (CAP/PACELC, SAGA, 2PC, 분산 락, Idempotency, Retry, Circuit Breaker)
