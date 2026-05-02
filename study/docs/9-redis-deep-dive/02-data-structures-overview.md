---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 1
---

# 02 — 자료구조 8종 개요

## 한줄 요약

Redis 의 진짜 매력은 단순 KV 가 아니라 "**서버 측 자료구조 + atomic 명령**" 이다. 8가지 자료구조 (String, List, Hash, Set, ZSet, Bitmap, HyperLogLog, Stream) 의 사용처를 본능적으로 매칭할 수 있어야 한다. Geo 도 있지만 Sorted Set 의 응용이라 별도 자료구조로 외울 필요는 없다.

## 1. 한 페이지 매트릭스

| # | 자료구조 | 대표 명령 | 시간 복잡도 | 메모리 | 전형 사용처 |
|---|---|---|---|---|---|
| 1 | String | SET/GET/INCR | O(1) | 키 + 값 | 캐시, 카운터, 분산락 키 |
| 2 | List | LPUSH/RPUSH/LRANGE/BLPOP | O(1) push, O(N) range | quicklist | FIFO 큐, 최근 N건, 작업 대기열 |
| 3 | Hash | HSET/HGET/HINCRBY | O(1) | listpack/hashtable | 객체 캐시 (도메인 1건 = 1 hash) |
| 4 | Set | SADD/SISMEMBER/SUNION | O(1) | intset/listpack/hashtable | 태그, unique 방문자, 집합 연산 |
| 5 | Sorted Set | ZADD/ZRANGEBYSCORE/ZINCRBY | O(log N) | listpack/skiplist+ht | 랭킹, 시간기반 큐, leaderboard |
| 6 | Bitmap | SETBIT/BITCOUNT/BITOP | O(1) bit, O(N) op | (String 위) | 출석, A/B 노출, 활성 사용자 |
| 7 | HyperLogLog | PFADD/PFCOUNT | O(1) | 12 KB 고정 | UV (unique visitor) 추정 |
| 8 | Stream | XADD/XREADGROUP/XACK | O(log N) | radix tree+listpack | 영속 메시지 큐, Kafka 라이트 |

> Geo 는 ZSet 에 geohash 64bit 인코딩으로 score 를 채운 것. `GEOADD` 내부적으로 `ZADD`. 별도 자료구조 아님.

## 2. String

### 1.1 핵심 특성

- 최대 512MB (보통은 KB 단위로 사용)
- 인코딩: `int` (long 범위) / `embstr` (≤44바이트) / `raw`
- atomic 산술: `INCR / INCRBY / DECR / INCRBYFLOAT`
- atomic SET: `SET key val NX EX 30` (분산락 표준)

### 1.2 사용 패턴

```
# 1) 단순 캐시
SET product:42 "{...json...}" EX 300

# 2) 분산 락 (12-distributed-lock-setnx 참고)
SET lock:order:42 "uuid-token" NX PX 5000

# 3) 카운터
INCR pageview:2026-05-01

# 4) 비트맵 (실제로는 String 위 비트 연산)
SETBIT user:active:2026-05-01 12345 1
```

### 1.3 함정

- 100MB 넘는 String → big key. `STRLEN` 으로 모니터링.
- `APPEND` 반복 시 SDS 가 prealloc 으로 2배씩 커진다 (1MB 이상부터는 1MB 씩 추가). 메모리 단편화 주의.

## 3. List

### 2.1 핵심 특성

- 인코딩: 작으면 `listpack`, 커지면 `quicklist` (linked list of listpacks)
- 양방향 push/pop: `LPUSH`, `RPUSH`, `LPOP`, `RPOP`
- blocking pop: `BLPOP`, `BRPOP` (큐 워커)
- 범위 조회: `LRANGE` (O(N), 큰 N 위험)
- 길이 제한: `LTRIM` 으로 capped list 운영

### 2.2 사용 패턴

