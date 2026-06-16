---
parent: 15-connection-pool
seq: 07
title: 풀 사이즈 산정 — Little's Law / PG 공식 / DB max_connections
type: deep
created: 2026-05-01
updated: 2026-06-16
sources:
  - https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing
  - "Brian Goetz, Java Concurrency in Practice (JCIP) §8.2 — thread pool sizing"
  - "YouTube: 코딩하는기술사 — 아키텍트가 알아야 할 커넥션 풀의 기본과 함정 (2026-06-15, 자동자막 트랜스크립트 기반 보강)"
  - "Oracle Real-World Performance (RWP) — Connection strategies (코어당 ≤10 process)"
---

# 07. 풀 사이즈 산정

"maxPoolSize 를 얼마로 하냐" 는 면접 단골이고 실무 직진 질문이다. 답은 *작은 게 빠르다* — 직관과 반대.

---

## 잘못된 직관: "thread 수만큼"

흔한 답:
- "Tomcat thread pool 이 200 이니 풀도 200"
- "동시 사용자 수 만큼"
- "혹시 모르니 넉넉하게 100"

이 답이 *틀린* 이유. DB 는 connection 수만큼 *동시 처리* 하지 못한다.

- MySQL: connection 당 thread 1 개 (per-thread model). thread 가 N 개여도 CPU core 가 8 이면 진짜 병렬 처리는 8
- PostgreSQL: connection 당 process 1 개 (per-process). connection 100 개 = process 100 개 = 메모리 + context switch 폭증
- 디스크 I/O: spindle (HDD) / IOPS (SSD) 에 묶임

connection 을 늘리면 *대기 시간이 줄어드는 게 아니라 늘어남*. context switch 가 더 많아지고 buffer pool / cache 가 nuke 됨.

---

## 라이브러리 기본값 & 실무 분포

풀 사이즈를 정하는 4가지 접근 — ① 라이브러리 기본값 그대로 ② 경험/감 ("저번 프로젝트 50개였으니까") ③ 업계 표준 공식 ④ 부하 테스트로 sweet spot 탐색. 실무에선 ①②가 흔하지만 **아키텍트는 ③+④** 로 접근한다.

### 진영별 기본값

| 런타임 / 라이브러리 | 기본 풀 | 비고 |
|---|---|---|
| Java — Spring Boot 2.0+ **HikariCP** | **10** | 사실상 표준 |
| Node.js — **node-postgres (pg)** | **10** | Hikari 와 동일 |
| Python — **SQLAlchemy QueuePool** | **5 + overflow 10 = 최대 15** | |
| .NET — **ADO.NET 내장 풀** | **100** | MS SQL Server 기본 max_connections 가 ~32,000 으로 크기 때문 |

**.NET 100 vs 나머지 5~15** 의 차이는 *철학 차이* — Java 진영은 "작게 시작해 넓혀간다", MS 진영은 "여유 있게 시작한다". 단 MS 공식 가이드조차 "기본값을 그대로 쓰지 말고 워크로드에 맞게 조정하라 — *안전 상한선*이지 권장값이 아니다" 라고 명시. 결국 표준 라이브러리들이 **5~15 범위에 수렴**한다는 사실 자체가 그 숫자에 기술적 근거가 있음을 시사한다.

### 실무 풀 사이즈 분포 (영상 기준)

| 규모 | 흔한 풀 | 비고 |
|---|---|---|
| dev / staging | 10 | Hikari 기본값 그대로 |
| 소규모 서비스 | 10 ~ 20 | |
| 중규모 | 20 ~ 30 | 서버 코어 늘면 함께 상향 |
| 트래픽 많음 | 30 ~ 50 | 부하 테스트 검증 후 |
| **100 이상** | — | **안티 패턴. 너무 많다** |

### 외부 권위자 수치

- **HikariCP wiki 벤치마크** — PostgreSQL 에서 약 **50 connection 부근부터 TPS(처리량)가 평탄화**.
- **Oracle Real-World Performance (RWP) 그룹** — "DB 서버 CPU **코어당 평균 process 수 ≤ 10**" 권장. 그리고 "연결 수는 코어의 *thread 수*가 아니라 *코어 수* 기준으로 잡아라." (PG 공식 `core×2` 보다 상한이 너그러운 가이드.)

