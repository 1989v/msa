# Search Quality — Baseline (2026-05-19)

ADR-0050 Phase 1 ramp 전 baseline. 후속 PR/ramp 의 회귀/효과 비교 기준점.

## 활성화 상태 (커밋 시점)

| Signal | weight | 활성? |
|---|---|---|
| popularityScore | 10.0 | ✅ (기존) |
| ctr (smoothed=false) | 5.0 | ✅ (기존) |
| cvr | 0.0 | ❌ |
| gmv7d / gmv30d | 0.0 | ❌ (필드만 적재) |
| freshness gauss | 0.0 | ❌ |
| tiebreaker | sort `[_score desc, id asc]` | ✅ (신규 적용) |
| Thompson MAB rerank | enabled=true, topN=100, hybrid=0.8 | ✅ (기존, ADR-0043) |
| Seller diversity | — | Phase 3 |
| Multi-scope MAB | category 단일 | Phase 3 |

## function_score 함수 순서 (활성화 시)

```
1. fieldValueFactor(popularityScore, log1p, weight=10) × 1.0
2. fieldValueFactor(ctr, log1p, weight=5) × 1.0
3. [opt] fieldValueFactor(cvr, log1p, weight=cvrWeight) × 1.0
4. [opt] fieldValueFactor(gmv7d, log1p, weight=gmv7dWeight) × 1.0
5. [opt] fieldValueFactor(gmv30d, log1p, weight=gmv30dWeight) × 1.0
6. [opt] gauss(createdAt, origin=now, scale=14d, decay=0.5) × freshness.weight
scoreMode=Sum, boostMode=Sum
```

## Tiebreaker 검증

- 동일 query 재호출 → 결과 순서 100% 일치 (sort: `[_score desc, id asc]`)
- 페이지네이션 안정성 (eventually consistent ES partial update 후에도 안정)

## TODO — Phase 2 ramp 전 측정 (운영 환경에서 수행)

| 항목 | 측정 방법 | 기대값 |
|---|---|---|
| Latency P50 / P95 / P99 | actuator/prometheus → Grafana | ADR-0025 Tier 1 (200ms P99) 이내 |
| 일평균 쿼리량 | search.requests.count | — |
| _score 분포 | 50 sample queries spot-check | — |
| 신상품 (createdAt < 30d) top-20 노출률 | sample queries | freshness ramp 후 비교 기준 |
| Unique seller @20 | sample queries | Phase 3 diversity ramp 후 비교 기준 |

## 측정 시나리오 (50 query sample set)

> 후속 PR 에서 judgment set (Phase 4) 의 약지도 부트스트랩 query 와 통합 예정.

(샘플 query list 는 Phase 4 P4-T2 에서 ClickHouse `search_judgments` 테이블에 적재 후 본 문서에서 참조)

## 출처

- 코드: `search/app/src/main/kotlin/com/kgd/search/elasticsearch/{ProductSearchAdapter,RankingProperties}.kt` (커밋 후 추적)
- ADR: `docs/adr/ADR-0050-search-quality-roadmap.md`
- Spec: `docs/specs/2026-05-19-search-quality-improvements/`
