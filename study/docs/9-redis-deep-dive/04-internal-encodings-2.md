---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 1
---

# 04 — 내부 인코딩 ② Hashtable / SkipList / QuickList

## 한줄 요약

자료구조가 임계값을 넘어가면 (a) Hash/Set 은 hashtable, (b) Sorted Set 은 skiplist+hashtable 듀얼, (c) List 는 quicklist 로 간다. 각각 **incremental rehashing**, **확률적 균형**, **linked listpack** 이라는 영리한 트릭이 있다.

## 1. Hashtable

### 1.1 기본 구조

```
dict
 ├─ ht[0]  ← 평소 사용하는 hash table
 │   └─ table[]: bucket → linked list of entries (chaining)
 │   └─ size, sizemask, used
 ├─ ht[1]  ← rehashing 중에만 사용
 └─ rehashidx  ← incremental rehashing 진행 위치
```

- chaining 으로 충돌 해결
- bucket 수는 2의 거듭제곱
- load factor (used/size) 가 1 을 넘기면 expand 시작 (5 이상이면 강제), 0.1 미만이면 shrink

### 1.2 Incremental Rehashing

대형 hashtable (수천만 entry) 을 한 번에 rehash 하면 **단일 스레드 정지** 가 길어진다. Redis 는 그래서 **점진적 rehashing** 을 한다.

```
1. expand 시작 → ht[1] 새 테이블 할당 (2배 크기)
2. rehashidx = 0
3. 매 명령마다 ht[0] 에서 1 bucket 을 ht[1] 로 옮김
4. 100ms 마다 호출되는 background cron 도 1ms 동안 옮김
5. ht[0] 비면 swap, rehashidx = -1
```

진행 중에는:

- READ → ht[0], ht[1] 둘 다 검색
- WRITE → ht[1] 에만 (ht[0] 은 줄어들기만)
- DELETE → 양쪽

이 덕분에 GB 단위 hashtable 도 rehashing 동안 추가 latency 가 µs 단위로만 늘어난다.

### 1.3 사용처

- Hash 자료구조 (listpack 임계값 초과)
- Set 자료구조 (intset/listpack 임계값 초과)
- Sorted Set 의 member→score 매핑 (skiplist 와 함께)
- 키 공간 자체 (DB) — 각 DB 가 dict
- expire 관리 (별도 dict)

## 2. SkipList (ZSet 의 핵심)

### 2.1 왜 SkipList 인가

Sorted Set 은:
- score 기반 범위 조회 `ZRANGEBYSCORE` (정렬 순회)
- member 기반 단건 조회 `ZSCORE` (해시 조회)

두 요구가 동시에 있다. balanced tree (RB-tree) 도 가능하지만 antirez 는 **skiplist + hashtable 듀얼**을 선택했다. 이유:
- 구현 단순 (RB-tree 회전 로직 복잡)
- 범위 순회가 자연스럽다 (link 만 따라가면 됨)
- 확률적 균형이라 worst case O(log N) 보장 (예상값)

### 2.2 구조

```
level 4 ───────────────────────► tail
                                  │
level 3 ───────►──────────────────►
                                  │
level 2 ───────►──►───────────────►
                                  │
level 1 ───►──►──►──►──►──►──►──►─►
            │
        node(score=10, member="a")
```

각 노드는 1개 ~ MAX_LEVEL(32) 개의 forward 포인터를 가진다. 노드 생성 시 level 은 확률 분포 `P(level≥k) = (1/4)^k` 로 결정 → 평균 노드당 1.33 포인터, 평균 검색 비용 O(log N).

### 2.3 Sorted Set = SkipList + Hashtable

```
ZADD zset 10 "a" 20 "b" 30 "c"

내부:
  hashtable: {"a"→10, "b"→20, "c"→30}     # ZSCORE 용 O(1)
  skiplist:  10→"a" → 20→"b" → 30→"c"     # 범위 순회 용 O(log N)
```

- 메모리 더 들지만 양쪽 명령 모두 빠름.
- 두 자료구조 동기화 일관성은 **단일 스레드 + 명령 단위 atomicity** 로 보장.

### 2.4 시간 복잡도

| 명령 | 복잡도 |
|---|---|
| ZADD | O(log N) |
| ZSCORE | O(1) |
| ZRANGE 0 N | O(log N + M) |
| ZRANGEBYSCORE | O(log N + M) |
| ZRANK | O(log N) |
| ZINCRBY | O(log N) |

## 3. QuickList (List)

### 3.1 단순 linked-list 가 아니다

Redis 3.2 부터 List 는 **quicklist = linked list of listpacks** 다.

```
quicklist
 ├─ head ──► node1 ──► node2 ──► node3 ──► tail
              │           │           │
        listpack(items)  listpack    listpack
```