---

## PostgreSQL 공식

PostgreSQL 공식 wiki + HikariCP wiki "About Pool Sizing" 의 권장.

```
connections = ((core_count * 2) + effective_spindle_count)
```

| 항목 | 설명 |
|---|---|
| core_count | DB 서버의 *물리* CPU core 수 (vCPU 아님, 단 cloud RDS 는 vCPU 가 사실상 standin) |
| effective_spindle_count | 디스크 axis 수. SSD 는 1 (sequential bound 아님), NVMe 는 1, RAID-0 multi-disk 면 disk 수 |
| × 2 | 한 connection 이 disk I/O 대기 중일 때 다른 connection 이 CPU 사용하도록 |

### 예시

- AWS RDS db.r5.xlarge (4 vCPU, 32GB) + EBS gp3
  - core × 2 + spindle = 4 × 2 + 1 = **9**
- db.r5.4xlarge (16 vCPU, 128GB) + provisioned IOPS
  - 16 × 2 + 1 = **33**
- db.r5.16xlarge (64 vCPU)
  - 64 × 2 + 1 = **129**

이게 *DB 측 총합* 이다. 서비스 인스턴스가 10개면 인스턴스당 약 3 connection. master 만 그렇고 replica 는 별도.

### 왜 "× 2 + spindle" 인가

CPU bound query 와 I/O bound query 가 섞여 있다는 가정. I/O 대기 중인 connection 은 CPU 를 안 쓰므로 더 많이 가질 수 있다 (spindle 수 만큼). 모든 query 가 in-memory hit 하면 *core_count* 만 있어도 충분.

### `× 2` 에 증명은 없다 — 경험칙의 직관

영상(코딩하는기술사)이 명확히 짚는 포인트 — `× 2` 에 *엄밀한 수학적 증명은 없다*. 수년간 벤치마크에서 수렴된 *경험칙(empirical)*이다. 직관은 이렇다:

- DB 쿼리는 `CPU 연산 ↔ I/O 대기` 를 번갈아 수행한다. I/O 대기 동안 코어는 *논다*.
- 그 빈 자리에 connection 을 하나 더 끼우면 CPU 를 거의 100% 채울 수 있다 → 그래서 코어당 *둘*.
- 그렇다고 `× 3, × 4` 로 더 늘리면 context switch + CPU 캐시 무효화 + 내부 lock 경쟁 비용이 이득을 잡아먹는다.

즉 `× 2` 는 *"I/O 대기를 채우기엔 충분하지만, 경합을 일으킬 만큼 많지는 않은"* 지점이다.

> **보충 (일반화 관점, 영상에는 없음)** — 이 직관을 일반식으로 쓰면 Brian Goetz, *Java Concurrency in Practice* §8.2 의 thread pool 공식과 같다: `N = N_cpu × U_cpu × (1 + W/C)` (W/C = wait/compute 비율). `W/C ≈ 1` 이면 `N ≈ core × 2` 가 되어 PG 공식과 일치 — `× 2` 의 "정체" 가 *대기:연산 ≈ 1:1 가정* 임을 보여준다.

### 또 하나의 공식 — deadlock 회피 최소 풀 (HikariCP 문서)

영상이 함께 소개하는 *두 번째 공식*. PG 공식이 "성능 최적 *시작점*" 이라면, 이건 "deadlock 이 안 나는 *최소 하한*":

```
pool_size = Tn × (Cm − 1) + 1
```

| 기호 | 의미 |
|---|---|
| Tn | 동시 실행 thread 수 |
| Cm | *한 thread 가 동시에 점유* 하는 최대 connection 수 |

한 요청이 connection 을 *동시에 여러 개* 잡는 코드(중첩 트랜잭션 등)에서 deadlock 을 막는 하한이다.

- 예: thread 4 / 풀 4 인데 각 thread 가 connection 을 1 개씩 받아 풀이 비었을 때, 한 thread 가 *두 번째* connection 을 요구하면 풀이 비어 영원히 대기 → deadlock.
- 공식은 *최소 한 thread 는 끝까지 일을 마치게* 보장해 교착을 푼다.

