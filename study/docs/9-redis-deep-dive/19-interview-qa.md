---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 4
---

# 19 — 면접 Q&A 카드 (50문항 + 회독용)

## 사용 방법

- 학습 종료 후 1주일 간격으로 2-3회 회독
- 답을 가리고 본인이 먼저 답해본 뒤 비교
- 오답 / 헷갈린 항목은 ★ 표시 → 다음 회독 시 우선 복습
- 한국 대기업 (네이버 / 카카오 / 라인 / 토스 / 우아한형제들 / 쿠팡 등) 면접에서 빈출 영역 위주

## A. 실행 모델 (Phase 1)

### Q1. Redis 가 왜 빠른가요?

A. 메모리 상주 + 단일 스레드 명령 루프 + epoll 기반 I/O 멀티플렉싱. 락/컨텍스트 스위치/캐시 invalidation 비용이 없고, 거의 모든 명령이 O(1). RTT 가 µs 단위라 단일 노드로 100k QPS (Queries Per Second, 초당 쿼리 수) 가 가능.

### Q2. 단일 스레드인데 멀티 코어를 어떻게 활용하나요?

A. 명령 실행 자체는 여전히 단일 스레드지만 Redis 6+ 의 I/O 스레드가 read/write/RESP 파싱을 병렬화. 또는 cluster sharding 으로 여러 master 에 분산.

### Q3. KEYS 명령을 운영에서 쓰면 안 되는 이유?

A. O(N) 으로 모든 키를 스캔. 단일 스레드를 점거해 전체 클라이언트가 lag. 대신 `SCAN cursor MATCH ...` 사용 (cursor 기반 incremental).

### Q4. DEL 과 UNLINK 차이?

A. DEL 은 동기, big key 면 단일 스레드 점거. UNLINK 는 키를 dict 에서 즉시 떼고 background thread 가 메모리 해제 → main 에 영향 X.

### Q5. blocking 명령은 어떤 게 있고 왜 위험한가?

A. KEYS, SMEMBERS, HGETALL, LRANGE 0 -1 같은 O(N), DEBUG SLEEP, FLUSHDB (sync). 단일 스레드라 한 명령이 ms 단위 걸리면 다른 클라이언트도 같이 lag. UNLINK / FLUSHDB ASYNC / SCAN 등 비동기 대안 사용.

## B. 자료구조와 인코딩 (Phase 1)

### Q6. Redis 의 9가지 자료구조? (Geo 포함)

A. String, List, Hash, Set, Sorted Set, Bitmap, HyperLogLog, Stream, Geo. Geo 는 Sorted Set 의 응용 (geohash score) 이라 별도 자료구조라기엔 모호.

### Q7. listpack 과 ziplist 차이?

A. ziplist 는 prevlen 으로 직전 entry 길이를 저장 → cascade update 위험 (prev 길이 변경이 chain). listpack 은 각 entry 끝에 자기 길이를 저장해 cascade 없앰. Redis 7 에서 ziplist 거의 deprecated.

### Q8. encoding 자동 변환 임계값을 외워주세요.

A. Hash: 128 entries / 64B value → hashtable. Set 정수: 512 → hashtable. Set mixed: 128/64 → hashtable. Sorted Set: 128/64 → skiplist. List: listpack 8KB 단위로 quicklist node 분할. **단방향** — 한 번 변환되면 작아져도 안 돌아옴.

### Q9. ZSet 이 skiplist + hashtable 둘 다 쓰는 이유?

A. 범위 조회 (ZRANGEBYSCORE) 는 skiplist 의 정렬 연결로 O(log N + M). 단건 조회 (ZSCORE) 는 hashtable 로 O(1). 두 요구를 모두 빠르게 충족하려고 메모리 비용을 받아들임.

### Q10. SkipList 와 Red-Black Tree 비교?

