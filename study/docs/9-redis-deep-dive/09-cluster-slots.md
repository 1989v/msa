---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 2
---

# 09 — Cluster: 16384 슬롯 + MOVED/ASK Redirect

## 한줄 요약

Redis Cluster 는 **16384 hash slot** 을 마스터 노드들에 배분 + **gossip 으로 토폴로지 공유** + **MOVED/ASK redirect** 로 클라이언트를 안내한다. multi-key 명령은 같은 슬롯에 있어야 하므로 **hash tag `{...}`** 로 강제한다. msa prod 는 3 master + 3 replica = 6노드 구성.

## 1. 왜 Cluster 인가

- 단일 master 의 한계: 메모리 (서버당 수십 GB), 단일 스레드 명령 한계 (100k QPS)
- 수평 확장이 필요할 때 sharding → consistent hashing 보다 단순한 **slot-based routing** 채택

## 2. 16384 슬롯

```
key → CRC16(key) mod 16384 = slot 번호 (0-16383)
```

각 master 가 이 16384 슬롯의 일부를 소유:

```
3 master 균등 분배 예시:
  master A → slot 0      ~ 5460
  master B → slot 5461   ~ 10922
  master C → slot 10923  ~ 16383
```

왜 16384? `2^14`. 65536 (2^16) 보다 작아서 노드별 슬롯 비트맵 (2KB) 이 gossip 패킷에 잘 들어간다 (antirez 의 답).

## 3. 명령 라우팅

### 3.1 MOVED redirect

클라이언트가 잘못된 노드에 명령 보내면 그 노드가 redirect:

```
client → A: GET key1
A: -MOVED 12182 192.168.1.3:6379

client → C: GET key1     # CRC16("key1") % 16384 = 12182, master C
C: "value"
```

cluster-aware 클라이언트는 처음에 슬롯 → 노드 매핑을 받아두고 (`CLUSTER SLOTS` / `CLUSTER SHARDS`) 직접 올바른 노드로 보낸다. MOVED 는 토폴로지 변경 시에만 발생.

### 3.2 ASK redirect (resharding 중)

slot 이 한 노드에서 다른 노드로 옮겨지는 동안 (migrating):

```
A 가 slot 100 을 B 에게 옮기는 중

client → A: GET keyInSlot100
A: -ASK 100 B:6379       # 임시 redirect (MOVED 와 다름)

client → B: ASKING        # ASK 이후 첫 명령 전 prefix
client → B: GET keyInSlot100
B: "value"
```

차이:
- MOVED → 영구 변경. 클라이언트는 매핑 캐시 갱신.
- ASK → 일시적. 다음 명령엔 다시 A 에 갈 수 있음 (이 키만 옮겨진 경우).

### 3.3 Lettuce 처리

`ClusterTopologyRefreshOptions` 가 핵심:

```kotlin
// common/CommonRedisAutoConfiguration.kt
val topologyRefreshOptions = ClusterTopologyRefreshOptions.builder()
    .enablePeriodicRefresh(Duration.ofMinutes(10))
    .enableAllAdaptiveRefreshTriggers()
    .build()
```

- periodic refresh: 10분마다 `CLUSTER SLOTS` 호출
- adaptive refresh: MOVED/ASK 받을 때, replica 자동 promote 감지 시 즉시 갱신
- 명시적으로 켜야 의미 있음 (Lettuce default 는 off)

## 4. Gossip 프로토콜

cluster 노드들이 서로 상태를 알리는 방식:

```
모든 master ↔ 모든 노드: 매 1초마다 PING/PONG 메시지 교환
PING/PONG 패킷 안에 일부 노드의 상태 정보가 piggyback
```

알림 정보:
- 노드 ID, IP, 슬롯 소유권
- master/replica 관계
- failure flag (PFAIL / FAIL)

