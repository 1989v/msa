---
id: 5
title: Spring Transactional 심화
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [spring, transactional, propagation, isolation, aop, proxy]
difficulty: intermediate
estimated-hours: 12
codebase-relevant: true
---

# Spring Transactional 심화

## 1. 개요

Spring 의 `@Transactional` 애노테이션 동작 원리, 전파 속성 7종, 격리 수준, proxy 기반 AOP 의 한계, 외부 IO 분리 패턴을 심화 학습한다. 10년차가 반드시 방어해야 하는 주제이며, msa 프로젝트의 ADR-0020 이 이미 규정하고 있어 실무 연결이 직결된다.

## 2. 학습 목표

- Spring AOP 기반 Transactional 의 proxy 동작 원리를 설명할 수 있다
- self-invocation 문제와 우회 방법 (self 주입, AopContext) 을 안다
- 7가지 전파 속성 (REQUIRED/REQUIRES_NEW/NESTED 등) 의 차이와 선택 기준
- 5가지 격리 수준 + DB 기본값 관계
- 외부 IO (HTTP, Kafka 발행) 와 DB 트랜잭션을 어떻게 분리하는가
- 중첩 트랜잭션, 예외 상황의 롤백 규칙 (RuntimeException vs Checked)
- `readOnly = true` 의 의미와 실제 효과
- 면접에서 "Transactional 이 동작 안 할 때가 있나요?" 같은 함정 질문 방어

## 3. 선수 지식

- Spring Framework 기본 (Bean, AOP)
- JPA 기본
- Proxy 패턴 이해

## 4. 학습 로드맵

### Phase 1: 기본 개념
- Transactional 의 동작: 프록시 기반 AOP
- CGLIB vs JDK Dynamic Proxy 차이
- @Transactional 이 붙을 수 있는 위치: 클래스 / 메서드 / 인터페이스
- 기본 전파 속성 (REQUIRED)
- 기본 격리 수준 (DEFAULT — DB 기본값 따름)
- 예외 발생 시 롤백 규칙 (RuntimeException / Error 기본 롤백, Checked 미롤백)
- `rollbackFor`, `noRollbackFor` 설정

### Phase 2: 심화
- Self-invocation 문제: 같은 클래스 내 메서드 호출 시 프록시 우회 → Transactional 미적용
- 우회 패턴: self 주입, AopContext.currentProxy(), 클래스 분리
- 7가지 전파 속성 전수 비교:
  - REQUIRED (기본)
  - REQUIRES_NEW — 독립 트랜잭션
  - SUPPORTS — 있으면 참여, 없으면 비트랜잭션
  - NOT_SUPPORTED — 트랜잭션 중단
  - MANDATORY — 반드시 기존 필요
  - NEVER — 기존 있으면 예외
  - NESTED — Savepoint 기반 중첩
- 5가지 격리 수준과 DB 의 실제 동작 (InnoDB REPEATABLE READ 차이 등)
- `readOnly = true`: Hibernate flush 모드 + DB 힌트
- 클래스 레벨 `@Transactional` 의 주의 (모든 public 메서드에 적용)
- 외부 IO 분리 패턴:
  - Transactional 밖에서 Kafka 발행 (Outbox 패턴)
  - `@TransactionalEventListener` 사용
  - Saga 패턴
- 예외 처리: AOP 내부에서 catch 시 롤백 안 되는 이슈
- `TransactionTemplate` 프로그래밍 방식

### Phase 3: 실전 적용
- msa 프로젝트 `@Transactional` 사용처 점검 (ADR-0020)
- Outbox 패턴 적용 여부 (product/order 등)
- Kafka 발행을 트랜잭션 밖에서 하는 패턴 (ADR-0012 연계)
- Entity 수정 규칙 (ADR-0022) 과의 상호작용
- Saga 패턴 적용 여부 (inventory-fulfillment 등)

### Phase 4: 면접 대비
- "Transactional 이 동작하지 않는 경우는 언제인가요?"
- "REQUIRES_NEW 와 NESTED 의 차이는?"
- "Checked Exception 에서 롤백이 기본으로 안 되는 이유는?"
- "Kafka 발행과 DB 트랜잭션을 어떻게 결합하나요?"
- "readOnly=true 의 실제 효과는?"

## 5. 코드베이스 연관성

- **ADR-0020**: `docs/adr/ADR-0020-transactional-usage.md`
- **ADR-0022**: `docs/adr/ADR-0022-entity-mutation-conventions.md`
- **Service 레이어**: `{service}/app/src/main/kotlin/**/application/**/*Service.kt`
- **Outbox/Kafka 발행 패턴**: 메시징 관련 코드

## 6. 참고 자료

- Spring Framework 공식 문서 (Transaction Management)
- "Spring in Action" - Craig Walls
- Vlad Mihalcea 블로그 (Hibernate + Transaction)

## 7. 미결 사항

- ADR-0020 기반으로 진행 범위 한정 vs 일반 이론 중심
- Saga / Outbox 패턴 깊이
- TransactionTemplate 실습 여부

## 8. 원본 메모

Spring Transactional 심화 (전파 속성, 격리 수준, proxy 한계, 외부 IO 분리, 중첩 트랜잭션)
