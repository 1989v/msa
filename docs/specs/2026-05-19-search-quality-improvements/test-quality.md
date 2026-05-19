<!-- source: search -->
# Test Quality Strategy — Search Quality Improvements

표준: `docs/standards/test-rules.md` — Kotest BehaviorSpec + MockK.

## 1. 테스트 계층

### Domain Layer (search:domain)
| 대상 | 테스트 | 도구 |
|---|---|---|
| `BanditKey` 확장 (scope 일반화) | unit (BehaviorSpec) | Kotest |
| `BanditState` 시간 감쇠 계산 | unit | Kotest |
| 베이지안 스무딩 계산 함수 (analytics 측이지만 도메인 순수 함수) | property test | Kotest property |

### Application Layer (search:app)
| 대상 | 테스트 | 도구 |
|---|---|---|
| `ThompsonReranker` (기존) | regression — 기존 test 유지 | Kotest + MockK |
| `MultiScopeBanditBlender` (신규) | unit | Kotest + MockK |
| `SellerDiversityReranker` (신규) | unit + table-driven | Kotest |
| `SearchProductService` integration | 기존 + 신규 rerank chain 검증 | Kotest + MockK |
| `RankingProperties` / `BanditProperties` binding | `@ConfigurationProperties` slice | Spring Boot test |

### Infrastructure Layer
| 대상 | 테스트 | 도구 |
|---|---|---|
| `ProductSearchAdapter` (GMV/CVR/freshness weight 함수 추가) | Testcontainers ES — 실제 ES 쿼리 발사 후 explain 결과 검증 | Testcontainers + JUnit |
| `ProductEsDocument` (gmv 필드 추가) | mapping test | Spring Data ES test |
| Search Debug API (`/api/v1/search/debug`) | MockMvc + Testcontainers | Spring Boot test |
| Search Raw Query API (`/debug/raw-query`) | MockMvc + 인증 필터 검증 | Spring Boot test |

### Evaluation Job (search:batch)
| 대상 | 테스트 | 도구 |
|---|---|---|
| NDCG / MRR / MAP 계산 함수 | property test (known-good vector) | Kotest property |
| Eval Job step | Spring Batch test + ES Testcontainers | spring-batch-test |

## 2. 평가 metric 검증

`NDCG@k`, `MRR`, `MAP` 산출 함수는 **공개 reference vector** 로 회귀 보호:
- TREC 또는 학술 예제 (Manning, Burges 2010) 의 expected NDCG 값과 일치
- property test: monotonicity (relevance 가 상위에 몰릴수록 NDCG ↑), 경계 (relevance 모두 0 → NDCG = 0)

## 3. Side-by-side UI 테스트

- 어드민 FE Vitest component test (랜더 + 좌/우 결과 카드 분리 확인)
- E2E (Playwright) — 후속 phase, 본 spec MVP 범위 외

## 4. 회귀 보호

- 모든 신규 weight default = 0 → 활성화 전에는 기존 테스트 100% 통과해야 함 (회귀 보호)
- 활성화 후 baseline NDCG 측정값을 `docs/benchmarks/search-quality-baseline.md` 에 기록 (deprecation 시 비교 기준)

## 5. 부하 테스트

- `search:app` 에 대한 k6 또는 gatling 시나리오:
  - 베이스라인: 현재 ranking (weight 0)
  - 변경: GMV/CVR/Freshness/Diversity 모두 활성화
  - 측정: P50/P95/P99 latency, ADR-0025 Tier 1 200ms 초과 시 fail
- 다중 scope MAB blend 가 latency 의 dominant cost 인지 별도 micro-bench

## 6. 데이터 평가 vs 통계 평가 분리

- **온라인 metric** (실서비스 A/B): CTR, CVR, GMV (analytics 가 산출)
- **오프라인 metric** (judgment set): NDCG, MRR, MAP, Precision@k
- 두 metric 충돌 시 (예: 오프라인 NDCG 는 +5% 인데 온라인 CTR 은 −2%) **온라인 우선** + 회고 → judgment set 품질 보강