작은 클러스터 (10 노드 이내) 는 가십이 빠르게 수렴, 큰 클러스터 (1000+) 면 패킷 트래픽 무시 못 함 → 그래서 antirez 가 **"몇백 노드까지 권장, 1000+ 는 검토 필요"** 입장.

## 5. failover (Cluster 자체 메커니즘)

```
1. master A 가 응답 없음 (cluster-node-timeout 초과)
2. 다른 master 들이 PFAIL 마킹
3. 과반 master 가 PFAIL 합의 → FAIL
4. A 의 replica 들이 election 시작
   - 자기들끼리 epoch 증가, 다른 master 들에게 투표 요청
   - 과반 master 의 동의 받으면 promote
5. 새 master 가 슬롯 소유권 takeover, gossip 으로 전파
```

Sentinel 과 거의 같은 흐름이지만 **별도 프로세스 없이 master 들이 협력**.

## 6. multi-key 한계

다음 명령은 모든 key 가 **같은 슬롯**에 있어야 한다:

- `MGET / MSET`
- `MULTI / EXEC` (트랜잭션)
- `EVAL` Lua script (KEYS 가 여러 슬롯이면 거부)
- `SUNIONSTORE / SINTERSTORE`
- `SORT BY ... GET ...`
- `RENAME` (src/dst 다른 슬롯)
- `BITOP DEST ...`
- `XADD` Stream (단일 키지만 consumer group 의 키가 여러개면)

cross-slot 시도하면:

```
> MGET key1 key2
(error) CROSSSLOT Keys in request don't hash to the same slot
```

### 6.1 Hash Tag

키 이름에 `{...}` 가 있으면 **그 안의 문자열만으로 CRC16** → 같은 슬롯 강제.

```
{order:42}:items   → CRC16("order:42") = slot X
{order:42}:total   → CRC16("order:42") = slot X
{order:42}:user    → CRC16("order:42") = slot X

# 모두 같은 슬롯이라 multi-key OK
MULTI
  HSET {order:42}:items ...
  SET  {order:42}:total 12345
EXEC
```

함정:
- hash tag 를 너무 많이 쓰면 슬롯 분포 불균형 (한 슬롯에 큰 데이터).
- hot tenant 가 한 슬롯에 몰리면 그 master 만 부하 (hot shard).

## 7. Cluster 와 트랜잭션

| 명령 | Cluster 에서 |
|---|---|
| MULTI/EXEC | 같은 슬롯 키만 가능 |
| WATCH (optimistic) | 같은 슬롯 |
| Lua EVAL | KEYS 가 모두 같은 슬롯 |
| Pub/Sub | cluster-wide broadcast (모든 노드에 publish 됨, 약간 비효율) |
| FLUSHALL | 각 master 에 개별 호출 |

## 8. 클러스터 운영 명령

```
CLUSTER NODES                    # 노드 목록 + 슬롯 + 역할
CLUSTER SLOTS                    # 슬롯 → 노드 매핑
CLUSTER SHARDS                   # Redis 7+ 새 형식 (master/replica 그룹)
CLUSTER INFO                     # 클러스터 상태
CLUSTER COUNTKEYSINSLOT N        # 슬롯 내 키 수
CLUSTER GETKEYSINSLOT N count    # 슬롯 내 키 추출

CLUSTER MEET ip port             # 노드 추가
CLUSTER FORGET nodeid            # 노드 제거
CLUSTER REPLICATE masterid       # replica 부착
CLUSTER FAILOVER [FORCE|TAKEOVER] # 수동 failover

CLUSTER ADDSLOTS / DELSLOTS / ADDSLOTSRANGE / DELSLOTSRANGE
CLUSTER SETSLOT slot { IMPORTING | MIGRATING | NODE | STABLE }
```

`redis-cli --cluster` 는 위 명령들을 wrapping 한 운영 도구:

```
redis-cli --cluster create node1:6379 ... node6:6379 --cluster-replicas 1
redis-cli --cluster reshard host:port --cluster-from src --cluster-to dst --cluster-slots 1000
redis-cli --cluster rebalance host:port
redis-cli --cluster info host:port
redis-cli --cluster check host:port
```