A. SkipList 는 확률적 균형 (level 분포로 자동), 구현 단순, 범위 순회 자연. RB-tree 는 worst case 더 엄격하지만 회전 로직 복잡, 범위 순회 어려움. antirez 가 단순성과 범위 순회 유리함을 들어 SkipList 채택.

### Q11. embstr 과 raw 차이? 임계값 44바이트의 의미?

A. embstr 은 RedisObject + SDS 를 한 메모리 블록에 → CPU L1 캐시 친화적. 44B 이하 string 일 때만. raw 는 분리 할당. 44B 는 jemalloc 64B 슬롯에 RedisObject(16B) + SDS 헤더(3B) + 데이터 + null 이 들어가도록 한 값.

### Q12. intset 의 장단점?

A. 모든 멤버가 정수일 때만. 정렬 + binary search 로 SISMEMBER O(log N). insert 시 정렬 유지로 O(N). 멤버가 늘면 (>512 default) hashtable 로 변환. 정수 작은 set 에 메모리 효율 매우 좋음.

### Q13. ★ HyperLogLog 의 12KB 의미?

A. 확률적 cardinality 추정 알고리즘. 12KB 고정 메모리로 최대 2^64 unique 까지 ~0.81% 표준 오차로 카운트. PFADD / PFCOUNT / PFMERGE. 정확한 멤버 enumerate 는 불가 — 정확값 필요하면 Set.

## C. TTL / Eviction (Phase 1)

### Q14. Redis 의 만료 처리 방식 2가지?

A. lazy (접근 시 검사) + active (background cron 이 expire dict 의 무작위 20개 샘플링, 만료 비율 25% 이상이면 다시 loop). 둘의 hybrid.

### Q15. expire spike 가 뭐고 어떻게 막나요?

A. 동일 TTL 의 키 대량이 같은 시점 만료 → active expiration 폭주로 latency spike. **TTL 에 ±10% jitter** 로 분산.

### Q16. maxmemory 미설정 시 위험?

A. Redis 가 시스템 메모리 한도까지 사용 후 OS 가 OOM-killer 로 프로세스 종료. 또는 fork 시 메모리 부족. 항상 명시 필수.

### Q17. ★ LRU 와 LFU 차이?

A. LRU 는 최근 접근 시각 기반 — burst (한 번 쓰는 cold 데이터) 가 hot 데이터를 밀어낼 수 있음 (cache pollution). LFU 는 빈도 기반 — burst 무시. 일반 캐시는 LFU 권장.

### Q18. Redis 의 LRU/LFU 가 정확한 알고리즘인가?

A. 아니오. 근사 알고리즘. `maxmemory-samples` 개 무작위 샘플 후 그 중 최악 제거. 정확한 LRU 는 메모리 오버헤드가 너무 커 안 함.

### Q19. eviction policy 6종? (volatile 포함)

A. noeviction, allkeys-lru/lfu/random, volatile-lru/lfu/random/ttl. (사실 8종.) volatile-* 는 TTL 있는 키만 대상.

### Q20. mem_fragmentation_ratio 가 1 미만일 때?

A. RSS < used_memory → swap 발생. 즉시 메모리 추가하거나 데이터 줄여야. 운영 위험 신호.

## D. 영속화 (Phase 2)

### Q21. RDB 와 AOF 차이?

A. RDB 는 시점 binary 스냅샷 (압축, restore 빠름, 손실 가능). AOF 는 명령 단위 append (1초 손실, 파일 큼, restore 느림). 운영 표준은 둘을 결합한 **mixed (RDB preamble + AOF append)**.

### Q22. BGSAVE 가 어떻게 일관된 스냅샷을 만드나요?

A. fork(2) + Copy-on-Write. 자식 프로세스가 fork 시점 메모리를 보고 dump, 부모는 새 명령 처리. 부모가 page write 하면 그 페이지만 복사 (CoW).

### Q23. fork 의 비용?

