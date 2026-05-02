---
parent: 15-connection-pool
seq: 06
title: HouseKeeper / leakDetection / keepalive — 유지보수 영역
type: deep
created: 2026-05-01
---

# 06. HouseKeeper · leak detection · keepalive

ConcurrentBag 과 FastList 가 *사용 중* 의 cost 를 줄였다면, HouseKeeper 는 *idle 시점* 의 안전성을 책임진다. HikariCP 가 운영 환경에서 안정적인 진짜 이유.

---

## HouseKeeper 의 책임

`HikariPool` 내부의 `ScheduledExecutorService` 에 의해 일정 주기로 실행되는 백그라운드 작업.

| 책임 | 트리거 |
|---|---|
| maxLifetime 초과 connection 폐기 | 매 30초 |
| idleTimeout 초과 connection 폐기 (minIdle 까지) | 매 30초 |
| keepalive ping | keepaliveTime |
| pool size 보충 (connection 부족) | 항시 |
| 시계 역행 (clock skew) 보정 | 자동 |

```java
// HouseKeeper.run() 의 단순화된 흐름
public void run() {
    long now = clockSource.currentTime();
    
    // 1. clock skew 검출
    if (now < previous + housekeepingPeriodMs) {
        logger.warn("Retrograde clock change detected.");
        previous = now;
        softEvictConnections();    // 모든 connection 안전하게 교체
        return;
    }
    
    // 2. 시간 기반 정리
    for (PoolEntry entry : connectionBag.values(STATE_NOT_IN_USE)) {
        long elapsed = now - entry.lastBorrowed;
        long idleTimeout = config.getIdleTimeout();
        long lifetime = entry.creationTime + config.getMaxLifetime();
        
        if (now > lifetime || (idleTimeout > 0 && elapsed > idleTimeout 
                                && totalConnections > minimumIdle)) {
            closeConnection(entry, "expired");
        }
    }
    
    // 3. fillPool — 부족하면 보충
    fillPool();
}
```

---

## maxLifetime 사이클

```
연속된 시간축
─────────────────────────────────────────────────────
   create     reuse           reuse     evict      create
     │          │               │         │          │
     ▼          ▼               ▼         ▼          ▼
[A] ──────────────────────────────────── ✕
                                         │
[B]                                      ──────────────────
                                         create

  ◄────── maxLifetime (30 min) ──────►
```

- A 가 maxLifetime 도달 → 풀에서 *제거 마킹* (`markedEvicted = true`)
- 현재 사용 중이 아니면 즉시 close, 사용 중이면 반납 시점에 close
- 새 connection B 가 생성됨

**왜 필요한가**:

- DB 측 `wait_timeout` 으로 강제 종료된 stale connection 사용 회피
- Aurora 등 cloud DB 의 connection muxing / failover 시 장기 idle connection 이 무효화될 수 있음
- 메모리 누수 방어 (driver 가 long-lived connection 에 caching 누적)

### "왜 일제히 안 닫고 분산하는가"

maxLifetime 정확히 30 min 에 모두 동시에 만들어진 connection 이 한 번에 expire 되면 *순간적으로 풀이 비고* 동시에 새 connection 을 N 개 만드느라 latency spike. HikariCP 는 *생성 시점에 ±2.5% jitter* 를 추가해 이를 방지.

```java
// PoolEntry 생성 시
this.creationTime = clockSource.currentTime() + 
                    ThreadLocalRandom.current().nextLong(maxLifetime / 40);
```

---

## leakDetectionThreshold 의 동작

borrow 시 `ScheduledFuture` 를 등록, threshold 시간 내에 close 되지 않으면 stack trace 출력.

```java
// PoolBase.borrow 시점
public Connection getConnection() {
    PoolEntry poolEntry = connectionBag.borrow(...);
    
    // leakDetectionThreshold 가 양수면 task 등록
    ProxyLeakTask task = leakTaskFactory.schedule(poolEntry);
    poolEntry.setLeakTask(task);
    
    return poolEntry.createProxyConnection(...);
}

// ProxyLeakTask
public void run() {
    Exception e = new Exception("Apparent connection leak detected");
    e.setStackTrace(stackTrace);   // borrow 시점의 stack trace
    logger.warn("Connection leak detection triggered for {}", connection, e);
}

// requite (close) 시점
public void recycle() {
    leakTask.cancel();
    ...
}
```