## 9. 클러스터 client 라이브러리

| Client | Cluster 지원 | 특징 |
|---|---|---|
| Lettuce | ✓ | reactive, ClusterTopologyRefresh, async |
| Jedis | ✓ (3.x+) | sync, simpler |
| Redisson | ✓ | RLock, RMap, 분산락 강점 |

msa 는 Spring Data Redis + **Lettuce** (default). `LettuceConnectionFactory` + `RedisClusterConfiguration`.

## 10. msa prod 클러스터 구성

```yaml
# k8s/infra/prod/redis/values.yaml (Bitnami)
cluster:
  nodes: 6           # 3 master + 3 replica
  replicas: 1        # master 당 replica 1
persistence:
  enabled: true
  size: 4Gi
```

3 master 면 16384 / 3 ≈ 5461 슬롯씩. 각 master 4GB → 총 12GB 데이터 용량 (replica 동일 4GB × 3).

## 11. K8s 위 Cluster 의 함정

- **Pod IP 변경**: cluster nodes.conf 에 IP 박혀있으면 재기동 시 노드를 못 찾음. Bitnami chart 는 hostname 기반 + bus port 같이 expose.
- **StatefulSet headless service**: cluster bus port (6379 + 10000 = 16379) 까지 열려야 gossip 가능.
- **resharding 시 replica failover** 와 겹치면 일시적 인접 슬롯 unavailable. cluster-allow-reads-when-down yes 로 read 만이라도 허용.

## 12. msa 의 standalone 전환 (k3s-lite)

local 환경은 cluster 운영 부담 큼 → **standalone 단일 노드 + 5개 서비스만 SPRING_APPLICATION_JSON 으로 cluster.nodes 를 null 로 override**.

```yaml
# k8s/overlays/k3s-lite/patches/redis-standalone-product.yaml
env:
  - name: SPRING_APPLICATION_JSON
    value: '{"spring":{"data":{"redis":{"cluster":null,"host":"redis","port":6379}}}}'
```

대상 서비스:
- gateway, product, gifticon, analytics, experiment

이들은 prod 에서 cluster 모드 (`spring.data.redis.cluster.nodes` 명시) → local 에선 standalone 강제.

## 13. 트래픽 cost 와 latency

- MOVED 한 번 = 1 RTT 추가. 토폴로지 캐시가 신선하면 거의 발생 안 함.
- ASK 는 reshard 진행 시 일부 키에만 발생.
- cluster mode 의 latency 평균 = 단일 노드 latency + 매핑 lookup (µs). 정상 운영에서는 차이 미미.

## 14. 면접 포인트

- "Redis Cluster 의 슬롯 수가 16384 인 이유?" → 2^14, gossip 패킷에 노드별 슬롯 비트맵 (2KB) 이 효율적으로 들어감.
- "Cluster 에서 transaction 이 왜 제한?" → 슬롯이 분산돼 노드별로 수행되니 atomic 보장이 어려움. hash tag 로 한 슬롯 강제 시 가능.
- "MOVED 와 ASK 의 차이?" → MOVED 영구 매핑 변경, ASK 임시 (reshard 중 진행 중인 키만).
- "Cluster 의 failover 는 Sentinel 과 무엇이 다른가?" → Sentinel 은 별도 프로세스, Cluster 는 master 들이 직접 협력 (gossip + epoch).
- "hash tag 의 함정?" → 분포 불균형 (hot shard) 가능. 너무 큰 단위로 묶지 말 것.
- "Cluster 에서 KEYS 가 동작하는가?" → 각 노드별로 동작, 클러스터 전체 KEYS 는 client 가 모든 노드에 SCAN 보내야.

## 15. 다음 파일 연결

이제 인프라 (RDB / AOF / Replication / Cluster) 가 끝났다. 캐시 패턴과 stampede 방어로 — 10, 11 에서.
