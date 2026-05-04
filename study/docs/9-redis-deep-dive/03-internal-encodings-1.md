---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 1
---

# 03 — 내부 인코딩 ① SDS / Listpack / Intset

## 한줄 요약

Redis 자료구조는 "**작을 때는 메모리 효율 우선 (listpack/intset/embstr), 커지면 시간 복잡도 우선 (hashtable/skiplist)**" 으로 자동 변환된다. 이 임계값 (config 로 노출) 을 외워두면 메모리 산정과 P99 (99th Percentile, 가장 느린 1%) 지연을 같은 언어로 말할 수 있다.

이 파일은 String 의 SDS, Hash/List/ZSet 작은 인스턴스의 Listpack, Set 의 Intset 까지.

## 1. SDS (Simple Dynamic String)

C 의 null-terminated string 으로는 길이 계산 O(N), binary safe 아님 등 문제가 많아 Redis 는 자체 SDS 를 쓴다.

### 1.1 구조

```
 ┌──────────────┬─────────┬─────────┬──────────────┐
 │ flags(1B)    │ len     │ alloc   │ buf[]        │
 │ (sds 타입)   │ 사용량  │ 할당량  │ 실제 데이터  │
 └──────────────┴─────────┴─────────┴──────────────┘
```

- `len` / `alloc` 으로 O(1) 길이 조회 + binary safe (\0 포함 가능)
- prealloc 으로 자주 발생하는 append 시 메모리 재할당 줄임
  - `< 1MB` → 2배 prealloc
  - `≥ 1MB` → 1MB 씩 prealloc
- 5가지 헤더 (sdshdr5/8/16/32/64) 로 길이 범위에 맞게 메모리 절약

### 1.2 String 인코딩 3종

| encoding | 조건 | 특징 |
|---|---|---|
| `int` | 값이 long 정수 (10진) | SDS 안 씀, 정수 직접 저장 |
| `embstr` | ≤44바이트 string | RedisObject + SDS 를 하나의 메모리 블록에 (cache-friendly) |
| `raw` | >44바이트 string | RedisObject 와 SDS 가 분리 할당 |

```
OBJECT ENCODING foo
> "embstr"
SET foo "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"  # 45자
OBJECT ENCODING foo
> "raw"
SET counter 100
OBJECT ENCODING counter
> "int"
```

### 1.3 함정

- 작은 정수 → `int` 로 가지만, `APPEND` 한 번 하면 raw 로 떨어짐
- embstr 을 수정하면 raw 로 떨어짐 (embstr 은 read-only 최적화)
- `INCR` 은 int encoding 일 때만 빠르고 raw / embstr 이면 변환 비용

## 2. Listpack (Redis 7+ 의 통합 작은 컬렉션 표현)

Redis 7 에서 ziplist 를 listpack 으로 거의 통합했다. ziplist 의 cascade update 버그를 없애려고 prevlen 을 빼고 entry 길이를 끝쪽에도 인코딩한 형태.

### 2.1 구조

```
┌────────────┬────────┬──────────────────────────┬─────┐
│ tot_bytes  │ count  │ entry1, entry2, ...      │ end │
│ 4B         │ 2B     │ 가변 길이                │ 1B  │
└────────────┴────────┴──────────────────────────┴─────┘

entry: ┌────────┬─────────┬──────────────┐
       │ encoding+content │ entry_total  │
       │ 가변             │ (back length)│
       └──────────────────┴──────────────┘
```

- **entry 자체가 가변 길이** + 끝에 자기 길이를 인코딩 → 역방향 traverse O(1)
- 작은 정수는 6/12/16/32/64 bit 인코딩으로 압축
- 작은 string 은 6/12/32 bit length prefix
- ziplist 의 cascade update (prev 길이 변경이 chain 으로 전파) 문제를 해결

### 2.2 사용처 (Redis 7+)

| 자료구조 | listpack 한도 (config) | 변환 후 |
|---|---|---|
| Hash | `hash-max-listpack-entries 128` / `hash-max-listpack-value 64` | hashtable |
| List | `list-max-listpack-size -2` (8KB) | quicklist (linked listpacks) |
| Set | `set-max-listpack-entries 128` / `set-max-listpack-value 64` (Redis 7.2+) | hashtable |
| Sorted Set | `zset-max-listpack-entries 128` / `zset-max-listpack-value 64` | skiplist + hashtable |

> Redis 6 까지는 hash/zset 이 ziplist 였고, set 은 intset → hashtable 만 있었다. Redis 7 에서 listpack 으로 통일 + small set 도 listpack 가능해졌다.

### 2.3 변환 임계값 예시

```
HSET h f1 v1
OBJECT ENCODING h
> "listpack"

# 128번째 필드까지 listpack
# 64바이트 초과 값이 들어가면 hashtable 로 변환

# 한번 hashtable 로 바뀌면 작아져도 다시 listpack 으로 안 돌아감
```

이 비대칭이 중요. **listpack ↔ hashtable 은 단방향 변환**이라 운영 시 한 번 큰 데이터 들어가면 메모리 효율이 영구히 떨어진다.

### 2.4 listpack 시간 복잡도

