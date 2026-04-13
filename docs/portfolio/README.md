# Tech Portfolio — Commerce MSA Platform

> 10년차 백엔드/풀스택 개발자의 기술 역량을 이 레포지토리 코드 기반으로 정리한 문서입니다.
> 각 항목은 실제 코드 위치와 ADR 근거를 포함합니다.

---

## Overview

19개 마이크로서비스로 구성된 커머스 플랫폼. Clean Architecture를 물리적 모듈 분리로 강제하고,
Kubernetes 네이티브 배포, 이벤트 기반 통신, 장애 대비 패턴을 실제 운영 수준으로 구현.

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway (WebFlux)                 │
│              JWT · Rate Limiting · Routing               │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┤
│Product│Order │Search│ Auth │Member│Gifti-│Inven-│Fulfill-│
│      │      │      │      │      │ con  │ tory │  ment  │
├──────┴──────┴──────┴──────┴──────┴──────┴──────┴────────┤
│            Kafka (Event Bus)  ·  Redis (Cache/Lock)      │
├──────────────────────────────────────────────────────────┤
│  MySQL(per-svc) · ES · OpenSearch · ClickHouse · pgvector│
├──────────────────────────────────────────────────────────┤
│        Kubernetes (Kustomize · Jib · Operator)           │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | **Kotlin 2.2** (primary), Python 3.11, TypeScript |
| Framework | Spring Boot 4.0, Spring Cloud 2025.1, FastAPI |
| Build | Gradle (Kotlin DSL), Java 25 LTS toolchain |
| Database | MySQL 8.0 (per-service), Redis Cluster, Elasticsearch, OpenSearch, ClickHouse, PostgreSQL+pgvector |
| Messaging | Apache Kafka (KRaft), Kafka Streams |
| Container | Jib (daemonless), k3d (local), Kustomize overlays |
| Orchestration | Kubernetes (k3s-lite / managed K8s + Operators) |
| CI/CD | GitHub Actions (build, test, Jib push to GHCR) |
| Test | Kotest 5.9.1 BehaviorSpec, MockK |
| Frontend | React 19, Vite, Three.js, D3 Force-3D |
| AI/Agent | Claude Code harness, agent-os standards, skill system |

---

## Key Technical Highlights

| # | 역량 | 핵심 포인트 | 상세 |
|---|------|-----------|------|
| 1 | **System Architecture** | Clean Architecture 물리적 강제, 19 마이크로서비스, Port & Adapter | [architecture.md](./01-architecture.md) |
| 2 | **Distributed Systems** | Circuit Breaker, Saga Choreography, Outbox, Idempotent Consumer, DLQ | [distributed-systems.md](./02-distributed-systems.md) |
| 3 | **Data Platform** | 6종 DB 전략, Kafka Streams 실시간 집계, CDC, Master/Replica 라우팅 | [data-platform.md](./03-data-platform.md) |
| 4 | **Cloud Native & DevOps** | K8s 2-mode 배포, Operator 기반 인프라, Jib, XtraBackup PITR | [infrastructure.md](./04-infrastructure.md) |
| 5 | **Security** | JWT + AES-256-GCM, OAuth2 (Kakao/Google), RBAC, Rate Limiting | [security.md](./05-security.md) |
| 6 | **Testing** | BDD (Kotest), 레이어별 격리 전략, 도메인 순수 단위 테스트 | [testing.md](./06-testing.md) |
| 7 | **Frontend & Visualization** | React 19, 3D Force Graph, 히트맵, 트리맵, OpenSearch 자동완성 | [frontend.md](./07-frontend.md) |
| 8 | **AI Engineering** | Agent OS, 하네스 표준, 아이디어→PRD→구현 파이프라인 | [ai-engineering.md](./08-ai-engineering.md) |
| 9 | **Polyglot & DX** | Kotlin/Python/TypeScript, 공통 라이브러리 AutoConfiguration | [polyglot.md](./09-polyglot.md) |

---

## Services Map

| Service | Stack | DB | Key Pattern | Code |
|---------|-------|----|------------|------|
| **gateway** | Spring Cloud Gateway (WebFlux) | - | JWT filter, Token Bucket Rate Limit | `gateway/` |
| **product** | Kotlin/Spring Boot, QueryDSL | MySQL | SSOT, Kafka 발행 | `product/{domain,app}/` |
| **order** | Kotlin/Spring Boot, Coroutines | MySQL | Saga trigger, 멱등성 | `order/{domain,app}/` |
| **search** | Kotlin/Spring Boot, ES | Elasticsearch | 3-module (API/Consumer/Batch), Nori 분석기 | `search/{domain,app,consumer,batch}/` |
| **inventory** | Kotlin/Spring Boot, Optimistic Lock | MySQL | CQRS Read Model (Redis), Outbox | `inventory/{domain,app}/` |
| **fulfillment** | Kotlin/Spring Boot, State Machine | MySQL | Outbox, 배송 상태 전이 | `fulfillment/{domain,app}/` |
| **auth** | Kotlin/Spring Boot, OAuth2 | MySQL | JWT refresh/revoke, AES-256-GCM | `auth/{domain,app}/` |
| **analytics** | Kafka Streams, ClickHouse | ClickHouse | 1h tumbling window, score 산출 | `analytics/{domain,app}/` |
| **experiment** | Kotlin/Spring Boot | MySQL | A/B 버킷 (MurmurHash3), 실험 결과 분석 | `experiment/{domain,app}/` |
| **code-dictionary** | Kotlin + React, OpenSearch | MySQL + OpenSearch | 하이브리드 검색, 3D 시각화 | `code-dictionary/` |
| **charting** | **Python/FastAPI**, pgvector | PostgreSQL | 벡터 유사도 (HNSW), 주가 패턴 분석 | `charting/` |
| **admin** | React 19, Vite | - | CRUD UI, 대시보드 | `admin/frontend/` |

---

## ADR (Architecture Decision Records) — 22건

22개의 ADR로 모든 아키텍처 결정을 문서화. → [전체 목록](../adr/)

| 주요 ADR | 결정 사항 |
|---------|---------|
| ADR-0003 | 동기(WebClient+CB) / 비동기(Kafka) 통신 분리 |
| ADR-0006 | Service-per-DB, Master/Replica, Flyway 마이그레이션 |
| ADR-0011 | Outbox pattern (Polling → Debezium CDC) |
| ADR-0012 | Idempotent Consumer (eventId dedup, 7일 보관) |
| ADR-0015 | 장애 대비 5종: CB, DLQ, Rate Limit, CQRS, Bulkhead |
| ADR-0017 | Kafka Streams + ClickHouse OLAP + Redis score cache |
| ADR-0019 | K8s 전환: Jib, Kustomize, Eureka 제거, 2-mode 배포 |

---

## How to Explore

```bash
# 전체 빌드 & 테스트
./gradlew build

# 단일 서비스 도메인 테스트 (Spring context 없음)
./gradlew :product:domain:test

# 로컬 K8s 클러스터 원클릭 구동
scripts/k3d-up.sh

# Kustomize 오버레이 적용
kubectl apply -k k8s/overlays/k3s-lite
```

---

## Document Generation

이 포트폴리오는 `/portfolio-gen` 스킬로 코드베이스를 재분석하여 갱신 가능합니다.

```
# Claude Code에서
/portfolio-gen          # 전체 재생성
/portfolio-gen --diff   # 변경분만 업데이트 (미구현, 향후)
```

---

*Auto-generated from codebase analysis. Last updated: 2026-04-14*