- 각 노드가 listpack 한 덩어리 (8KB default)
- LPUSH / RPUSH 는 head/tail listpack 에 append
- 압축 옵션 `list-compress-depth N` — 양 끝 N 노드 빼고 LZF 압축 (메모리 더 절약, CPU ↑)

### 3.2 왜 이 구조인가

- 단순 linked list = 노드마다 next/prev 포인터 + RedisObject 오버헤드 → 메모리 폭증
- 단순 listpack = 큰 List 면 O(N) traversal + cascade insert
- 둘 다 단점이라 **listpack 의 메모리 효율 + linked list 의 양 끝 O(1) push**

### 3.3 시간 복잡도

| 명령 | 복잡도 |
|---|---|
| LPUSH / RPUSH / LPOP / RPOP | O(1) (양 끝 listpack 에 op) |
| LRANGE 0 N | O(N) — 노드 traverse + listpack 풀기 |
| LINDEX i | O(N) (worst case) |
| LREM count v | O(N) |

## 4. Stream 의 내부 (간단)

Stream 은 **radix tree (라딕스 트리) + listpack** 의 조합이다.

- key = stream ID (`<ms>-<seq>`)
- 같은 ms prefix 끼리 하나의 listpack 에 묶이고, 그 listpack 들이 radix tree 의 leaf
- 시간순 append 라 radix tree 의 prefix 효율이 좋음
- O(log N) 으로 ID 기반 lookup, O(1) append

## 5. 메모리/시간 비교 테이블

| 자료구조 | 작을 때 | 클 때 | 변환 임계값 |
|---|---|---|---|
| String | embstr | raw | 44 bytes |
| Hash | listpack | hashtable | 128 entries / 64B value |
| List | listpack 단일 | quicklist | 8KB listpack 단위 |
| Set (정수) | intset | hashtable | 512 entries |
| Set (mixed) | listpack | hashtable | 128/64 |
| ZSet | listpack | skiplist+hashtable | 128/64 |
| Stream | — | radix+listpack | (항상) |

## 6. ZSet 메모리 산정 예시

10만 멤버 ZSet:

- listpack 불가능 (한도 128)
- skiplist + hashtable
  - skiplist: 100k × ~32B (avg 1.33 ptr × 8B + score 8B + next/prev 8B + 약간) ≈ 3.2MB
  - hashtable: 100k × ~50B ≈ 5MB
  - 총 ≈ 8MB

→ 동일 데이터를 List 에 넣으면 quicklist 로 약 4MB. 절반. ZSet 은 이중 인덱스 비용을 명확히 인지.

## 7. rehashing 의 운영 영향

- BGSAVE 와 rehashing 이 겹치면 fork 후 **CoW 페이지 폭증** (rehash 중인 ht[0]/ht[1] 두 테이블 모두 dirty 페이지 가능). 운영에서 RDB 시간을 새벽으로 분리하는 이유 중 하나.
- 50% 규모 변경 (대규모 import / FLUSHDB) 후 rehashing 트래픽 latency 가 5-10% 솟구쳐도 정상.

## 8. defrag (active-defrag)

memtable 이 jemalloc 위에 올라가는데, 시간이 지나면 **할당된 빈 슬롯이 많아 fragmentation ratio** 가 1.5+ 로 솟는다 (`mem_fragmentation_ratio`). Redis 4+ `activedefrag yes` 로 background 에서 페이지 압축 가능. 단, CPU 5-10% 추가.

## 9. 면접 포인트

- "ZSet 은 왜 skiplist 와 hashtable 둘 다?" → 범위 순회와 단건 조회 모두 빠르려고. 메모리 트레이드오프.
- "Skiplist 와 RB-tree 비교?" → 구현 단순성, 범위 순회 용이성, 확률적 균형으로 충분.
- "incremental rehashing 이 뭐고 왜 필요?" → 대형 hashtable rehash 시 단일 스레드 정지를 피하려고 명령마다 1 bucket 씩 옮김.
- "QuickList 는 단순 linked list 보다 왜 좋은가?" → 노드별 listpack 으로 포인터 오버헤드 줄이고, 양 끝 O(1) push 유지.
- "Sorted Set 메모리 산정?" → skiplist + hashtable → 멤버당 약 80B (mixed). 큰 ZSet 비용 인지.

## 10. 코드베이스 연관

- msa 의 ZSet 사용은 현재 없음 (랭킹/leaderboard 시 도입 후보).
- analytics 가 product/keyword 스코어를 ZSet 에 넣으면 Top-N 조회 O(log N + M) 으로 빠름. 현재는 String JSON 으로 단건 캐시 (`score:product:42`) → 18 improvements 에서 leaderboard ZSet 도입 검토.

## 11. 다음 파일 연결

이제 자료구조 + 인코딩이 끝났다. 메모리에 들어간 데이터를 어떻게 정리/만료시키는가 (TTL + eviction policy) 는 05 에서.
