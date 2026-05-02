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
13. encrypt, jwt, aes, sha 등등
14. CRDT, MRDT 등
15. 커넥션 풀, 히카리CP, reader/writer CP 분리, 레디스 풀
16. 비동기, 논블러킹
17. spring 
  17-1. Transactional(readonly, writable)
  17-2. spring filter chain, intercept, aop
  17-3. 스레드 덤프, 분석
  17-4. jackson
  17-5. gzip
18. grpc

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
| 2 | JVM 내부 + GC 튜닝 | [2-jvm-gc/](docs/2-jvm-gc/) | **completed + 22 deep files** |
| 3 | Java/Kotlin 동시성 심화 | [3-java-kotlin-concurrency/](docs/3-java-kotlin-concurrency/) | **completed + 24 deep files** |
| 4 | DB 인덱스 + 트랜잭션 격리 | [4-db-index-transaction/](docs/4-db-index-transaction/) | **completed + 18 deep files** |
| 5 | Spring Transactional 심화 | [5-spring-transactional/](docs/5-spring-transactional/) | **completed + 14 deep files** |
| 6 | Kafka 내부 동작 | [6-kafka-internals/](docs/6-kafka-internals/) | **completed + 13 deep files** |
| 7 | 분산 시스템 이론 + 패턴 | [7-distributed-systems/](docs/7-distributed-systems/) | **completed + 20 deep files** |
| 8 | 시스템 설계 시나리오 10선 | [8-system-design/](docs/8-system-design/) | **completed + 13 deep files** |
| 9 | Redis 심화 | [9-redis-deep-dive/](docs/9-redis-deep-dive/) | **completed + 19 deep files** |
| 10 | Observability 3축 | [10-observability/](docs/10-observability/) | **completed + 14 deep files** |
| 11 | K8s 심화 + 배포 전략 | [11-k8s-deep-dive/](docs/11-k8s-deep-dive/) | **completed + 17 deep files** |
| 12 | Latency Numbers Every Programmer Should Know | [12-latency-numbers/](docs/12-latency-numbers/) | **completed + 12 deep files** |
| 13 | 암호화 · JWT · SSO · 클라우드 KMS | [13-crypto-jwt-sso/](docs/13-crypto-jwt-sso/) | **completed + 20 deep files** |
| 14 | CRDT · MRDT — 분산 데이터 동기화 | [14-crdt-mrdt/](docs/14-crdt-mrdt/) | **completed + 19 deep files** |
| 15 | 커넥션 풀 심화 (HikariCP · R/W 분리 · Redis Pool) | [15-connection-pool/](docs/15-connection-pool/) | **completed + 18 deep files** |
| 16 | 비동기 · 논블러킹 IO (NIO · Reactor · Netty) | [16-async-nonblocking-io/](docs/16-async-nonblocking-io/) | **completed + 19 deep files** |
| 17 | Spring Web 처리 심화 (Filter/Interceptor/AOP · Jackson · gzip) | [17-spring-web/](docs/17-spring-web/) | **completed + 20 deep files** |
| 18 | gRPC 심화 (Protobuf · HTTP/2 · Streaming) | [18-grpc/](docs/18-grpc/) | **completed + 20 deep files** |

> **흡수 노트**: 원본 17-1 (`@Transactional(readonly/writable)`) 은 #5 plan + deep file 06/07 에, 17-3 (스레드 덤프) 은 #3 plan + deep file 20 에 흡수됨 (2026-05-01).
>
> **전체 통계** (2026-05-02 기준): 18개 주제 / 333개 파일 / 약 97,063 줄.
