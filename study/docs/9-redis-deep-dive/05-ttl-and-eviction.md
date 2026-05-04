---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 1
---

# 05 — TTL + Expiration + maxmemory eviction

## 한줄 요약

Redis 의 만료는 (a) **lazy expiration** (접근 시 검사) + (b) **active expiration** (background 무작위 샘플링) 의 hybrid 다. maxmemory 에 도달하면 **eviction policy** (6종) 로 키를 강제 삭제한다. **`allkeys-lfu`** 가 일반 캐시에 가장 안전한 기본값이다.

## 1. TTL 설정과 조회

### 명령

```
EXPIRE key 60                # 60초 후 만료
PEXPIRE key 60000            # 밀리초
EXPIREAT key 1714521600      # epoch 초 시각
PEXPIREAT key ...            # epoch ms 시각
PERSIST key                  # TTL 제거
TTL key                      # 남은 초 (없음=-1, 없는 키=-2)
PTTL key                     # 남은 ms

# Redis 7+ 옵션
EXPIRE key 60 NX             # TTL 없을 때만 set
EXPIRE key 60 XX             # TTL 있을 때만 set
EXPIRE key 60 GT             # 새 TTL > 기존 TTL 일 때만
EXPIRE key 60 LT             # 새 TTL < 기존 TTL 일 때만
```

`SET key val EX 60` / `SET key val PX 60000` 도 atomic.

### 함정

- `SET key val` 가 **TTL 을 제거** 한다. partial update 시 TTL 유지하려면 `EXPIRE` 다시 걸거나 `KEEPTTL` 옵션 (`SET key val KEEPTTL`).
- `RENAME` 은 TTL 유지, `COPY` 는 TTL 따로 (`COPY src dst`).
- `LPUSH` / `HSET` 같은 명령은 TTL 그대로 유지 — 만료 시 통째로 사라짐.

## 2. 만료 처리 알고리즘

### 2.1 Lazy Expiration

키 접근 시점에 만료 여부 검사. 메모리 효율은 좋지만, **접근 안 하면 영원히 남음**.

```
GET foo
  ↓
expireIfNeeded(foo)
  ↓
지났으면 → DEL foo, return nil
아니면   → 정상 반환
```

### 2.2 Active Expiration

background cron (default 10Hz, `hz` config) 에서 주기적으로 expire dict 에서 **무작위 샘플 20개**를 검사:

```
loop:
  if expire dict 에서 무작위 20개 샘플 후
     만료된 비율 > 25% → 다시 loop (더 청소)
     아니면 break
  4ms 이상 걸리면 break
```

이 로직 덕분에 평균적으로 만료 키가 메모리의 25% 이하로 유지된다. Redis 6+ 에선 **multi-threaded expire** 로 더 효율적.

### 2.3 함정

active expiration 이 **명령 처리 사이에 끼어든다**. 만료 키가 한꺼번에 많이 쌓이면 (예: 동일 시점에 100만개 TTL 만료) 다음 명령들의 latency 가 µs → ms 단위로 튀는 "**expire spike**" 발생. **TTL 에 jitter 를 줘야** (예: 60s ± 10s) 이런 thundering herd 를 막는다.

```kotlin
// Bad: 모두 동일 TTL → 60초 후 동시 만료
redis.set(key, value, Duration.ofSeconds(60))

// Good: jitter
val jitter = Random.nextLong(-10, 10)
redis.set(key, value, Duration.ofSeconds(60 + jitter))
```

이 jitter 는 Cache Stampede 방어와도 직결 (11 파일).

## 3. maxmemory 와 eviction

### 3.1 설정

```
CONFIG SET maxmemory 4gb
CONFIG SET maxmemory-policy allkeys-lfu
```

`maxmemory 0` 은 무제한 (시스템 메모리 한도까지) — **운영에서는 항상 명시**해야 OOM (Out Of Memory, 메모리 부족) 으로 OS 가 프로세스 죽이는 걸 막는다.

### 3.2 6가지 정책 (Redis 7.x)

| policy | 대상 | 알고리즘 |
|---|---|---|
| `noeviction` | — | 거부 (write 시 에러) |
| `allkeys-lru` | 모든 키 | LRU 근사 |
| `allkeys-lfu` | 모든 키 | LFU 근사 (Redis 4+) |
| `allkeys-random` | 모든 키 | 무작위 |
| `volatile-lru` | TTL 있는 키만 | LRU |
| `volatile-lfu` | TTL 있는 키만 | LFU |
| `volatile-random` | TTL 있는 키만 | 무작위 |
| `volatile-ttl` | TTL 있는 키만 | 만료 임박 우선 |

### 3.3 LRU vs LFU

- **LRU**: 가장 오래 안 쓴 키 제거. 한 번이라도 쓰이면 "최근" 으로 간주됨 → "한 번만 쓰는 burst" 가 진짜 hot key 를 밀어낼 수 있음 (cache pollution).
- **LFU**: 빈도(frequency) 기반. burst 를 무시. 일반 캐시에 더 적합.

