---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 4
---

# 16 — 메모리 관리 + 운영 함정

## 한줄 요약

Redis 운영의 5대 함정: (1) **big key**, (2) **hot key (hot shard)**, (3) **KEYS / SMEMBERS / LRANGE 0 -1 같은 O(N) 명령**, (4) **메모리 fragmentation**, (5) **CoW 로 RSS 폭증**. 이걸 모니터링과 가드레일로 잡는 게 운영의 80%.

## 1. Big Key

### 1.1 정의

- String 100MB+
- List/Hash/Set/ZSet 100만 element+
- 단일 키에 GB 단위

### 1.2 영향

- `DEL` 단일 스레드 점거 (UNLINK 필요)
- BGSAVE 시 fork CoW 비용 증폭
- replication stream 비대 → repl_backlog 부족
- migration 시 슬롯 이동 시간 증가 (cluster reshard)
- 메모리 단편화 가속

### 1.3 탐지

```
redis-cli --bigkeys
> top 1 STRING:    "hugeData" (size: 240 MB)
> top 1 HASH:      "user:42" (entries: 5000000)

# 실시간 (운영 영향 작음)
redis-cli --memkeys

# 단일 키
MEMORY USAGE bigkey
DEBUG OBJECT bigkey
```

`--bigkeys` 는 SCAN 기반이라 운영 영향 작음.

### 1.4 대응

- 분할: `user:42:profile`, `user:42:settings`, `user:42:items` 로 쪼갬
- HSET / HMGET 으로 partial access (전체 HGETALL 대신)
- 만료 분산 (모든 key 동시 만료 X)
- 큰 컬렉션은 외부 스토리지 (S3 등) + Redis 는 인덱스만

## 2. Hot Key / Hot Shard

### 2.1 정의

- 단일 키에 트래픽 집중 (예: 유명 인플루언서 프로필, 핫이슈 상품)
- 클러스터에선 그 키가 들어있는 master 만 부하 (hot shard)

### 2.2 탐지

```
redis-cli --hotkeys
> hotkey "celebrity:1" hits 1234567

LATENCY HISTORY event
LATENCY LATEST
SLOWLOG GET 10
INFO commandstats
```

LFU 가 enabled 이면 (`maxmemory-policy *-lfu`) `OBJECT FREQ key` 로 빈도 조회.

### 2.3 대응

- **로컬 캐시**: 애플리케이션 메모리에 짧은 TTL (1초) 로 hot key 결과 캐시 → Redis 트래픽 N 인스턴스 수만큼 절감
- **Read replica**: cluster 의 replica 에서 read 분산
- **키 분산**: `celebrity:1:0`, `celebrity:1:1`, ... 로 쪼개고 client 가 random pick (단, write 시 fanout 필요)
- **CDN / Edge cache**: 정적 hot 데이터는 Redis 가 아니라 CDN 으로 끌어내기

## 3. O(N) 명령 금지 목록

| 명령 | 대안 |
|---|---|
| `KEYS pattern` | `SCAN cursor MATCH pattern` |
| `SMEMBERS large` | `SSCAN cursor` |
| `HGETALL large` | `HSCAN cursor` |
| `LRANGE 0 -1 large` | `LRANGE 0 N` 페이지네이션 |
| `ZRANGE 0 -1 large` | `ZRANGE 0 N` 페이지네이션 |
| `DEL large` | `UNLINK large` |
| `FLUSHDB` | `FLUSHDB ASYNC` |
| `DEBUG SLEEP N` | 절대 금지 |

운영 권장: 위 명령들에 대해 `ACL` 로 client/role 별 차단. `rename-command KEYS ""` 로 비활성화도 가능 (config).

## 4. 메모리 단편화

### 4.1 측정

```
INFO memory
> used_memory_human: 8.0G
> used_memory_rss_human: 12.0G
> mem_fragmentation_ratio: 1.50
```

`mem_fragmentation_ratio = rss / used_memory`:

- 1.0-1.5: 정상
- 1.5+: 단편화 심함
- < 1.0: swap 발생 (즉시 조치)

### 4.2 원인

- 다양한 크기 객체의 빈번한 alloc/free 후 jemalloc slab 의 hole
- expire 로 키 대량 삭제 후 빈 페이지

### 4.3 대응

```
CONFIG SET activedefrag yes        # background defrag (Redis 4+)
CONFIG SET active-defrag-ignore-bytes 100mb
CONFIG SET active-defrag-threshold-lower 10
CONFIG SET active-defrag-threshold-upper 100
CONFIG SET active-defrag-cycle-min 5
CONFIG SET active-defrag-cycle-max 25
```

CPU 5-10% 추가 부담. 운영 트래픽 확인 후 enable.

마지막 수단: master 재기동 — 메모리가 깨끗해지지만 다운타임. cluster 면 replica 로 failover 하고 master 재기동하는 식 가능.

## 5. CoW 폭증 방지

