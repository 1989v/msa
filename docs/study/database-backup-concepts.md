# 데이터베이스 백업 핵심 개념

## 1. RPO / RTO

### RPO (Recovery Point Objective) — 복구 시점 목표

**"장애 발생 시 최대 얼마나 오래된 데이터까지 잃어도 되는가?"**

```
          RPO
      ◄──────────►
──────┬────────────┬──────
   마지막 백업     장애 발생
```

- RPO 24시간: 일일 백업, 최악의 경우 하루치 데이터 유실 허용
- RPO 1시간: 매 시간 백업 또는 증분 보관
- RPO ~0: 모든 트랜잭션을 실시간 보관 (binlog PITR, WAL archiving)

### RTO (Recovery Time Objective) — 복구 시간 목표

**"장애 발생 후 서비스를 얼마나 빨리 복구해야 하는가?"**

```
          RTO
      ◄──────────►
──────┬────────────┬──────
   장애 발생      서비스 복구
```

- RTO 수 시간: 수동 복구 허용 (mysqldump 복원 등)
- RTO 수 분~30분: 자동화된 복구 스크립트 (XtraBackup 복원 + binlog replay)
- RTO 수 초: 자동 페일오버 (Orchestrator, Group Replication)

### RPO vs RTO 관계

```
                 높은 비용/복잡도
                      ▲
                      │
         ┌────────────┼────────────┐
         │ RPO ~0     │  RPO ~0    │
         │ RTO 수 분   │  RTO 수 초  │
         │ (PITR)     │  (자동 페일) │
         ├────────────┼────────────┤
         │ RPO 24h    │  RPO 24h   │
         │ RTO 수 시간  │  RTO 수 분  │
         │ (일일 백업)  │  (핫 스탠바이)│
         └────────────┼────────────┘
                      │
                 낮은 비용/복잡도
```

RPO를 줄이려면 더 자주 백업하거나 실시간 로그를 보관해야 하고,
RTO를 줄이려면 복구 자동화 또는 대기 인스턴스가 필요하다.

---

## 2. 백업 방식 비교

### 2.1 논리적 백업 (Logical Backup)

**대표 도구:** mysqldump, pg_dump

```bash
mysqldump --single-transaction --all-databases > backup.sql
```

- SQL INSERT문 형태로 데이터 export
- 복구: SQL 파일을 다시 실행 (`mysql < backup.sql`)
- **장점**: 이식성 높음 (다른 버전/플랫폼으로 마이그레이션 가능)
- **단점**: 대용량에서 매우 느림 (백업/복구 모두)

### 2.2 물리적 백업 (Physical Backup)

**대표 도구:** Percona XtraBackup (MySQL), pg_basebackup (PostgreSQL)

```bash
xtrabackup --backup --target-dir=/backup/2026-04-06
xtrabackup --prepare --target-dir=/backup/2026-04-06
```

- InnoDB 데이터 파일을 직접 복사 (hot backup — 서비스 중단 없음)
- 복구: 파일을 데이터 디렉토리에 복사 (`xtrabackup --copy-back`)
- **장점**: 대용량에서 빠름, 무중단
- **단점**: 같은 MySQL 버전/플랫폼에서만 복구 가능

### 2.3 비교

| | 논리적 (mysqldump) | 물리적 (XtraBackup) |
|---|---|---|
| 백업 속도 | 느림 (테이블 스캔) | 빠름 (파일 복사) |
| 복구 속도 | 느림 (SQL 실행) | 빠름 (파일 복사) |
| 서비스 영향 | 락 가능성 | 무중단 (hot backup) |
| 이식성 | 높음 | 낮음 (같은 버전만) |
| 증분 백업 | 불가 | 가능 |
| 용도 | 소규모, 마이그레이션 | 프로덕션 정기 백업 |

---

## 3. PITR (Point-in-Time Recovery)

### 개념