```
# 1) "최근 N건" capped list
LPUSH user:42:recent "evt1"
LTRIM user:42:recent 0 99   # 최근 100건만 유지

# 2) 작업 큐 (간단)
RPUSH queue:email "{to:..., subject:...}"
BLPOP queue:email 0          # 워커가 blocking pop
```

### 2.3 함정

- List 큐는 ack/재처리 개념이 없다. 워커가 죽으면 처리 중 메시지 유실. 안전하면 **Stream** (14번 파일).
- `LRANGE 0 -1` 이 운영에 자주 보이면 위험 신호.

## 4. Hash

### 3.1 핵심 특성

- 도메인 객체 1건을 단일 키로. 필드 단위 partial update.
- 인코딩: 작으면 `listpack`, 임계값 넘으면 `hashtable`
- atomic 필드 증가: `HINCRBY`

### 3.2 사용 패턴

```
HSET user:42 name "Kim" age 31 city "Seoul"
HGET user:42 age          # 한 필드만 조회
HINCRBY user:42 score 10  # 한 필드만 atomic 증가
HMGET user:42 name age    # 다중 필드
```

### 3.3 vs JSON String 트레이드오프

- Hash: 필드 단위 atomic 갱신 가능, 메모리 효율 좋음 (listpack 일 때)
- JSON String: 직렬화 단순, 한 번에 다 가져오기 쉬움, partial update 불가

→ msa 는 GenericJacksonJsonRedisSerializer 로 String/Hash 둘 다 JSON 가능. 분기 기준은 "필드 단위 atomic 갱신 필요한가".

## 5. Set

### 4.1 핵심 특성

- 중복 없는 string 집합
- 인코딩: 모두 정수면 `intset` (정렬 + binary search), 작은 mixed 면 `listpack` (Redis 7.2+), 그 외 `hashtable`
- 집합 연산: `SUNION`, `SINTER`, `SDIFF` — O(N+M)

### 4.2 사용 패턴

```
# 1) 태그
SADD article:42:tags "redis" "cache" "kotlin"
SISMEMBER article:42:tags "redis"

# 2) unique 방문자 (정확값)
SADD visitors:2026-05-01 user42
SCARD visitors:2026-05-01

# 3) 친구 교집합
SINTER user:1:friends user:2:friends
```

### 4.3 함정

- `SUNIONSTORE` / `SINTERSTORE` 가 큰 집합이면 O(N+M) 단일 스레드 점거.
- unique 방문자가 100만+ → `HyperLogLog` 로 전환 (12KB 고정).

## 6. Sorted Set (ZSet)

### 5.1 핵심 특성

- (member, score) 페어, score 로 정렬
- 인코딩: 작으면 `listpack`, 크면 `skiplist + hashtable` (이중 인덱스)
- 범위 조회 O(log N + M): `ZRANGEBYSCORE`, `ZRANGEBYLEX`, `ZREVRANGE`

### 5.2 사용 패턴

```
# 1) 실시간 랭킹
ZADD leaderboard 1500 "user42"
ZADD leaderboard 1700 "user88"
ZREVRANGE leaderboard 0 9 WITHSCORES   # top 10

# 2) 시간 기반 큐
ZADD scheduled "1714521600" "task-uuid"   # score = epoch sec
ZRANGEBYSCORE scheduled 0 (now)           # 만료된 것만 pop

# 3) Geo (응용)
GEOADD shops 127.001 37.564 "store-1"
GEORADIUS shops 127.0 37.5 1 km
```

### 5.3 함정

- `ZRANGE 0 -1` 큰 ZSet → 단일 스레드 점거.
- score 가 float 라 IEEE 754 정밀도 한계 (정수 53bit 까지 안전).

## 7. Bitmap

### 6.1 핵심 특성

- String 위 비트 연산. `SETBIT key offset value`
- offset 매우 큼 (2^32-1) → 4GB 까지 가능, 보통 100MB 안에서 운영
- 집합 연산: `BITOP AND/OR/XOR`, `BITCOUNT`

### 6.2 사용 패턴

