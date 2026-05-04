---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 3
---

# 10 — Cache 전략 4종 (Aside / Through / Behind / Refresh-Ahead)

## 한줄 요약

캐시 패턴은 (a) **누가 cache 와 DB 를 쓰는가**, (b) **언제 cache 가 업데이트되는가** 의 조합이다. 가장 흔한 건 **Cache-Aside (lazy loading)**, 가장 위험한 건 **Write-Behind (eventual consistency, 손실 가능)**. 패턴 선택은 일관성 vs 성능 트레이드오프.

## 1. Cache-Aside (Lazy Loading)

### 1.1 흐름

```
read:
  1. cache.get(key)
  2. hit  → return
  3. miss → db.find(...) → cache.set(key, val, ttl) → return

write:
  1. db.save(...)
  2. cache.delete(key)        # invalidate (또는 set)
```

### 1.2 코드 예 (Kotlin)

```kotlin
fun getProduct(id: Long): Product {
    val cached = redis.get("product:$id")
    if (cached != null) return mapper.readValue(cached, Product::class.java)

    val product = productRepository.findById(id) ?: throw NotFound()
    redis.set("product:$id", mapper.writeValueAsString(product), Duration.ofMinutes(10))
    return product
}

@Transactional
fun updateProduct(id: Long, command: UpdateCommand): Product {
    val product = productRepository.findById(id)?.update(command) ?: throw NotFound()
    productRepository.save(product)
    redis.delete("product:$id")           // invalidate
    return product
}
```

### 1.3 장단점

| 장점 | 단점 |
|---|---|
| 캐시 인프라 장애 시 DB 가 SSOT 라 fallback 가능 | 첫 요청은 항상 cache miss (cold start) |
| 가장 단순, 디버깅 쉬움 | invalidation 누락 시 stale 발생 |
| 읽기 부하만 캐시로 흡수 | thundering herd (Cache Stampede) 위험 |

### 1.4 함정: Read-After-Write 일관성

```
T0: client A → updateProduct(42)
    1) UPDATE products WHERE id=42  (DB)
    2) DEL product:42                (cache)
T1: client B → getProduct(42)
    1) GET product:42 → miss
    2) SELECT FROM products WHERE id=42 → 갱신값
    3) SET product:42 → 갱신값
```

문제는 1-2 사이의 race:

```
T0.5: client B 가 동시 read 진입
    GET product:42 → miss → SELECT → 구값 (replication lag) → SET 구값
T0.6: client A 의 DEL 이 늦게 도착
    → 결과: cache 에 구값
```

→ **Cache-Aside 는 read-after-write 일관성을 100% 보장하지 못한다**. 강한 일관성이 필요하면 분산 락 + write-through, 또는 outbox pattern.

## 2. Read-Through

### 2.1 흐름

```
read:
  cache.get(key) {
     cache miss 시 cache 라이브러리가 자동으로 DB 조회 + cache 적재
  }
  return

write:
  cache.put(key, val) → 라이브러리가 DB + cache 동기 업데이트
```

Cache-Aside 와 다른 점은 **cache 라이브러리가 DB 접근까지 캡슐화**. Spring Cache 의 `@Cacheable` + `CacheLoader` 패턴.

```kotlin
@Cacheable("product", key = "#id")
fun getProduct(id: Long): Product = productRepository.findById(id) ?: throw NotFound()
```

내부적으로 cache miss 시 `getProduct` 가 호출되어 DB 조회 후 cache 에 저장.

### 2.2 장단점

| 장점 | 단점 |
|---|---|
| 호출자 코드 단순 (annotation) | cache 라이브러리에 종속 |
| 패턴 일관 | cache 인프라 장애 시 미세하게 다른 동작 |

## 3. Write-Through

### 3.1 흐름

```
write:
  1. cache.set(key, val)       # cache 먼저 (또는 DB 먼저)
  2. db.save(...)              # 둘 다 동기 성공해야 ack
```

### 3.2 장단점

| 장점 | 단점 |
|---|---|
| cache ↔ DB 강한 일관성 | write latency = cache + DB |
| read miss 가 거의 없음 | DB 만 update 하는 외부 변경 (배치, ETL) 시 cache invalidation 필요 |

### 3.3 cache + DB atomic 문제

cache.set 과 db.save 의 atomic 보장이 어렵다. 한쪽 성공 후 다른쪽 실패 시 inconsistency.

해결책:
- DB 가 SSOT 이고 cache 는 무시해도 되는 경우 → DB 우선 + cache 실패시 무시 (best-effort)
- 강한 일관성 필요 → outbox + reliable invalidation, 또는 transactional outbox 로 cache CDC (Change Data Capture, 변경 데이터 캡처)

## 4. Write-Behind (Write-Back)

### 4.1 흐름

```
write:
  1. cache.set(key, val)        # 즉시 ack
  2. cache 가 큐에 적재
  3. background worker 가 DB 에 batch 로 flush
```

### 4.2 장단점

