---
parent: 15-connection-pool
seq: 07
title: 풀 사이즈 산정 — Little's Law / PG 공식 / DB max_connections
type: deep
created: 2026-05-01
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

HikariCP wiki 의 유명한 그래프 (Oracle 환경):

| 풀 사이즈 | TPS |
|---|---|
| 9 | 약 ?배 baseline |
| 50 | 절반 |
| 200 | 1/4 |

이유:

1. **context switch** — connection 많을수록 OS scheduler 가 더 자주 swap
2. **buffer pool eviction** — 동시 쿼리가 많으면 cache hit ratio 하락
3. **lock contention** — DB 내부 lock (row, table, transaction)
4. **disk seek** — spindle 수 이상의 동시 I/O 는 random seek 폭증

Brett Wooldridge 의 권장: **"start small, increase only when measured benefit"**.

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

- 풀 사이즈는 thread 수가 아닌 *동시 진행 쿼리 수* (Little's Law)
- PG 공식 `(core × 2) + spindle` 은 DB 측 총합 산정
- 인스턴스 × 풀 ≤ max_connections × 0.8 hard constraint
- 컨테이너 HPA 환경은 ProxySQL/PgBouncer + Aurora muxing 으로 boundary 처리
- 작은 풀이 빠르다 — context switch / cache miss / lock contention 모두 풀 수에 비례

## 다음 학습

- [08-pool-failure-patterns.md](08-pool-failure-patterns.md) — 풀 부족 vs 다른 4가지 원인 구분
- [15-codebase-audit.md](15-codebase-audit.md) — msa 11 서비스 풀 사이즈 점검
- [17-improvements.md](17-improvements.md) — 사이즈 재산정 + ADR 초안
