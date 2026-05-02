---
parent: 15-connection-pool
seq: 16
title: 풀 고갈 진단 워크플로 — 재현 + 추적 실습
type: deep
created: 2026-05-01
---

# 16. 풀 고갈 진단 드릴

[08-pool-failure-patterns.md](08-pool-failure-patterns.md) 의 4 원인을 *직접 재현* 하고 진단해보는 실습. 운영 사고 시 5분 내에 원인 분류할 수 있어야 한다.

---

## 사전 준비

### 환경

```bash
# k3d cluster 기동 (msa local stack)
kubectl apply -k k8s/overlays/k3s-lite

# 부하 도구
brew install k6
brew install jstack  # JDK 포함

# DB 접속
mysql -h localhost -P 3326 -u order_user -porder_password order_db
```

### 메트릭 노출 확인

```bash
kubectl port-forward -n commerce svc/order 8082:8082 &
curl http://localhost:8082/actuator/prometheus | grep hikaricp
```

### 풀 설정 임시로 작게 (재현 용이)

```yaml
# order/app/src/main/resources/application.yml 임시 수정
spring:
  datasource:
    master:
      hikari:
        maximum-pool-size: 3       # 일부러 작게
        connection-timeout: 5000
        leak-detection-threshold: 5000
```

---

## 시나리오 1: 느린 쿼리

### 재현

```sql
-- DB 측 1: 느린 쿼리 강제 (의도적 lock)
START TRANSACTION;
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
-- (commit 안 함, 다른 세션을 lock)
```

```sql
-- DB 측 2: 같은 row update 시도 (block 됨)
UPDATE orders SET status = 'X' WHERE id = 1;
-- ↑ 30s 정도 hang
```

서비스 측에서 같은 row 조회/업데이트 부하:

```bash
k6 run --vus 10 --duration 30s - <<EOF
import http from 'k6/http';
export default function() {
    http.get('http://localhost:8082/api/v1/orders/1');
}
EOF
```

### 진단

#### Step 1: Hikari 메트릭

```bash
curl -s http://localhost:8082/actuator/prometheus | grep -E "hikaricp.*active|pending|usage"
```

```
hikaricp_connections_active{pool="HikariPool-1"} 3.0
hikaricp_connections_pending{pool="HikariPool-1"} 7.0    # ← 7명 대기
hikaricp_connections_usage_seconds{pool="HikariPool-1",quantile="0.99"} 28.5  # ← 28s
```

#### Step 2: DB 측 PROCESSLIST

```sql
SELECT id, user, time, state, info FROM information_schema.PROCESSLIST 
WHERE command != 'Sleep' ORDER BY time DESC;
```

```
+----+--------+------+------------------------+--------------------------+
| id | user   | time | state                  | info                     |
+----+--------+------+------------------------+--------------------------+
| 12 | order  |   30 | Waiting for table lock | UPDATE orders SET ...    |
| 13 | order  |   28 | Waiting for table lock | UPDATE orders SET ...    |
| 11 | manual |   45 | NULL                   | NULL (transaction held)  |
+----+--------+------+------------------------+--------------------------+
```

→ 진짜 lock holder 가 id=11 의 manual session.

#### Step 3: lock 분석

```sql
SELECT * FROM performance_schema.data_locks;
SELECT * FROM information_schema.INNODB_LOCK_WAITS;
```

→ lock chain 파악, holder 강제 종료:

```sql
KILL 11;
```

#### 결론

- 패턴: active=max + pending>0 + usage 매우 높음 + DB 측 lock 대기
- 원인: row lock holder (외부 세션 또는 long transaction)
- 처치: `KILL` + 코드의 트랜잭션 길이 검토

---

## 시나리오 2: 트랜잭션 내 외부 IO

### 코드 (의도적 안티패턴)

```kotlin
// ⚠ 재현용
@Service
class BadOrderService(
    private val repo: OrderRepository,
    private val webClient: WebClient
) {
    @Transactional
    fun placeOrder(req: OrderRequest): Order {
        val order = repo.save(req.toEntity())
        
        // 외부 호출 — 의도적으로 느린 mock 서버
        val payment = webClient.get()
            .uri("http://slow-mock:8888/charge")  // 5s 응답
            .retrieve()
            .bodyToMono(PaymentResult::class.java)
            .block(Duration.ofSeconds(10))
        
        order.markPaid(payment!!.id)
        return order
    }
}
```

slow-mock 서버:

```kotlin
@RestController
class SlowMock {
    @GetMapping("/charge")
    fun charge(): Mono<PaymentResult> = Mono.delay(Duration.ofSeconds(5))
        .map { PaymentResult("p-${UUID.randomUUID()}") }
}
```

