---
parent: 4-db-index-transaction
seq: 13
title: Online DDL — INPLACE / INSTANT / pt-osc / gh-ost
type: deep
created: 2026-05-01
---

# 13. Online DDL — INPLACE / INSTANT / pt-osc / gh-ost

## 핵심 정의

운영 트래픽 중 DDL (인덱스 추가, 컬럼 추가/변경) 을 안전하게 수행하는 방법.

- **MySQL native Online DDL**: ALGORITHM=INPLACE/INSTANT, LOCK=NONE/SHARED.
- **pt-online-schema-change** (Percona): 그림자 테이블 + 트리거.
- **gh-ost** (GitHub): 그림자 테이블 + binlog 추적.

08 (MDL) 에서 DDL 한 줄이 서비스 정지를 만들 수 있음을 봤다. 본 문서는 그 회피 방법.

## MySQL Native Online DDL

### ALGORITHM 종류

| ALGORITHM | 동작 | DDL 시간 | 트래픽 영향 |
|---|---|---|---|
| **INSTANT** (8.0.12+) | metadata 만 변경 | ms | 거의 없음 |
| **INPLACE** | 테이블 안에서 수정, 데이터 복사 가능 | 분~시간 | DML 가능 (대개) |
| **COPY** | 새 테이블 만들고 모든 row 복사 | 시간~일 | DML 차단 |

### LOCK 종류

| LOCK | 의미 |
|---|---|
| **NONE** | DDL 중 DML 가능 |
| **SHARED** | DDL 중 SELECT 만 |
| **EXCLUSIVE** | DDL 중 모든 쿼리 차단 |

### 명시 사용

```sql
ALTER TABLE orders ADD COLUMN tax DECIMAL(10,2) NULL,
  ALGORITHM=INPLACE, LOCK=NONE;

ALTER TABLE orders ADD INDEX idx_user_status (user_id, status),
  ALGORITHM=INPLACE, LOCK=NONE;
```

- 지정한 알고리즘 불가능하면 에러 → 안전한 fallback 방지.
- 지정 안 하면 MySQL 이 가능한 가장 가벼운 옵션 자동 선택.

## INSTANT 적용 가능한 작업 (8.0.12+)

| 작업 | INSTANT? |
|---|---|
| ADD COLUMN (마지막 위치) | ✅ |
| ADD COLUMN (중간 위치) | ❌ |
| DROP COLUMN | ✅ (8.0.29+) |
| 컬럼 이름 변경 | ✅ |
| 컬럼 타입 변경 (호환) | △ (일부) |
| ENUM/SET 값 끝에 추가 | ✅ |
| ENUM/SET 값 중간에 추가 | ❌ |
| ADD INDEX | ❌ (INPLACE) |
| DROP INDEX | ✅ |
| RENAME TABLE | ✅ |

### INSTANT 의 비밀

- 메타데이터에 "이 row 부터 새 컬럼 default" 만 기록. 기존 row 의 실제 데이터는 안 바꿈.
- row 읽을 때 default 적용.
- → DDL 시간 ms, 디스크 IO 거의 없음.
- 단, INSTANT ADD COLUMN 횟수 제한 (테이블당 64) — 한도 차면 다음 ADD 는 INPLACE 또는 COPY.

## INPLACE — 테이블 재구성

- 새 idb 파일 생성 + 기존 데이터 복사 + 변경 사항 적용.
- DML 은 동시에 가능 → row log 에 변경 기록 → DDL 종료 직전 일괄 적용.
- DDL 종료 직전 잠시 EXCLUSIVE MDL → 이 시간이 ms 단위로 짧음.

### INPLACE 가능한 작업

- ADD INDEX (대부분)
- ADD/DROP FOREIGN KEY
- 컬럼 NULL/NOT NULL 변경 (값 검증 필요해서 시간 걸림)
- VARCHAR 길이 확장 (같은 byte 표현 안에서)
- ENUM 끝에 값 추가

### INPLACE 도 시간이 길면 위험