**"특정 시점으로 되돌리기"** — 풀백업 시점이 아닌 **임의의 시점**으로 복구하는 기법.

예: "오늘 오후 2시 30분에 실수로 DELETE를 날렸으니, 2시 29분 상태로 복구하고 싶다."

### 동작 원리 (MySQL)

MySQL은 모든 데이터 변경을 **Binary Log(binlog)**에 기록한다. PITR은 풀백업 + binlog replay의 조합이다.

```
Day 1 02:00 ─── 풀백업 생성
Day 1 02:00 ~ Day 1 14:29 ─── binlog에 모든 변경 기록
Day 1 14:30 ─── 실수로 DELETE 실행
Day 1 14:31 ─── 장애 인지

복구 절차:
  1. Day 1 02:00 풀백업 복원 (DB가 새벽 2시 상태로 돌아감)
  2. binlog를 14:29까지만 replay (02:00 → 14:29 변경 재적용)
  3. 14:30의 DELETE는 적용하지 않음
  → DB가 14:29 상태로 복구됨
```

### 복구 명령어

```bash
# 1단계: 풀백업 복원
xtrabackup --prepare --target-dir=/backup/2026-04-06
xtrabackup --copy-back --target-dir=/backup/2026-04-06

# 2단계: binlog를 특정 시점까지 replay
mysqlbinlog --stop-datetime="2026-04-06 14:29:00" \
    binlog.000042 binlog.000043 | mysql -u root -p
```

### PostgreSQL의 PITR

PostgreSQL은 binlog 대신 **WAL(Write-Ahead Log)**을 사용하며 동일 원리로 동작한다.

```bash
# recovery.conf (또는 postgresql.conf)
restore_command = 'cp /backup/wal/%f %p'
recovery_target_time = '2026-04-06 14:29:00'
```

### PITR이 가능하려면

1. **정기 풀백업** — 복구의 출발점 (없으면 binlog만으로 복구 불가)
2. **연속적인 binlog/WAL 보관** — 풀백업 이후의 모든 로그가 끊김 없이 있어야 함
3. **GTID 활성화** (MySQL) — 복제 위치 추적에 사용, 권장

---

## 4. Binary Log (binlog)

### 개념

MySQL이 **데이터를 변경하는 모든 이벤트**를 순서대로 기록하는 로그 파일.

```
binlog.000001  ← INSERT INTO product ...
binlog.000001  ← UPDATE order SET status = ...
binlog.000002  ← DELETE FROM cart WHERE ...
(파일이 일정 크기에 도달하면 다음 번호로 rotate)
```

### 용도

| 용도 | 설명 |
|------|------|
| **복제 (Replication)** | Master의 binlog를 Replica가 읽어서 동일 변경 적용 |
| **PITR** | 풀백업 이후 변경분을 replay하여 특정 시점 복구 |
| **감사 (Audit)** | 누가 언제 어떤 변경을 했는지 추적 |

### GTID (Global Transaction ID)

각 트랜잭션에 부여되는 전역 고유 ID: `server_uuid:transaction_id`

```
3E11FA47-71CA-11E1-9E33-C80AA9429562:1
3E11FA47-71CA-11E1-9E33-C80AA9429562:2
...
```

- 복제 시 "어디까지 적용했는지"를 binlog 파일 위치 대신 GTID로 추적
- 페일오버 시 새 Master로 전환이 간편 (위치 재계산 불필요)

---

## 5. WAL (Write-Ahead Log)

PostgreSQL 버전의 binlog. 모든 데이터 변경을 먼저 WAL에 기록한 후 실제 데이터 파일에 반영한다.

```
WAL 기록 → 데이터 파일 반영
(장애 시 WAL에서 replay하여 일관성 보장)
```

- 복제: Streaming Replication으로 WAL을 Replica에 전송
- PITR: pg_basebackup + WAL archive replay

---

## 6. 풀백업 vs 증분백업