### 부하

```bash
k6 run --vus 10 --duration 30s ...
```

### 진단

#### Step 1: Hikari 메트릭

```
hikaricp_connections_active = 3 (max)
hikaricp_connections_pending = 7
hikaricp_connections_usage_seconds{quantile="0.99"} = 5.2  # ← 5초 점유
```

#### Step 2: DB 측 PROCESSLIST

```
+----+-------+------+-----------+------------+
| id | time  | command | state    | info     |
+----+-------+------+-----------+------------+
| 50 |    5  | Sleep   |          | NULL     |  # ← Sleep!
| 51 |    4  | Sleep   |          | NULL     |
| 52 |    3  | Sleep   |          | NULL     |
+----+-------+------+-----------+------------+
```

→ DB 측은 *Sleep 상태* — 쿼리는 안 하는데 connection 만 잡고 있음. 풀 외부 (애플리케이션) 가 느림.

#### Step 3: thread dump

```bash
kubectl exec -n commerce order-pod -- jstack 1 > order.dump
grep -A 20 "RUNNABLE\|TIMED_WAITING" order.dump | grep -A 5 "BadOrderService\|webClient"
```

```
"http-nio-8082-exec-3" #25 daemon prio=5 ... 
   java.lang.Thread.State: TIMED_WAITING (parking)
    at sun.misc.Unsafe.park(Native Method)
    - parking to wait for ... (Mono.block)
    at reactor.core.publisher.Mono.block(Mono.java:...)
    at com.kgd.order.BadOrderService.placeOrder(BadOrderService.kt:18)
```

→ thread 가 webClient.block 에 park, connection 은 잡혀있음.

#### Step 4: usage time 와 외부 IO latency 비교

```promql
hikaricp_connections_usage_seconds{quantile="0.99"} = 5.2
http_client_requests_seconds{uri="/charge", quantile="0.99"} = 5.1
```

→ 두 값이 *거의 동일* = 외부 IO 가 connection 을 잡고 있다는 결정적 증거.

#### 결론

- 패턴: usage 높음 + DB 측 Sleep + thread dump 가 외부 IO 에 park
- 원인: `@Transactional` 안에 외부 HTTP / Kafka / S3
- 처치: ADR-0020 (`docs/adr/ADR-0020-transactional-usage.md`) 의 외부 IO 분리

---

## 시나리오 3: 진짜 풀 사이즈 부족

### 재현

쿼리 자체는 빠른데 (10ms) 동시 요청이 풀 한계 초과:

```bash
# 풀 size 3 인 상태에서 동시 50 요청
k6 run --vus 50 --duration 30s - <<EOF
import http from 'k6/http';
export default function() {
    http.get('http://localhost:8082/api/v1/products/1');  # 10ms 쿼리
}
EOF
```

### 진단

```
hikaricp_connections_active = 3 (max)
hikaricp_connections_pending = 47   # ← 대기자 폭증
hikaricp_connections_usage_seconds{quantile="0.99"} = 0.012  # ← 짧음
hikaricp_connections_acquire_seconds{quantile="0.99"} = 4.8  # ← borrow 대기 폭발
```

→ usage 는 짧은데 acquire 가 길음 = *순수 풀 부족*.

DB 측:

```
threads_connected: 3   # 평소 수준
slow_queries: 0        # 변화 없음
CPU: 30%               # 여유
```

DB 는 *놀고 있음*. 풀만 부족.

#### 결론

- 패턴: usage 낮음 + acquire 높음 + DB 여유
- 원인: 풀 사이즈 부족
- 처치: 풀 사이즈 증가 (단, DB max_connections 검증 후)

---

## 시나리오 4: DB max_connections 도달

### 재현 (위험 — local 만)

```sql
-- DB 측: max_connections 강제로 줄임
SET GLOBAL max_connections = 10;
```

여러 서비스가 동시 connect 시도:

```bash
# 서비스 인스턴스 5개 × 풀 10 = 50 → 한계 10 초과
kubectl scale deployment/order --replicas=5
```

### 진단

#### Step 1: 서비스 로그

```
Caused by: java.sql.SQLException: 
  null,  message from server: "Too many connections"
```

#### Step 2: DB 측

```sql
SHOW STATUS LIKE 'Threads_connected';
-- Threads_connected = 10
SHOW VARIABLES LIKE 'max_connections';
-- max_connections = 10
```

#### Step 3: 어느 호스트가 차지?

```sql
SELECT user, host, COUNT(*) 
FROM information_schema.PROCESSLIST 
GROUP BY user, host;
```

#### 결론