대부분의 앱은 `Cm = 1` (한 요청 = 한 connection) 이라 `(Cm − 1) = 0 → pool = 1` 로 *값이 무의미*하다. 그래서 이건 **풀 사이즈 산정 공식이 아니라 deadlock 진단 공식**으로 본다. `Cm > 1` 인 코드를 발견하면 풀을 키울 게 아니라 코드 구조(트랜잭션 분리 / JTA)를 고쳐야 한다.

---

## Little's Law

queueing theory 의 기초. *시스템 안에 머무는 평균 항목 수 = 도착률 × 평균 머무는 시간*.

```
L = λ × W
```

| 기호 | 의미 |
|---|---|
| L | pool 안의 *busy* connection 수 |
| λ | 초당 도착 요청 수 (RPS) |
| W | 한 요청이 connection 을 *점유* 하는 평균 시간 |

### 적용 예

서비스 RPS (Requests Per Second, 초당 요청 수) = 200, 평균 쿼리 시간 = 50ms = 0.05s

```
L = 200 × 0.05 = 10
```

즉 *평균 10 개 connection 이 동시에 사용 중*. 풀 사이즈 = 평균 + 안전 margin (peak 대응) = 10 × 1.5 ≈ 15.

### "안전 margin" 의 근거

P99 latency 와 평균 latency 의 비율을 사용. 평균 50ms / P99 200ms 면 ratio 4 — 이론적으로는 4 배까지도 spike 가 발생. 보통 1.5~2배 margin 이 실용적.

### 함정

- W 가 *쿼리 시간만* 이 아니라 *connection 점유 전체 시간* 이다. `@Transactional` 안에 외부 IO 호출이 있으면 W 가 폭증
- spike 시점 RPS 로 계산 — 평균 RPS 가 아님
- DB-side connection slot 한계도 고려

### 영상 관점: 사이징 공식이 아니라 *진단 도구*

영상은 Little's Law 를 풀 사이즈를 *정하는* 공식이 아니라 **"풀 부족 vs 쿼리 느림"을 구별하는 진단 도구**로 쓴다. 같은 법칙을 TPS 형태로 재배열:

```
TPS = 활성(active) connection 수 / 쿼리 실행 시간
```

- 측정 예: 풀 16 / 평균 active 14 / 쿼리 50ms → `14 / 0.05 = 280 TPS` (실측과 일치, 풀 90% 가까이 점유 중).
- **active ≈ `core × 2`** 에 도달했다면 → DB 코어가 saturate. 풀을 늘려도 USL 때문에 throughput 안 오름 → **쿼리 응답 시간을 줄여라**. 쿼리를 절반으로 줄이면 throughput 가 *배*가 된다.
- DB 코어에 여력이 있다면 → 그때 maxPoolSize 확장이 유효.

> 즉 풀을 무작정 늘리기 *전에* 쿼리 튜닝 / 인덱스 / 캐시로 W 를 줄이는 게 먼저다.

### 워크스루 — 8코어 단일 DB

영상 시나리오: DB 8코어 / SSD / 충분한 RAM / 1요청=1connection / P95 쿼리 50ms / 목표 300 TPS / WAS 단일.

1. **시작점** = `8 × 2 + 0`(SSD→spindle 0) = **maxPool 16**
2. **Little's Law 검증** = `16 / 0.05 = 320 TPS` 이론 상한 → 실용 80% = **256 TPS** → 목표 300 에 *다소 부족*
3. **처방 순서**: ① 쿼리/인덱스로 P95 50ms 단축 → ② 풀 16 → 18~20 점진 확장 → ③ 그래도 부족하면 DB 코어 증설 / replica
4. Hikari `active`/`pending` 메트릭 모니터링하며 단계적 조정

---

## DB max_connections 와의 충돌

`maxPoolSize × 인스턴스 수` ≤ `DB max_connections` 가 hard constraint.

### MySQL

```sql
SHOW VARIABLES LIKE 'max_connections';
-- default 151, RDS 는 instance class 별 상이
```

| RDS class | max_connections |
|---|---|
| db.t3.micro (1GB) | 90 |
| db.t3.small (2GB) | 170 |
| db.r5.large (16GB) | 1000+ |
| db.r5.4xlarge (128GB) | 5000+ |

### PostgreSQL

