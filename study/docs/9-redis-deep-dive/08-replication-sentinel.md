---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 2
---

# 08 — Replication + Sentinel (HA Layer 1)

## 한줄 요약

Redis 의 HA (High Availability, 고가용성) 1단계는 **async replication (master → replica)** + **Sentinel 로 자동 failover**. async 라 master 가 ack 없이도 응답하므로 빠르지만 **failover 시 데이터 유실 가능**. Sentinel 은 quorum 기반 투표로 새 master 를 선출한다.

## 1. Replication 기본

### 1.1 모델

```
            ┌─────────────┐
            │   master    │
            │  (write)    │
            └──┬───────┬──┘
               │       │
        async  │       │  async
               ▼       ▼
       ┌────────┐    ┌────────┐
       │replica1│    │replica2│
       │ (read) │    │ (read) │
       └────────┘    └────────┘
```

- Replication 은 **async** — master 는 write 에 즉시 응답하고, 별도 stream 으로 replica 에 전파.
- replica 는 read 만 (default `replica-read-only yes`).
- WAIT 명령으로 동기 confirm 가능 (`WAIT 1 100ms` = 1개 replica 가 100ms 안에 반영).

### 1.2 PSYNC (Partial Sync)

replica 가 master 와 끊겼다 다시 붙으면:

```
1. replica → master: PSYNC <replication-id> <offset>
2. master:
   - replication-id 가 같고 offset 이 repl_backlog 안에 있다 → PSYNC OK + 누락분 stream
   - 그렇지 않다 → FULLRESYNC (BGSAVE 후 RDB 전체 + 이후 stream)
```

`repl-backlog-size` (기본 1MB) 가 누락분을 잡을 ring buffer. 트래픽 큰 시스템은 64MB-256MB 권장.

### 1.3 Diskless Replication

`repl-diskless-sync yes` (Redis 6+ 기본) → master 가 BGSAVE 결과를 디스크 파일에 안 쓰고 replica 의 socket 에 직접 stream. 디스크 IOPS 절약.

## 2. Replication 의 데이터 손실 시나리오

```
T0: client → master: SET x 1   (master 응답)
T1: master replication backlog 에 적재
T2: master 서버 정전 (재부팅 안 됨)
T3: Sentinel 이 replica 를 새 master 로 promote
    → replica 는 T1 stream 을 못 받았으므로 x = (없음)
```

→ **async replication 의 본질적 트레이드오프**. write 마다 동기 ack 받으면 latency 가 RTT × 2 만큼 늘어남.

운영 룰:

- 절대 손실 안 되는 데이터는 Redis 단일 source 로 두지 말 것 (DB 가 SSOT, Redis 는 cache + 보조).
- 큰 손실 우려시 `min-replicas-to-write 1` + `min-replicas-max-lag 10` — 최소 1개 replica 가 10초 이내 lag 일 때만 write 수락 (불가능하면 거부).

## 3. Sentinel

### 3.1 역할

```
Sentinel = "Redis master 모니터링 + 자동 failover" 데몬
```

- 별도 프로세스 (보통 3개 이상, 홀수)
- master/replica 들에게 PING
- master 가 응답 없으면 → 다른 Sentinel 들과 합의 → 새 master 선출 → 클라이언트에게 알림 (Pub/Sub)

### 3.2 토폴로지

```
                ┌─────────────┐
                │  Sentinel A │
                └──┬───┬───┬──┘
        watches    │   │   │
        ┌──────────┘   │   └──────┐
        ▼              ▼          ▼
   ┌────────┐    ┌────────┐  ┌────────┐
   │ master │    │replica1│  │replica2│
   └────────┘    └────────┘  └────────┘
        ▲              ▲          ▲
        │              │          │
   ┌────┴──┐  ┌────────┴──┐  ┌────┴────┐
   │Sentinel│  │ Sentinel C│  │ client  │
   │   B    │  └───────────┘  └─────────┘
   └────────┘
```

3개의 Sentinel 이 같은 master 를 모니터링. quorum (예: 2) 이상이 master down 으로 합의해야 failover.

### 3.3 failover 단계

```
1. Sentinel 이 master 에 PING 응답 X (down-after-milliseconds 초과)
   → SDOWN (Subjectively Down)
2. 다른 Sentinel 들에게 master 상태 물어봄
3. quorum 이상이 SDOWN 이면 → ODOWN (Objectively Down)
4. Sentinel 들이 leader 선출 (Raft-like)
5. leader 가 적합한 replica 선택 (priority + offset + run_id)
6. 선택된 replica 를 SLAVEOF NO ONE 으로 promote
7. 다른 replica 들을 새 master 에 attach
8. Pub/Sub 으로 클라이언트에게 master 변경 알림
```

전체 30초-2분 정도 (down-after-milliseconds + 합의 + 재구성). 그 동안 write 는 거부 또는 client 가 connection 재시도.

### 3.4 클라이언트 통합

Lettuce / Jedis 모두 Sentinel-aware:

```kotlin
spring:
  data:
    redis:
      sentinel:
        master: mymaster
        nodes: sentinel1:26379, sentinel2:26379, sentinel3:26379
```

