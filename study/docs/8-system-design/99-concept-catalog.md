---
parent: 8-system-design
seq: 99
title: 시스템 설계 시나리오 카탈로그 — 표준 시나리오 + 평가 축 + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - "System Design Interview Vol. 1, 2 (Alex Xu)"
  - "Designing Data-Intensive Applications (Kleppmann)"
  - https://github.com/donnemartin/system-design-primer
  - https://highscalability.com/
  - https://aws.amazon.com/architecture/
---

# 99. 시스템 설계 시나리오 카탈로그

> **목적** — 8-system-design 이 다룬 10 시나리오 + 면접/실무 표준 시나리오 풀 + 평가 축 정리. 단일 공식 reference 가 없으므로 "표준 책 + 정리된 자료" 를 토대로 한다.
> **본 카탈로그의 차이점** — 다른 99-catalog 가 "API 카탈로그" 라면, 본 catalog 는 **시나리오 + 의사결정 축 카탈로그**.

---

## 1. 기존 커버 매트릭스

8-system-design 이 다룬 10 시나리오 (가설):

| 시나리오 | 핵심 도전 | 상태 |
|---|---|---|
| URL Shortener | 짧은 ID 생성, redirect, 분석 | ✅ |
| Chat | 실시간, presence, 파티션 | ✅ |
| Feed (timeline) | fan-out vs fan-in | ✅ |
| Payment | 결제 멱등성, 외부 PG, Saga | ✅ |
| Rate Limiter | 알고리즘 + 분산 | ✅ |
| Notification | 채널, retry, throttle | ✅ |
| Ticketing | 좌석 예약, 동시성 | ✅ |
| Search (커머스) | inverted index, ranking (#19) | ✅ |
| Commerce | 장바구니, 주문, 결제 통합 | ✅ |
| Map / Ride hailing | geo, 매칭, ETA | ✅ |
| **Search Autocomplete (search-as-you-type)** | Trie + score, prefix matching, edit distance | ✅ 커버 ([14](14-realtime-search-autocomplete.md)) |
| **Distributed Counter (impressions/clicks)** | high QPS counter, HyperLogLog, sharding | ✅ 커버 ([15](15-distributed-counter-impressions.md)) |
| **Payment Idempotency** | idempotency key, Outbox + payment, 멱등 보장 | ✅ 커버 ([16](16-payment-idempotency.md)) |
| **IoT Telemetry Pipeline** | MQTT, 시계열 ingest, edge → cloud, OLAP 저장 | ✅ 커버 ([17](17-iot-telemetry-pipeline.md)) |

### 1-A. 갭 진단 — 추가 표준 시나리오

11. **News Feed (Twitter/Facebook)** — push vs pull, hybrid
12. **Newsfeed at Scale (BigTable / GraphDB)**
13. **Distributed File Storage (S3, GFS, HDFS)**
14. **Distributed Cache (memcached / Redis cluster)**
15. **Distributed Counter (high QPS counters)** — ✅ 커버 ([15](15-distributed-counter-impressions.md))
16. **Distributed Queue / Pub-Sub**
17. **Distributed KV store (DynamoDB, Cassandra)**
18. **Distributed SQL (Spanner, CockroachDB)**
19. **Object Storage** (S3 like)
20. **Video Streaming (Netflix / YouTube)** — CDN, transcoding, adaptive bitrate (HLS/DASH)
21. **Live Streaming (Twitch)** — low-latency
22. **Ads Serving (Real-time bidding)** — RTB
23. **Recommendation System** — offline + online (#19 cross)
24. **Search Autocomplete (Twitter/Google)** — Trie + score — ✅ 커버 ([14](14-realtime-search-autocomplete.md))
25. **Web Crawler** — politeness, dedup, Bloom filter
26. **Photo Sharing (Instagram)** — feed + media + likes
27. **Real-time Analytics (Druid / ClickHouse)** — OLAP
28. **Logging Pipeline (ELK)** — Kafka + ES
29. **Metric Pipeline (Prometheus + Cortex/Mimir)** — TSDB
30. **API Rate Limiter (multi-tier)** — sliding window + token bucket
31. **Distributed Job Scheduler (Airflow / Temporal)** — DAG
32. **Distributed Lock Service (ZooKeeper / etcd / Chubby)**
33. **Stock Exchange / Trading System** — order book, matching engine
34. **OTP / 2FA / OAuth flow** (#13 cross)
35. **Pub-Sub at scale (Pulsar / Kafka / SQS)**
36. **Cloud DNS** (Route 53 like)
37. **Push Notification at Scale** (FCM / APNS)
38. **CRDT-based Collaborative Editor** (#14 cross)
39. **Chat with E2E Encryption (Signal / WhatsApp)** — Double Ratchet
40. **Distributed File Sync (Dropbox)** — chunking + delta sync

---

## 2. 평가 축 (Functional / Non-Functional / Constraints)

각 시나리오는 **공통 5축** 으로 평가:

### 2-A. Functional Requirements
- 핵심 use case (write/read/notify ...)
- API endpoints (REST/gRPC/WebSocket)
- 데이터 모델

### 2-B. Non-Functional (NFR)
- **Scale**: QPS / DAU / MAU / data volume / write:read ratio
- **Latency**: P50 / P95 / P99 (Tier 1 SLA?)
- **Availability**: 9 의 개수 (99.9 vs 99.99 vs 99.999)
- **Durability**: data loss 허용 (event vs financial)
- **Consistency**: strong vs eventual (CAP)
- **Cost**: $/req / GB / TB
- **Compliance**: GDPR / PCI / HIPAA

### 2-C. Capacity / Sizing
- Storage estimate (per record × N years)
- Bandwidth (write QPS × payload size)
- Memory (cache hit ratio × hot working set)
- Connection 수 (#15 cross)

### 2-D. 의존성 / 외부 서비스
- 결제 PG / SMS / push / 이메일 / 소셜 로그인
- DR / multi-region

### 2-E. 운영 / 진단
- Observability (metric/log/trace) — #10 cross
- Deployment 전략 (canary, blue-green) — #11 cross
- Rollback 가능성

---

## 3. 시나리오 카드 템플릿

각 시나리오는 다음 카드 형식으로 정리:

```markdown
## NN. <시나리오 이름>

### Functional Requirements
- ...

### NFR
- Scale: ~X QPS, ~Y GB/day
- Latency: P99 < N ms
- Availability: 99.X%

### High-Level Architecture
[ASCII diagram]

### Core Components
| 컴포넌트 | 역할 | 기술 선택 |
|---|---|---|

### Data Model
- 테이블 / index / partitioning

### Critical Decisions (의사결정)
1. **<이슈>**: 옵션 A vs B → 선택 + 이유

### Failure Modes
- DB down / cache miss storm / cross-region partition

### Scaling Path
- Phase 1 (단일 instance) → Phase 2 (cluster) → Phase 3 (multi-region)

### Observability
- 핵심 metric, alert

### 면접 트랩
- 흔한 oversimplification + reality check
```

---

## 4. 핵심 의사결정 패턴 카탈로그

시나리오를 가로지르는 **재사용 의사결정 카드**:

| 결정 | 옵션 | 결정 기준 |
|---|---|---|
| **Push vs Pull (feed)** | push (fan-out on write) / pull (fan-out on read) / hybrid | 작성자 follower 수 분포 |
| **Strong vs Eventual** | linearizable / eventual | 비즈니스 영향 + 사용자 기대 |
| **Sync vs Async (write)** | sync = 즉시 일관 / async = enqueue | NFR 지연 vs 일관성 |
| **Cache 무효화** | write-through / write-back / write-around / TTL | hit ratio + staleness |
| **Replica 라우팅** | round-robin / latency-based / leader-only / read-your-writes | 일관성 vs throughput |
| **ID 생성** | auto-increment / Snowflake / UUIDv7 / KSUID | 분산 + 시간 정렬 |
| **샤딩 키 선택** | user_id / time / random hash | hot shard 회피 |
| **GeoIndex** | geohash / S2 / H3 / quadtree | 분포 + zoom level |
| **TTL vs explicit delete** | 사용자 데이터 vs 캐시 | GDPR / 비용 |
| **Sync vs Async event** | RPC / event bus | 결합도 |
| **Choreography vs Orchestration** (Saga) | event chain / 중앙 코디네이터 | 가시성 vs 유연성 |
| **Polling vs Webhook vs WebSocket** | 외부 통신 | latency + 비용 |
| **Multi-tenancy** | shared DB / DB per tenant / hybrid | isolation + 비용 |
| **Multi-region active-active vs active-passive** | latency vs 일관성 | DR + 사용자 분포 |

---

## 5. 우선 심화 후보 Top-10

| 우선 | 시나리오/주제 | 왜 |
|---|---|---|
| 1 | **News Feed (push/pull/hybrid)** | classic + 실무 빈출 |
| 2 | **Distributed Counter** | 단순한데 분산 함정 풀 셋 |
| 3 | **Search Autocomplete (Trie + score)** | #19 와 cross |
| 4 | **Recommendation System** | offline + online + ML |
| 5 | **Real-time Analytics (ClickHouse / Druid)** | analytics 와 cross |
| 6 | **Live Streaming (low-latency)** | HLS/DASH/WebRTC |
| 7 | **Stock Exchange / Matching Engine** | low-latency + 정확성 |
| 8 | **Distributed Job Scheduler (Temporal)** | workflow 표준 |
| 9 | **Distributed Lock Service (etcd / Chubby)** | 분산 lock 의 모델 |
| 10 | **CRDT 기반 협업 에디터** | #14 cross |

---

## 6. 표준 심화 스터디 템플릿

위 §3 의 시나리오 카드 형식을 사용. 각 시나리오 deep file 작성 시:

- [ ] §1 Functional Requirements
- [ ] §2 NFR (Scale + Latency + Availability + Consistency + Cost)
- [ ] §3 High-Level Architecture (ASCII 1개)
- [ ] §4 Core Components (표)
- [ ] §5 Data Model
- [ ] §6 Critical Decisions (3-5개, §4 의사결정 카드 참조)
- [ ] §7 Failure Modes
- [ ] §8 Scaling Path (Phase 1/2/3)
- [ ] §9 Observability
- [ ] §10 면접 트랩
- [ ] §11 msa 코드 grounding (해당 도메인이 msa 에 있다면)

---

## 7. 참고 자료

- "System Design Interview" Vol 1, 2 (Alex Xu)
- "Designing Data-Intensive Applications" (Kleppmann)
- "Microservices Patterns" (Chris Richardson)
- system-design-primer: https://github.com/donnemartin/system-design-primer
- High Scalability blog: https://highscalability.com/
- AWS Architecture Center: https://aws.amazon.com/architecture/
- Engineering blogs: Netflix Tech Blog, Uber Eng, Discord Eng, Stripe Eng, Airbnb Eng, Slack Eng, Cloudflare Blog
- "Site Reliability Engineering" (Google)

> 새 시나리오 발견 시 §1-A 에 행 추가. 카드 작성 시 §6 체크리스트 사용.
