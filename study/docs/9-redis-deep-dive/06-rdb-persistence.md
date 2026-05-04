---
parent: 9-redis-deep-dive
type: deep
created: 2026-05-01
phase: 2
---

# 06 — RDB 스냅샷 (fork + Copy-on-Write)

## 한줄 요약

RDB (Redis Database 스냅샷) 는 특정 시점의 메모리 전체를 binary 로 덤프한 스냅샷. **`fork(2)` + Copy-on-Write** 로 메인 프로세스가 명령을 계속 받으면서 자식이 dump 한다. 빠른 restore + 작은 파일이 장점, **데이터 유실 위험 (스냅샷 사이 변경)** 과 **fork latency / CoW 메모리 폭증** 이 단점.

## 1. RDB 가 무엇인가

```
.rdb 파일 = 메모리 전체의 binary serialization
```

- 압축 (`rdbcompression yes`, LZF)
- restart 시 빠르게 메모리 복구 (Redis 6 기준 1GB 약 5-10초)
- AOF 보다 파일이 작다

`SAVE` 와 `BGSAVE` 두 명령:

| 명령 | 동작 | 영향 |
|---|---|---|
| `SAVE` | main thread 가 직접 dump | **단일 스레드 정지** — 운영에서 절대 사용 X |
| `BGSAVE` | fork → child 가 dump | main thread 는 정상 동작 |

자동 트리거 설정:

```
save 3600 1     # 3600초 동안 1회 이상 변경 → BGSAVE
save 300 100    # 300초 동안 100회 변경
save 60 10000   # 60초 동안 10000회 변경
```

여러 줄을 OR 로 평가. msa local Redis 는 `--save 60 1` (60초마다 1번 변경 있으면).

## 2. fork(2) 와 Copy-on-Write

### 2.1 fork 의 동작

```
parent (Redis main):  pid=100, 메모리 4GB
        │
        │ fork()
        ▼
child  (BGSAVE):       pid=101, 메모리 페이지 테이블 복사 (실데이터 공유)
```

- Linux fork 는 즉시 4GB 를 복사하지 않고, **페이지 테이블만 복사**한다 (수십 ms).
- 두 프로세스가 같은 물리 페이지를 공유. 페이지에 write 가 발생하면 **그 페이지만 복사** — Copy-on-Write.

```
초기:
  parent ──► [page A] ◄── child   (공유, read-only)
  parent ──► [page B] ◄── child

parent 가 page A 에 write:
  parent ──► [page A'] (새 복사본)
  child  ──► [page A]  (원본 유지)
```

### 2.2 Redis 가 fork 를 쓰는 이유

- main thread 는 정상 명령 처리 계속
- child 는 **fork 시점의 메모리 스냅샷**을 보고 dump (write 가 일어나도 원본 페이지 유지)
- 결과: 일관된 시점 스냅샷 + 서비스 중단 없음

### 2.3 함정 1: fork latency

대용량 (10GB+) 인스턴스에서 fork 는 **페이지 테이블 복사**가 길어질 수 있다 (페이지 4KB 기준 1GB ≈ 256K 엔트리, 10GB ≈ 2.6M 엔트리). x86 huge page (2MB) 사용 시 더 빠름.

```
INFO stats
> latest_fork_usec: 12345    # 직전 fork 에 걸린 µs
```

운영 룰: `latest_fork_usec` 가 100ms 이상이면 점검. K8s 환경에선 cgroup 메모리 제한 때문에 더 비싼 경우 있음.

### 2.4 함정 2: CoW 메모리 폭증

dump 진행 중 main thread 가 write 를 많이 하면 **CoW 페이지가 누적** → child 와 parent 가 거의 별도 메모리. RSS 가 잠시 2배까지 솟을 수 있다.

worst case:
```
4GB 인스턴스, BGSAVE 도중 전체 키를 모두 update 하는 트래픽
  → CoW 로 4GB 추가 페이지
  → RSS = 8GB
  → swap 발생 또는 OOM
```

운영 룰:
- `maxmemory` 를 **시스템 메모리의 50-60%** 로 설정 (CoW 여유)
- `vm.overcommit_memory=1` 설정 (Linux) — fork 가 거부되지 않도록
- BGSAVE 중에는 트래픽 변화 모니터링

### 2.5 K8s 환경의 추가 함정

