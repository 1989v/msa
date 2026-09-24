# 데이터 저장 — 커버리지 체크리스트

원천:
- 레포 운영 행 — 지난 라운드 data.yaml 의 56 개 개념 (id 유지)
- `study/docs/4-db-index-transaction/` — 99-concept-catalog §1-A 갭 25 · §2 A~J 표, 본문 노트 01~21 의 절 제목
- `study/docs/9-redis-deep-dive/` — 99-concept-catalog §1-A 갭 34 · §2 A~K 표, 본문 노트 01~19
- `study/docs/15-connection-pool/` — 99-concept-catalog §1-A 갭 30 · §2 A~H 표, 본문 노트 01~18
- 볼트 `system-resources-cheatsheet.md` — §01 메모리 용어 중 저장 관련 행(페이지 캐시 · dirty page · mmap · 페이지 폴트), §05 디스크 · 파일 I/O 전체
- 레포 코드 · 마이그레이션 · `docs/conventions/jpa-persistence.md` · ADR-0077(보존기간)
- 분야 표준 — 「Designing Data-Intensive Applications」 3·5·7장, 「High Performance MySQL」, MySQL 8.4 · ClickHouse 공식 문서 목차(저장 엔진 · 조인 알고리즘 · 격리 · LSM · 컬럼 지향)