A. 페이지 테이블 복사 (즉시는 가벼움, ms 단위). 그러나 CoW 누적으로 RSS 가 잠시 2배까지 솟을 수 있음. `latest_fork_usec` 모니터링 + maxmemory 50-60% 시스템 메모리.

### Q24. transparent_hugepage 를 never 로 설정해야 하는 이유?

A. THP=always 면 CoW 가 4KB 페이지가 아닌 2MB hugepage 단위 → 작은 write 하나도 큰 페이지 통째로 복사 → CoW 폭증.

### Q25. ★ AOF 의 fsync 옵션 3종?

A. `always` (매 write 마다 fsync, 성능 1/10), `everysec` (1초마다, 표준), `no` (OS 캐시 의존, 위험). 운영 표준은 everysec.

### Q26. AOF rewrite 가 뭐고 왜 필요?

A. 명령이 누적되어 파일 비대 → 현재 메모리 상태로 압축 재작성. fork 사용. Redis 7 부터 multi-part AOF 로 rewrite 중 base/incr 파일 분리 → main thread buffer 부담 해소.

### Q27. mixed (aof-use-rdb-preamble) 가 표준인 이유?

A. AOF rewrite 시 child 가 RDB 형식 dump + 그 후 새 명령 append. restore 시 RDB 부분 빠르게 로드 + 마지막 명령만 replay → AOF 안정성 + RDB 빠른 restore.

## E. HA / 분산 (Phase 2)

### Q28. Redis replication 은 sync? async?

A. async. master 는 ack 없이 응답하고 background 로 replica 에 stream. WAIT 명령으로 부분 동기 가능 (`WAIT 1 100`). min-replicas-* 로 손실 폭 제어.

### Q29. PSYNC 와 FULLRESYNC?

A. replica 가 끊겼다 다시 붙으면 master 의 repl_backlog 안에 누락 offset 이 있으면 PSYNC 부분 동기, 없으면 FULLRESYNC (RDB 전체 + stream).

### Q30. Sentinel 의 quorum?

A. master 가 down 됐다고 합의하는 Sentinel 수의 임계값. 과반이어야 split-brain 방지 (Sentinel 5개면 quorum 3).

### Q31. ★ Sentinel 과 Cluster 의 차이?

A. Sentinel = 단일 master + 자동 failover. Cluster = 16384 슬롯 sharding + 자체 failover (별도 Sentinel 불필요). 데이터 / 트래픽 큰 환경은 Cluster.

### Q32. 16384 슬롯이라는 숫자의 의미?

A. 2^14. cluster gossip 패킷에 노드별 슬롯 비트맵 (2KB) 이 효율적으로 들어가는 크기. 65536 이면 8KB 라 무거움 — antirez 의 답.

### Q33. MOVED 와 ASK redirect 차이?

A. MOVED 는 영구 매핑 변경 (클라이언트가 캐시 갱신). ASK 는 reshard 진행 중 임시 (해당 키만 옮겨진 경우, 다음 명령엔 다시 원 master).

### Q34. cluster 에서 transaction 이 왜 제한?

A. MULTI/EXEC 가 atomic 보장하려면 같은 노드. 슬롯이 분산돼 있어 cross-slot 거부. **Hash tag `{...}`** 로 같은 슬롯 강제하면 가능.

### Q35. ★ Hash tag 의 함정?

A. 같은 tag 의 모든 키가 한 master 에 몰림 → hot shard. tenant id 같은 거에 hash tag 걸면 한 사용자 폭주가 한 master 죽임. 도메인 단위 (order:42 같은 작은 묶음) 로 사용.

## F. 캐시 패턴 / Stampede (Phase 3)

### Q36. Cache-Aside vs Read-Through?

A. Cache-Aside 는 호출자가 직접 cache miss 시 DB 조회. Read-Through 는 cache 라이브러리가 DB 접근까지 캡슐화 (Spring `@Cacheable`). 동작 본질은 같지만 호출자 코드의 책임이 다름.

### Q37. Write-Through 와 Write-Behind 차이?