> Redis 의 LRU/LFU 는 **근사 알고리즘** (`maxmemory-samples` 개 무작위 샘플 후 그 중 최악 제거). 정확한 LRU 는 메모리 비용이 너무 크다.

### 3.4 LFU 의 Morris counter

LFU 의 frequency counter 는 8bit 에 들어가도록 **확률적 증가** (Morris counter). 자주 접근될수록 증가 확률이 낮아져 8bit 안에 수십억 회 카운트 가능. `lfu-log-factor` 와 `lfu-decay-time` 으로 튜닝.

```
lfu-log-factor 10        # 증가율 (낮을수록 빨리 증가)
lfu-decay-time 1         # 분 단위, 시간 지나면 counter 감소
```

### 3.5 정책 선택 가이드

| 워크로드 | 추천 |
|---|---|
| 일반 캐시 (hot/cold 명확) | `allkeys-lfu` |
| TTL 명확 + 만료 임박 우선 | `volatile-ttl` |
| 캐시 + 절대 사라지면 안 되는 영구키 혼재 | `volatile-lru` 또는 `volatile-lfu` |
| Redis 를 정식 DB 처럼 쓸 때 | `noeviction` (단, 메모리 모니터링 필수) |
| 분산 락 / 큐 / 영속 키만 있을 때 | `noeviction` |

msa 의 경우:
- gateway / analytics / product 캐시 → `allkeys-lfu` (또는 `volatile-lfu`)
- 분산 락 키만 있는 인스턴스가 분리되면 `noeviction`

## 4. 메모리 관측 명령

```
INFO memory
> used_memory_human:2.34G
> used_memory_rss_human:3.10G
> mem_fragmentation_ratio:1.32
> maxmemory_human:4.00G
> maxmemory_policy:allkeys-lfu
> evicted_keys:1234567

MEMORY USAGE key
> (integer) 12345          # bytes (정확치 않은 추정)

MEMORY STATS
> 다양한 카테고리 메모리

MEMORY DOCTOR
> 추천사항 텍스트
```

핵심 지표:

- `used_memory` — 데이터 메모리 (jemalloc 입장에서 알려준 값)
- `used_memory_rss` — OS 입장 RSS (페이지 단위)
- `mem_fragmentation_ratio` = rss / used_memory
  - 1.0-1.5 정상
  - 1.5+ 단편화 → `activedefrag yes`
  - <1.0 → swap 발생, 매우 위험
- `evicted_keys` — eviction 발생량 (높으면 maxmemory 부족)

## 5. expire dict 와 메모리 비용

키마다 TTL 이 있으면 별도 `expire dict` 에 저장 (key→expireTime). 대략 키당 추가 ~50바이트.
- TTL 없는 키는 expire dict 미등록.
- TTL 키가 많으면 메모리 ~10% 추가.

## 6. lazy free (UNLINK / FLUSH ASYNC)

big key 를 `DEL` 하면 단일 스레드 점거. Redis 4+ 부터 `UNLINK` 가 키를 dict 에서 즉시 떼어내고 **background thread 가 실제 메모리 해제**:

```
UNLINK bigkey            # O(1) (dict 에서 분리만)
FLUSHDB ASYNC            # 백그라운드 청소
FLUSHALL ASYNC
```

자동화도 가능:

```
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
lazyfree-lazy-user-del yes        # DEL 도 lazy
```

운영 권장: 위 4개 모두 `yes`.

## 7. msa 코드베이스 적용

- `analytics/ScoreCacheAdapter` 가 `Duration.ofSeconds(productTtl=7200)` 로 일괄 TTL → **jitter 없음**. 7200초마다 동시 만료 위험.
- `inventory/InventoryCacheAdapter` 는 명시적 TTL 없음 → 영구 캐시처럼 동작 + maxmemory 정책 의존.
- common 자동설정엔 `maxmemory-policy` 가 명시적으로 들어가지 않음 → Redis 노드 conf 에 의존.

→ 18 improvements 에서:
1. analytics TTL 에 ±10% jitter 추가
2. Redis 노드 `maxmemory-policy=allkeys-lfu`, `lazyfree-lazy-* yes` 명시 (k8s/infra/local/redis/statefulset.yaml args 추가)
3. inventory 캐시는 reservation 만료 정책 명시 (없으면 leak)

## 8. 면접 포인트

- "Redis 만료는 어떻게?" → lazy + active. 둘 다.
- "LRU 와 LFU 차이?" → LFU 가 빈도 기반이라 burst 무시. 일반 캐시 추천.
- "expire spike?" → 동일 TTL 키 대량 만료 시 latency spike. jitter 로 해결.
- "maxmemory 미설정 위험?" → OOM 으로 OS 가 죽임. `noeviction` 도 위험 (write 거부).
- "fragmentation_ratio < 1?" → 스왑 발생, 즉시 메모리 추가하거나 노드 분리.
- "DEL 과 UNLINK 차이?" → DEL O(N) 동기, UNLINK 비동기 lazy free.

## 9. 다음 파일 연결

메모리만으로 끝나면 영속성이 없다. 프로세스 죽으면 데이터가 사라지는데, RDB 와 AOF 두 방법으로 디스크에 영속화한다 — 06, 07 에서.
