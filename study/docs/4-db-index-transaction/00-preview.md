---
parent: 4-db-index-transaction
type: preview
created: 2026-05-01
---

# DB 인덱스 + 트랜잭션 격리 — Preview

> 학습자 수준: advanced (10년차 백엔드, 한국 대기업 면접 대비) · 전체 예상 시간: 25h · 목표: B-Tree/MVCC/Lock 의 동작 원리를 InnoDB 페이지 단위로 그릴 수 있게 + EXPLAIN 한 줄로 병목 진단 + msa 11개 서비스에 즉시 적용
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: P3 풀팩 · 학습 순서: Bottom-up (구조 → 동작 → 코드)
> 직전 학습: [#5 Spring Transactional](../5-spring-transactional/00-preview.md) — 본 학습은 그 "DB 쪽 절반" 을 다룬다.

---

## 멘탈 모델: "디스크 → 페이지 → B+Tree → MVCC → Lock → 쿼리 플랜"

DB 면접/실무 사고는 **6층 사다리**다. 아래 층의 물리 제약이 위 층의 모든 추상을 결정한다. 한 층만 알면 답할 수 없는 질문이 늘 나온다 ("REPEATABLE READ 인데 왜 DEADLOCK 이?", "복합 인덱스 (A,B) 인데 왜 ALL?").

```
  ┌────────────────────────────────────────────┐
  │  Layer 6: 옵티마이저 / 실행 계획            │
  │  - EXPLAIN type/key/rows/Extra             │
  │  - cardinality, histogram, cost            │
  └─────────────────┬──────────────────────────┘
                    │ "통계가 결정"
  ┌─────────────────┴──────────────────────────┐
  │  Layer 5: Lock                             │
  │  - S / X / IS / IX / AUTO-INC / MDL        │
  │  - Record / Gap / Next-key / Insert Intent │
  └─────────────────┬──────────────────────────┘
                    │ "쓰기 보호"
  ┌─────────────────┴──────────────────────────┐
  │  Layer 4: MVCC                             │
  │  - undo log + DB_TRX_ID + DB_ROLL_PTR      │
  │  - Read View, Consistent Read              │
  └─────────────────┬──────────────────────────┘
                    │ "읽기 보호"
  ┌─────────────────┴──────────────────────────┐
  │  Layer 3: B+Tree (clustered / secondary)   │
  │  - leaf 연결 리스트 → 범위 스캔            │
  │  - secondary leaf = PK 값                  │
  └─────────────────┬──────────────────────────┘
                    │ "인덱스 자료구조"
  ┌─────────────────┴──────────────────────────┐
  │  Layer 2: 페이지 (16KiB 기본)              │
  │  - 페이지 헤더 + 슬롯 + record + trailer  │
  │  - buffer pool LRU                         │
  └─────────────────┬──────────────────────────┘
                    │ "물리 단위"
  ┌─────────────────┴──────────────────────────┐
  │  Layer 1: 디스크 / OS                      │
  │  - random IO 비싼 이유 = seek time + 페이지 단위 │
  │  - SSD 도 페이지 단위는 동일                │
  └────────────────────────────────────────────┘
```

**핵심 7문장만 외운다**:
1. DB 가 **B+Tree** 를 쓰는 이유는 디스크가 **페이지(16KiB)** 단위라서. fanout 수백~수천이면 1억 행도 트리 깊이 3-4.
2. InnoDB 의 **clustered index = PK** — secondary index 의 leaf 는 **PK 값**을 들고 있다. 이 한 문장이 covering / lookup / pk 길이 / 정렬 모두 설명.
3. **MVCC = "읽기는 lock 없이"** — undo log 로 과거 버전을 만들어주는 메커니즘. REPEATABLE READ 의 snapshot 일관성도 여기서 나온다.
4. InnoDB 의 **REPEATABLE READ + Gap Lock + Next-key Lock** 조합이 phantom read 를 차단한다. 표준 SQL 정의와 다른 InnoDB 만의 특징.
5. Lock 호환성: **S↔S 만 공존**. X 는 모두 충돌. **IS/IX 는 row-level 과 table-level 을 충돌 없이 공존**시키는 메타 락.
6. **Deadlock 은 InnoDB 가 자동 감지** (wait-for graph) → 한쪽만 rollback. 진단은 `SHOW ENGINE INNODB STATUS` 의 LATEST DETECTED DEADLOCK 섹션.
7. EXPLAIN 보는 순서: `type` (range/ref 이상이어야) → `key` (실제 탄 인덱스) → `rows` (예상 스캔) → `Extra` (Using filesort/Using temporary 가 있으면 위험).

---

## 소주제 지도

> 19개 파일 (preview 포함). 각 파일 평균 1.0~1.5h.

### Phase 1: 자료구조와 기본 개념 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 인덱스가 왜 필요한가 | [01-why-index.md](01-why-index.md) | Full Table Scan vs Index Seek 의 IO 비용 모델, 디스크 페이지 단위 |
| 02 | B-Tree / B+Tree 구조 | [02-btree-bplustree.md](02-btree-bplustree.md) | 노드/leaf/fanout, 왜 binary search tree 가 아니라 B+Tree, 삽입/분할 |
| 03 | 클러스터드 vs 세컨더리 | [03-clustered-vs-secondary.md](03-clustered-vs-secondary.md) | InnoDB PK = clustered, secondary leaf = PK, 의존성 5가지 결과 |
| 04 | 다른 인덱스 종류 | [04-index-types.md](04-index-types.md) | Hash / Bitmap / Spatial / Fulltext, MySQL 에서 언제 |

### Phase 2: 트랜잭션 / 격리 / Lock / 실행계획 (9개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 05 | ACID + 격리 4단계 + 이상현상 | [05-acid-isolation.md](05-acid-isolation.md) | Dirty / Non-repeatable / Phantom, MySQL 기본 RR 의 특이성 |
| 06 | InnoDB 페이지 + MVCC | [06-innodb-page-mvcc.md](06-innodb-page-mvcc.md) | 16KiB 페이지, undo log, Read View, snapshot 생성 시점 |
| 07 | Lock 종류 전수 | [07-lock-types.md](07-lock-types.md) | S/X/IS/IX, Record/Gap/Next-key/Insert Intention, 호환성 매트릭스 |
| 08 | Deadlock + MDL + AUTO-INC | [08-deadlock-mdl.md](08-deadlock-mdl.md) | wait-for graph, SHOW ENGINE INNODB STATUS, MDL 사슬, AUTO-INC 모드 |
| 09 | EXPLAIN / EXPLAIN ANALYZE | [09-explain.md](09-explain.md) | type/key/rows/Extra, 실측 vs 예측, JSON 모드 |
| 10 | 복합 인덱스 + Covering + Merge | [10-composite-covering-merge.md](10-composite-covering-merge.md) | (=,IN,범위,정렬) 순서, covering, Index Merge, Skip Scan |
| 11 | 인덱스 안티패턴 | [11-anti-patterns.md](11-anti-patterns.md) | left-most prefix, 함수 적용, IS NULL, OR, implicit cast |
| 12 | 통계와 옵티마이저 | [12-statistics-optimizer.md](12-statistics-optimizer.md) | cardinality, histogram, ANALYZE TABLE, FORCE INDEX |
| 13 | Online DDL + pt-osc | [13-online-ddl.md](13-online-ddl.md) | INPLACE/COPY, INSTANT, MDL 차단 회피, gh-ost 비교 |

### Phase 3: msa 코드베이스 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 14 | msa 엔티티 인덱스 매핑 | [14-msa-entities.md](14-msa-entities.md) | 11개 서비스의 `@Table indexes` / Flyway DDL 전수 분석 |
| 15 | msa 쿼리 패턴 + slow 후보 | [15-msa-queries.md](15-msa-queries.md) | OutboxRelay, Wishlist, Order/Product 쿼리, slow 후보 |
| 16 | TX 와 라우팅 / 격리 결합 | [16-msa-tx-routing.md](16-msa-tx-routing.md) | ADR-0020 와 lock 보유 시간, RoutingDataSource × 격리, replica lag |

### 산출물 (2개) + Cookbook (1개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 17 | 개선 제안 종합 | [17-improvements.md](17-improvements.md) | 인덱스 추가/제거, partition/sharding ADR 후보, 격리 수정 후보 |
| 18 | 면접 Q&A 카드 | [18-interview-qa.md](18-interview-qa.md) | 4 Phase × 8~10 카드 = 35+ 카드 |
| 19 | 동시성 제어 Cookbook | [19-concurrency-control-cookbook.md](19-concurrency-control-cookbook.md) | 9 시나리오 × 4 패턴 decision matrix + 실 회사 사례 (Stripe / Amazon / Shopify / 은행 / 티켓팅 / MSA) + Defense-in-Depth |

---

## 개념 관계도

```
              ┌──────────────────────────────────┐
              │  B+Tree (clustered/secondary)    │
              │  - leaf 연결 리스트              │
              │  - secondary leaf = PK           │
              └──────────────┬───────────────────┘
                             │ "쿼리"
                             ▼
              ┌──────────────────────────────────┐
              │  옵티마이저                      │
              │  cardinality / histogram         │
              │  → EXPLAIN plan                  │
              └──────────────┬───────────────────┘
                             │ "동시성"
              ┌──────────────┴───────────────────┐
              ▼                                   ▼
  ┌──────────────────────┐         ┌────────────────────────┐
  │  MVCC                │         │  Lock                  │
  │  undo + Read View    │         │  S/X/IS/IX             │
  │  Consistent Read     │         │  Record/Gap/Next-key   │
  └──────────┬───────────┘         └───────────┬────────────┘
             │                                 │
             └────────────┬────────────────────┘
                          ▼
              ┌──────────────────────────────────┐
              │  격리 수준 (RR / RC / RU / SER)  │
              │  + 이상현상 (Dirty/NR/Phantom)   │
              └──────────────────────────────────┘
```

---

## 학습 시작 전 한 장 치트시트

### 권장 인덱스 설계 룰 (2026 기준)

| 룰 | 이유 |
|---|---|
| PK 는 항상 **단조 증가 + 짧은 정수** (BIGINT AUTO_INCREMENT, UUIDv7) | clustered index 분할 비용 최소화 + secondary leaf 크기 절약 |
| WHERE 등호 → IN → 범위 → ORDER BY 순서로 컬럼 배치 | left-most prefix + Index Range Scan 활용 |
| 자주 함께 쓰는 SELECT 컬럼은 **covering** 후보 | secondary → clustered 룩업 제거 (Using index) |
| cardinality 낮은 컬럼 (status enum) 단독 인덱스 금지 | 옵티마이저가 외면 → ALL 로 회귀 |
| `WHERE func(col) = ?` 절대 금지 → **함수 인덱스** 또는 컬럼 보존 | 인덱스 무효화 |
| `OR` 는 가능하면 `UNION ALL` / Index Merge 가능한 패턴으로 | OR 한쪽만 인덱스면 ALL 회귀 |
| 페이징은 **keyset (cursor) > offset** | offset 큰 값에서 cluster index 전체 스캔 |
| FK 컬럼에는 별도 인덱스 강제 | InnoDB 가 자동 생성하지만 복합 PK 일부일 때 누락 |

### 격리 수준 선택 (msa 표준)

| 시나리오 | 격리 | 이유 |
|---|---|---|
| 일반 조회/CRUD | **REPEATABLE READ** (InnoDB 기본) | snapshot 일관성 + Gap Lock 으로 phantom 차단 |
| Outbox relay (배치 polling) | **REPEATABLE READ + SKIP LOCKED** | 동시 worker 가 같은 row 안 잡게 |
| 보고서/대시보드 | **READ COMMITTED** | snapshot 비용 절감, 약간의 inconsistent 허용 |
| 자금 이체 (없지만) | **SERIALIZABLE** 보다 **비관락 (FOR UPDATE)** | SERIALIZABLE 은 throughput 망가짐 |

### 절대 하지 말 것

- `WHERE DATE(created_at) = '2026-05-01'` — 함수 적용으로 인덱스 무효화 → `created_at >= '2026-05-01' AND created_at < '2026-05-02'`
- 큰 `OFFSET` 페이징 (`LIMIT 1000000, 20`) — keyset 으로
- Long TX 안에서 외부 IO (이미 ADR-0020 강조) — lock 보유 시간 폭증 → deadlock / lock wait timeout
- `@Transactional` 안에서 `Thread.sleep`, RestTemplate, KafkaProducer.send().get()
- secondary index 만 보고 `SELECT *` (index 만 쓰겠다고 착각) — covering 이 안 되면 random IO 폭발
- 인덱스 추가 무지성 — write amplification (모든 INSERT 가 모든 secondary index 갱신)

---

## Kotlin/JPA 특유 함정

- **JPA flush 시점**: TX 종료 직전. 그 전에 보낸 SELECT 가 캐시(1차) 에서 stale 한 값 받아 락 충돌 시 의외 동작.
- **`@OneToMany fetch=LAZY` + Open-In-View 활성**: TX 밖에서 Lazy 로딩 → 새 connection + 새 snapshot → repeatable read 가 깨진 듯한 착각.
- **QueryDSL 의 `ne` / `notIn`**: 인덱스 못 탐 (negative match). cardinality 낮은 enum 의 NOT 조건은 거의 ALL.
- **Hibernate `nullable = false` 변경**: ALTER 가 INPLACE 안 되고 COPY → MDL 폭탄. ADR-0020 의 long TX 와 만나면 서비스 정지.
- **`@Version` 낙관락**: row lock 안 잡고 UPDATE WHERE version=? 로 충돌 검출. lock 보유 시간 0 이라 lock wait 없음. 동시 업데이트 빈도 높으면 retry 폭주.

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 18 → 19** Bottom-up. Phase 1 은 의존성 강함, Phase 2 부터는 09 (EXPLAIN) 만 먼저 보고 점프 가능.
- **19 (Cookbook)** 은 07/08/16 + #5/#7/#9 학습 후 보면 매핑이 깔끔. 면접 시나리오 답변용 무기.
- Phase 1 (01-04) 은 자료구조에 약한 사람만 정독. 익숙하면 02-03 만 읽고 05 로.
- **06 (MVCC) + 07 (Lock) + 08 (Deadlock)** 은 본 학습의 코어. 면접 단골 + 실무 장애 1순위.
- **09 (EXPLAIN) + 11 (Anti-pattern)** 은 PR 리뷰에서 즉시 쓰는 무기. 손에 익을 때까지 회독.
- **14-16 (msa 매핑)** 은 면접에서 "회사 사례" 로 답할 때 무기. 머리에 표로 꽂는다.
- 코드 따라 작성 권장: 02 (B+Tree 시뮬), 06 (MVCC 재현 SQL), 07 (Gap Lock 재현 SQL), 08 (Deadlock 재현 2 세션).

---

## 관련 다음 학습

- **#5 Spring Transactional** — 이미 학습. ADR-0020 의 외부 IO 분리가 lock 보유 시간을 어떻게 줄이는지 본 학습 16번 파일에서 다룬다.
- **#15 Connection Pool** — `LazyConnectionDataSourceProxy` + HikariCP 의 leak detection 이 long TX 진단에 어떻게 쓰이는지.
- **#7 Distributed Systems** — 분산 트랜잭션 (2PC, Saga) 가 단일 DB 의 격리 수준과 어떻게 다른지.
- **#6 Kafka Internals** — Outbox 폴링이 InnoDB Gap Lock 과 만나면 어떤 패턴이 나오는지.
- **#11 Observability** — slow query log + p99 latency budget 측정 (ADR-0025).
