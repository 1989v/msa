---
id: 9
title: Redis 심화
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [redis, cache, persistence, cluster, stampede, distributed-lock, stream]
difficulty: intermediate
estimated-hours: 15
codebase-relevant: true
---

# Redis 심화

## 1. 개요

Redis 의 내부 자료구조, 퍼시스턴스 (AOF/RDB), 클러스터 모드, Cache Stampede 방어, 분산 락, Stream 까지 10년차 수준으로 학습한다. 대부분의 한국 서비스가 Redis 를 쓰기 때문에 면접 빈도 매우 높음.

msa 프로젝트에서 Redis 를 gateway Rate Limiting, 여러 서비스 캐시에 사용 중이라 직접 적용 가능.

## 2. 학습 목표

- 9가지 자료구조 (String, List, Hash, Set, SortedSet, Bitmap, HyperLogLog, Geo, Stream) 특성 이해
- 내부 구현 (ziplist, intset, listpack, skiplist, hashtable) 선택 기준
- 퍼시스턴스: RDB (snapshot) vs AOF (append-only) 트레이드오프
- Replication, Sentinel, Cluster 3가지 HA 모델 차이
- Cache 전략 (Cache-Aside, Write-Through, Write-Behind, Refresh-Ahead)
- Cache Stampede (Dog-pile) 방어 패턴
- 분산 락 (SETNX, Redisson RedLock) 과 한계
- Redis Stream 과 Kafka 비교
- Pub/Sub 의 한계와 사용 시점
- 면접 "Redis 와 Memcached 차이?" "클러스터 모드 어떻게 동작?" 방어

## 3. 선수 지식

- Key-Value Store 기본 개념
- Cache 기본 패턴
- Linux 기본

## 4. 학습 로드맵

### Phase 1: 기본 개념
- Redis 의 단일 스레드 모델 + I/O Multiplexing
- 9가지 자료구조:
  - String, List, Hash, Set, Sorted Set (기본)
  - Bitmap, HyperLogLog, Geo, Stream (고급)
- TTL 과 Eviction 정책 (LRU, LFU, TTL, random)
- Pub/Sub 기본
- Transaction (MULTI/EXEC)
- Pipeline

### Phase 2: 심화
- 내부 자료구조 선택:
  - 소규모: ziplist, intset, listpack (메모리 효율)
  - 대규모: skiplist (sorted set), hashtable (hash)
  - Redis 7+: listpack 통합
- 퍼시스턴스:
  - RDB: snapshot, SAVE/BGSAVE, 빠른 restore
  - AOF: append-only, fsync 정책 (always/everysec/no)
  - 하이브리드 (RDB + AOF 혼합)
- Replication: async, chain replication
- Sentinel: failover 자동화, quorum
- Cluster: 16384 hash slot, slot 이동, resharding
- Cache 전략:
  - Cache-Aside (lazy loading): 가장 흔함
  - Write-Through: 쓰기 시 DB+Cache 동시
  - Write-Behind: Cache 먼저, DB 는 비동기
  - Refresh-Ahead: TTL 근처 Pre-warming
- Cache Stampede 방어:
  - Probabilistic early expiration (XFetch algorithm)
  - Mutex/Lease (한 인스턴스만 재계산)
  - SingleFlight 패턴
- 분산 락:
  - SETNX + TTL (기본)
  - Redisson RedLock (5+ Redis 노드)
  - Martin Kleppmann 비판 (fencing token 필요성)
- Redis Stream: Consumer Group, XREAD, XADD, XACK
  - Kafka 와 비교 (영속성, 처리량, consumer)
- Lua Script 와 원자성
- Memory 관리: maxmemory, defrag

### Phase 3: 실전 적용
- msa 프로젝트 Redis 사용처 전수 점검
- gateway Rate Limiting (Token Bucket) 구현 리뷰
- product 조회 캐시 패턴
- Cache Stampede 방어 적용 여부
- Redis standalone vs cluster 모드 (k8s/infra/local/redis/)
- K8s 에서 Redis 클러스터 모드 전환 시 5개 서비스 (gateway, product, gifticon, analytics, experiment) 영향
- Redisson 사용 여부
- ADR 관련 (Redis 전략 ADR 신규 필요성?)

### Phase 4: 면접 대비
- "Redis 가 왜 빠른가요?"
- "RDB 와 AOF 중 뭘 쓰세요?"
- "Cache Stampede 가 뭐고 어떻게 방어하나요?"
- "Redis Cluster 모드에서 transaction 이 안 되는 이유는?"
- "Redis 분산 락의 한계는?"
- "Redis Stream 과 Kafka 중 언제 뭘 쓰나요?"
- "Pub/Sub 를 왜 메시지 큐 대용으로 쓰면 안 되나요?"

## 5. 코드베이스 연관성

- **Gateway Rate Limiting**: `gateway/src/main/kotlin/.../RateLimitingConfig.kt`
- **Redis 설정**: `{service}/app/src/main/resources/application.yml`
- **Redis K8s 배포**: `k8s/infra/local/redis/`
- **Redis 사용 서비스**: gateway, product, gifticon, analytics, experiment

## 6. 참고 자료

- Redis 공식 문서
- "Redis in Action" - Josiah L. Carlson
- Martin Kleppmann: "How to do distributed locking"
- antirez 블로그 (Redis 저자)

## 7. 미결 사항

- Redis Stream 심화 (msa 에 도입 가능성?)
- Redisson 사용 여부 확인 후 범위 결정
- Cluster 모드 실습 범위
- Lua Script 실전 예시 포함 여부

## 8. 원본 메모

Redis 심화 (자료구조 내부, AOF/RDB 퍼시스턴스, 클러스터, Cache Stampede 방어, 분산 락, Stream)