A. Through 는 동기 — write 시 cache + DB 모두 ack. Behind 는 비동기 — cache 즉시 ack 후 background 가 DB flush. Behind 는 빠르지만 cache 죽으면 영구 손실.

### Q38. ★ Cache Stampede 가 뭐고 방어 4가지?

A. hot key 만료 + 동시 요청 폭주로 DB 가 동일 query 폭격 받는 현상. 방어: (1) TTL jitter, (2) 분산 락 single-flight, (3) Probabilistic Early Recomputation (XFetch), (4) Refresh-Ahead background.

### Q39. XFetch (Probabilistic Early Recomputation) 의 핵심 직관?

A. TTL 가까워질수록 호출자가 확률적으로 본인이 미리 refresh. 만료 정확히 도달하기 전에 누군가 cache 가 새값으로 채워짐. lock 없이 동시 cache miss 거의 0.

### Q40. Cache-Aside 의 read-after-write race 가 뭐죠?

A. write 의 DEL 과 read 의 SET 이 race → cache 에 stale 값 적재 가능. 해결: delayed double-delete (write 후 짧은 대기 후 다시 DEL), versioned key, 또는 분산 락.

## G. 분산 락 (Phase 3)

### Q41. SETNX 분산 락의 안전한 형태?

A. `SET lock:key uuid NX EX 5` (atomic), release 시 Lua 로 GET ↔ DEL atomic + owner token (uuid) 검증. token 없이 DEL 하면 다른 owner 락을 풀어버릴 수 있음.

### Q42. ★ GC pause 가 분산 락에 미치는 영향?

A. STW 가 TTL 보다 길면 락 자동 해제 → 다른 client 가 락 획득 → 자기는 자기가 락 가졌다고 믿고 critical section 진입 → 동시 진입. **펜싱 token 필요**.

### Q43. RedLock 알고리즘?

A. N개 (보통 5) 독립 마스터에 동시 SET NX → 과반 (3) 성공 + elapsed < ttl 이면 락 OK. 단일 master 의 async replication 문제 우회 의도. 시간 보정 (drift) 적용.

### Q44. Martin Kleppmann 이 RedLock 을 비판한 이유?

A. (1) clock drift (NTP 점프, VM live migration) 로 노드 시계가 비동기. 한 노드 시계 점프로 락이 즉시 만료 → mutual exclusion 깨짐. (2) STW pause — 어떤 TTL 기반 락도 본질적으로 안전하지 않음. **펜싱 token (단조 증가 시퀀스)** 가 진짜 답.

### Q45. 펜싱 토큰의 동작?

A. lock service 가 단조 증가 token 발급 → client 가 storage write 시 token 함께 전달 → storage 가 마지막 본 token 보다 작으면 거부. STW 후 늦게 도착한 stale write 차단.

### Q46. 분산 락 대신 어떤 대안이 더 안전?

A. correctness 가 핵심이면 ZooKeeper / Etcd (consensus + ephemeral node), 또는 ACID DB 의 SELECT FOR UPDATE. Redis 락은 best-effort efficiency 용도.

## H. Stream / Pub-Sub / Lua

### Q47. Redis Stream 과 Kafka 의 차이?

A. 둘 다 영속 + consumer group + ack. 차이: Stream 은 단일 슬롯 (cluster 의 한 master), 처리량 작음, 운영 부담 작음. Kafka 는 partition sharding, 수십만 msg/s, broker 운영 필요. 데이터 / consumer 복잡도 작으면 Stream, 크면 Kafka.

### Q48. Pub/Sub 를 메시지 큐로 쓰면 안 되는 이유?

A. 영속성 / ack / backpressure 부재. 구독자 다운 = 메시지 영구 유실. 처리 실패 재처리 불가. slow consumer 가 broker 메모리 폭증. 휘발성 broadcast (실시간 알림) 만 OK.

### Q49. Lua 가 atomic 한 이유? 함정?