- 1억 row 테이블의 ADD INDEX = 수십 분.
- 그 사이 DML 은 row log 에 쌓임 → row log 가 너무 크면 OOM.
- `innodb_online_alter_log_max_size` (기본 128MB) 초과 시 DDL 실패.

## COPY — 마지막 수단

- 안전한 fallback. PRIMARY KEY 변경 같은 일부 작업은 COPY 만 가능.
- DML 차단 → 운영에는 거의 안 씀.

## pt-online-schema-change (pt-osc)

### 동작

1. 원본 테이블 (orders) 과 같은 구조의 그림자 테이블 (_orders_new) 생성.
2. 그림자에 DDL 변경 적용 (ALTER).
3. 트리거 (INSERT/UPDATE/DELETE) 로 원본의 변경을 그림자에 동기.
4. 청크 단위로 원본 → 그림자 데이터 복사.
5. RENAME (atomic swap).
6. 트리거 제거 + 원본 삭제.

### 장점

- DDL 자체가 ms (RENAME 만). MDL EXCLUSIVE 시간 매우 짧음.
- 청크 복사 속도 조절 가능 (`--chunk-time`, `--max-load`).
- 1억 row 도 수 시간이지만 DML 영향 거의 없음.

### 단점

- 그림자 테이블 생성 시 디스크 2배 필요.
- 트리거 부담 → write 부하 ~10-20% 증가.
- FK 처리 까다로움 (--alter-foreign-keys-method).
- replica lag 발생 가능 (추가 write 가 이중).

### 명령 예

```bash
pt-online-schema-change \
  --alter "ADD INDEX idx_user_status (user_id, status)" \
  --execute \
  D=commerce,t=orders,h=master.example.com,u=admin,p=...
```

## gh-ost

### 동작 (pt-osc 와 차이)

1. 그림자 테이블 생성.
2. **binlog 를 읽어** 원본 변경을 그림자에 적용 (트리거 안 씀).
3. 청크 복사.
4. cut-over (atomic rename).

### pt-osc 대비 장점

- 트리거 없음 → 원본 테이블 write 부하 추가 X.
- replica 에서 binlog 읽으면 master 부하 0.
- 일시정지/재개 가능 (`echo throttle | nc`).

### 단점

- binlog format 이 ROW 여야.
- 설정 복잡. learning curve.

→ GitHub / Shopify 등 대형 운영자 표준. 한국 대기업도 점차 채택.

## 의사결정 트리

```
ALGORITHM=INSTANT 가능?
├── 가능 → INSTANT 사용 (1초 이내)
└── 불가
    │
    ALGORITHM=INPLACE LOCK=NONE 가능?
    ├── 가능 + 테이블 작음 (< 100M row) → INPLACE
    ├── 가능 + 테이블 큼 → row log 폭발 위험 → pt-osc / gh-ost
    └── 불가 (PRIMARY KEY 변경 등) → pt-osc / gh-ost
```

## 운영 절차 (msa 권장)

```
1. 로컬 dev 에서 ALGORITHM=INPLACE LOCK=NONE 시도.
2. 가능하면 staging 에서 같은 명령 시간 측정.
3. 운영 적용 전 CHECK:
   ☐ long-running TX 없음 (information_schema.innodb_trx)
   ☐ MDL EXCLUSIVE 시간 짧을 것 (INPLACE/INSTANT)
   ☐ row log 폭발 가능성 (INPLACE 의 경우)
4. 운영 시간 외 / off-peak 에 적용.
5. 적용 중 모니터: SHOW PROCESSLIST 의 ALTER 진행, lock_waits.
6. 실패 시 즉시 KILL → 청크 복구.
```

### Flyway 와의 결합

- Flyway 로 무지성 ALTER 는 위험 — 큰 테이블이면 startup 자체가 timeout.
- 운영에선 **Flyway 는 "pending migration 알림" 용**, 실제 적용은 **별도 운영 작업**.
- 또는 INSTANT 만 가능하도록 migration 정책 (마지막 위치 ADD COLUMN 만 등).

## msa 사례

