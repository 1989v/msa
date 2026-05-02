---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 2
---

# 07 — AOF + Mixed (RDB-AOF Hybrid)

## 한줄 요약

AOF 는 모든 write 명령을 디스크에 append 하는 영속화 방식. **`appendfsync everysec`** 가 표준 (1초 손실 허용 + 성능). 시간이 지나면 파일이 커져 **AOF rewrite** (BGREWRITEAOF) 로 압축. Redis 7 의 **multi-part AOF + RDB preamble (mixed)** 가 현재 권장 운영 형태.

## 1. AOF 작동 원리

```
write 명령 도착
   ↓
명령 실행 (메모리 변경)
   ↓
RESP 형식 그대로 AOF 버퍼에 append
   ↓
[fsync 정책에 따라] 디스크 flush
```

restore 시:
```
1. RDB preamble 읽기 (있으면) → 빠르게 메모리 채움
2. AOF 끝부분 명령 replay → 마지막 상태 복원
```

## 2. fsync 3 정책

```
appendfsync always       # 매 write 마다 fsync
appendfsync everysec     # 1초마다 fsync (기본)
appendfsync no           # OS 캐시에 맡김
```

| 정책 | 데이터 손실 | TPS | 비고 |
|---|---|---|---|
| `always` | 거의 0 | TPS 1/10 이하 | 디스크 IOPS 가 병목 |
| `everysec` | ≤ 1초 | 풀 TPS의 ~95% | **표준** |
| `no` | OS 캐시 (보통 30초) | 풀 TPS | 위험, 운영 비추 |

`everysec` 의 동작: background thread 가 1초마다 fsync. main thread 는 buffer append 만 하고 끝.

### `everysec` 의 함정

`fsync` 가 1초 안에 안 끝나면 (디스크 I/O 폭주) main thread 가 다음 write 시 **이전 fsync 가 끝나길 기다린다** → latency spike. K8s 의 EBS gp2 같은 burstable SSD 에서 자주 보임.

## 3. AOF rewrite

명령마다 append 하면 파일이 무한히 커진다. `INCR counter` 를 1억 번 쳤으면 1억 줄이 쌓임.

`BGREWRITEAOF` (또는 자동 트리거) 가 **현재 메모리 상태에서 최소한의 명령으로 다시 쓴다**.

```
원본 AOF (1억 줄):
  INCR counter
  INCR counter
  ... (1억 번)

rewrite 후 (1줄):
  SET counter 100000000
```

자동 트리거:

```
auto-aof-rewrite-percentage 100   # 마지막 rewrite 의 100% (즉 2배) 커지면
auto-aof-rewrite-min-size 64mb    # 최소 64MB 부터 적용
```

rewrite 도 `fork(2)` 사용 — RDB 와 동일하게 child 가 새 AOF 작성, parent 는 새 명령을 별도 buffer 에 기록 후 child 가 끝나면 합침.

## 4. Redis 7 의 multi-part AOF

Redis 7 부터 AOF 는 **여러 파일로 분리** + manifest 파일로 관리.

```
appendonlydir/
 ├─ appendonly.aof.1.base.rdb        # base 파일 (RDB preamble)
 ├─ appendonly.aof.1.incr.aof        # 증분 AOF
 ├─ appendonly.aof.2.incr.aof
 └─ appendonly.aof.manifest          # 어느 파일 어떤 순서로 읽을지
```

장점:

- rewrite 중 새 파일 (incr) 을 따로 쓰니 main thread 의 buffer 비대 문제 해결
- restore 시 base.rdb → incr 순으로 읽음 (RDB 의 빠른 restore + AOF 의 작은 손실)
- 디스크 atomic 처리 단순화

## 5. RDB preamble (mixed)

`aof-use-rdb-preamble yes` (Redis 4+, 기본 yes):

```
AOF rewrite 시 child 가 작성하는 파일:
  ┌─────────────────────────┐
  │ RDB binary preamble      │   ← 메모리 전체 dump (RDB 형식)
  ├─────────────────────────┤
  │ Append-only commands     │   ← rewrite 도중 들어온 신규 write
  └─────────────────────────┘
```

장점:
- restore 시 RDB 파트는 빠르게 로드 (RDB 의 장점)
- 마지막 변동분만 명령 replay
- 결과적으로 **AOF 의 안정성 + RDB 의 restore 속도**