```
# 1) 일자별 활성 사용자
SETBIT active:2026-05-01 12345 1   # userId=12345 가 오늘 활성
BITCOUNT active:2026-05-01         # DAU
BITOP AND active:week active:m1 active:m2 ... active:m7
BITCOUNT active:week               # WAU

# 2) 출석체크
SETBIT user:42:attendance:2026-05 0 1   # 1일 출석
BITCOUNT user:42:attendance:2026-05      # 한 달 출석 일수
```

### 6.3 함정

- offset 이 user_id 면 user_id 폭이 크면 메모리 폭증 (희소). user_id 100억이면 1.25GB.
- "있다/없다" 대규모는 `Roaring Bitmap` 외부 라이브러리 검토.

## 8. HyperLogLog (HLL)

### 7.1 핵심 특성

- **확률적 cardinality 추정**. 12 KB 고정 메모리로 **최대 2^64 unique** 까지 0.81% 표준 오차로 카운트.
- `PFADD key elem`, `PFCOUNT key`, `PFMERGE dest src1 src2`
- 정확값 X — 추정값.

### 7.2 사용 패턴

```
PFADD uv:2026-05-01 user42 user88 user1234
PFCOUNT uv:2026-05-01            # 약 3
PFMERGE uv:2026-05 uv:2026-05-01 uv:2026-05-02 ...
PFCOUNT uv:2026-05                # 월별 UV
```

### 7.3 vs Set

| 항목 | Set | HLL |
|---|---|---|
| 메모리 | O(N) | 12KB 고정 |
| 정확도 | 정확 | 약 0.81% 오차 |
| 멤버 enumerate | O(N) 가능 | 불가 |

→ "정확한 멤버 목록" 필요하면 Set, "근사 카운트" 면 HLL.

## 9. Stream

별도 파일 (14-stream-consumer-group.md) 에서 깊이 다룸. 요약:

- **append-only log + consumer group + ACK**.
- 메시지마다 ID `<ms>-<seq>`.
- `XADD`, `XREAD`, `XREADGROUP`, `XACK`, `XPENDING`.
- Kafka 의 라이트 버전 — 단일 노드, 영속성, 멀티 컨슈머 가능. 처리량 / 보존 / 확장성에서 Kafka 보다 낮음.

## 10. 자료구조 매칭 면접 표

| 요구 | 정답 |
|---|---|
| 카운트 1개 | String + INCR |
| 객체 1건 partial update | Hash |
| FIFO 작업 큐 (간단) | List + BLPOP, **장애 위험 있으면 Stream** |
| 랭킹 / leaderboard | Sorted Set |
| 시간 기반 지연 큐 | Sorted Set (score=epoch) |
| 태그 / unique 회원 정확값 | Set |
| 일별 활성 / 출석 | Bitmap |
| UV 근사 | HyperLogLog |
| ack 가 필요한 메시지 큐 | Stream + Consumer Group |
| 위치 검색 | Geo (= Sorted Set 응용) |
| Pub/Sub broadcast (휘발 OK) | Pub/Sub (자료구조 아님) |
| 분산 락 키 | String + SET NX EX |

## 11. msa 코드베이스 매칭

| 자료구조 | msa 사용처 |
|---|---|
| String | analytics 스코어 캐시 (`score:product:42` JSON) |
| Hash | inventory 재고 (`inventory:42:1` availableQty/reservedQty) |
| Hash | quant rate limit token bucket (tokens / last_refill) |
| String INCR | inventory `inventory:active-reservations` 카운터 |
| String SETNX (예정) | 분산락 도입 시 (12 파일 참고) |
| Stream | 미사용 — 18 improvements 에서 도입 검토 |
| Bitmap / HLL | 미사용 |

## 12. 다음 파일 연결

각 자료구조의 **내부 메모리 표현 (encoding) 자동 변환 임계값**과 시간/공간 트레이드오프는 03 (SDS / Listpack / Intset), 04 (Hashtable / SkipList / QuickList) 에서 다룬다.
