---
parent: 15-connection-pool
seq: 10
title: Replica Lag — read-after-write 일관성과 stickiness
type: deep
created: 2026-05-01
---

# 10. Replica Lag와 일관성 처리

R/W 분리의 *비용* — eventually consistent. master 에 write 한 직후 replica 를 읽으면 못 볼 수 있다. "내가 방금 등록한 게 안 보여요" 의 진짜 원인.

---

## 복제 지연 (replication lag)

### MySQL async replication

```
[Master] ──Binlog write──→ [Binlog]
                                │
                                ▼
                          [Replica IO Thread]
                                │
                                ▼
                          [Relay Log]
                                │
                                ▼
                          [Replica SQL Thread] ──apply──→ [Replica DB]
```

- **IO Thread**: master 에서 binlog 를 가져와 replica 의 relay log 에 저장
- **SQL Thread**: relay log 를 replica 에 적용

각 단계마다 lag 발생 가능. 운영 환경 lag:

- 정상: < 100 ms
- 높은 부하: 1~5 s
- DDL / large transaction: 수 분

### 측정

```sql
-- MySQL replica 측
SHOW REPLICA STATUS\G

-- 핵심 지표
Seconds_Behind_Source: 0~N      -- SQL thread 의 lag (초 단위)
Replica_IO_Running: Yes
Replica_SQL_Running: Yes
```

단점: `Seconds_Behind_Source` 는 *SQL thread* 시점 차이만 측정. IO thread 가 막히면 0 으로 보일 수 있음. heartbeat 사용 권장.

```sql
-- pt-heartbeat 류
INSERT INTO heartbeat (ts) VALUES (NOW(6));   -- master, 매 1s
SELECT (NOW(6) - ts) AS lag_ms FROM heartbeat;  -- replica
```

---

## read-after-write 일관성 깨짐

### 시나리오 1: 같은 사용자 즉시 새로고침

```
T0: User → Service.create(item)         [MASTER write]
T1: Master 응답 OK
T2: User → Service.findById(item.id)    [REPLICA read]
T3: Replica 가 아직 binlog 적용 안 함 → 404
```

UI/UX: "방금 등록 버튼 눌렀는데 안 보여요" → user confusion.

### 시나리오 2: 같은 트랜잭션 안에서

이건 R/W 분리와 무관. 같은 `@Transactional` 안에서 `save → findById` 는 Hibernate 의 *1차 캐시* 가 보장.

### 시나리오 3: 서로 다른 endpoint

POST /orders → write OK → 클라이언트가 GET /orders/{id} 호출. Service A 가 처리한 write 를 Service B 가 read — replica 가 동기화 전이면 not found.

---

## 처치 패턴

### 1. session stickiness (단발)

같은 사용자의 *직후 요청* 만 master 로 보내는 패턴.

```kotlin
@Service
class StickinessService(private val redisTemplate: StringRedisTemplate) {
    
    fun markRecentWrite(userId: String) {
        redisTemplate.opsForValue()
            .set("write:$userId", "1", Duration.ofSeconds(2))
    }
    
    fun isRecentWrite(userId: String): Boolean =
        redisTemplate.hasKey("write:$userId")
}

class RoutingDataSource : AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType {
        val userId = SecurityContextHolder.getContext().authentication?.name
        if (userId != null && stickinessService.isRecentWrite(userId)) {
            return DataSourceType.MASTER
        }
        return if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
    }
}
```

→ write 직후 2s 동안은 master 에서 read. lag < 2s 면 일관성 보장.

장점: 사용자 자기 데이터에 대한 일관성 강함  
단점: master 부하 약간 증가, Redis 의존 추가

### 2. consistent read 힌트 — 비즈니스 단위

```kotlin
@Service
class OrderService {
    
    @Transactional(readOnly = false)        // ⚠ master 강제 read
    fun findJustCreatedOrder(id: Long): Order? = ...
}
```

`readOnly = false` 가 master 라우팅을 강제. 단, 트랜잭션 시멘틱이 read-only 가 아니어서 Hibernate 가 dirty checking 등을 함.

대안: 별도 annotation 도입.

```kotlin
@Target(AnnotationTarget.FUNCTION)
annotation class UseMaster

class RoutingDataSource : AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType {
        if (RoutingContext.isUseMaster()) return DataSourceType.MASTER
        ...
    }
}

// AOP 로 ThreadLocal 설정
@Around("@annotation(UseMaster)")
fun useMaster(pjp: ProceedingJoinPoint): Any? {
    RoutingContext.setUseMaster(true)
    return try { pjp.proceed() } finally { RoutingContext.clear() }
}
```

### 3. wait-for-replica (강한 일관성)

GTID / position 을 기반으로 replica 가 *해당 write 까지 적용한 후* 읽기.