- 패턴: connect 자체 fail (Hikari pending 이 의미 없음)
- 원인: DB max_connections 한계
- 처치:
  - 서비스 측 풀 ↓ 또는 인스턴스 수 ↓
  - PgBouncer / ProxySQL
  - DB instance class 업그레이드

---

## 진단 명령 cheat sheet

### 1. Hikari 메트릭

```bash
# Prometheus endpoint
curl -s http://localhost:8082/actuator/prometheus | grep -E "hikaricp"

# 또는 Actuator metrics
curl http://localhost:8082/actuator/metrics/hikaricp.connections.active
```

### 2. JVM thread dump

```bash
# kubectl 환경
kubectl exec -n commerce {pod} -- jstack 1 > thread.dump

# 또는 Spring Boot Actuator
curl http://localhost:8082/actuator/threaddump > threaddump.json

# 분석 — connection 을 잡고 있는 thread
grep -B 1 -A 10 "HikariProxyConnection\|in-use" thread.dump
```

### 3. DB processlist

```sql
SELECT id, user, host, db, command, time, state, 
       LEFT(info, 100) AS query
FROM information_schema.PROCESSLIST 
WHERE command != 'Sleep' OR time > 10
ORDER BY time DESC;
```

### 4. DB lock 분석

```sql
-- MySQL 8+
SELECT * FROM performance_schema.data_locks;
SELECT * FROM performance_schema.data_lock_waits;

-- 또는
SELECT * FROM information_schema.INNODB_TRX 
ORDER BY trx_started;
```

### 5. slow query log

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.5;       -- 0.5s 이상

-- 분석
SELECT * FROM mysql.slow_log 
WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY query_time DESC LIMIT 20;
```

### 6. Hikari MBean (jconsole / arthas)

```
com.zaxxer.hikari:type=Pool (HikariPool-1)
  ActiveConnections   : 3
  IdleConnections     : 0
  ThreadsAwaitingConnection : 47
```

---

## 5분 진단 흐름

운영 사고 alert 이 왔을 때:

```
1분: hikaricp_connections_pending > 0 확인
     → YES: 풀 압박. 다음 단계
     → NO: 풀 외 원인 (서비스 멈춤, GC 등)

2분: hikaricp_connections_usage_seconds P99 확인
     → 평소 대비 ↑: 시나리오 1 (느린 쿼리) 또는 2 (외부 IO)
     → 평소 수준: 시나리오 3 (풀 부족) 또는 4 (DB 한계)

3분: DB processlist 확인
     → Sleep 다수: 시나리오 2 (외부 IO)
     → state="locked / waiting": 시나리오 1 (lock contention)
     → 평소 수준 + Threads_connected = max_connections: 시나리오 4

4분: thread dump 확인 (시나리오 2 의심 시)
     → webClient / kafka / external IO: 시나리오 2 확정
     → DB driver socket read: 시나리오 1 확정

5분: 처치
     - 시나리오 1: lock holder 식별, slow query 임시 차단
     - 시나리오 2: 외부 IO 호출 차단 / circuit breaker
     - 시나리오 3: 풀 임시 증가, 부하 줄이기
     - 시나리오 4: 인스턴스 수 cap, DB upgrade 계획
```

---

## drill 복기 — 학습 효과

각 시나리오를 실제 재현하면 *메트릭 그래프 모양* 이 머리에 박힌다.

- 시나리오 1: pending = 7, usage P99 = 28s, acquire P99 = 5s
- 시나리오 2: pending = 7, usage P99 = 5s, acquire P99 = 4s, DB sleep 다수
- 시나리오 3: pending = 47, usage P99 = 12ms, acquire P99 = 5s, DB 여유
- 시나리오 4: pending = N/A (connect fail), DB Threads_connected = max

이 그래프 모양 차이가 5분 진단의 핵심.

---

## 핵심 포인트

- 4 시나리오의 메트릭 패턴은 *서로 다름* — pending / usage / acquire / DB 측 조합으로 분류
- 진단의 1번 도구는 hikaricp.connections.* + DB processlist 의 *조합*
- thread dump 는 시나리오 2 (외부 IO) 확정의 결정타
- 평소 메트릭 그래프를 머리에 익히면 사고 시 모양 차이로 원인 즉시 추정
- drill 자체는 staging 환경에서 정기적으로 (분기 1회) 권장

## 다음 학습

- [08-pool-failure-patterns.md](08-pool-failure-patterns.md) — 4 원인 이론 정리
- [14-observability.md](14-observability.md) — 알람 룰 검증
- [17-improvements.md](17-improvements.md) — drill 결과로 도출한 개선