### Order 의 idx_orders_status 제거 시 (17 의 후보)

```sql
ALTER TABLE orders DROP INDEX idx_orders_status,
  ALGORITHM=INPLACE, LOCK=NONE;
```

- DROP INDEX 는 보통 INSTANT (8.0+ 메타만 변경) 또는 INPLACE 빠름.
- MDL EXCLUSIVE 짧음.

### Wishlist 의 (member_id, created_at) 추가 시

```sql
ALTER TABLE wishlist_items ADD INDEX idx_member_created (member_id, created_at),
  ALGORITHM=INPLACE, LOCK=NONE;
```

- INPLACE. 테이블이 크지 않으면 분 단위.
- 큰 테이블 (>10M row) 이면 gh-ost 검토.

### Quant 의 outbox 제거 (테이블 비움)

```sql
TRUNCATE TABLE outbox;  -- TRUNCATE 는 DDL — MDL EXCLUSIVE!
```

- TRUNCATE 가 DDL 이라는 점 주의 — DROP + CREATE 와 같음. MDL 폭탄 가능.
- 대안: `DELETE FROM outbox WHERE published_at IS NOT NULL AND published_at < NOW() - INTERVAL 7 DAY` 청크로.

## 함정

### 1. INSTANT 한도 초과

```
ERROR 4092 (HY000): Maximum row size for INSTANT ADD/DROP COLUMN is exceeded.
```
- 테이블 재구성 (OPTIMIZE TABLE) 으로 리셋.

### 2. row log 초과

```
ERROR 1799 (HY000): Online DDL operation failed because the row log exceeded its maximum size.
```
- DML 부하 줄이고 재시도. 또는 pt-osc 로.

### 3. FK + pt-osc

- pt-osc 가 FK 처리하는 방식이 application 레벨 가정과 다를 수 있음.
- `--alter-foreign-keys-method=auto|rebuild_constraints|drop_swap` 신중히.

### 4. MDL 에서 묵시적 EXCLUSIVE

```sql
RENAME TABLE orders TO orders_old, orders_new TO orders;  -- atomic, MDL 짧음
```
- pt-osc 의 cut-over 가 이걸 사용. 정상.

### 5. replica lag

- pt-osc / gh-ost 의 청크 복사가 binlog 에 쌓임 → replica 적용 지연.
- `--max-lag` 옵션으로 throttling.

## ADR / 운영 룰 후보 (msa)

- 모든 ALTER 는 ALGORITHM, LOCK 명시.
- 1M row 이상 테이블은 INSTANT 또는 INPLACE LOCK=NONE 만 허용.
- 그 이상 변경은 별도 운영 작업 (Flyway 비활성).
- INSTANT 횟수 한도 모니터링.

## 멘탈 모델

> Online DDL 은 **공연 중 무대 세트 교체**. INSTANT = 조명만 바꿔서 효과. INPLACE = 무대 옆에서 새 세트 만들고 막간에 살짝 바꿈. COPY = 공연 중단하고 무대 통째로 교체. pt-osc / gh-ost = 옆 무대에 똑같이 만들고 관객은 모르게 슬쩍 옮김.

## 핵심 포인트

- **INSTANT** (8.0.12+) = 메타데이터 변경, 거의 무영향. ADD COLUMN 끝, DROP INDEX, RENAME 등.
- **INPLACE** = 테이블 재구성, DML 가능, MDL EXCLUSIVE 는 시작/종료 잠시.
- **COPY** = 마지막 수단, DML 차단.
- 큰 테이블엔 **pt-osc / gh-ost** — 그림자 테이블 + 트리거 (pt-osc) 또는 binlog (gh-ost).
- **Flyway 의 무지성 ALTER 위험** — 운영은 운영 작업으로 분리.
- ALGORITHM, LOCK 명시 컨벤션이 안전.

## 다음 학습
- [14-msa-entities.md](14-msa-entities.md) — msa 의 entity 인덱스 정의 전수
- [17-improvements.md](17-improvements.md) — 인덱스 추가/제거 ADR 후보