배치 합계: placed 319 / excluded 55. 행 순서는 온톨로지 계층(저장소 선택 → 관계형 DB 단계들 → 인메모리 저장소 → 데이터 접근 · 캐시 → 분석용 저장 → 용어 사전)을 따른다.

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| data-storage | 데이터 저장 (DOMAIN) | 운영 행 | placed |
| data-store-selection | 저장소 선택 (STAGE) | study/4 00-preview · 운영 행 | placed |
| data-polyglot-persistence | 용도별 저장소 분리 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-row-oriented-storage | 행 지향 저장 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| mysql | MySQL (TECHNOLOGY) | 운영 행 | placed |
| redis | Redis (TECHNOLOGY) | 운영 행 | placed |
| clickhouse | ClickHouse (TECHNOLOGY) | 운영 행 | placed |
| data-relational | 관계형 데이터베이스 (DOMAIN) | study/4 00-preview | placed |
| data-schema-design | 스키마 설계 (STAGE) | study/4 14 · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-normalization | 정규화 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-denormalization | 반정규화 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-primary-key-design | 기본 키 설계 (MECHANISM) | study/4 03 §권장 PK 패턴 · 99 §J | placed |
| data-auto-increment-key | 자동 증가 키 (MECHANISM) | study/4 99 §J · 02 | placed |
| data-random-pk-fragmentation | 랜덤 키 삽입 단편화 (PROBLEM) | study/4 99 §J (UUIDv4 함정) · 02 | placed |
| data-constraint | 무결성 제약 (MECHANISM) | docs/conventions/jpa-persistence (FK-as-ID) · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-soft-delete | 소프트 삭제 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-json-column | JSON 컬럼 (MECHANISM) | study/4 99 §E (JSON/JSON_TABLE · JSONB) | placed |
| data-generated-column | 생성 컬럼 (MECHANISM) | study/4 99 §D (Generated columns) · 04 | placed |
| data-update-anomaly | 갱신 이상 (PROBLEM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-descending-index | 내림차순 인덱스 | study/4 10 (Descending Index) | excluded — 복합 인덱스의 컬럼 정렬 방향 옵션이라 data-composite-index 설명에 흡수 |
| data-sql-querying | SQL 질의 작성 (STAGE) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-join | 조인 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-subquery | 서브쿼리 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-aggregation | 집계 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-window-function | 윈도 함수 (MECHANISM) | study/4 99 §D (Window functions) | placed |
| data-cte | CTE (MECHANISM) | study/4 99 §D (CTE · Recursive) | placed |
| data-upsert | 업서트 (MECHANISM) | study/4 19 시나리오① · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-prepared-statement | Prepared Statement (MECHANISM) | study/15 99 §A (cachePrepStmts) · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-json-table | JSON_TABLE · JSON 함수 | study/4 99 §E | excluded — 벤더 SQL 함수 목록이라 개념이 아니다(data-json-column 에 흡수) |
| data-spatial-functions | ST_* 공간 함수 · PostGIS | study/4 99 §E | excluded — 벤더 함수 · 확장 제품. 개념은 data-spatial-index |
| data-pg-tsvector | PG tsvector · tsquery | study/4 99 §E | excluded — PostgreSQL 한정 구현. 개념은 data-fulltext-index |
| data-storage-engine | 저장 엔진 내부 (STAGE) | study/4 06 · 99 §I | placed |
| data-buffer-pool | 버퍼 풀 (MECHANISM) | study/4 01 · 99 §I (Buffer pool) | placed |
| write-ahead-log | WAL (MECHANISM) | 운영 행 · study/4 99 §I (Redo log) | placed |
| data-undo-log | undo 로그 (MECHANISM) | study/4 06 (Undo Log) | placed |
| data-checkpoint | 체크포인트 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-doublewrite-buffer | 이중 쓰기 버퍼 (MECHANISM) | study/4 99 §I (Doublewrite buffer) | placed |
| data-crash-recovery | 장애 복구 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (ARIES) | placed |
| data-fsync | fsync 내구성 기록 (MECHANISM) | 치트시트 §05 (fsync · 내구성) | placed |
| data-group-commit | 그룹 커밋 (MECHANISM) | study/4 99 갭 17 · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-page-cache | OS 페이지 캐시 (MECHANISM) | 치트시트 §01 (file · 페이지 캐시) · §05 | placed |
| data-direct-io | Direct I/O (MECHANISM) | 치트시트 §05 (O_DIRECT) | placed |
| data-lsm-tree | LSM 트리 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-lsm-compaction | 컴팩션 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-torn-page | 찢어진 페이지 (PROBLEM) | study/4 99 §I (Doublewrite 의 이유) | placed |
| data-write-amplification | 쓰기 증폭 (PROBLEM) | study/4 01 (Write Amplification) | placed |
| data-buffer-pool-hit-ratio | 버퍼 풀 적중률 (METRIC) | study/4 01 (Buffer Pool 과 working set) | placed |
| data-row-format | 행 형식(DYNAMIC · COMPACT · COMPRESSED) | study/4 99 갭 14 | excluded — InnoDB 한정 설정값 |
| data-tablespace | 테이블스페이스 종류 | study/4 99 갭 15 | excluded — InnoDB 한정 파일 배치 설정 |
| data-buffer-pool-dump-load | 버퍼 풀 dump/load · NUMA | study/4 99 §I | excluded — 벤더 한정 운영 설정. 개념은 data-buffer-pool |
| data-iops | IOPS | 치트시트 §05 | excluded — owned by observability (obs-iops 로 MEASURED_BY) |
| data-iowait | iowait | 치트시트 §05 | excluded — owned by observability |
| data-mmap | read() vs mmap | 치트시트 §01 · §05 | excluded — owned by runtime (rt-mmap) |
| data-page-fault | 페이지 폴트(minor · major) | 치트시트 §01 | excluded — owned by observability (obs-major-page-faults) |
| data-io-scheduler | I/O 스케줄러 · 큐 깊이 | 치트시트 §05 | excluded — owned by observability (OS 성능 진단) |
| data-local-volume | 로컬 볼륨 · 단일 디스크 | 치트시트 §05 | excluded — owned by infrastructure |
| data-fs-bloat | 파일 시스템 부풀음 | 치트시트 §05 | excluded — owned by observability (obs-disk-fill) |
| data-indexing | 인덱스 설계 (STAGE) | 운영 행 · study/4 01 | placed |
| b-tree | B-트리 (MECHANISM) | 운영 행 · study/4 02 | placed |
| data-b-plus-tree | B+트리 (MECHANISM) | study/4 02 · 99 §A | placed |
| data-page-split | 페이지 분할 · 병합 (MECHANISM) | study/4 02 (page split · merge · fill factor) | placed |
| data-clustered-index | 클러스터드 인덱스 (MECHANISM) | study/4 03 · 99 §A | placed |
| data-secondary-index | 보조 인덱스 (MECHANISM) | study/4 03 | placed |
| data-covering-index | 커버링 인덱스 (MECHANISM) | study/4 10 · 99 §A | placed |
| data-composite-index | 복합 인덱스 (MECHANISM) | 운영 행 · study/4 10 | placed |
| data-unique-index | 유니크 인덱스 (MECHANISM) | study/4 14 Pattern B | placed |
| data-hash-index | 해시 인덱스 (MECHANISM) | study/4 04 · 99 §A | placed |
| data-adaptive-hash-index | 적응형 해시 인덱스 (MECHANISM) | study/4 99 §A (Adaptive Hash Index) | placed |
| data-fulltext-index | 전문 인덱스 (MECHANISM) | study/4 04 · 99 §E (Full-Text) | placed |
| data-spatial-index | 공간 인덱스 (MECHANISM) | study/4 04 (R-Tree) · 99 §A | placed |
| data-functional-index | 함수 기반 인덱스 (MECHANISM) | study/4 04 (함수 / 표현식 인덱스) | placed |
| data-partial-index | 부분 인덱스 (MECHANISM) | study/4 04 (Partial Index) | placed |
| data-bitmap-index | 비트맵 인덱스 (MECHANISM) | study/4 04 (Bitmap 인덱스) | placed |
| data-full-table-scan | 풀 테이블 스캔 (PROBLEM) | 운영 행 · study/4 09 (type=ALL) | placed |
| data-index-invalidation | 인덱스 무효화 (PROBLEM) | study/4 11 (안티패턴 1~7) | placed |
| data-over-indexing | 인덱스 과다 (PROBLEM) | study/4 01 (모든 컬럼에 인덱스 비용) | placed |
| data-secondary-lookup-cost | 보조 인덱스 재조회 비용 (PROBLEM) | study/4 03 (보조 인덱스 조회 2단계) | placed |
| data-query-latency | 쿼리 지연 (METRIC) | 운영 행 | placed |
| data-pg-index-types | GIN · GiST · BRIN · SP-GiST | study/4 99 §A | excluded — PostgreSQL 한정 인덱스 종류. 공간 · 부분 · 전문 인덱스로 개념은 덮는다 |
| data-query-optimization | 실행 계획 · 옵티마이저 (STAGE) | study/4 09 · 12 | placed |
| data-execution-plan | 실행 계획 읽기 (MECHANISM) | study/4 09 · 99 §D (EXPLAIN · ANALYZE · FORMAT=JSON) | placed |
| data-cost-based-optimizer | 비용 기반 옵티마이저 (MECHANISM) | study/4 12 (Cost Model) | placed |
| data-table-statistics | 테이블 통계 (MECHANISM) | study/4 12 (Persistent statistics · Index Dive) · 99 §D | placed |
| data-histogram | 히스토그램 (MECHANISM) | study/4 12 · 99 §D (Histograms) | placed |
| data-optimizer-hint | 옵티마이저 힌트 (MECHANISM) | study/4 12 · 99 §D (Optimizer hints) | placed |
| data-join-algorithm | 조인 알고리즘 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-nested-loop-join | 중첩 루프 조인 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-hash-join | 해시 조인 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (MySQL 8.0.18+) | placed |
| data-sort-merge-join | 정렬 병합 조인 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-index-condition-pushdown | 인덱스 조건 푸시다운 (MECHANISM) | study/4 09 · 10 · 99 §A (ICP) | placed |
| data-multi-range-read | 다중 범위 읽기 (MECHANISM) | study/4 10 · 99 §A (MRR) | placed |
| data-index-merge | 인덱스 병합 (MECHANISM) | study/4 10 (Index Merge) | placed |
| data-index-skip-scan | 인덱스 스킵 스캔 (MECHANISM) | study/4 10 (Index Skip Scan) | placed |
| data-keyset-pagination | 키셋 페이지네이션 (MECHANISM) | study/4 11 (OFFSET pagination) · 17 §3 | placed |
| data-slow-query-log | 슬로 쿼리 로그 (MECHANISM) | study/4 12 (Slow Query Log) · 99 §I | placed |
| data-plan-misestimate | 실행 계획 오판 (PROBLEM) | study/4 09 (예측과 실측 괴리) · 12 | placed |
| data-filesort-temp-table | 파일 정렬 · 임시 테이블 (PROBLEM) | study/4 09 패턴 7 (Using filesort) | placed |
| data-deep-offset-pagination | 깊은 OFFSET 페이지 (PROBLEM) | study/4 99 §1 (OFFSET pagination) | placed |
| data-rows-examined | 검사 행 수 (METRIC) | study/4 09 (rows · filtered) | placed |
| data-optimizer-trace | 옵티마이저 트레이스 | study/4 12 · 99 §D | excluded — 벤더 진단 도구. 개념은 data-cost-based-optimizer |
| data-query-rewriter | Query Rewriter · SQL Plan Management | study/4 99 §D | excluded — 벤더 플러그인 |
| data-performance-schema | Performance Schema · sys schema | study/4 99 §I | excluded — 벤더 진단 도구 |
| data-query-cache | MySQL 쿼리 캐시 | 분야 표준 | excluded — MySQL 8.0 에서 제거된 벤더 기능 |
| data-transaction-management | 트랜잭션 관리 (STAGE) | 운영 행 | placed |
| data-isolation-level | 격리 수준 (MECHANISM) | 운영 행 · study/4 05 | placed |
| data-read-uncommitted | READ UNCOMMITTED (MECHANISM) | study/4 05 · 99 §B | placed |
| data-read-committed | READ COMMITTED (MECHANISM) | study/4 05 · 99 §B | placed |
| data-repeatable-read | REPEATABLE READ (MECHANISM) | study/4 05 (InnoDB RR + Phantom 차단) | placed |
| data-snapshot-isolation | 스냅샷 격리 (MECHANISM) | study/4 99 §1 (snapshot isolation) | placed |
| data-serializable | SERIALIZABLE (MECHANISM) | study/4 05 (SERIALIZABLE 의 비용) | placed |
| data-serializable-snapshot-isolation | 직렬화 가능 스냅샷 격리 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (PostgreSQL SSI) | placed |
| data-mvcc | MVCC (MECHANISM) | 운영 행 · study/4 06 | placed |
| data-read-view | 읽기 뷰 (MECHANISM) | study/4 06 (Read View) | placed |
| data-consistent-read | 일관된 읽기 (MECHANISM) | study/4 06 · 99 §B (Consistent vs Locking Read) | placed |
| data-mvcc-purge | 옛 버전 정리 (MECHANISM) | study/4 06 (History list length) · 99 §I (PG vacuum) | placed |
| data-savepoint | 세이브포인트 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-read-anomaly | 읽기 이상 현상 (PROBLEM) | 운영 행 | placed |
| data-long-transaction | 긴 트랜잭션 (PROBLEM) | study/4 06 (Long TX 가 위험한 이유) · 08 MDL | placed |
| data-pg-hot | HOT (Heap-Only Tuple) | study/4 99 §B | excluded — PostgreSQL 한정 최적화 |
| data-2pc-xa | 2PC · XA | study/4 99 §B | excluded — owned by distributed (two-phase-commit) |
| data-saga | Saga 보상 트랜잭션 | study/4 99 §B | excluded — owned by distributed (saga-pattern) |
| data-transactional-propagation | @Transactional 전파 · readOnly | study/4 16 | excluded — owned by spring (spring-propagation) |
| data-concurrency-control | 동시 갱신 제어 (STAGE) | 운영 행 · study/4 19 | placed |
| optimistic-lock | 낙관적 락 (MECHANISM) | 운영 행 | placed |
| pessimistic-lock | 비관적 락 (MECHANISM) | 운영 행 | placed |
| data-conditional-update | 조건부 원자 갱신 (MECHANISM) | study/4 19 시나리오⑤ | placed |
| data-unique-constraint-guard | 유니크 제약 중복 차단 (MECHANISM) | study/4 19 시나리오① · §5.6 | placed |
| data-locking-read | 잠금 읽기 (MECHANISM) | study/4 05 · 07 (명시적 잠금 구문) | placed |
| data-lock-mode | 공유 · 배타 잠금 (MECHANISM) | study/4 07 (호환성 매트릭스) | placed |
| data-intention-lock | 의도 잠금 (MECHANISM) | study/4 07 · 99 §C (IS / IX) | placed |
| data-row-lock-range | 행 잠금 범위 (MECHANISM) | study/4 07 (Lock 범위) | placed |
| data-record-lock | 레코드 락 (MECHANISM) | study/4 07 · 99 §C | placed |
| data-gap-lock | 갭 락 (MECHANISM) | study/4 07 · 99 §C | placed |
| data-next-key-lock | 넥스트키 락 (MECHANISM) | study/4 07 · 99 §C | placed |
| data-insert-intention-lock | 삽입 의도 락 (MECHANISM) | study/4 07 (Insert Intention Lock) | placed |
| data-two-phase-locking | 2단계 잠금 (MECHANISM) | study/4 99 §B (2PL) | placed |
| data-metadata-lock | 메타데이터 락 (MECHANISM) | study/4 08 · 99 §C (MDL) | placed |
| data-auto-inc-lock | 자동 증가 잠금 (MECHANISM) | study/4 07 · 08 · 99 §C (Auto-increment lock modes) | placed |
| data-advisory-lock | 명명 잠금 (MECHANISM) | study/4 21 §6-3 (advisory lock) | placed |
| data-lock-ordering | 잠금 순서 고정 (MECHANISM) | 운영 행 · study/4 21 §7 | placed |
| data-deadlock-detection | DB 교착 감지 (MECHANISM) | study/4 08 · 21 §3 (Wait-For Graph · SHOW ENGINE INNODB STATUS) | placed |
| data-lock-wait-timeout | 잠금 대기 제한 (MECHANISM) | study/4 07 · 08 · 99 §C (Lock wait timeout) | placed |
| data-skip-locked | SKIP LOCKED 작업 나눠 갖기 (MECHANISM) | 운영 행 · study/4 07 케이스 4 | placed |
| data-lost-update | 갱신 손실 (PROBLEM) | 운영 행 · study/4 99 §B | placed |
| data-duplicate-insert | 중복 삽입 경쟁 (PROBLEM) | study/4 19 §5.6 (Check-Then-Act) | placed |
| data-metadata-lock-chain | 메타데이터 락 대기 사슬 (PROBLEM) | study/4 08 (MDL 사슬) | placed |
| data-lock-wait-time | 행 잠금 대기 시간 (METRIC) | study/4 21 §4-5 (data_lock_waits) · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-coffman-conditions | 교착 4조건(Coffman) | study/4 21 §2 | excluded — owned by concurrency (conc-coffman-conditions) |
| data-distributed-lock | 분산 락 · 크로스 서비스 mutex | study/4 19 시나리오④ | excluded — owned by distributed (distributed-lock) |
| data-idempotency-key | HTTP 멱등 키 · processed_event | study/4 19 시나리오⑦ · 16 | excluded — owned by distributed (idempotency) |
| data-object-mapping | 객체-테이블 매핑 (STAGE) | 운영 행 | placed |
| orm | ORM (MECHANISM) | 운영 행 | placed |
| hibernate | Hibernate (TECHNOLOGY) | 운영 행 | placed |
| data-lazy-loading | 지연 로딩 (MECHANISM) | 운영 행 | placed |
| data-fetch-join | 페치 조인 (MECHANISM) | 운영 행 | placed |
| data-dirty-checking | 변경 감지 (MECHANISM) | 운영 행 (영속성 컨텍스트 동의어에서 분리) | placed |
| data-query-builder | 타입 안전 쿼리 빌더 (MECHANISM) | 운영 행 | placed |
| querydsl | Querydsl (TECHNOLOGY) | 운영 행 | placed |
| data-jdbc-batch | 배치 쓰기 (MECHANISM) | study/15 99 §A (rewriteBatchedStatements) | placed |
| data-bulk-update | 벌크 갱신 (MECHANISM) | study/4 15 Pattern 6 (Bulk DELETE) | placed |
| data-second-level-cache | 2차 캐시 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (JPA) | placed |
| n-plus-one | N+1 문제 (PROBLEM) | 운영 행 · study/4 11 | placed |
| data-collection-fetch-paging | 컬렉션 페치 조인 페이징 (PROBLEM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (JPA) | placed |
| data-queries-per-request | 요청당 쿼리 수 (METRIC) | 운영 행 | placed |
| data-osiv | Open Session In View | 분야 표준(JPA) | excluded — owned by spring (spring-open-session-in-view) |
| data-handling-mode | hibernate.connection.handling_mode | study/15 99 §C | excluded — 벤더 한정 설정값. 개념은 data-lazy-connection-acquisition |
| data-schema-migration | 스키마 변경 관리 (STAGE) | 운영 행 | placed |
| data-versioned-migration | 버전 마이그레이션 (MECHANISM) | 운영 행 | placed |
| flyway | Flyway (TECHNOLOGY) | 운영 행 | placed |
| data-schema-validation | 스키마 검증 (MECHANISM) | 운영 행 | placed |
| data-expand-contract | 확장-축소 마이그레이션 (MECHANISM) | study/4 13 (운영 절차 · Flyway 결합) · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-online-ddl | 온라인 DDL (MECHANISM) | study/4 13 · 20 · 99 §H (INSTANT/INPLACE/COPY · LOCK=) | placed |
| data-shadow-table-migration | 그림자 테이블 마이그레이션 (MECHANISM) | study/4 13 · 20 · 99 §H (gh-ost · pt-osc) | placed |
| data-schema-drift | 스키마 불일치 (PROBLEM) | 운영 행 | placed |
| data-ddl-write-block | DDL 쓰기 정지 (PROBLEM) | study/4 20 §2 (DDL = full table lock) | placed |
| data-pg-repack | pg_repack · REINDEX CONCURRENTLY | study/4 20 §6 · 99 §H | excluded — PostgreSQL 한정 도구. 개념은 data-online-ddl · data-mvcc-purge |
| data-replication-ha | DB 복제 · 고가용성 (STAGE) | study/4 99 §G | placed |
| data-binlog | 바이너리 로그 (MECHANISM) | study/4 99 §G · 갭 22 | placed |
| data-binlog-format | binlog 형식 (MECHANISM) | study/4 99 §G (SBR/RBR/MIXED) | placed |
| data-async-replication | 비동기 복제 (MECHANISM) | study/4 99 §G (Async) | placed |
| data-semi-sync-replication | 반동기 복제 (MECHANISM) | study/4 99 §G (Semi-sync) | placed |
| data-gtid | GTID (MECHANISM) | study/4 99 §G (GTID) | placed |
| data-group-replication | 그룹 복제 (MECHANISM) | study/4 99 §G (Group Replication · InnoDB Cluster · Galera) | placed |
| data-db-failover | DB 페일오버 (MECHANISM) | study/15 08 (DB Failover 시 stale connection) · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-replication-lag | 복제 지연 (PROBLEM) | 운영 행 · study/15 10 | placed |
| data-read-your-writes | 쓰기 후 원본 읽기(read-after-write) | study/4 16 · study/15 10 | excluded — owned by distributed (dist-read-your-writes-routing 을 USES) |
| data-cdc | 변경 데이터 캡처(CDC · Debezium · logical replication) | study/4 99 §G · 갭 25 | excluded — owned by distributed (dist-cdc 를 USES) |
| data-parallel-applier | 병렬 복제 적용기 | study/4 99 갭 17 | excluded — 벤더 한정 설정(replica_parallel_workers). 개념은 data-replication-lag |
| data-replication-slot | PG WAL · replication slot | study/4 99 §I | excluded — PostgreSQL 한정 구현. 개념은 data-binlog |
| data-partitioning | 파티셔닝 · 데이터 수명 (STAGE) | study/4 99 §F | placed |
| data-table-partitioning | 테이블 파티셔닝 (MECHANISM) | study/4 99 §F (RANGE/LIST/HASH/KEY) | placed |
| data-list-partitioning | 목록 파티셔닝 (MECHANISM) | study/4 99 §F (LIST) | placed |
| data-range-partitioning | 범위 파티셔닝 | study/4 99 §F (RANGE) | excluded — owned by distributed (dist-range-partitioning 을 USES) |
| data-hash-partitioning | 해시 파티셔닝 | study/4 99 §F (HASH/KEY) | excluded — owned by distributed (dist-hash-partitioning 을 USES) |
| data-sharding | 샤딩 · Vitess · Citus | study/4 99 §F | excluded — owned by distributed (sharding 과 ALTERNATIVE_TO) |
| data-partition-pruning | 파티션 프루닝 (MECHANISM) | study/4 99 §F (Partition pruning) | placed |
| data-retention-purge | 보존 기간 정리 (MECHANISM) | docs/adr ADR-0077 · study/4 17 §4 | placed |
| data-backup-recovery | 백업 · 복구 (STAGE) | study/4 99 §I (Backup · PITR) | placed |
| data-logical-backup | 논리 백업 (MECHANISM) | study/4 99 §I (mysqldump) | placed |
| data-physical-backup | 물리 백업 (MECHANISM) | study/4 99 §I (Xtrabackup) | placed |
| data-pitr | 시점 복구 (MECHANISM) | study/4 99 §I (PITR — binlog) | placed |
| data-data-loss | 데이터 유실 (PROBLEM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-offsite-backup | 원격 사본 보관 | 레포 k8s/base/db-backup | excluded — owned by infrastructure (infra-offsite-backup) |
| data-rpo | RPO | CLAUDE.md 백업/복구 | excluded — owned by infrastructure (infra-rpo 로 MEASURED_BY) |
| data-rto | RTO | 분야 표준 | excluded — owned by infrastructure (infra-rto 로 MEASURED_BY) |
| data-inmemory-store | 인메모리 저장소 (DOMAIN) | study/9 00-preview | placed |
| data-redis-execution-model | Redis 실행 모델 (STAGE) | study/9 01 | placed |
| data-redis-single-thread | 단일 스레드 이벤트 루프 (MECHANISM) | study/9 01 §1~2 | placed |
| data-redis-io-threads | I/O 스레드 (MECHANISM) | study/9 01 §3 | placed |
| data-resp | RESP 프로토콜 (MECHANISM) | study/9 01 §5 · 99 §H (RESP2 · RESP3 · HELLO) | placed |
| data-pipelining | 파이프라이닝 (MECHANISM) | study/9 15 §1 · 99 §D | placed |
| data-client-side-caching | 클라이언트 측 캐시 (MECHANISM) | study/9 99 §H (Client Side Caching) | placed |
| data-blocking-command | 긴 명령에 의한 전체 정지 (PROBLEM) | study/9 01 §4 · 16 §3 | placed |
| data-redis-command-latency | Redis 명령 지연 (METRIC) | study/9 16 §6 · 99 §I (LATENCY · SLOWLOG) | placed |
| data-redis-data-modeling | Redis 자료구조 선택 (STAGE) | study/9 02 | placed |
| data-redis-string | Redis String (MECHANISM) | study/9 02 §2 · 99 §A | placed |
| data-sds | SDS (MECHANISM) | study/9 03 §1 | placed |
| data-redis-list | Redis List (MECHANISM) | study/9 02 §3 · 99 §A | placed |
| data-quicklist | quicklist (MECHANISM) | study/9 04 §3 | placed |
| data-redis-hash | Redis Hash (MECHANISM) | study/9 02 §4 · 99 §A | placed |
| data-redis-dict | 점진적 재해싱 해시 표 (MECHANISM) | study/9 04 §1 · §7 (rehashing) | placed |
| data-redis-set | Redis Set (MECHANISM) | study/9 02 §5 · 99 §A | placed |
| data-intset | intset (MECHANISM) | study/9 03 §3 | placed |
| data-redis-sorted-set | Redis Sorted Set (MECHANISM) | study/9 02 §6 · 04 §2 | placed |
| data-redis-bitmap | Redis Bitmap (MECHANISM) | study/9 02 §7 | placed |
| data-redis-hyperloglog | Redis HyperLogLog (MECHANISM) | study/9 02 §8 | placed |
| data-redis-geo | Redis Geo (MECHANISM) | study/9 99 §A (Geo) | placed |
| data-redis-stream | Redis Stream (MECHANISM) | study/9 02 §9 · 14 | placed |
| data-listpack | listpack (MECHANISM) | study/9 03 §2 · 99 §A (ziplist/listpack) | placed |
| data-big-key | 빅 키 (PROBLEM) | study/9 16 §1 | placed |
| data-hot-key | 핫 키 (PROBLEM) | study/9 16 §2 | placed |
| data-geohash | 지오해시 | study/9 99 §A (Geo) | excluded — owned by search (srch-geohash 를 USES) |
| data-redis-modules | RedisJSON · RediSearch · RedisTimeSeries · RedisBloom · RedisGears | study/9 99 §J | excluded — 레포에 없는 벤더 모듈. 확률 구조 개념은 cs-fundamentals |
| data-object-encoding | OBJECT ENCODING · MEMORY USAGE 명령 | study/9 99 §I | excluded — 벤더 명령. 개념은 data-listpack · data-redis-memory-usage |
| data-redis-memory-management | 메모리 · 만료 관리 (STAGE) | study/9 05 | placed |
| data-expiry-algorithm | 만료 처리 방식 (MECHANISM) | study/9 05 §2 · 99 갭 22 | placed |
| data-eviction-policy | eviction 정책 (MECHANISM) | study/9 05 §3 · 99 갭 21 (8 종) | placed |
| data-approximate-lru | 근사 LRU (MECHANISM) | study/9 05 §3 | placed |
| data-lfu-eviction | LFU 내보내기 (MECHANISM) | study/9 05 §3 | placed |
| data-lazy-free | 비동기 해제 (MECHANISM) | study/9 05 §6 · 18 P0-5 | placed |
| data-active-defrag | 능동 조각 모음 (MECHANISM) | study/9 04 §8 | placed |
| data-maxmemory-reached | 메모리 한도 도달 (PROBLEM) | study/9 18 P0-1 | placed |
| data-memory-fragmentation | 메모리 단편화 (PROBLEM) | study/9 16 §4 | placed |
| data-redis-memory-usage | Redis 메모리 사용량 (METRIC) | study/9 05 §4 · 99 §I (MEMORY STATS) | placed |
| data-redis-persistence | Redis 영속화 (STAGE) | study/9 06 · 07 | placed |
| data-rdb-snapshot | RDB 스냅샷 (MECHANISM) | study/9 06 · 99 §B | placed |
| data-aof | AOF (MECHANISM) | study/9 07 · 99 §B | placed |
| data-aof-fsync-policy | AOF fsync 정책 (MECHANISM) | study/9 07 §2 | placed |
| data-aof-rewrite | AOF 재작성 (MECHANISM) | study/9 07 §3~4 · 99 갭 34 | placed |
| data-hybrid-persistence | 혼합 영속화 (MECHANISM) | study/9 07 §5 · 99 §B | placed |
| data-fork-copy-on-write | fork 와 copy-on-write (MECHANISM) | study/9 06 §2 | placed |
| data-cow-memory-spike | 스냅샷 중 메모리 급증 (PROBLEM) | study/9 16 §5 | placed |
| data-redis-ha-scaling | Redis 복제 · 클러스터 (STAGE) | study/9 08 · 09 | placed |
| data-redis-replication | Redis 복제 (MECHANISM) | study/9 08 §1 · 99 §C | placed |
| data-redis-wait | WAIT 복제 확인 (MECHANISM) | study/9 08 §5 · 99 갭 26 | placed |
| data-sentinel | Sentinel (MECHANISM) | study/9 08 §3~4 · 99 §C | placed |
| data-redis-cluster | Redis Cluster (MECHANISM) | study/9 09 · 99 §C | placed |
| data-hash-slot | 해시 슬롯 (MECHANISM) | study/9 09 §2 · 99 갭 7 | placed |
| data-hash-tag | 해시 태그 (MECHANISM) | study/9 99 §C (Hash tag) · 18 P0-4 | placed |
| data-cluster-redirect | MOVED · ASK 리다이렉트 (MECHANISM) | study/9 09 §3 · 99 §C (MOVED/ASK) | placed |
| data-resharding | 리샤딩 (MECHANISM) | study/9 99 §C (Resharding) | placed |
| data-cross-slot-error | CROSSSLOT 오류 (PROBLEM) | study/9 09 §6 (multi-key 한계) | placed |
| data-redis-failover-write-loss | 페일오버 쓰기 유실 (PROBLEM) | study/9 08 §2 | placed |
| data-active-active-crdb | Active-Active CRDB | study/9 99 §C | excluded — 벤더 상용 기능. CRDT 개념은 distributed |
| data-redis-read-from-replica | READONLY · Lettuce ReadFrom | study/9 99 §C · study/15 99 §F | excluded — 클라이언트 설정값. 개념은 data-read-replica-routing |
| data-redis-atomic-execution | 원자 실행 · 락 (STAGE) | study/9 15 · 12 | placed |
| data-redis-atomic-counter | 원자 카운터 (MECHANISM) | study/9 17 §5~8 · 운영 행 (레포 사용처) | placed |
| data-multi-exec | MULTI/EXEC 트랜잭션 (MECHANISM) | study/9 15 §4 · 99 §D | placed |
| data-watch-cas | WATCH 낙관적 잠금 (MECHANISM) | study/9 15 §4 · 99 §D (WATCH) | placed |
| data-lua-script | Lua 스크립트 (MECHANISM) | study/9 15 §2 · 17 §7 | placed |
| data-redis-functions | Redis Functions (MECHANISM) | study/9 15 §3 · 99 §D (Functions) | placed |
| data-redis-set-nx | SET NX 선점 키 (MECHANISM) | study/9 12 · 99 §F (SET NX EX) | placed |
| data-redlock | Redlock · Redisson | study/9 13 · 99 §F | excluded — owned by distributed (dist-redlock) |
| data-fencing-token | 펜싱 토큰 | study/9 13 §3 | excluded — owned by distributed (dist-fencing-token) |
| data-redis-messaging | Redis 메시지 전달 (STAGE) | study/9 14 · 15 | placed |
| data-redis-pubsub | Redis Pub/Sub (MECHANISM) | study/9 15 §5 · 99 §E | placed |
| data-stream-consumer-group | Stream 소비자 그룹 (MECHANISM) | study/9 14 · 99 §E (XACK · XPENDING · XCLAIM) | placed |
| data-keyspace-notification | 키 공간 알림 (MECHANISM) | study/9 99 §I (Keyspace notifications) | placed |
| data-redis-acl-tls | Redis ACL · TLS · AUTH | study/9 99 §G | excluded — owned by security (접근 제어 · TLS 개념) |
| data-client-options | CLIENT NO-EVICT · REPLY OFF | study/9 99 §H | excluded — 벤더 운영 명령 |
| data-access | 데이터 접근 · 캐시 (DOMAIN) | study/15 00-preview | placed |
| data-connection-management | 커넥션 관리 (STAGE) | 운영 행 · study/15 01 | placed |
| connection-pool | 커넥션 풀 (MECHANISM) | 운영 행 · study/15 01 | placed |
| hikaricp | HikariCP (TECHNOLOGY) | 운영 행 · study/15 03 | placed |
| data-concurrent-bag | ConcurrentBag (MECHANISM) | study/15 04 | placed |
| data-pool-sizing | 풀 크기 산정 (MECHANISM) | study/15 07 · 99 §B | placed |
| data-acquire-timeout | 대여 대기 제한 (MECHANISM) | study/15 02 §6 (connectionTimeout) | placed |
| data-connection-lifetime | 커넥션 수명 제한 (MECHANISM) | study/15 02 §3~4 · 06 · 99 갭 26~27 | placed |
| data-connection-keepalive | 커넥션 keepalive (MECHANISM) | study/15 02 §5 · 06 | placed |
| data-connection-validation | 커넥션 검증 (MECHANISM) | study/15 02 §7 · 99 갭 6 | placed |
| data-connection-leak-detection | 커넥션 누수 감지 (MECHANISM) | study/15 02 §8 · 06 · 99 갭 7 | placed |
| data-statement-cache | Statement 캐시 (MECHANISM) | study/15 99 §A (cachePrepStmts · useServerPrepStmts) | placed |
| data-read-replica-routing | 읽기 복제본 라우팅 (MECHANISM) | 운영 행 · study/15 09 | placed |
| data-lazy-connection-acquisition | 커넥션 늦게 잡기 (MECHANISM) | study/15 09 · 99 §C (LazyConnectionDataSourceProxy) | placed |
| data-external-pooler | 외부 커넥션 풀러 (MECHANISM) | study/15 07 · 99 §D (PgBouncer · ProxySQL · RDS Proxy) | placed |
| data-multiplexed-connection | 다중화 연결 (MECHANISM) | study/15 11 · 99 §F (Lettuce · Jedis) | placed |
| data-reactive-db-driver | 논블로킹 DB 드라이버 (MECHANISM) | study/15 13 · 99 §E (R2DBC) | placed |
| data-pool-exhaustion | 커넥션 풀 고갈 (PROBLEM) | 운영 행 · study/15 08 | placed |
| data-connection-leak | 커넥션 누수 (PROBLEM) | study/15 08 (Connection Leak) | placed |
| data-stale-connection | 죽은 커넥션 (PROBLEM) | study/15 08 · 99 §G | placed |
| data-connection-storm | 커넥션 폭주 (PROBLEM) | study/15 99 §G (Connection storm) | placed |
| data-max-connections-exceeded | DB 연결 한도 초과 (PROBLEM) | study/15 07 · 08 원인 4 | placed |
| data-pool-wait-time | 커넥션 대기 시간 (METRIC) | 운영 행 · study/15 14 | placed |
| data-pool-utilization | 풀 사용률 (METRIC) | study/15 14 · 99 §H (active · idle · pending) | placed |
| data-suspend-resume | SuspendResumeLock · ConnectionCustomizer | study/15 99 §A | excluded — HikariCP 한정 API |
| data-fastlist-proxy | FastList · ProxyConnection | study/15 05 | excluded — HikariCP 내부 구현 세부. 개념은 data-concurrent-bag |
| data-pool-products | Tomcat JDBC · DBCP2 | study/15 03 · 99 갭 10 | excluded — 레포에 없는 제품 |
| data-multi-tenant-routing | 멀티테넌트 DataSource 라우팅 | study/15 99 §C | excluded — data-read-replica-routing 과 같은 라우팅 장치의 다른 키라 설명에 흡수 |
| data-transaction-aware-proxy | TransactionAwareDataSourceProxy | study/15 99 §C | excluded — owned by spring |
| data-littles-law | Little 의 법칙 | study/15 07 | excluded — owned by observability (obs-littles-law 를 USES) |
| data-tls-handshake-cost | TLS 핸드셰이크 비용 | study/15 99 §G | excluded — owned by network (ssl-tls) |
| data-caching-strategy | 캐시 전략 (STAGE) | 운영 행 · study/9 10 | placed |
| caching | 캐싱 (MECHANISM) | 운영 행 | placed |
| data-cache-aside | cache-aside (MECHANISM) | study/9 10 §1 · 운영 행 (caching 동의어에서 분리) | placed |
| data-read-through | read-through (MECHANISM) | study/9 10 §2 | placed |
| data-write-through | write-through (MECHANISM) | study/9 10 §3 | placed |
| data-write-behind | write-behind (MECHANISM) | study/9 10 §4 | placed |
| data-refresh-ahead | refresh-ahead (MECHANISM) | study/9 10 §5 · 11 §5 | placed |
| data-local-cache | 로컬 캐시 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) · 레포 Caffeine | placed |
| data-multi-level-cache | 다단 캐시 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-cache-invalidation | 캐시 무효화 (MECHANISM) | study/9 10 §7 | placed |
| data-ttl-expiration | TTL 만료 (MECHANISM) | 운영 행 · study/9 05 | placed |
| data-ttl-jitter | TTL 지터 (MECHANISM) | study/9 11 §2 · 99 §F | placed |
| data-single-flight | 단일 재계산 (MECHANISM) | study/9 11 §3 · §6 | placed |
| data-probabilistic-early-expiration | 확률적 조기 갱신 (MECHANISM) | study/9 11 §4 (XFetch) | placed |
| data-negative-caching | 부정 캐싱 (MECHANISM) | study/9 99 §F (Negative caching) | placed |
| data-stale-cache | 캐시 불일치 (PROBLEM) | 운영 행 | placed |
| data-cache-stampede | 캐시 스탬피드 (PROBLEM) | 운영 행 · study/9 11 | placed |
| data-cache-penetration | 캐시 관통 (PROBLEM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-cache-avalanche | 캐시 사태 (PROBLEM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-analytical-storage | 분석용 저장 (STAGE) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) · 레포 ClickHouse | placed |
| data-columnar-storage | 컬럼 지향 저장 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-column-compression | 컬럼 압축 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (ClickHouse 문서) | placed |
| data-vectorized-execution | 벡터화 실행 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (ClickHouse 문서) | placed |
| data-mergetree | MergeTree (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (ClickHouse 문서) · 레포 마이그레이션 | placed |
| data-sparse-primary-index | 희소 기본 인덱스 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (ClickHouse 문서) | placed |
| data-materialized-view | 머티리얼라이즈드 뷰 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) · 레포 마이그레이션 | placed |
| data-pre-aggregation | 사전 집계 (MECHANISM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-olap-point-mutation | 분석 저장소의 행 단위 변경 (PROBLEM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) (ClickHouse 문서) | placed |
| data-glossary | 데이터 저장 용어 사전 (TERM) | 운영 행 | placed |
| data-glossary-modeling | 모델링 · SQL 용어 (TERM) | 구조 노드 | placed |
| data-relational-model | 관계형 모델 (TERM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-normal-form | 정규형 (TERM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-er-model | ER 모델 (TERM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-surrogate-key | 대리 키 (TERM) | study/4 03 (권장 PK 패턴) | placed |
| data-natural-key | 자연 키 (TERM) | study/4 14 Pattern B | placed |
| data-join-types | 조인 종류 (TERM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-three-valued-logic | 3값 논리 (TERM) | study/4 11 §5 (IS NULL) · 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-glossary-transaction | 트랜잭션 · 이상 현상 용어 (TERM) | 구조 노드 | placed |
| data-transaction | 트랜잭션 (TERM) | 운영 행 | placed |
| acid | ACID (TERM) | 운영 행 · study/4 05 | placed |
| data-autocommit | 자동 커밋 (TERM) | study/15 99 갭 8 (autoCommit) | placed |
| data-dirty-read | 더티 리드 (TERM) | 운영 행 | placed |
| data-non-repeatable-read | 반복 불가능한 읽기 (TERM) | 운영 행 | placed |
| data-phantom-read | 팬텀 읽기 (TERM) | 운영 행 | placed |
| data-write-skew | 쓰기 왜곡 (TERM) | study/4 99 §B (Write skew) | placed |
| data-lock-escalation | 잠금 확대 (TERM) | study/4 07 (Lock Escalation) | placed |
| data-glossary-storage | 저장 · 입출력 용어 (TERM) | 구조 노드 | placed |
| data-page | 페이지 (TERM) | study/4 06 (페이지 구조 16 KiB) | placed |
| data-dirty-page | 더티 페이지 (TERM) | 치트시트 §01 (dirty page · writeback) · §05 (dirty_ratio) | placed |
| data-lsn | LSN (TERM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-sequential-random-io | 순차 · 랜덤 I/O (TERM) | 치트시트 §05 (순차 vs 랜덤 · IOPS) | placed |
| data-oltp | OLTP (TERM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-olap | OLAP (TERM) | 분야 표준(DDIA · MySQL 8.4 레퍼런스) | placed |
| data-glossary-index | 인덱스 · 실행 계획 용어 (TERM) | 구조 노드 | placed |
| data-cardinality | 카디널리티 (TERM) | 운영 행 · study/4 12 | placed |
| data-selectivity | 선택도 (TERM) | study/4 01 (selectivity) · 운영 행 (카디널리티 동의어에서 분리) | placed |
| data-fanout | 팬아웃 (TERM) | study/4 02 (fanout) | placed |
| data-sargable | SARGable 조건 (TERM) | study/4 11 | placed |
| data-leftmost-prefix | 최좌측 접두 규칙 (TERM) | study/4 10 (Leftmost Prefix 룰) · 운영 행 (복합 인덱스 동의어에서 분리) | placed |
| data-access-type | 접근 방식 (TERM) | study/4 09 (type) | placed |
| data-glossary-orm | ORM 용어 (TERM) | 구조 노드 | placed |
| data-entity | 엔티티(JPA) (TERM) | 운영 행 | placed |
| data-persistence-context | 영속성 컨텍스트 (TERM) | 운영 행 | placed |