### 출력 예시

```
WARN  c.z.h.p.ProxyLeakTask - Connection leak detection triggered for 
      com.mysql.cj.jdbc.ConnectionImpl@5d3e6c, stack trace follows
java.lang.Exception: Apparent connection leak detected
  at c.kgd.order.OrderRepository.findById(OrderRepository.kt:42)
  at c.kgd.order.OrderService.processOrder(OrderService.kt:78)
  at ...
```

→ borrow 한 *코드 위치* 가 그대로 stack trace 에 남는다. 이게 prod 에서 *유일한* leak 추적 도구. 비용은 거의 없음 (Exception 객체 한 개 + ScheduledFuture 한 개).

### 권장값

- **dev/local**: 비활성 (`0`) — 디버거에서 brake 걸면 그대로 leak 처럼 보임
- **staging/prod**: `10000` (10s)
- **너무 짧게 (1s)** 하면 정상 long query 도 잡힘 → false positive 폭증

---

## keepaliveTime — silent drop 방어

`keepaliveTime > 0` 이면 idle connection 마다 별도 ScheduledFuture 가 주기적으로 ping.

```java
// PoolEntry 생성 시 keepalive task 등록
private ScheduledFuture<?> scheduleKeepalive() {
    if (keepaliveTime > 0) {
        return houseKeepingExecutor.schedule(
            () -> {
                if (!hikariPool.isClosed() && state == STATE_NOT_IN_USE) {
                    if (compareAndSet(STATE_NOT_IN_USE, STATE_RESERVED)) {
                        if (!isConnectionAlive(connection)) {
                            softEvictConnection();
                        }
                        compareAndSet(STATE_RESERVED, STATE_NOT_IN_USE);
                    }
                }
            },
            keepaliveTime + ThreadLocalRandom.current().nextLong(keepaliveTime / 5),
            MILLISECONDS
        );
    }
    return null;
}
```

핵심:

- **STATE_RESERVED** 로 잠시 마킹 (다른 thread 가 borrow 하지 못하게)
- `isConnectionAlive` (`Connection.isValid()`) 호출
- 죽었으면 `softEvictConnection` — 다음 borrow 시 폐기
- jitter 적용 (±20%) 로 동시 ping 회피

### 왜 필요한가

K8s / cloud LB / NAT gateway 는 보통 *idle TCP* 를 5~15분 후 silent drop 한다. 클라이언트는 모르고, 다음 packet 송신 시 RST 받고 fail.

```
[App]──TCP──[k8s svc / NAT]──TCP──[MySQL]
              │ (idle 5min)
              ✕ silently drop
              
다음 borrow + 쿼리 → RST → "Communications link failure"
```

keepaliveTime 30s 면 90% 회피. validation cost 는 isValid() 한 번 = 1ms 미만.

---

## connection 검진 (isAlive)

borrow 시점, keepalive 시점, evict 검사 시점에 호출.

```java
boolean isConnectionAlive(Connection connection) {
    try {
        long validationTimeout = config.getValidationTimeout();
        
        if (isUseJdbc4Validation) {
            return connection.isValid((int) Math.max(1000L, validationTimeout) / 1000);
        }
        
        // JDBC 3 호환 — connectionTestQuery 사용
        try (Statement stmt = connection.createStatement()) {
            stmt.setQueryTimeout((int) validationTimeout / 1000);
            stmt.execute(config.getConnectionTestQuery());   // "SELECT 1"
        }
        return true;
    } catch (Exception e) {
        return false;
    }
}
```

- `isUseJdbc4Validation` = JDBC 4 driver 면 default `true`
- `Connection.isValid(timeout)` 는 driver-specific implementation
  - MySQL Connector/J: PING packet (`COM_PING`)
  - PostgreSQL: `SELECT 1` 자동
  - Oracle: native call
