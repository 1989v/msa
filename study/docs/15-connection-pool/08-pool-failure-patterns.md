---
parent: 15-connection-pool
seq: 08
title: 장애 패턴 — "Connection is not available" 의 4가지 원인
type: deep
created: 2026-05-01
---

# 08. 풀 장애 패턴

운영에서 가장 자주 마주치는 에러:

```
SQLTransientConnectionException: HikariPool-1 - Connection is not available, 
request timed out after 30000ms (total=10, active=10, idle=0, waiting=15)
```

이 에러를 보면 첫 반응이 "풀 사이즈 늘려" 인데, *대부분 그게 답이 아니다*. 4가지 원인을 구분하는 게 진단의 핵심.

---

## 4가지 근본 원인

| # | 증상 | 진짜 원인 | 잘못된 처치 |
|---|---|---|---|
| 1 | active=10, idle=0, waiting>0 + DB CPU 정상 | 느린 쿼리 (slow query) | 풀 사이즈 ↑ |
| 2 | active=10, idle=0, transaction 길게 점유 | 트랜잭션 내 외부 IO | 풀 사이즈 ↑ |
| 3 | active=10, idle=0 + RPS 진짜 폭증 | 풀 사이즈 부족 | (정답) 사이즈 ↑ |
| 4 | DB max_connections 도달 + 신규 connect 거부 | DB 측 한계 | 서비스 측 풀 ↑ (역효과) |

각 원인이 *어떤 메트릭 패턴* 으로 보이는지가 진단 능력.

---

## 원인 1: 느린 쿼리 (slow query)

가장 흔한 원인이고 가장 자주 *오진* 되는 원인.

### 메트릭 패턴

- `hikaricp.connections.active` = max
- `hikaricp.connections.pending` > 0
- DB CPU = 정상 (50% 이하)
- DB QPS = 평소 수준
- but 평균 쿼리 latency 가 평소 30ms → 갑자기 5s

### 시나리오

```sql
-- 평소: index 가 잘 타서 30ms
SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20;

-- 어느날: user_id 의 데이터 분포가 skew 되어 sort 가 메모리 초과 → tmpfile
-- 같은 쿼리가 5s 가 걸림
```

5s 짜리 쿼리 N 개가 풀 10 을 다 점유하면 다른 요청들이 connectionTimeout 30s 에 걸림.

### 진단

```sql
-- MySQL: 실시간 long query
SELECT * FROM information_schema.PROCESSLIST 
WHERE COMMAND != 'Sleep' AND TIME > 1
ORDER BY TIME DESC;

-- MySQL: slow query log (`long_query_time` 이상 자동 기록)
SHOW VARIABLES LIKE 'slow_query_log%';

-- pt-query-digest 로 분석
```

```promql
# Prometheus: Hibernate query timing
histogram_quantile(0.99, 
  rate(hibernate_orm_query_executor_seconds_bucket[5m])) by (query_type)
```

### 처치

1. EXPLAIN 으로 plan 확인 — index 미사용? full scan?
2. data skew 면 partition / index 추가
3. covering index 로 sort 회피
4. 쿼리 자체 재작성 (LIMIT pagination, batch)
5. **풀 사이즈 ↑ 는 일시적 완화일 뿐 — 근본은 쿼리**

---

## 원인 2: 트랜잭션 내 외부 IO