클라이언트는 Sentinel 에게 **현재 master 가 누구냐** 물어보고 그 master 에 연결. failover 시 Sentinel 의 Pub/Sub 구독 또는 polling 으로 새 master 정보 받음.

## 4. Sentinel 의 함정

### 4.1 split-brain

Sentinel 클러스터가 네트워크 분할로 둘로 쪼개지면 양쪽이 각각 master 를 정할 수 있다. quorum 을 holdings of total Sentinel count 의 과반 (Sentinel 5개면 quorum=3) 으로 잡아야 split-brain 을 방지.

### 4.2 데이터 손실 폭 제어

`min-replicas-to-write N`, `min-replicas-max-lag SEC` 를 master 에 걸어둔다.

```
min-replicas-to-write 1
min-replicas-max-lag 10
```

→ 최소 1개 replica 가 10초 이내 lag 일 때만 write 수락. failover 시 promote 되는 replica 도 lag 10초 이내라 손실 폭 최대 10초.

### 4.3 priority 와 promote 순서

`replica-priority N` (default 100):
- 0 → promote 후보 제외 (영구 replica)
- 낮은 값 → 우선 promote

운영에서 한 replica 를 backup 전용으로 분리할 때 `replica-priority 0` + `priority 100` 의 다른 replica 가 기본 promote.

## 5. WAIT 와 동기 강도

```
SET key value
WAIT 1 100              # 1개 replica 에 100ms 안에 전파됐다는 ack 기다림
```

return: 실제 ack 받은 replica 수.

이는 "**소프트한 동기 replication**" 으로, master 에 추가 latency 만큼 cost 지급하고 손실 폭을 줄임. 다만 timeout 안에 ack 못 받아도 **rollback 은 안 됨** — 단지 "확실한 동기" 가 아닌 "확률적 동기" 보장.

## 6. Sentinel 이 안 쓰이는 경우

- **Cluster mode** (09 파일) → Cluster 가 자체 failover 가짐 (cluster gossip + replica 자동 promote). Sentinel 불필요.
- 단일 노드 (replica 0) → 어차피 HA 없음. local dev / 로컬 캐시.

msa:
- local (k3s-lite) → Redis standalone (replica 없음, Sentinel 없음).
- prod (Bitnami redis-cluster) → **Cluster mode** → Sentinel 없음.

따라서 msa 에서 Sentinel 학습은 "다른 회사 시스템 이해" 용도. 프로젝트 운영엔 적용 안 됨.

## 7. Cluster vs Sentinel 의 선택

| 항목 | Sentinel | Cluster |
|---|---|---|
| 데이터 분산 | 단일 master 만 write | 16384 슬롯으로 분산 |
| 처리량 | 단일 master IPS 한계 | 노드 수 × master IPS |
| failover | 자동 (Sentinel) | 자동 (cluster) |
| 클라이언트 | sentinel-aware | cluster-aware (MOVED 처리) |
| 트랜잭션 | MULTI/EXEC + Lua 자유 | hash tag 로 한 슬롯 강제 |
| 운영 부담 | Sentinel 별도 프로세스 3+ | cluster 노드 6+ |
| 적합한 용도 | 작은-중간 규모 단일 master 로 충분, 코드 호환성 중요 | 데이터 / 트래픽 큼, 수평 확장 필요 |

## 8. Replica 의 활용 패턴

- **read 분산**: replica 에 read 보내서 master 부하 절감. Lettuce `ReadFrom.REPLICA_PREFERRED`.
- **백업 전용**: `replica-priority 0` + 대용량 디스크 / `repl-disable-tcp-nodelay yes` 로 stream 효율.
- **분석 / 일회성 export**: replica 에서 RDB 떠서 별도 시스템에 import.

read 분산 시 **eventual consistency** 인지 필수 — write 직후 같은 키 read 가 replica 에서 안 보일 수 있음 (lag 만큼).

## 9. 면접 포인트

- "Redis replication 은 sync 인가 async?" → async. WAIT 로 부분 동기 가능.
- "Sentinel 의 quorum 의미?" → master down 으로 합의하는 데 필요한 Sentinel 수. split-brain 방지를 위해 과반.
- "Sentinel 과 Cluster 의 차이?" → Sentinel 은 단일 master + HA, Cluster 는 sharding + HA.
- "async 의 데이터 손실?" → master 가 ack 받기 전 죽으면 그 write 는 사라짐. min-replicas-* 로 폭 제어.
- "PSYNC 와 FULLRESYNC?" → backlog 안에 있으면 부분 동기, 없으면 RDB 전체 + stream 으로 풀 동기.
- "split-brain 어떻게?" → quorum 과반 + min-replicas-to-write 로 양쪽이 동시에 write 받지 않게.

## 10. 코드베이스 연관

- msa local 은 replica 0 → HA 없음 (개발용).
- msa prod 는 Cluster (3 master + 3 replica) → Sentinel 없음.
- Lettuce 의 `ClusterTopologyRefreshOptions` 는 cluster 환경의 topology 변경 (replica promote 등) 자동 감지 (`CommonRedisAutoConfiguration.kt` 참고).

## 11. 다음 파일 연결

Cluster 의 16384 슬롯, MOVED/ASK redirect, hash tag 로 multi-key 처리는 09 에서.
