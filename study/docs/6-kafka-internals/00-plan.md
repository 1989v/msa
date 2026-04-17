---
id: 6
title: Kafka 내부 동작
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [kafka, messaging, partition, consumer-group, exactly-once, idempotency, dlq]
difficulty: advanced
estimated-hours: 20
codebase-relevant: true
---

# Kafka 내부 동작

## 1. 개요

Kafka 의 아키텍처, 파티션/리플리케이션 메커니즘, Consumer Group 리밸런싱, Exactly-Once Semantics (EOS), 멱등성/트랜잭션/DLQ 등 프로덕션 Kafka 운영의 핵심 주제를 10년차 수준으로 학습한다.

msa 프로젝트가 Kafka 를 SSOT 기반 이벤트 버스로 사용하므로 직접 연결된다. ADR-0012 (멱등 Consumer), ADR-0015 (Resilience) 와 연계.

## 2. 학습 목표

- Kafka 의 브로커/파티션/리더/팔로워 구조를 설명할 수 있다
- ISR (In-Sync Replica) + Leader Election 동작 원리
- Producer 의 acks (0/1/all), linger.ms, batch.size, compression 튜닝
- Consumer Group 리밸런싱 (Eager / Cooperative Sticky)
- Offset 관리, Commit 전략 (auto / manual / sync / async)
- Exactly-Once Semantics 구현 (transactional producer + read_committed consumer)
- 멱등성 Consumer 패턴 (key 기반 중복 탐지)
- DLQ (Dead Letter Queue) 와 Retry 전략
- Kafka Streams vs Consumer API 선택 기준
- Schema Registry, Avro/Protobuf 활용
- 면접에서 "Exactly-Once 어떻게 구현하나요?" "리밸런싱 중 메시지 누락?" 방어

## 3. 선수 지식

- 메시지 큐 기본 개념
- Producer/Consumer 패턴
- 분산 시스템 기본 (CAP)

## 4. 학습 로드맵

### Phase 1: 기본 개념
- 브로커, 토픽, 파티션, 오프셋
- Producer/Consumer/Consumer Group
- 리플리케이션: Leader/Follower, ISR
- Partition 할당 전략 (Range, RoundRobin, Sticky)
- 메시지 보관 (retention.ms, log segment)
- Log Compaction
- ZooKeeper 제거 (KRaft 모드, Kafka 3.3+)

### Phase 2: 심화
- Producer 심화:
  - acks=0/1/all + 각 보장 수준
  - enable.idempotence (max.in.flight 제한)
  - linger.ms + batch.size 튜닝 (throughput vs latency)
  - compression.type (lz4/zstd 비교)
  - transactional.id (EOS)
- Consumer 심화:
  - poll 루프와 session.timeout.ms
  - Rebalancing: Eager vs Cooperative Sticky
  - Static Membership (group.instance.id)
  - fetch.min.bytes, fetch.max.wait.ms
  - 오프셋 커밋: auto vs manual sync/async
  - isolation.level (read_committed)
- Exactly-Once:
  - Transactional Producer → Consumer read_committed
  - Consume-Transform-Produce 패턴
- 멱등성 Consumer:
  - DB UNIQUE key 기반
  - Redis SETNX 기반
  - 이벤트 ID 저장 테이블
- Backpressure 처리
- Dead Letter Topic, Retry Topic 패턴
- Schema Registry + Avro/Protobuf (forward/backward 호환)
- Kafka Streams: KStream/KTable, stateful 처리, windowing
- Kafka Connect: Sink/Source Connector
- Rack Awareness (KIP-392) — AZ 간 비용 최적화
- Tiered Storage (Kafka 3.6+)

### Phase 3: 실전 적용
- msa 프로젝트 Kafka 사용처 전수 점검
- `docs/architecture/kafka-convention.md` 규약과 실제 코드 일치 여부
- ADR-0012 멱등 Consumer 패턴 적용 방식 확인
- ADR-0015 Resilience (DLQ) 구현 확인
- Kafka Consumer 의 concurrency 설정
- product/order/search 의 이벤트 흐름 다이어그램 작성
- Rack-awareness 설정 점검 (Cross-AZ 비용)

### Phase 4: 면접 대비
- "Kafka 가 왜 빠른가요?"
- "Exactly-Once Semantics 어떻게 구현하나요?"
- "Consumer Group Rebalancing 중 메시지가 누락될 수 있나요?"
- "멱등성 Consumer 를 어떻게 구현하나요?"
- "DLQ 는 언제 어떻게 쓰나요?"
- "Kafka 와 RabbitMQ 의 차이는?"
- "ZooKeeper 가 제거된 이유는?"

## 5. 코드베이스 연관성

- **Kafka Convention**: `docs/architecture/kafka-convention.md`
- **ADR-0012**: `docs/adr/ADR-0012-idempotent-consumer.md`
- **ADR-0015**: `docs/adr/ADR-0015-resilience-strategy.md`
- **Producer/Consumer 코드**: `{service}/app/src/main/kotlin/**/messaging/**`
- **Kafka 설정**: `{service}/app/src/main/resources/application.yml`
- **Kafka K8s 배포**: `k8s/infra/local/kafka/`, `k8s/infra/prod/`

## 6. 참고 자료

- "Kafka: The Definitive Guide" - Gwen Shapira 외
- Confluent 공식 블로그
- Apache Kafka 공식 문서
- KIPs (Kafka Improvement Proposals)

## 7. 미결 사항

- Kafka Streams 포함 여부 (msa 가 analytics 에서 사용)
- KRaft 모드 심화 여부
- Schema Registry 도입 검토 포함 여부
- EOS 실습 포함 여부

## 8. 원본 메모

Kafka 내부 동작 (파티션, 컨슈머 그룹, 리밸런싱, Exactly-once semantics, 멱등성, DLQ, 장애 대응)