[ADR-0020 transactional-usage](file:///Users/gideok-kwon/IdeaProjects/msa/docs/adr/ADR-0020-transactional-usage.md) 의 핵심 주제.

### 안티패턴

```kotlin
@Transactional
fun placeOrder(req: OrderRequest): Order {
    val order = orderRepository.save(req.toEntity())
    
    // ⚠ 트랜잭션 안에서 외부 HTTP — connection 점유 + 외부 latency
    val payment = paymentClient.charge(order.id, req.amount)   // 200ms ~ 5s
    
    order.markPaid(payment.id)
    return order
}
```

문제:

- `@Transactional` 시작 시점에 connection borrow
- HTTP 외부 호출 동안 connection *idle 상태로 점유*
- 외부 5s spike 시 connection 5s 동안 잠김
- 풀 10 = 동시 요청 10 까지만 → 11번째부터 wait

### 메트릭 패턴

- `hikaricp.connections.active` 가 *지속적으로* high
- `hikaricp.connections.usage.avg` 가 외부 IO timeout 과 비슷
- DB QPS 는 낮음 (대부분 idle 상태)
- 외부 서비스 (payment) 의 latency 와 *상관관계* 가 명확

### 진단

```promql
# 트랜잭션 평균 길이
hikaricp_connections_usage_seconds{quantile="0.99"}

# 외부 IO latency 와 비교
http_client_requests_seconds{uri="/payment/charge", quantile="0.99"}

# 두 값이 비슷하면 외부 IO 가 트랜잭션을 잡고 있음
```

### 처치

1. **트랜잭션 분리** — saga / outbox 패턴
   ```kotlin
   fun placeOrder(req: OrderRequest): Order {
       val order = txn.execute { orderRepository.save(req.toEntity()) }
       val payment = paymentClient.charge(order.id, req.amount)
       return txn.execute { 
           order.markPaid(payment.id)
           orderRepository.save(order)
       }
   }
   ```
2. **outbox 패턴** — 외부 호출은 트랜잭션 밖에서, 보장은 outbox 메시지로
3. msa 코드베이스의 `*TransactionalService` 분리 패턴이 이 답 (ADR-0020)

---

## 원인 3: 풀 사이즈 부족 (진짜)

### 메트릭 패턴

- `hikaricp.connections.active` = max
- `hikaricp.connections.pending` > 0 *지속적으로*
- DB CPU / QPS / 쿼리 latency 모두 *정상*
- RPS 가 *진짜* 평소보다 높음 (이벤트, 광고, peak hour)
- `hikaricp.connections.usage.avg` 도 평소 수준

### 진단

```
1. RPS 변화 확인 — Prometheus rate(http_requests_total)
2. 쿼리 latency 변화 없음 확인
3. Little's Law 재계산 — 새로운 RPS × 기존 W
4. DB 측 max_connections 여유 확인
```

### 처치

이 경우만 **풀 사이즈를 늘려도 됨**.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20   # 10 → 20
```

하지만 늘리기 전에 검증:

- DB max_connections / 인스턴스 수 ≥ 새 풀 사이즈?
- DB CPU 가 늘어난 부하를 견디는가?
- *왜 RPS 가 늘었는가* (광고? 봇? leak?)

---

## 원인 4: DB 측 max_connections 도달

### 메트릭 패턴

- 서비스 풀은 *부분* 사용 (active < max)
- `connection.create.error` 메트릭 증가
- DB-side 에러: `Too many connections`
- 다른 *서비스* 들도 동시에 영향 — 전체 DB 클러스터 수준

### 진단

```sql
-- MySQL: 현재 connection 수 vs 한계
SHOW STATUS LIKE 'Threads_connected';
SHOW VARIABLES LIKE 'max_connections';

-- 어느 host/user 가 많이 쓰고 있는가
SELECT host, COUNT(*) FROM information_schema.PROCESSLIST GROUP BY host;
```

### 처치

- **서비스 측 풀 ↑ 는 역효과** — DB 부담 가중
- 인스턴스당 풀 ↓ 또는 인스턴스 수 ↓
- ProxySQL / PgBouncer 도입 (transaction-pool)
- DB instance class 업그레이드 (max_connections 자동 ↑)
- Aurora connection muxing 도입

---

## 진단 결정 트리

```
"Connection is not available" 발생
   │
   ├─ DB-side 'Too many connections' 에러도 있는가?
   │     YES → 원인 4 (DB max_connections)
   │     NO → 다음
   │
   ├─ DB CPU 가 증가했는가?
   │     YES → 원인 1 (느린 쿼리, DB 부하)
   │     NO → 다음
   │
   ├─ RPS 가 평소 대비 1.5배 이상인가?
   │     YES → 원인 3 (풀 부족)
   │     NO → 다음
   │
   └─ 외부 서비스 latency 와 상관관계?
         YES → 원인 2 (트랜잭션 내 IO)
         NO → 트랜잭션 leak (다음 절)
```

---

## Connection Leak (특수 케이스)

`@Transactional` 이 아닌 manual JDBC 사용 + close 누락.

```kotlin
// ⚠ 절대 이렇게 짜지 말 것
fun rawQuery(): List<String> {
    val conn = dataSource.connection   // borrow
    val ps = conn.prepareStatement("SELECT name FROM users")
    val rs = ps.executeQuery()
    val result = mutableListOf<String>()
    while (rs.next()) result.add(rs.getString(1))
    return result   // ← close 안 함, connection leak
}
```

### 진단

leakDetectionThreshold 설정 시 자동 출력:

```
WARN  c.z.h.p.ProxyLeakTask - Connection leak detection triggered for ...
java.lang.Exception: Apparent connection leak detected
  at com.kgd.foo.RawQueryService.rawQuery(RawQueryService.kt:15)
```

### 처치

- try-with-resources / `use {}` 패턴 강제
- JdbcTemplate / JpaRepository 사용 (close 자동)
- leakDetectionThreshold prod ON 유지

---

## DB Failover 시 stale connection

### 시나리오

```
T0: 서비스 풀 10 개 connection 모두 master DB host A 에 연결
T1: A 가 fail → RDS 가 standby B 로 promote (DNS 전환)
T2: 서비스 connection 10 개 모두 *과거 A 의 endpoint* 에 묶임
T3: 다음 borrow → "Communications link failure" 폭증
```

### 처치 (구성)

```yaml
spring:
  datasource:
    hikari:
      max-lifetime: 1800000        # 30 min — 자발적 교체
      keepalive-time: 30000        # silent drop 검출
      validation-timeout: 3000
```

- maxLifetime 으로 평상시 교체
- keepalive 로 dead connection 검출 → softEvict
- failover 즉시는 *최대 keepaliveTime 만큼 stale* — 30s 정도는 감수

### 처치 (적극)

- `softEvictConnections()` (HikariCP MBean) — failover 알림 시 풀 전체 교체
- AWS RDS 의 경우 RDS event subscription → SNS → service hook

---

## active=max, waiting>0 인데 DB 는 아무 일 안 함

가장 헷갈리는 패턴. 원인 2 (트랜잭션 내 IO) 의 변형.

### 시나리오: synchronized 메서드 + DB

```kotlin
@Service
class CacheService(private val repo: SettingRepository) {
    
    @Synchronized                        // ⚠ 모든 호출 직렬화
    fun getSetting(key: String): String {
        return cache.computeIfAbsent(key) { repo.findByKey(it) }
    }
}
```

`@Synchronized` 가 메서드 전체를 직렬화 → 동시에 DB 호출 1개만 가능. 풀에는 connection 이 남는데 *application 레벨 lock* 때문에 wait.

### 진단

- thread dump (jstack / arthas) 에서 BLOCKED state thread 다수
- `synchronized` / `ReentrantLock` 의 monitor 확인
- DB 는 idle, 풀은 active=1 이지만 thread 는 wait

---

## 진단 워크플로 (실무)

[16-pool-exhaustion-drill.md](16-pool-exhaustion-drill.md) 에서 재현 + 추적 실습.

1. **Hikari 메트릭 확인**: `hikaricp.connections.{active,idle,pending,usage}`
2. **DB 측 PROCESSLIST 확인**: 실제 쿼리 진행 중인지
3. **thread dump**: `kubectl exec -- jstack 1 > dump.txt`
4. **외부 IO latency 확인**: payment / kafka / redis
5. **slow query log 확인**: long_query_time 이상

---

## 핵심 포인트

- "Connection is not available" 의 *대부분* 은 풀 사이즈가 아닌 다른 3가지 원인
- 진단은 메트릭 *조합* — active 만 봐서는 구분 불가, DB CPU / 외부 IO / RPS 와 함께
- 트랜잭션 내 외부 IO 는 가장 흔한 *오진* 대상 (ADR-0020 의 동기)
- DB max_connections 도달 시 풀 사이즈 ↑ 는 *역효과*
- leakDetectionThreshold prod ON + maxLifetime + keepalive 가 failover/leak 의 1차 방어선

## 다음 학습

- [09-reader-writer-routing.md](09-reader-writer-routing.md) — 읽기 부하 분산으로 master 풀 보호
- [16-pool-exhaustion-drill.md](16-pool-exhaustion-drill.md) — 위 4 원인 재현 실습
- [14-observability.md](14-observability.md) — 어떤 메트릭을 봐야 하는가
