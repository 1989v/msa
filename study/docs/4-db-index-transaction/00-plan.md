---
id: 4
title: DB 인덱스 + 트랜잭션 격리
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [database, mysql, index, b-tree, transaction, mvcc, isolation, lock, deadlock]
difficulty: advanced
estimated-hours: 25
codebase-relevant: true
---

# DB 인덱스 + 트랜잭션 격리

## 1. 개요

RDBMS (특히 MySQL/InnoDB) 의 인덱스 구조, 실행 계획 분석, 트랜잭션 격리 수준과 MVCC, Lock 매커니즘을 10년차 수준으로 학습한다. 거의 모든 백엔드 면접의 단골 주제이며, 실무에서도 성능/장애의 70% 이상이 DB 에서 발생한다.

msa 프로젝트가 서비스별 MySQL 을 사용하므로 모든 서비스에 직접 적용 가능.

## 2. 학습 목표

- B-Tree 인덱스의 구조와 탐색/삽입 동작을 설명할 수 있다
- 클러스터드 인덱스 vs 세컨더리 인덱스 차이 + InnoDB 에서의 특징
- Covering Index, 복합 인덱스의 순서 규칙, Index Skip Scan 등 고급 패턴 이해
- `EXPLAIN` / `EXPLAIN ANALYZE` 실행 계획을 해석할 수 있다
- ACID, 4가지 격리 수준 (READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE) 차이
- MVCC 동작 원리 (Undo log, Read View)
- InnoDB Lock 종류 (Record Lock, Gap Lock, Next-Key Lock, Insert Intention Lock)
- Deadlock 발생 시나리오와 진단/회피 방법
- 면접에서 "인덱스 왜 B-Tree 인가요?" "REPEATABLE READ 에서 Phantom Read 는?" 방어

## 3. 선수 지식

- SQL 기본 (SELECT, JOIN, subquery)
- 트랜잭션 개념 기본
- 자료구조 기본 (Tree)

## 4. 학습 로드맵

### Phase 1: 기본 개념
- 인덱스가 왜 필요한가 (Full Table Scan vs Index Seek)
- B-Tree 구조 (node, leaf, fanout)
- B+Tree 가 실제로 쓰이는 이유 (leaf 연결 리스트)
- 클러스터드 인덱스 (InnoDB PK) vs 세컨더리 인덱스
- Hash 인덱스, Bitmap 인덱스 (언제 쓰는가)
- ACID 4가지 속성
- 4가지 격리 수준 + 발생 이상 현상 (Dirty / Non-repeatable / Phantom)
- Lock 의 기본 종류 (Shared, Exclusive)

### Phase 2: 심화
- InnoDB 의 Hidden Column (DB_TRX_ID, DB_ROLL_PTR)
- MVCC: Read View, Undo Log, Consistent Read vs Locking Read
- InnoDB 기본 격리 수준: REPEATABLE READ + Gap Lock → Phantom Read 방어
- Gap Lock, Next-Key Lock, Insert Intention Lock 동작
- 복합 인덱스 순서 법칙 (= → IN → 범위 → 정렬)
- Covering Index: 인덱스만으로 쿼리 해결
- Index Merge: Union/Intersection
- Index Skip Scan (MySQL 8+)
- EXPLAIN 의 핵심 필드 (type, key, rows, Extra)
- EXPLAIN ANALYZE 실측 실행 시간
- 옵티마이저의 통계(Statistics) 와 Cardinality
- Slow Query Log + pt-query-digest
- Deadlock 시나리오 (순서 반대 UPDATE, Gap Lock 충돌)
- Online DDL (MySQL 8.0.12+), pt-online-schema-change

### Phase 3: 실전 적용
- msa 프로젝트 주요 테이블 스키마 탐색 (JPA `@Entity`)
- product/order/member 의 인덱스 전략 점검
- N+1 문제 탐지 (`@EntityGraph`, fetch join 사용처)
- ADR-0006 (database-strategy) 와 연결
- Deadlock 재현 예시: 두 트랜잭션이 반대 순서로 UPDATE
- JPA + Transactional 의 격리 수준 설정
- Read Replica 활용 패턴

### Phase 4: 면접 대비
- "인덱스는 왜 B-Tree 인가요? Hash 가 아닌 이유?"
- "복합 인덱스 (A, B) 가 있을 때 WHERE B = ? 만 쓰면 인덱스 타나요?"
- "REPEATABLE READ 에서 Phantom Read 가 발생하나요?"
- "Gap Lock 이 뭔가요? 언제 발생하나요?"
- "Deadlock 감지와 대응은 어떻게 하나요?"
- "MVCC 가 Lock 을 어떻게 대체하나요?"
- "EXPLAIN 의 type 중 ALL / index / range / ref / const 차이는?"

## 5. 코드베이스 연관성

- **JPA Entity**: `{service}/domain/src/main/kotlin/**/*.kt`
- **Repository 쿼리**: `{service}/app/src/main/kotlin/**/repository/*.kt`
- **마이그레이션/스키마**: Flyway 또는 Hibernate DDL
- **ADR-0006**: `docs/adr/ADR-0006-database-strategy.md` (DB 전략)
- **ADR-0020**: `docs/adr/ADR-0020-transactional-usage.md` (Transactional 사용 규칙)

## 6. 참고 자료

- "Real MySQL 8.0" - 백은빈, 이성욱
- "High Performance MySQL" - Baron Schwartz
- MySQL 공식 문서 (InnoDB Storage Engine)
- Use The Index, Luke! (use-the-index-luke.com)

## 7. 미결 사항

- DB 범위: MySQL 집중 vs PostgreSQL/Oracle 도 비교?
- 실습: 실제 테이블에 인덱스 추가/EXPLAIN 실행?
- Deadlock 재현 실습 포함 여부
- JPA + N+1 문제 심화 포함 여부

## 8. 원본 메모

DB 인덱스 + 트랜잭션 격리 (B-Tree, 클러스터드 인덱스, MVCC, Lock, Deadlock, 실행 계획 분석)
