---
parent: 15-connection-pool
type: preview
created: 2026-05-01
---

# 커넥션 풀 심화 — Preview

> 학습자 수준: intermediate (4영역 자가평가 3) · 전체 예상 시간: 12h · 목표: HikariCP/Lettuce 내부 이해 + msa 운영 튜닝 + 면접 대비
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: P3 풀팩 · 학습 순서: Bottom-up (원리 → 운영)

---

## 멘탈 모델: "외부 자원 풀의 4축"

커넥션 풀은 단순히 "객체를 미리 만들어 둔 캐시"가 아니다. 4개 축으로 분리해서 봐야 한다.

```
  ┌─────────────────────────────────────────────┐
  │ 1. 자원 비용 축                                │
  │    TCP 3-way handshake / TLS / DB 인증       │
  │    → 매 요청마다 만들면 latency 폭발          │
  └─────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────┐
  │ 2. 동시성 축                                   │
  │    스레드 ↔ connection 매핑 (1:1 vs 1:N)     │
  │    HikariCP: 1:1 / Lettuce: N:1 multiplex    │
  └─────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────┐
  │ 3. 상태 / 수명 축                              │
  │    idleTimeout / maxLifetime / validation    │
  │    DB-side wait_timeout 보다 짧게             │
  └─────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────┐
  │ 4. 라우팅 / 토폴로지 축                          │
  │    R/W 분리 / replica lag / cluster topology  │
  │    AbstractRoutingDataSource / Lettuce ARO   │
  └─────────────────────────────────────────────┘
```

**핵심 5문장만 외운다**:
1. **HikariCP 가 빠른 이유는 ConcurrentBag + FastList + ProxyConnection 조합** — synchronized 제거.
2. **pool size 는 thread 수가 아니라 "동시에 진행 중인 쿼리 수"** — Little's Law 로 계산.
3. **`@Transactional(readOnly=true)` + LazyConnectionDataSourceProxy + AbstractRoutingDataSource** 가 R/W 분리 표준 조합.
4. **Lettuce 는 single connection multiplex**, Jedis 는 connection-per-thread → WebFlux/Cluster 환경은 Lettuce.
5. **`maxLifetime < DB wait_timeout - 30s`** 가 stale connection 회피의 1번 룰.

---

## 소주제 지도

> 19개 파일로 분할. 각 파일 평균 약 0.6h.

### Phase 1: 기본 개념 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 풀이 필요한 이유 (TCP/TLS/인증 비용) | [01-pool-fundamentals.md](01-pool-fundamentals.md) | 매 요청 신규 connection 의 latency 분해 |
| 02 | 핵심 파라미터 8가지 | [02-pool-parameters.md](02-pool-parameters.md) | maxPoolSize / minimumIdle / idleTimeout / maxLifetime / connectionTimeout / leakDetectionThreshold / validationTimeout / keepaliveTime |
| 03 | Spring Boot 기본값 + Hikari/Tomcat/DBCP2 비교 | [03-spring-boot-defaults.md](03-spring-boot-defaults.md) | 왜 Boot 2.x 부터 Hikari 가 default 인가 |