A. Redis 단일 스레드라 Lua 실행 동안 다른 명령 끼어들지 못함 → atomic. 함정: Lua 안 blocking 명령 금지, 5초 이상 걸리면 BUSY 에러, random/time 은 결정성 위험 (Redis 5+ effects replication 으로 보완).

### Q50. ★ Pipeline 과 Lua / Function 차이?

A. Pipeline 은 N RTT → 1 RTT 절감, atomic 보장 X (각 명령 독립). Lua 는 read 결과 기반 분기 + atomic. Function (Redis 7+) 은 Lua 의 운영 단점 (SHA1 캐시, 라이브러리 미관리) 보완 + 명시적 라이브러리 등록.

## I. 보너스 (운영 / 도구 / 함정)

### Q51. ★ big key 의 위험과 탐지?

A. DEL 단일 스레드 점거, BGSAVE CoW 폭증, replication stream 비대. 탐지: `redis-cli --bigkeys`, `MEMORY USAGE key`, `--memkeys`. 대응: 분할 + UNLINK + 만료 분산.

### Q52. hot key 대응 4가지?

A. (1) 애플리케이션 로컬 캐시 (1초 TTL), (2) replica read 분산, (3) 키 분산 (`celebrity:1:0..N` random pick), (4) CDN / Edge cache.

### Q53. SLOWLOG 와 LATENCY MONITOR 차이?

A. SLOWLOG 는 명령 단위 latency 기록 (CONFIG SET slowlog-log-slower-than). LATENCY MONITOR 는 fork / expire / aof / 등 이벤트 단위 latency 추적 (CONFIG SET latency-monitor-threshold).

### Q54. Lettuce 와 Jedis 차이?

A. Lettuce 는 reactive/async + connection multiplexing (단일 connection 으로 다중 명령). Jedis 는 sync + connection pool 필수. cluster topology refresh / RESP3 / Reactor 통합 등 Lettuce 가 풍부. Spring Boot default 는 Lettuce.

### Q55. ClusterTopologyRefreshOptions 가 왜 중요?

A. Lettuce default 는 토폴로지 자동 refresh off → cluster failover / replica promote / reshard 시 stale routing. `enablePeriodicRefresh(10min)` + `enableAllAdaptiveRefreshTriggers()` 명시 필수.

## J. 회독 체크리스트

| 회차 | 정답율 | ★ 표시 | 재학습 항목 |
|---|---|---|---|
| 1회독 | / 55 | | |
| 2회독 | / 55 | | |
| 3회독 | / 55 | | |

## K. 면접 시점 빈출 Top 10 (한국 대기업)

1. Redis 가 왜 빠른가요? (Q1)
2. RDB 와 AOF 중 뭘 쓰세요? (Q21)
3. Cache Stampede 가 뭐고 어떻게 방어하나요? (Q38)
4. Redis Cluster 모드에서 transaction 이 안 되는 이유는? (Q34)
5. Redis 분산 락의 한계는? (Q42, Q44)
6. Redis Stream 과 Kafka 중 언제 뭘 쓰나요? (Q47)
7. Pub/Sub 를 왜 메시지 큐 대용으로 쓰면 안 되나요? (Q48)
8. LRU 와 LFU 차이? (Q17)
9. listpack 과 ziplist 차이? (Q7)
10. fork 와 CoW 가 메모리에 미치는 영향? (Q22, Q23)

이 10개는 거의 나옴. 정답을 흐름까지 같이 외우자.

## L. 다음 학습 추천

- 책: "Redis in Action" (Josiah Carlson)
- 블로그: antirez (Redis 저자), Martin Kleppmann
- 실습: 단일 노드 Redis 띄워 `redis-cli --bigkeys`, `LATENCY DOCTOR`, `DEBUG OBJECT` 직접 쳐보기
- ADR 작성: msa 의 P0 개선 ADR (18 파일) 직접 작성해보기