- 단일 entry 조회 / 삽입 : O(N) — 가변 길이 traverse 필요
- 그래도 N 작아 메모리 캐시 친화적이라 평균 µs 단위로 끝남
- N 이 64 / 128 을 넘는 순간 hashtable 변환 → O(1) 로 점프

## 3. Intset

### 3.1 구조

```
┌──────────────┬────────┬───────────────────────────┐
│ encoding(4B) │ length │ contents (정렬된 정수)    │
└──────────────┴────────┴───────────────────────────┘

encoding ∈ { INT16, INT32, INT64 }
```

- 모든 멤버가 정수일 때만 사용
- 멤버는 항상 **정렬된 상태로 유지** → `SISMEMBER` 가 binary search O(log N)
- 가장 큰 값에 맞춰 encoding 자동 승급 (INT16 → INT64)
- `set-max-intset-entries 512` 까지 → 그 이상이면 hashtable

### 3.2 변환 흐름

```
SADD nums 1 2 3 4 5
OBJECT ENCODING nums
> "intset"

SADD nums "hello"     # 비정수 추가
OBJECT ENCODING nums
> "listpack"          # Redis 7.2+, 그 이전엔 hashtable

SADD nums (...)       # 멤버 늘어남
OBJECT ENCODING nums
> "hashtable"
```

### 3.3 시간 복잡도

| 명령 | intset | listpack | hashtable |
|---|---|---|---|
| SADD (이미 존재 체크) | O(log N) binary search | O(N) | O(1) |
| SISMEMBER | O(log N) | O(N) | O(1) |
| SMEMBERS | O(N) | O(N) | O(N) |

intset 은 정렬되어 있어 `SUNION` / `SINTER` 도 빠르다.

## 4. embstr / int 의 cache-line 효과

embstr 은 RedisObject + SDS 를 한 번에 할당해 **CPU L1 캐시에 같이 들어간다**. 1억 개의 짧은 키에서 GET 성능이 raw 보다 20-30% 빠른 결과가 보고됨. raw 는 두 번의 메모리 jump 가 필요.

44바이트 임계값은 RedisObject(16B) + SDS 헤더(3B) + 데이터 + \0 가 jemalloc 의 64B 슬롯에 들어가도록 계산된 값.

## 5. config 변환 임계값 (Redis 7.x default)

```
hash-max-listpack-entries 128
hash-max-listpack-value 64
list-max-listpack-size -2          # -2 = 8KB
list-compress-depth 0
set-max-intset-entries 512
set-max-listpack-entries 128       # Redis 7.2+
set-max-listpack-value 64
zset-max-listpack-entries 128
zset-max-listpack-value 64
```

운영 팁:

- 메모리 빡빡하면 **임계값을 올려 listpack 비율을 늘림**. 다만 단일 명령 latency 가 O(N) 으로 커지므로 P99 모니터링 필수.
- 임계값을 줄이면 (= hashtable 일찍 변환) latency 안정성 ↑, 메모리 ↑.

## 6. 메모리 산정 예제

10만 개의 user (uid 정수) 를 한 set 에 넣을 때:

| 인코딩 | 메모리 (대략) |
|---|---|
| intset (불가, 한도 512) | — |
| listpack (불가) | — |
| hashtable | 10만 × 56B (entry + ptr) ≈ 5.6MB |

작은 hash (10필드 × 32B 값) 1000만 개:

| 인코딩 | 메모리 |
|---|---|
| listpack (32×10 = 320B per hash) | 10M × ~350B ≈ 3.3GB |
| hashtable | 10M × ~1500B ≈ 14GB |

→ listpack 유지 시 **4배 절약**. 이래서 임계값이 중요.

## 7. 면접 포인트

- "Redis 가 작은 객체에 메모리 효율 좋은 이유?" → embstr / listpack / intset 으로 한 메모리 블록에 압축 + cache-friendly.
- "listpack 과 ziplist 의 차이?" → ziplist 의 cascade update 문제 해결 (prevlen 제거, 엔트리 끝 self-length).
- "encoding 변환은 양방향?" → **단방향**. 한 번 hashtable / quicklist 로 가면 작아져도 안 돌아옴.
- "44바이트 임계값 의미?" → RedisObject + SDS 가 jemalloc 64B 슬롯에 함께 들어가도록 한 값.
- "intset 이 binary search 라 O(log N) 인데 왜 hashtable 로 바꿔?" → N 이 커지면 SADD/SISMEMBER 가 hash O(1) 보다 느려지고, 정렬 유지 비용 (insert O(N)) 도 부담.

## 8. 코드베이스 연관

- `analytics/ScoreCacheAdapter` 의 `score:product:42` 는 JSON 직렬화 → `embstr` 또는 `raw` (44B 초과). 메모리 보고 싶으면 `OBJECT ENCODING score:product:42`.
- `inventory:42:1` Hash 는 필드 2개 (availableQty/reservedQty) → `listpack`. 메모리 효율 좋음.
- `quant` rate limit bucket 은 필드 2개 hash → 동일.

## 9. 다음 파일 연결

자료구조가 임계값을 넘으면 어디로 가는가? Hashtable / SkipList / QuickList 의 내부 구조와 시간 복잡도는 04 에서.