- `transparent_hugepage=always` 면 CoW 가 페이지 단위가 아닌 hugepage(2MB) 단위 → 작은 write 가 큰 페이지 복사 유발. Redis 공식 가이드는 `never` 권장.
- cgroup memory.limit 가 maxmemory 와 너무 가까우면 fork 거부 (`Cannot allocate memory`) → ext memory 여유 필요.

## 3. RDB 파일 구조 (간단)

```
"REDIS"                     # magic
RDB_VERSION (4 bytes)
[ DB_SELECTOR(0) ]
[ AUX_FIELD ]               # redis-ver, redis-bits, ctime, used-mem
[ key1, value1 ]
[ key2, value2 ]
...
[ EOF ]
[ CRC64 checksum ]
```

각 entry 는 type + encoding + 데이터. 작은 컬렉션은 listpack 그대로 직렬화 가능 (Redis 7).

## 4. RDB restore

```
1. 시작 시 dump.rdb 존재 확인
2. magic + version 검사
3. AUX 필드 읽기
4. key/value 순차 메모리 로드
5. CRC 검증
6. 정상이면 ready
```

restore 동안 클라이언트는 `LOADING` 에러를 받음. AOF 와 RDB 둘 다 있을 때는 AOF 우선.

## 5. RDB 단독 사용의 트레이드오프

| 장점 | 단점 |
|---|---|
| 파일 작음 (압축) | 스냅샷 사이 데이터 유실 |
| restore 빠름 | fork latency / CoW 메모리 비용 |
| backup/clone 단순 (파일 1개 복사) | 빈번한 save 시 디스크 I/O 부담 |

→ **RDB 단독은 캐시 / 휘발 OK 인 경우만**. 데이터 손실 허용 못 하면 AOF 도 필요 (07).

## 6. msa local 의 RDB 설정

```yaml
# k8s/infra/local/redis/statefulset.yaml
args:
  - redis-server
  - --appendonly
  - "yes"
  - --save
  - "60 1"
```

- AOF on + RDB save 조건 60초/1변경
- 즉, AOF 가 메인 영속성, RDB 는 보조 (mixed 모드, 07 참고)
- 1GB volume 이라 운영 데이터 보관 X (개발용)

## 7. RDB 파일 활용

### 7.1 백업 / 복구

```
# 백업
SAVE                    # 또는 BGSAVE 후 LASTSAVE 확인
cp dump.rdb backup-2026-05-01.rdb

# 복구
systemctl stop redis
cp backup-2026-05-01.rdb /var/lib/redis/dump.rdb
systemctl start redis
```

### 7.2 cluster sharding 마이그레이션

- 한 cluster 에서 다른 cluster 로 이동 시 RDB dump + redis-cli `--rdb` 활용 가능.

### 7.3 redis-cli --rdb

```
redis-cli --rdb /tmp/dump.rdb
```

원격 redis 의 메모리 dump 를 받아옴 (백업 자동화에 유용).

## 8. RDB 와 replication 의 관계

- master 가 처음 replica 와 동기화할 때 (full resync) **BGSAVE → RDB 파일 전송 → AOF replay 또는 stream** 의 흐름.
- Redis 6.2+ `repl-diskless-sync yes` 면 RDB 파일을 디스크 거치지 않고 socket 으로 직접 스트리밍 → 디스크 I/O 절약.

## 9. 면접 포인트

- "RDB 와 AOF 의 차이?" → RDB 는 시점 스냅샷 (binary, 압축), AOF 는 명령 로그 (append).
- "BGSAVE 는 어떻게 일관된 스냅샷을?" → fork + CoW. 자식이 fork 시점 메모리를 보고 dump.
- "fork 가 메모리 비용이 큰가?" → 페이지 테이블만 복사라 즉시는 가벼움. 다만 CoW 누적 + 큰 메모리에서 페이지 테이블 복사도 ms 단위 latency.
- "RDB 만 쓸 때 위험?" → 스냅샷 사이 데이터 유실. 60초 save 면 최대 60초 손실 가능.
- "vm.overcommit_memory=1 설정 이유?" → fork 시 자식이 부모 만큼의 메모리를 요구하는 것처럼 보여 OS 가 거부할 수 있음 — overcommit 허용으로 회피.

## 10. 다음 파일 연결

RDB 의 데이터 유실을 메우는 게 AOF — 명령 단위 append. 단점은 파일 비대 / restore 느림. Redis 7 의 multi-part AOF 와 mixed 모드는 07 에서.