### Phase 2: 심화 (11개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 04 | ConcurrentBag 내부 구조 | [04-hikari-concurrent-bag.md](04-hikari-concurrent-bag.md) | ThreadLocal 캐시 + CopyOnWriteArrayList shared list + handoff queue |
| 05 | FastList + ProxyConnection (Javassist) | [05-hikari-fastlist-proxy.md](05-hikari-fastlist-proxy.md) | ArrayList synchronized 제거, JDBC API call 우회 |
| 06 | HouseKeeper / leakDetection / keepalive | [06-hikari-housekeeper.md](06-hikari-housekeeper.md) | maxLifetime 사이클, leak 추적 stack trace |
| 07 | 풀 사이즈 산정 (Little's Law / PG 공식 / DB max_connections) | [07-pool-sizing.md](07-pool-sizing.md) | 컨테이너 환경 HPA × 인스턴스 × 풀 폭증, ProxySQL/PgBouncer |
| 08 | 장애 패턴 (Connection is not available 4가지) | [08-pool-failure-patterns.md](08-pool-failure-patterns.md) | 느린 쿼리 / 긴 트랜잭션 / 풀 사이즈 / DB 거부 |
| 09 | Reader/Writer 분리 패턴 | [09-reader-writer-routing.md](09-reader-writer-routing.md) | AbstractRoutingDataSource + LazyConnectionDataSourceProxy + readOnly 결합 |
| 10 | Replica Lag 와 read-after-write 일관성 | [10-replica-lag-consistency.md](10-replica-lag-consistency.md) | stickiness, GTID 대기, 비즈니스 단위 우회 |
| 11 | Lettuce vs Jedis 내부 차이 | [11-redis-lettuce-vs-jedis.md](11-redis-lettuce-vs-jedis.md) | Netty multiplex / commons-pool2 / cluster topology refresh |
| 12 | Redis 풀 튜닝 (commons-pool2) | [12-redis-pool-tuning.md](12-redis-pool-tuning.md) | maxTotal / blockWhenExhausted / pub-sub dedicated |
| 13 | Reactive 환경 (R2DBC / Lettuce reactive) | [13-reactive-r2dbc.md](13-reactive-r2dbc.md) | event-loop blocking, r2dbc-pool |
| 14 | 관측 (HikariCP MicroMeter / Lettuce metrics) | [14-observability.md](14-observability.md) | hikaricp.connections.* / Prometheus 알람 룰 |

### Phase 3: 실전 적용 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 15 | msa 코드베이스 풀 설정 점검 | [15-codebase-audit.md](15-codebase-audit.md) | 11개 서비스 hikari 설정 / gateway Lettuce / common Redis 자동 설정 분석 |
| 16 | 풀 고갈 진단 워크플로 (재현 + 추적) | [16-pool-exhaustion-drill.md](16-pool-exhaustion-drill.md) | SLEEP(N) 시뮬레이션 + thread dump + Hikari MBean |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 17 | msa 풀 설정 개선 후보 + R/W 분리 ADR 초안 | [17-improvements.md](17-improvements.md) | 11개 서비스 max-pool 재산정, leakDetection 도입, ADR-XXXX 초안 |
| 18 | 면접 Q&A 카드 (꼬리질문 포함) | [18-interview-qa.md](18-interview-qa.md) | 7대 정면 질문 + 각 3 layer 꼬리질문 |

---

## 개념 관계도

```
                ┌────────────────────────┐
                │ Phase 1: 왜 풀인가      │
                │ TCP/TLS/Auth 비용      │
                └───────────┬────────────┘
                            │ "어떻게 빠른가"
                            ▼
                ┌────────────────────────┐
                │ Phase 2-A: Hikari 내부 │
                │ ConcurrentBag/FastList │
                │ Proxy/HouseKeeper      │
                └───────────┬────────────┘
                            │ "얼마나 둘 건가"
                            ▼
                ┌────────────────────────┐
                │ Phase 2-B: 사이즈/장애  │
                │ Little's Law / 4 원인  │
                └───────────┬────────────┘
                            │ "어디로 보낼 건가"
                            ▼
                ┌────────────────────────┐
                │ Phase 2-C: R/W 라우팅   │
                │ AbsRouting + Lazy      │
                │ replica lag 처리        │
                └───────────┬────────────┘
                            │ "Redis 도 같은가"
                            ▼
                ┌────────────────────────┐
                │ Phase 2-D: Redis/Reactive│
                │ Lettuce multiplex       │
                │ R2DBC                   │
                └───────────┬────────────┘
                            │ "어떻게 볼 건가"
                            ▼
                ┌────────────────────────┐
                │ Phase 2-E: 관측         │
                │ MicroMeter / 알람       │
                └───────────┬────────────┘
                            │ "코드베이스 적용"
                            ▼
                ┌────────────────────────┐
                │ Phase 3: msa 적용       │
                │ audit + drill + ADR     │
                └────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 권장 기본값 (2026 기준 / Spring Boot 3.x + Hikari 5)

| 파라미터 | 권장 | 비고 |
|---|---|---|
| `maximum-pool-size` | **(cpu_count × 2) + spindle** ≈ 10~20 | DB 측 max_connections 와 합산 검증 필수 |
| `minimum-idle` | maxPoolSize 와 동일 (Hikari 권장) | "fixed-size pool" 이 spike 대응에 유리 |
| `idle-timeout` | 0 (fixed pool) | minIdle = maxPool 이면 의미 없음 |
| `max-lifetime` | **DB wait_timeout − 30s** | MySQL 기본 28800s → 보수적 1800s |
| `connection-timeout` | 3000~10000ms | 빠른 fail-fast |
| `keepalive-time` | 30000ms | maxLifetime 보다 짧게, 0 이면 비활성 |
| `leak-detection-threshold` | 5000~10000ms | prod 권장, 미설정 = 비활성 |
| `validation-timeout` | 5000ms | connectionTimeout 보다 짧게 |

### 절대 하지 말 것

- pool size 를 thread pool size 와 같게 잡기 (DB 가 thread 수만큼 동시 처리하지 못함)
- HPA 인스턴스 폭증 시 DB max_connections 무시
- `@Transactional` 을 외부 IO (HTTP/Kafka) 까지 감싸기 → connection 점유
- WebFlux 에서 일반 JDBC + Hikari 사용 (event loop block)
- maxLifetime 을 DB wait_timeout 보다 길게 (서버 측 강제 종료 → stale connection)
- 분산 락 / pub-sub 을 일반 Lettuce shared connection 에서 실행
- 운영 환경에서 leakDetectionThreshold 비활성

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 18** (Bottom-up). 단 Phase 1 (01-03) 만 익숙하면 Phase 2 안에서는 원하는 순서로 진입 가능.
- 04-06 (Hikari 내부) 은 한 세트로 묶어 1.5h 안에 끊는 것을 권장.
- 09-10 (R/W 분리) 은 코드베이스 DataSourceConfig.kt (`product/app/src/main/kotlin/com/kgd/product/config/DataSourceConfig.kt`) 를 옆에 띄워두고 학습.
- 15-16 (실전) 은 Phase 2 끝낸 직후가 retention 가장 높음.
- 18 (면접 Q&A) 은 회독용 — 학습 종료 후 1주일 간격 2회 회독.

각 파일 호출:
```
/study:start 15           # 다음 deep file 자동 선택
/study:start 15 04        # 04-hikari-concurrent-bag.md 직접 지정
```