```sql
SHOW max_connections;
-- default 100
```

PostgreSQL 은 connection 당 process 라 더 빡빡. 1000 connection 이 process 1000 개 = 메모리 폭발.

### 산정 공식

```
inst_count × (master_pool + replica_pool) + admin_pool ≤ max_connections × 0.8
```

- ×0.8 — DBA / monitoring / mysqldump 등 admin 여유분 20%
- replica 는 master 와 별도 host 면 따로 계산

### 예시: msa product 서비스

- 인스턴스 수 (HPA peak): 5
- 풀: master 10 + replica 10 = 20
- 동시 사용 DB: 1 (master + replica 가 각각 별도 host)
- 5 × 10 = 50 connection (master), 5 × 10 = 50 (replica)
- master max_connections 100 일 때 → 50 / 100 = 50% — 안전

K8s HPA peak 5 가 갑자기 20 으로 폭증하면? 20 × 10 = 200 > 100 → 일부 인스턴스 *connection 거부*. ProxySQL/PgBouncer 가 필요한 시점.

---

## 다중 WAS 분배 — DB 보호 vs 가용성

> 영상이 강조하는 *가장 흔한 실수*: 공식으로 나온 값을 **WAS 마다 곱하지 마라**.

8코어 DB → 공식 16. WAS 4대에 *각각* 16 을 주면 합계 64 = DB 가 감당할 양의 **4배**. (단일 WAS 로 16 설정 후 scale-out 할 때 분배를 깜빡하는 데서 자주 발생.) 올바른 방식은 **총량을 WAS 에 나눠 분배**:

```
WAS 당 풀 = (core × 2) / WAS 수
```

- 8코어 / 4 WAS → 각 **4** (총 16) — **DB 보호 우선** (보수적)
- 단순 ÷N 은 한 대 장애 시 나머지가 부담을 떠안는 위험 → 약간의 여유:
- 각 **5~6** (총 20~24) — **가용성 우선** (한 대 다운 견딤). DB 부담은 살짝 늘지만 합계가 `core × 2` 를 크게 넘지 않게.

**핵심은 "무엇을 우선하나"의 의사결정**이다. DB 보호 우선이면 빡빡하게, 가용성 우선이면 여유 있게 — 실제 값은 부하 테스트로 검증. (오토스케일링이라 풀을 수동 조정 못 하면 → PgBouncer 같은 외부 풀러.)

### 적용 전 *반드시 측정* — 축소는 확장보다 위험하다

> "잘 도는 시스템은 건들지 마라"가 운영의 황금률. 오늘 이 공식을 들었다고 멀쩡한 풀을 곧장 줄이면 안 된다 — **풀 축소는 트래픽 폭증 시 즉각 장애**로 이어질 수 있다.

피크 시간대 Hikari `active` 메트릭으로 평균 active connection 을 먼저 측정하고, `평균 active / 현재 풀` 비율로 판단:

| 사용률 | 조치 |
|---|---|
| ≤ 25% | 축소해도 안전 (예: 풀 10, active 2.5 이하) |
| 25 ~ 65% | 신중히, 단계적으로 |
| ≥ 60% | **축소 금지** |

적용은 한 번에 다 말고 **단계적 + 모니터링 + 즉시 롤백 준비**. 이 가이드를 *적용할 곳*은 두 가지뿐 — ① throughput 이 자원 대비 안 나와 트러블슈팅이 필요할 때의 진단 기준, ② 신규 시스템 구축 시 출발점.

---

## ProxySQL / PgBouncer — connection 폭증 완화

### 문제

```
[Service Pod 1] ─┐
[Service Pod 2] ─┤
[Service Pod 3] ─┼──── direct ───→ [MySQL]   ← max_connections 한계
[Service Pod 4] ─┤
[Service Pod 5] ─┘
```

### 해결

```
[Service Pod 1] ─┐
[Service Pod 2] ─┤        connections=20      connections=100
[Service Pod 3] ─┼──→ [PgBouncer / ProxySQL] ──────────→ [DB]
[Service Pod 4] ─┤      transaction-mode 
[Service Pod 5] ─┘      pooling
```