```sql
-- write 후 GTID 획득
SELECT @@global.gtid_executed;
-- 'uuid:1-12345'

-- replica 에서 그 GTID 까지 기다림 (max 5s)
SELECT WAIT_FOR_EXECUTED_GTID_SET('uuid:1-12345', 5);
```

복잡하고 latency 추가 → 진짜 강한 일관성이 *반드시* 필요할 때만. 보통 stickiness 로 충분.

### 4. 응답에 데이터 포함

가장 단순. write 응답에 *생성된 entity 자체* 를 포함시켜 클라이언트가 다시 read 하지 않게.

```kotlin
@PostMapping
fun create(@RequestBody req: CreateRequest): Order {
    val saved = orderService.create(req)
    return saved   // ← 그대로 응답
}
```

UI/UX: 즉시 반영. 단점: 일부 케이스 (페이지 이동 후 list) 는 여전히 lag 영향.

---

## msa 적용 가이드

| 케이스 | 권장 패턴 |
|---|---|
| 사용자 자기 데이터 (마이페이지, 장바구니) | session stickiness |
| 일반 read-heavy 조회 (상품, 검색) | replica routing 그대로 (lag 허용) |
| write 응답 즉시 사용 (생성 후 confirm 페이지) | 응답에 데이터 포함 |
| 결제 / 주문 like 강한 일관성 | master read 강제 (`@UseMaster`) |
| 정산 / 보고서 (stale 허용) | replica 명시 |

---

## 모니터링

### lag 알람

```promql
# Prometheus mysqld_exporter
mysql_slave_lag_seconds > 5

# 또는 heartbeat 기반
mysql_heartbeat_lag_milliseconds > 5000
```

이 알람은 *DBA 가 받지만 서비스 팀도 인지* 필요. lag 가 5s 이상이면 stickiness 의 2s window 가 부족.

### "내 데이터 안 보여요" 에러 수집

```kotlin
@Aspect
@Component
class ReadAfterWriteMonitor {
    
    @AfterReturning("execution(* *Service.find*(..))", returning = "result")
    fun checkResult(pjp: JoinPoint, result: Any?) {
        if (result == null && wasJustWritten(pjp)) {
            metrics.counter("read_after_write_miss").increment()
        }
    }
}
```

이 메트릭이 increase 하면 stickiness 정책 재검토.

---

## 함정

### 1. session 변수와 stickiness 충돌

`SET @user = ?` 같은 session 변수는 connection 별 — replica/master 라우팅이 바뀌면 잃음. 잘 쓰지 않지만 legacy 코드 주의.

### 2. read-only transaction 안에 write

```kotlin
@Transactional(readOnly = true)
fun fooInternal() {
    repo.update(...)         // ⚠ MySQL replica 는 reject, MyISAM 은 silent fail
}
```

[ADR-0020](file:///Users/gideok-kwon/IdeaProjects/msa/docs/adr/ADR-0020-transactional-usage.md) 에서 금지.

### 3. service 내부 chained call

```kotlin
@Transactional
fun outerWrite() {
    repo.save(...)
    self.innerRead()   // ← 같은 트랜잭션 → master (OK)
}

@Transactional(readOnly = true)
fun innerRead() = ...
```

self-invocation 은 AOP proxy 우회 → 새 트랜잭션 안 만들어짐. innerRead 가 readOnly 이지만 outer 트랜잭션 따라 master. 의도한 건지 확인.

### 4. async write + sync read

```kotlin
fun doWriteAsync(req: Req) {
    asyncExecutor.submit { service.create(req) }   // 다른 thread 에서 write
}

fun doRead(id: Long) = service.findById(id)  // ← write 가 끝나기 전에 read 시도
```

stickiness 도 도움 안 됨 (write thread 와 read thread 의 user context 다를 수 있음). 비즈니스 로직 수준에서 wait / poll 필요.

---

## 핵심 포인트

- replica lag 는 *피할 수 없는* eventually consistent 비용 — 평소 < 100ms, peak 시 수 초
- read-after-write 보장은 4가지 전략: stickiness / 강제 master / GTID wait / 응답에 데이터 포함
- 일반적으로 stickiness 2s window 면 90% 케이스 cover
- 강한 일관성 필요한 도메인 (결제, 재고) 은 master 강제, 나머지는 replica 그대로
- lag 모니터링 알람은 SLA 관점에서 서비스 팀 / DBA 공동 책임

## 다음 학습

- [09-reader-writer-routing.md](09-reader-writer-routing.md) — 라우팅 자체 구현
- [15-codebase-audit.md](15-codebase-audit.md) — msa 가 lag 처리를 어떻게 하는가
- [17-improvements.md](17-improvements.md) — stickiness 도입 ADR 후보