| 장점 | 단점 |
|---|---|
| write latency = cache 만 (µs) | cache 죽으면 데이터 영구 유실 |
| DB 부하 batching 으로 절감 | write 후 read 시 lag 가능 |
| 쓰기 폭주 대응 | 일관성 약함 |

### 4.3 사용 시나리오

- 카운터 / 통계 (정확도가 중요하지 않음)
- analytics 이벤트 집계
- log 같은 append-only

→ msa analytics 가 사실상 이 패턴: Kafka Streams 가 카운터를 윈도우로 집계 후 ClickHouse / Redis 에 batch flush. **Redis 는 view 캐시 + ClickHouse 가 SSOT**.

## 5. Refresh-Ahead

### 5.1 흐름

```
read:
  1. cache.get(key)
  2. TTL 이 거의 만료 (예: 80% 도달) → background 에서 미리 refresh
  3. 호출자에게는 현재 cache 값 즉시 반환

만료 직전 refresh:
  background:
    val = db.find(...)
    cache.set(key, val, fullTtl)
```

### 5.2 장단점

| 장점 | 단점 |
|---|---|
| TTL 만료 직후의 cold miss 없음 | 안 쓰는 키도 refresh (낭비) |
| stampede 자연스럽게 예방 | hot key 만 적용 가능 (cold key 는 의미 없음) |

### 5.3 응용: Probabilistic Early Recomputation (XFetch)

Refresh-Ahead 의 확률적 버전. **TTL 이 가까워질수록 호출자가 stochastic 하게 본인이 직접 refresh**. Cache Stampede 방어의 표준 (11 파일).

## 6. 패턴 선택 매트릭스

| 워크로드 | 추천 |
|---|---|
| 일반 read-heavy 캐시 (productdetail, 사용자) | Cache-Aside |
| ORM 통합 캐시 (entity 1차) | Read-Through (Spring Cache) |
| 강한 일관성 + 적당한 TPS | Write-Through |
| 카운터 / log / analytics | Write-Behind |
| hot key + 만료 직후 cold miss 위험 | Refresh-Ahead (or XFetch) |

## 7. 캐시 invalidation 패턴

### 7.1 TTL only

```
SET key val EX 60
```

가장 단순. 60초 stale 허용. 대부분 사용 케이스에서 충분.

### 7.2 Event-driven invalidation

```
DB write → Kafka 이벤트 발행 → consumer 가 cache.delete
```

msa 의 product → kafka → search 와 유사한 패턴 활용 가능. cross-service 일관성을 이벤트로 푸는 방식.

### 7.3 Versioned key

```
SET product:42:v3 ...

// 새 버전 발급 시
SET product:42:current_version 4
SET product:42:v4 ...
```

옛 버전 키는 자동 만료. 캐시 invalidation 의 race 를 우회.

### 7.4 Cache-Aside + DEL twice (delayed double-delete)

write 직후 한 번 DEL, 짧은 대기 후 한 번 더 DEL (replication lag 또는 in-flight cache miss 의 stale 적재 무력화):

```kotlin
@Transactional
fun update(id: Long) {
    db.update(id)
    redis.delete("product:$id")
    delayed.schedule { redis.delete("product:$id") }   // 500ms 후
}
```

DB replication lag 이 큰 환경에서 효과 있음.

## 8. msa 적용 점검

| 서비스 | 패턴 | 비고 |
|---|---|---|
| analytics | Cache-Aside (Read) + Write-Behind 유사 (스코어 산출이 batch) | TTL 7200s 균등 (jitter 없음, 11 파일 개선 대상) |
| inventory | Cache-Aside + Lua atomic update | DB → Redis 한쪽 source 위험 (재고 SSOT 가 어디?) |
| gateway | Stateful Filter (rate limit) — cache 라기보단 counter | OK |
| product (예상) | Cache-Aside (productdetail) | 미구현 / 18 improvements 후보 |

## 9. 면접 포인트

- "Cache-Aside 의 race?" → write 의 DEL 과 read 의 SET 이 race → stale 가능. delayed double-delete 또는 versioned key.
- "Write-Through 와 Write-Behind 차이?" → through 는 동기 ack, behind 는 비동기 batch (성능 ↑, 손실 위험).
- "Refresh-Ahead 가 Refresh-Ahead 만으로 stampede 방어 가능?" → 아니오. hot key 일 때만 효과. 일반 stampede 는 XFetch / lock / TTL jitter 조합.
- "캐시 일관성 4가지 (없는 거 / TTL / 이벤트 / versioned)?" → trade-off 별로 설명.
- "DEL vs SET on update?" → DEL 이 안전 (다음 read 가 DB hit, race 영향 작음). SET 은 갱신값을 바로 적재라 stale read 위험 작아 보이지만 race 상황에서 옛값 적재 가능.

## 10. 다음 파일 연결

cache miss 가 동시에 폭주하면 DB 가 무너지는 게 Cache Stampede. 방어 4가지 (probabilistic early, locking, TTL jitter, SingleFlight) 를 11 에서.