- 서비스는 PgBouncer 와의 connection 만 관리 (개별 pool)
- PgBouncer 가 DB connection 을 *재사용* (transaction-pool, statement-pool 모드)
- 서비스 입장: connection 무한대처럼 보임
- DB 입장: 안정적 connection 수

### transaction pooling 의 함정

transaction 단위로 backend connection 이 바뀜 → session-level 상태 사용 불가:
- prepared statement (server-side)
- temporary table
- session variable
- LISTEN/NOTIFY (PostgreSQL)

Hibernate 의 server-side prepared statement (`useServerPrepStmts=true`) 는 transaction-pool 모드와 *충돌* — pool 모드를 session 으로 바꾸거나, prepared statement 를 client-side 로 사용.

---

## 컨테이너 환경의 함정

### HPA 트리거

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

CPU spike → HPA 가 인스턴스를 2 → 20 으로 scale up. 각 인스턴스가 풀 20 → 총 400 connection 요구. DB max_connections 100 이면 *대규모 fail*.

### 해결

1. ProxySQL/PgBouncer (위)
2. 풀 사이즈 줄이기 — 인스턴스당 5 → 5 × 20 = 100 OK
3. HPA maxReplicas cap — DB 한계 역산
4. Service Mesh / Aurora Serverless connection muxing

### Aurora connection muxing

Aurora Serverless v2 / RDS Proxy 는 *서버 측* 에서 connection 을 *muxing* — 클라이언트 connection 1000 개를 backend 50 개로 share. transaction-pool 과 같은 한계 (session state).

---

## 작은 풀이 빠른 이유

HikariCP wiki "About Pool Sizing" 의 핵심 주장 — 풀을 *키우면* throughput 가 어느 지점부터 *떨어진다*. 곡선은 우상향이 아니라 **역U자(혹은 빨리 saturate 후 하락)**:

- 한 상용 DB 시뮬레이션: 약 9,600 동시 사용자 환경에서 connection 풀을 수천 개 → 수십 개로 *줄이자* 요청당 응답 시간이 급감.
- Wooldridge 의 실사례: 수천 명을 처리하는 Oracle 시스템이 풀 ~10 으로 충분했고, 그 이상은 손해.

> 정확한 절대 수치는 wiki 원문/벤치 영상 참조. 외울 건 숫자가 아니라 *"곡선 모양"* — 적정점을 지나면 connection 추가가 마이너스다.

이 곡선을 수학적으로 모델링한 게 **USL (Universal Scalability Law, 보편적 확장성 법칙)** 이다. 동시 처리 단위 N 을 늘릴수록 *자원 경합 + 일관성(coherency) 비용*이 누적되어, 어느 지점부터 처리량이 평탄화되다 *오히려 감소*한다. 그 꺾이는 지점이 **saturation point(포화점) = 시스템의 한계**. 핵심 통찰: *"동시에 일하는 connection 은 CPU 가 처리할 수 있는 양만큼만 의미가 있다"* — 이건 DB 풀만이 아니라 thread pool / HTTP client pool / process pool 등 *모든 풀*에 공통이다. 풀을 아무리 키워도 물리 자원의 처리 능력 이상으로 throughput 는 늘지 않는다.

이유:

1. **context switch** — connection 많을수록 OS scheduler 가 더 자주 swap
2. **buffer pool eviction** — 동시 쿼리가 많으면 cache hit ratio 하락
3. **lock contention** — DB 내부 lock (row, table, transaction)
4. **disk seek** — spindle 수 이상의 동시 I/O 는 random seek 폭증

Brett Wooldridge 의 권장: **"start small, increase only when measured benefit"**.

---

## 실무 함정 4선

영상이 꼽는, 공식대로 풀을 잡아도 터지는 4가지. (심화는 [08-pool-failure-patterns.md](08-pool-failure-patterns.md))

