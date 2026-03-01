# ADR-0006: 데이터베이스 전략

## Status
Accepted

## Context
서비스별 DB 완전 분리, 읽기 성능 최적화, 트랜잭션 일관성 보장 필요.

## Decision
- 서비스별 독립 MySQL 인스턴스 (product-db, order-db 완전 분리)
- 각 서비스별 MySQL Master(Write) + Replica(Read) 구성
- AbstractRoutingDataSource로 @Transactional(readOnly=true) → Replica 자동 라우팅
- JPA + QueryDSL (복잡 쿼리), Blocking I/O 유지
- 분산 트랜잭션 금지 → Kafka 이벤트 기반 Eventual Consistency

## Alternatives Considered
- 단일 MySQL 멀티 스키마: 물리적 분리 없어 의존성 완전 차단 불가
- PostgreSQL: MySQL 대비 팀 경험 부족, 운영 일관성
- MongoDB: 스키마 유연성 있으나 트랜잭션 지원 제한적

## Consequences
- Replica 지연(Replication Lag) 발생 가능 → 강한 일관성 필요 시 Master 직접 조회
- 서비스별 독립 배포/스케일 가능
- 스키마 마이그레이션: Flyway 사용 (Liquibase 대비 Spring Boot 통합 단순, SQL 기반으로 학습 비용 낮음)
  각 서비스 모듈이 독립적으로 Flyway 마이그레이션 관리
