# Study Topics

간략하게 주제를 남기면 `/study:init`으로 구조화된 학습 계획서가 생성됩니다.

## Pending Topics

1. aws 인프라 환경에서 network / 방화벽 / nat / alb / nlb 등 스터디
2. JVM 내부 + GC 튜닝 (G1/ZGC 차이, GC 로그 해석, OOM 원인 분석)
3. Java/Kotlin 동시성 심화 (synchronized, volatile, AtomicXxx, ConcurrentHashMap 내부, Kotlin coroutine, Virtual Threads/Loom)
4. DB 인덱스 + 트랜잭션 격리 (B-Tree, 클러스터드 인덱스, MVCC, Lock, Deadlock, 실행 계획 분석)
5. Spring Transactional 심화 (전파 속성, 격리 수준, proxy 한계, 외부 IO 분리, 중첩 트랜잭션)
6. Kafka 내부 동작 (파티션, 컨슈머 그룹, 리밸런싱, Exactly-once semantics, 멱등성, DLQ, 장애 대응)
7. 분산 시스템 이론 + 패턴 (CAP/PACELC, SAGA, 2PC, 분산 락, Idempotency, Retry, Circuit Breaker)
8. 시스템 설계 시나리오 10선 (URL Shortener, Chat, Feed, Payment, Rate Limiter, 알림 시스템, 티켓팅, 검색, 커머스, 지도)
9. Redis 심화 (자료구조 내부, AOF/RDB 퍼시스턴스, 클러스터, Cache Stampede 방어, 분산 락, Stream)
10. Observability 3축 (Metrics: Prometheus + Grafana / Logs: ELK, Loki / Tracing: OpenTelemetry, Jaeger)
11. K8s 심화 + 배포 전략 (Operator/CRD, Networking 심화, Rolling/Blue-Green/Canary, Helm, GitOps)
12. Latency Numbers Every Programmer Should Know, 즉 레이어간 통신 비용에 대한 스터(L1, 메인메모리, SSD, 데이터센터간 통신, 디스크, 리전간 통신 등)
  12-1. https://colin-scott.github.io/personal_website/research/interactive_latency.html
  12-2. https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf page 12
  12-3. https://www.youtube.com/watch?v=WbzMtyyOQpM

## 파이프라인

각 주제는 `/study:init → bs → exec → start` 4단계로 학습:

| Skill | 역할 | 산출물 |
|---|---|---|
| `/study:init N` | 주제 초기화 | `{N}-{slug}/plan.md` |
| `/study:bs N` | 방향 다듬기 | plan.md 개정 |
| `/study:exec N` | 프리뷰 (소주제 지도) | `{N}-{slug}/preview.md` |
| `/study:start N [subtopic]` | 본격 심화 학습 | `{N}-{slug}/{NN}-{subtopic}.md` |

## 학습 현황

| # | 주제 | 폴더 | 상태 |
|---|------|-------|------|
| 1 | AWS 네트워크 인프라 | [1-aws-network/](docs/1-aws-network/) | **completed + 19 deep files** |
| 2 | JVM 내부 + GC 튜닝 | [2-jvm-gc/](docs/2-jvm-gc/) | ready |
| 3 | Java/Kotlin 동시성 심화 | [3-java-kotlin-concurrency/](docs/3-java-kotlin-concurrency/) | draft |
| 4 | DB 인덱스 + 트랜잭션 격리 | [4-db-index-transaction/](docs/4-db-index-transaction/) | draft |
| 5 | Spring Transactional 심화 | [5-spring-transactional/](docs/5-spring-transactional/) | draft |
| 6 | Kafka 내부 동작 | [6-kafka-internals/](docs/6-kafka-internals/) | draft |
| 7 | 분산 시스템 이론 + 패턴 | [7-distributed-systems/](docs/7-distributed-systems/) | draft |
| 8 | 시스템 설계 시나리오 10선 | [8-system-design/](docs/8-system-design/) | draft |
| 9 | Redis 심화 | [9-redis-deep-dive/](docs/9-redis-deep-dive/) | draft |
| 10 | Observability 3축 | [10-observability/](docs/10-observability/) | draft |
| 11 | K8s 심화 + 배포 전략 | [11-k8s-deep-dive/](docs/11-k8s-deep-dive/) | draft |
| 12 | Latency Numbers Every Programmer Should Know | [12-latency-numbers/](docs/12-latency-numbers/) | **completed + 12 deep files** |