1. **롱 트랜잭션** — 트랜잭션 안에서 외부 호출/무거운 계산 → connection 점유 시간 폭증 → 공식대로 잡아도 풀 고갈. 트랜잭션은 짧게, 외부 호출은 밖으로 (#5 cross). *가장 흔한 풀 고갈 원인.*
2. **maxLifetime ↔ DB idle timeout 미스매치** — Hikari `maxLifetime` 기본 **30분**. DB idle timeout 이 더 짧으면 DB 가 먼저 끊은 죽은 connection 을 풀이 들고 있다 사용 → 오류. PostgreSQL idle timeout 기본 0(무제한)·MySQL 8시간이라 *직접* 연결 시엔 보통 무탈하지만, **중간 계층이 끼면 즉시 터진다** — 특히 **PgBouncer `server_idle_timeout` 기본 10분** vs Hikari 30분. RDS Proxy·NLB 도 동일. → **외부 풀러/프록시 도입 시 maxLifetime 을 그 계층의 idle timeout 보다 30초 이상 짧게** (HikariCP README 도 "인프라가 부과하는 어떤 시간 제한보다 몇 초 짧게" 권고).
3. **`Cm > 1` 코드** — 한 thread 가 동시에 여러 connection 점유 (deadlock 공식의 그 패턴). 풀을 키울 게 아니라 트랜잭션 분리 / JTA 로 코드 구조를 고친다.
4. **connection 누수** — `leakDetectionThreshold`(예 60s) 설정 → 60초 넘게 미반환된 connection 을 로그로 경고.

> 한 줄 요약: **풀 고갈은 풀 *크기* 문제가 아니라 connection *점유 시간* 문제일 때가 많다.**

---

## 산정 워크플로

```
1. RPS 측정 (peak)
   - 보통 평균 × 3 = peak
   - Prometheus: rate(http_requests_total[5m]) max over [7d]

2. 평균 connection 점유 시간 (W) 측정
   - hikaricp.connections.usage.avg
   - 또는 Hibernate StatementInspector

3. Little's Law: L = λ × W

4. P99 / 평균 비율로 margin 계산 (×1.5 ~ ×2)

5. DB 측 검증
   - DB max_connections 의 80% / 인스턴스 수 ≥ 풀 사이즈

6. 작게 시작, 메트릭 보면서 늘림
   - hikaricp.connections.pending 가 지속적으로 > 0 이면 부족
```

---

## msa 적용 추산

product 서비스 가정:
- RPS peak: 100
- 평균 쿼리 시간: 30ms
- L = 100 × 0.03 = 3 connection
- margin × 2 = 6 → 풀 8 충분
- 현재 설정: master 10 + replica 10 → 적정

order 서비스 (트랜잭션 길이 길음):
- RPS peak: 50
- 평균 connection 점유: 200ms (외부 결제 IO 포함)
- L = 50 × 0.2 = 10
- margin × 2 = 20 → 풀 20 필요
- 현재 설정: master 10 → **부족 위험**, [17-improvements.md](17-improvements.md) 에서 다룸

---

## 핵심 포인트

- 풀 사이즈는 thread 수가 아닌 *동시 진행 쿼리 수* — core×2 가 시작점, thread 수 기준 아님
- **시작 공식** = `(물리 core × 2) + spindle` (2026 NVMe/캐시 환경 → spindle≈0 → 사실상 `core × 2`). 경험칙이지 정답 아님 → 부하 테스트로 sweet spot
- **deadlock 공식** `Tn × (Cm−1) + 1` 은 사이즈 산정용이 아니라 *교착 진단*용 (Cm=1 이면 무의미)
- **Little's Law** `TPS = active / 쿼리시간` 은 *풀 부족 vs 쿼리 느림* 진단 도구 — 풀 늘리기 전에 쿼리부터 줄여라
- **다중 WAS**: WAS 마다 곱하지 말고 `(core×2)/WAS수` 로 분배. DB 보호 vs 가용성 의사결정
- 인스턴스 × 풀 ≤ max_connections × 0.8 hard constraint, 초과 시 PgBouncer
- 작은 풀이 빠르다 (USL) — context switch / cache miss / lock contention 모두 풀 수에 비례
- 멀쩡한 풀은 함부로 *축소* 금지 (측정 후 25%/65% 기준), 롱 트랜잭션이 진짜 적

## 다음 학습

- [08-pool-failure-patterns.md](08-pool-failure-patterns.md) — 풀 부족 vs 다른 4가지 원인 구분
- [15-codebase-audit.md](15-codebase-audit.md) — msa 11 서비스 풀 사이즈 점검
- [17-improvements.md](17-improvements.md) — 사이즈 재산정 + ADR 초안
