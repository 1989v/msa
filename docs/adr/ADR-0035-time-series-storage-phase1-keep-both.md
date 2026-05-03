# ADR-0035: 시계열 저장소 — Phase 1 분리 유지, Phase 2 통합 재검토

- **Status**: Accepted
- **Date**: 2026-05-04
- **Deciders**: kgd
- **Related**: ADR-0033, ADR-0034, charting/docs/adr/ADR-002 (pgvector 선택)

## Context

ADR-0033 (full merge) 결정 후 시계열 저장소 통합 여부를 결정해야 한다.

| 저장소 | 강점 | 약점 | 현재 사용처 |
|---|---|---|---|
| **ClickHouse** | 컬럼 지향 OLAP, 시계열 압축/집계 빠름, 대량 데이터 처리 | vector search 미성숙 (실험 단계) | quant 의 candle 시세 |
| **PostgreSQL + pgvector** | HNSW vector cosine 검색 정석, 일반 SQL workload OK | 시계열 압축이 ClickHouse 대비 약함 | charting 의 32차원 패턴 임베딩 |

통합 옵션:
1. PostgreSQL+TimescaleDB+pgvector — 한 DB로 시계열+벡터 동시
2. ClickHouse only — vector search 미성숙
3. 둘 다 유지 — 운영 복잡 ↑

## Decision

**Phase 1: 둘 다 유지** (ClickHouse 시계열 + pgvector 임베딩 분리). **Phase 2** 에서 데이터
볼륨/접근 패턴 측정 후 통합 ADR 로 재검토.

### 도메인별 사용

| 데이터 | 저장소 | 테이블 |
|---|---|---|
| OHLCV 시세 (자산 무관) | ClickHouse | `quant.ohlcv` |
| 시그널 평가 이력 | ClickHouse | `quant.signal_eval` |
| 환율 proxy 시세 (USDT/KRW) | ClickHouse | `quant.fx_proxy_tick` |
| 백테스트 run 메타 | MySQL | `signal_strategy_run`, `tranche_strategy_run` |
| 32차원 패턴 임베딩 | PostgreSQL + pgvector | `quant_pattern` (rename from `pattern`) |
| 도메인 (strategy, indicator_content) | MySQL | `strategy`, `indicator_content`, ... |

### 비고려 옵션

- **PostgreSQL+TimescaleDB+pgvector 단일** — 시계열 분석 성능 트레이드오프. 빗썸 candle
  대량 ingest 시 ClickHouse 컬럼 압축 우위 포기. Phase 1 단순화에는 매력적이나 백테스트
  성능 영향 측정 없이 결정하는 위험 큼.
- **ClickHouse only** — vector search 가 실험 단계. cosine 정확도/성능/HNSW index 미보장.
  pgvector 의 성숙도/생태계 포기.

## Consequences

### Positive

- 각 저장소의 강점 보존 (ClickHouse 시계열 / pgvector 벡터)
- 마이그레이션 표면 ↓ — 기존 quant ClickHouse + 기존 charting pgvector 모두 그대로 사용
- Phase 2 측정 데이터 기반 의사결정 → 잘못된 통합 비용 회피

### Negative

- 운영 표면 ↑ — 두 DB 의 백업/모니터링/스키마 마이그레이션 별도
- Cross-store 조회 시 application 레이어 join 필요 (예: 패턴 검색 결과의 자산 OHLCV 추가 조회)
- Phase 2 통합 결정 시 데이터 마이그레이션 비용 (현 시점 부채로 인식)

### Mitigations

- Application 레이어에서 두 저장소 쿼리를 캡슐화 (`OhlcvRepositoryPort` + `PatternEmbeddingRepositoryPort`)
- Phase 2 진입 전 측정 메트릭 정의:
  - ClickHouse `quant.ohlcv` 일별 row 증가량
  - pgvector `quant_pattern` 검색 P99 latency
  - cross-store 조회 빈도
- 측정 결과로 Phase 2 통합 ADR 의사결정 입력값 확보

## Phase 2 재검토 트리거

다음 중 하나라도 발생 시 통합 ADR 작성:

1. ClickHouse `quant.ohlcv` 일별 증가량이 단일 PostgreSQL 노드 한계의 70% 초과
2. cross-store 조회가 strategy 평가의 P95 latency 의 30% 이상 차지
3. pgvector 의 vector size 가 256+ 으로 증가 (ClickHouse vector extension 성숙도가 더 빠를 가능성)
4. 운영 부담으로 단일화 요구가 사용자/오너에게서 제기

## References

- [Spec](../specs/2026-05-04-quant-unified-platform/planning/spec.md) §3 / §11
- ADR-0033 (Quant 통합 플랫폼)
- ADR-0034 (Kotlin 단일 + Python ingest)
- charting/docs/adr/ADR-002 (pgvector over Elasticsearch)