- `connectionTestQuery` 는 legacy JDBC 3 driver 용 — 현대 환경에서 설정할 필요 거의 없음

### "왜 SELECT 1 을 안 쓰는가"

- isValid() 가 더 빠름 (PING > query parse + plan)
- network round-trip 외에 server-side overhead 가 작음
- driver 가 connection state 를 *내부적으로* 검사 (예: socket closed flag) 하기도 함

---

## fillPool — 부족 시 보충 로직

```java
private void fillPool() {
    int connectionsToAdd = Math.min(
        config.getMaximumPoolSize() - getTotalConnections(),
        config.getMinimumIdle() - getIdleConnections()
    );
    
    for (int i = 0; i < connectionsToAdd; i++) {
        addBagItem(connectionsToAdd - i);   // 순차적으로 add
    }
}
```

- HouseKeeper 가 매 30s 주기로 호출
- borrow 시점에 idle 부족이면 즉시 트리거
- `addBagItem` 은 별도 thread 에서 비동기 — borrow 가 block 되지 않음

---

## 시계 역행 보정

NTP 가 시간을 *과거로* 되돌렸을 때 maxLifetime 계산이 깨진다 (creationTime > now 가 됨).

```java
if (now < previous + housekeepingPeriodMs) {
    logger.warn("Retrograde clock change detected.");
    softEvictConnections();    // 모든 connection 을 markedEvicted
}
```

K8s 환경에서 podsandbox 가 host clock 과 sync 안 맞으면 종종 발생. softEvict 로 안전하게 모두 교체.

---

## 모든 시계가 한 번에 보기

```
borrow ──────────────────────────────► return
   │                  │
   │                  └── leakDetectionThreshold 초과 → WARN log
   │
   └── connectionTimeout 초과 시 → SQLTransientConnectionException

idle  ────────────────────────────────────────────────────────
   │              │                  │                  │
   │              │                  │                  └── maxLifetime → evict
   │              │                  └── idleTimeout → evict (minIdle 까지)
   │              └── keepaliveTime → ping
   └── HouseKeeper 30s 주기로 검사
```

---

## 면접 모의 답변

> "HikariCP 의 운영 안정성은 HouseKeeper 라는 백그라운드 작업이 책임진다. 첫째 maxLifetime — connection 이 풀에 머무는 최대 시간을 강제해 DB 측 wait_timeout 보다 먼저 자발적으로 교체한다. 생성 시점에 ±2.5% jitter 를 줘 동시 expire 를 회피한다. 둘째 idleTimeout — minIdle 위로 쌓인 idle connection 을 점진적으로 폐기한다. 셋째 keepaliveTime — idle connection 을 주기적으로 isValid() 핑해 LB / NAT 의 silent drop 을 검출한다. 넷째 leakDetectionThreshold — borrow 시 ScheduledFuture 를 등록해 threshold 안에 반납 안 되면 borrow 시점의 stack trace 와 함께 WARN 출력한다. 이게 운영에서 leak 추적의 *유일한* 도구다."

---

## 핵심 포인트

- HouseKeeper 가 maxLifetime / idleTimeout / fillPool / clock skew 를 30s 주기로 처리
- maxLifetime 에 ±2.5% jitter — 동시 expire spike 회피
- keepaliveTime 은 STATE_RESERVED 로 잠시 잠그고 isValid() 호출 — borrow 와 충돌 안 함
- leakDetectionThreshold 는 prod 의 *유일* leak 추적 도구, 비용 거의 0
- isValid() > "SELECT 1" — driver 가 PING packet 사용

## 다음 학습

- [02-pool-parameters.md](02-pool-parameters.md) — 8 파라미터 권장값
- [07-pool-sizing.md](07-pool-sizing.md) — maximumPoolSize 산정
- [08-pool-failure-patterns.md](08-pool-failure-patterns.md) — leakDetection 이 잡아주는 4 패턴