(06 RDB 파일 참고) BGSAVE / AOF rewrite 동안 CoW 페이지 폭증 → RSS 가 2배까지 솟을 수 있음.

대응:

- `maxmemory` 를 시스템 메모리의 50-60% 로
- transparent_hugepage = never
- vm.overcommit_memory = 1
- BGSAVE 와 AOF rewrite 가 동시에 일어나지 않도록 스케줄링
- write-heavy 시간대에 BGSAVE 회피

## 6. Latency 측정

```
LATENCY MONITOR fork
LATENCY RESET
LATENCY HISTORY event
LATENCY LATEST
LATENCY GRAPH command-name

CONFIG SET latency-monitor-threshold 100   # 100ms 이상 명령 기록
SLOWLOG GET 10
INFO commandstats
```

운영 알람:
- p99 latency > 5ms 지속 → 점검
- `latest_fork_usec` > 100ms → big memory or HugePage 의심
- `evicted_keys` 증가율 → maxmemory 부족

## 7. 클라이언트 connection 관리

```
INFO clients
> connected_clients: 5234
> maxclients: 10000

CLIENT LIST
CLIENT KILL ADDR ip:port

CONFIG SET maxclients 10000
CONFIG SET tcp-keepalive 300
```

함정:
- 너무 많은 idle connection → 메모리. `tcp-keepalive` 로 죽은 connection 정리.
- per-client output buffer 가 hot key broadcast 시 폭증 → `client-output-buffer-limit normal/replica/pubsub` 설정.

## 8. RDB / AOF 디스크 운영

- AOF/RDB 디스크 별도 분리 권장 (data 디스크와 성능 격리)
- `dir /data/redis` 디스크 free space 모니터링 — full 되면 BGSAVE 실패
- `du -sh dump.rdb appendonly.aof` 정기 측정

## 9. Eviction 모니터링

```
INFO stats
> evicted_keys: 1234567

# 그래프로 plot 해서 spike 찾기
```

evicted_keys 가 평소 0 이었는데 급증하면 메모리 부족. `maxmemory` 늘리거나 큰 키 정리.

## 10. msa 코드 적용 점검

`k8s/infra/local/redis/statefulset.yaml` (재인용):

```yaml
args:
  - redis-server
  - --appendonly
  - "yes"
  - --save
  - "60 1"
resources:
  requests:
    memory: 128Mi
  limits:
    memory: 256Mi
```

- `maxmemory` 명시 X → 256Mi limit 부근까지 사용 후 OOM-killed 가능
- `maxmemory-policy` 명시 X → default `noeviction` → write 거부 위험
- big key / hot key 모니터링 무
- `activedefrag` 명시 X

→ 18 improvements 에서:
1. `--maxmemory 200mb --maxmemory-policy allkeys-lfu` 추가 (메모리 limit 보다 약간 작게)
2. `--lazyfree-lazy-eviction yes --lazyfree-lazy-expire yes --lazyfree-lazy-server-del yes` 추가
3. ServiceMonitor + Prometheus exporter 로 evicted_keys, mem_fragmentation_ratio, used_memory_rss 모니터링
4. `redis-cli --bigkeys` 정기 batch (운영 schedule)

## 11. 운영 dashboard 권장 지표

| 카테고리 | 지표 |
|---|---|
| Throughput | `instantaneous_ops_per_sec`, `total_commands_processed` |
| Latency | LATENCY MONITOR, p99 (SLOWLOG) |
| Memory | `used_memory`, `used_memory_rss`, `mem_fragmentation_ratio`, `evicted_keys` |
| Replication | `master_repl_offset`, `slave_repl_offset`, `master_link_status` |
| Persistence | `rdb_bgsave_in_progress`, `aof_rewrite_in_progress`, `aof_current_size`, `latest_fork_usec` |
| Connections | `connected_clients`, `rejected_connections`, `blocked_clients` |
| Errors | `keyspace_hits` / `keyspace_misses`, `expired_keys` |

## 12. 면접 포인트

- "Big key 의 위험?" → DEL 차단, BGSAVE CoW 폭증, replication stream 비대.
- "Hot key 대응?" → 로컬 캐시, replica read, 키 분산, CDN.
- "운영에서 KEYS 금지 이유?" → O(N), 단일 스레드 점거. SCAN 사용.
- "fragmentation_ratio 1.5 이상?" → activedefrag enable. 또는 master 재기동.
- "evicted_keys 가 늘면?" → maxmemory 부족 → 메모리 늘리거나 큰 키 정리.
- "LATENCY MONITOR / SLOWLOG?" → 둘 다 latency 진단. SLOWLOG 는 명령 단위, LATENCY 는 fork/expire 등 이벤트.

## 13. 다음 파일 연결

이론은 끝. 이제 msa 코드베이스에 정확히 어떻게 매핑되는지, 어디를 보강해야 하는지를 17 (실전 적용) 과 18 (improvements) 에서.