이게 현재 권장 표준. msa local 도 `--appendonly yes` + `--save 60 1` 조합으로 mixed 와 유사.

## 6. AOF 손상 복구

전원 손실 등으로 AOF 끝부분이 손상되면 restore 가 실패할 수 있다.

```
redis-check-aof --fix appendonly.aof.1.incr.aof
```

마지막 손상된 명령을 잘라낸다. `aof-load-truncated yes` 면 자동.

## 7. AOF only / RDB only / Mixed 비교

| 모드 | 데이터 손실 | restore 속도 | 파일 크기 | CPU |
|---|---|---|---|---|
| RDB only | 분 단위 | 빠름 | 작음 | save 시 fork |
| AOF only (everysec) | ≤1초 | 느림 (모든 명령 replay) | 큼 | rewrite 시 fork |
| Mixed (RDB+AOF) | ≤1초 | 빠름 | 중간 | rewrite 시 fork |

운영 권장 = Mixed.

## 8. 실전 운영 체크리스트

```
✓ appendonly yes
✓ appendfsync everysec
✓ aof-use-rdb-preamble yes
✓ auto-aof-rewrite-percentage 100
✓ auto-aof-rewrite-min-size 64mb
✓ aof-load-truncated yes
✓ no-appendfsync-on-rewrite no   # rewrite 중에도 fsync (default)
✓ vm.overcommit_memory = 1 (sysctl)
✓ transparent_hugepage = never (THP)
✓ maxmemory <= 50-60% 시스템 메모리
```

## 9. 디스크 I/O 산정

AOF 는 명령 1개당 약 50-100 바이트 (RESP 인코딩). 100k QPS write × 80B = 8 MB/s. EBS gp3 baseline 125 MB/s 안에 들어가지만, `always` 면 IOPS 한계 (gp3 baseline 3000 IOPS) 가 먼저 박힘 — 100k write 에 fsync 도 100k 면 IOPS 부족.

→ **`always` 는 DB 급 안전성 필요 + IOPS 6000+ NVMe 일 때만**.

## 10. AOF 와 replication

- AOF 는 master 의 영속성, replica 는 PSYNC 로 stream 받음 (08 파일).
- AOF rewrite 와 replica full sync 가 동시에 일어나면 fork 가 한 번에 두 개 — `repl-diskless-sync yes` 면 그래도 디스크 부담 작음.

## 11. msa 코드베이스 적용

- `k8s/infra/local/redis/statefulset.yaml` 은 `--appendonly yes` + `--save 60 1` → 사실상 mixed.
- `appendfsync` 명시 안 됨 → Redis default `everysec` 적용.
- prod (`k8s/infra/prod/redis/values.yaml`) 는 Bitnami chart → values 에서 `redis.persistence` 설정 (Bitnami 기본 yes).

→ 18 improvements 에서 명시 필요:
1. `appendfsync everysec` 명시 (defaults-as-config 원칙)
2. `aof-use-rdb-preamble yes` 명시
3. prod values 에 `auto-aof-rewrite-min-size` 운영 환경 맞게 (4-8 GB 인스턴스면 256MB 정도)

## 12. 면접 포인트

- "AOF 의 fsync 옵션 3종?" → always / everysec / no. everysec 표준.
- "AOF rewrite 가 뭐고 왜 필요?" → 명령이 누적되는 파일을 현재 메모리 상태로 압축 재작성. fork 사용.
- "Redis 7 의 multi-part AOF 가 뭐가 좋은가?" → rewrite 중 base/incr 파일 분리 → main thread 의 buffer 부담 해소, atomic 처리 단순.
- "Mixed 가 왜 표준?" → RDB 의 빠른 restore + AOF 의 1초 손실. 둘의 장점 조합.
- "everysec 인데도 latency spike 가 왜?" → fsync 가 1초 안에 안 끝나면 main thread 의 다음 write 가 직전 fsync 끝날 때까지 대기.
- "AOF 가 손상됐을 때?" → `redis-check-aof --fix`, 또는 `aof-load-truncated yes` 자동.

## 13. 다음 파일 연결

영속화는 단일 노드 안의 안전성이고, 노드 자체가 죽으면 의미 없다. Replication + Sentinel 로 HA 를 만든다 — 08 에서.