### 풀백업 (Full Backup)

```
Day 1: 전체 데이터 (100만 건)     ← 자기 완결, 이것만으로 복구 가능
Day 2: 전체 데이터 (101만 건)     ← 자기 완결
Day 3: 전체 데이터 (103만 건)     ← 자기 완결
```

- 각 백업이 독립적이라 오래된 백업을 자유롭게 삭제 가능
- 스토리지를 많이 사용하지만 복구가 단순

### 증분백업 (Incremental Backup)

```
Day 1: 풀백업 (기준점)
Day 2: Day 1 이후 변경분만         ← Day 1에 의존
Day 3: Day 2 이후 변경분만         ← Day 1 + Day 2에 의존
```

- 스토리지 절약
- 복구 시 풀백업 + 모든 증분을 순서대로 적용해야 함 (체인 의존)
- 중간 증분이 손상되면 이후 전부 복구 불가

### 선택 기준

| | 풀백업 | 증분백업 |
|---|---|---|
| DB 크기 | 수십 GB 이하 | TB급 이상 |
| 복구 단순성 | 높음 | 낮음 (체인 의존) |
| 스토리지 비용 | 높음 | 낮음 |
| 운영 복잡도 | 낮음 | 높음 |

일반적으로 **TB 미만이면 일일 풀백업이 표준**이다.

---

## 7. 자동 페일오버 (Auto-Failover)

### 개념

Master DB 장애 시 **사람 개입 없이** Replica를 새 Master로 승격시키는 메커니즘.

### 구성 요소

```
App → ProxySQL → Master (정상)
       ↕
   Orchestrator (감시)
       ↕
     Replica

[Master 장애 발생]

App → ProxySQL → Replica (새 Master로 승격)
       ↕
   Orchestrator (승격 명령 실행, ProxySQL 라우팅 갱신)
```

| 컴포넌트 | 역할 |
|----------|------|
| **Orchestrator** | Master 헬스체크, 장애 감지, Replica 승격 판단 |
| **ProxySQL** | 앱이 항상 같은 endpoint로 접속, 내부적으로 라우팅 전환 |

### 페일오버 vs 페일백

- **페일오버**: Master → Replica 전환 (자동)
- **페일백**: 원래 Master 복구 후 다시 Master로 전환 (보통 수동)

---

## 8. 보관 정책 패턴

### 단순 고정 (Fixed Retention)

```
일일 풀백업 7일 보관, binlog 2일 보관
→ 8일째 되면 가장 오래된 백업 자동 삭제
```

### GFS (Grandfather-Father-Son)

```
Son (일일):       7일 보관
Father (주간):    4주 보관 (매주 일요일 백업 유지)
Grandfather (월간): 12개월 보관 (매월 1일 백업 유지)
```

- 장기 보관이 필요한 규제 환경에서 사용
- 스토리지 효율적으로 장기간 복구 지점 확보

---

## 9. 용어 정리

| 용어 | 설명 |
|------|------|
| **RPO** | Recovery Point Objective — 허용 가능한 최대 데이터 유실 시간 |
| **RTO** | Recovery Time Objective — 허용 가능한 최대 서비스 중단 시간 |
| **PITR** | Point-in-Time Recovery — 임의 시점으로 복구 |
| **Binlog** | MySQL Binary Log — 데이터 변경 이벤트 로그 |
| **WAL** | PostgreSQL Write-Ahead Log — binlog와 동일 역할 |
| **GTID** | Global Transaction ID — 트랜잭션별 전역 고유 식별자 |
| **XtraBackup** | Percona의 MySQL 물리적 핫 백업 도구 |
| **Hot Backup** | 서비스 중단 없이 수행하는 백업 |
| **Cold Backup** | DB를 정지한 상태에서 수행하는 백업 |
| **Failover** | 장애 시 대기 서버로 자동 전환 |
| **Failback** | 원래 서버 복구 후 재전환 |
