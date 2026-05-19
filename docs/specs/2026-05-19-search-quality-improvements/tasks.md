<!-- source: search -->
# Tasks — Search Quality Improvements

상위 spec: `spec.md` / 상위 ADR: `docs/adr/ADR-0050-search-quality-roadmap.md`

| 표기 | 의미 |
|---|---|
| `[ ]` | pending |
| `[~]` | in progress |
| `[x]` | done |

크기: XS≤0.5md, S≤1md, M≤3md, L≤5md, XL>5md

---

## Phase 1 — Quick Wins (총 ~3md)

### P1-T1 결정적 tiebreaker (XS)
- [ ] `ProductSearchAdapter.executeSearch` 의 `NativeQuery.builder()` 에 `sort: [_score desc, id asc]` 추가
- [ ] Testcontainers ES test 로 정렬 안정성 검증
- 산출물: 코드 변경, 테스트 추가

### P1-T2 CVR 가중치 활성화 (S)
- [ ] `RankingProperties.cvrWeight: Double = 0.0` 추가
- [ ] `ProductSearchAdapter` function_score 에 cvr 함수 (조건부)
- [ ] unit test (cvrWeight > 0 일 때 함수 포함, 0 일 때 부재)
- 산출물: 코드 + 테스트

### P1-T3 Freshness gauss decay (S)
- [ ] `RankingProperties.FreshnessConfig` 데이터 클래스 추가
- [ ] `ProductSearchAdapter` 에 gauss decay 함수 (조건부)
- [ ] unit test
- 산출물: 코드 + 테스트

### P1-T4 Baseline 기록 (XS)
- [ ] `docs/benchmarks/search-quality-baseline.md` 생성
- [ ] 현재 ES 쿼리 spot-check 결과 (10 queries 샘플) + latency P50/P95/P99 기록
- 산출물: 신규 문서

### P1-T5 K8s ConfigMap reload 검증 (XS)
- [ ] `RankingProperties` 가 ConfigMap reload 시 hot reload 되는지 actuator/refresh 또는 `@RefreshScope` 확인
- 산출물: 운영 메모 (`docs/runbooks/search-config-reload.md` 추가 또는 기존 runbook 보강)

**Phase 1 Exit Criteria**: 모든 weight 0 일 때 기존 회귀 100% 통과 + tiebreaker 동작 확인 + baseline 기록 완료

---

## Phase 2 — Signal Expansion (총 ~5md)

### P2-T1 ProductEsDocument 필드 확장 (S)
- [ ] `gmv7d`, `gmv30d`, `ctrRaw`, `cvrRaw` 필드 추가
- [ ] `IndexAliasManager.createIndex` 매핑 갱신
- [ ] alias swap 절차 문서 (`search/docs/migration-2026-05-{seq}.md`)
- 산출물: 코드 + 운영 절차

### P2-T2 analytics 측 베이지안 스무딩 (M)
- [ ] Kafka Streams 산출 함수에 `smoothedCtr/Cvr` 추가
- [ ] empirical Bayes prior (category 평균 CTR × k) 산출 모듈
- [ ] `analytics.score.updated` 페이로드 확장 (`ctr`, `cvr` smoothed + `ctrRaw`, `cvrRaw`)
- [ ] property test (스무딩 수렴 / 경계)
- 산출물: analytics 코드 + 테스트

### P2-T3 analytics 측 GMV 산출 (M)
- [ ] ClickHouse 집계 잡 또는 Kafka Streams windowing 으로 `gmv7d`, `gmv30d` 산출
- [ ] `analytics.score.updated` 페이로드 확장
- 산출물: analytics 코드 + ClickHouse 마이그레이션

### P2-T4 search:consumer 페이로드 확장 (XS)
- [ ] `ProductScoreUpdateConsumer` 가 `gmv7d/gmv30d/ctrRaw/cvrRaw` 도 ES 업데이트
- 산출물: 코드

### P2-T5 function_score 에 GMV (S)
- [ ] `RankingProperties.gmv7dWeight`, `gmv30dWeight` (default 0)
- [ ] `ProductSearchAdapter` 함수 추가 (조건부)
- 산출물: 코드 + 테스트

### P2-T6 모니터링 메트릭 (S)
- [ ] `search.feature_score.distribution{signal}` histogram
- [ ] `search.score.update.lag.seconds` gauge
- [ ] Grafana 대시보드 JSON (`k8s/infra/grafana-dashboards/search-quality.json`)
- 산출물: micrometer 코드 + Grafana json

**Phase 2 Exit Criteria**: alias swap 후 신규 필드 데이터 적재 + 메트릭 가시화 + weight 0 → 기존 동일

---

## Phase 3 — MAB Expansion (총 ~10md)

### P3-T0 product `brand` 필드 합의 (S, blocking)
- [ ] product 도메인 / DB 스키마 `brand` 또는 `sellerId` 신설 합의
- [ ] product 측 spec / ADR (필요 시) 분리
- [ ] `product.item.created/updated` 이벤트 페이로드 포함
- 산출물: 합의 메모 / product 측 변경

### P3-T1 BanditKey 일반화 (S)
- [ ] `BanditKey(scope: String, productId: String)` 로 재설계
- [ ] 호출처 (`ThompsonReranker` 등) `BanditKey.category(...)` 로 변경
- [ ] Redis 키 prefix 변경 마이그레이션 절차 (cold-start 일시 발생 명시)
- 산출물: 코드 + 마이그레이션 절차

### P3-T2 MultiScopeBanditBlender (M)
- [ ] `MultiScopeBanditBlender` 신규 구현
- [ ] `ThompsonReranker` 가 blender 사용
- [ ] unit test (단일 scope 일 때 기존 동작 동일 보장)
- 산출물: 코드 + 테스트

### P3-T3 BanditProperties scope 외부화 (S)
- [ ] `ScopeConfig` 데이터 클래스
- [ ] `scopes: List<ScopeConfig>` default = `[category(weight=1.0)]`
- [ ] ConfigMap 예시 + 문서
- 산출물: 코드 + 운영 문서

### P3-T4 Redis TTL/LRU 정책 (S)
- [ ] `bandit:state:*` 키 TTL (예: 90일 미사용 키 만료) 또는 LRU eviction 정책 결정
- [ ] Redis maxmemory 정책 변경 + `k8s/infra/{local,prod}/redis/*` 반영
- [ ] 회수 시뮬레이션 / scope 확장 시 메모리 ↑ 예측치 문서화
- 산출물: 운영 정책 + ConfigMap

### P3-T5 SellerDiversityReranker (M)
- [ ] round-robin 알고리즘 구현 (top-K, maxPerSeller)
- [ ] `DiversityProperties` 외부화 (default enabled=false)
- [ ] unit test (편중 query, 균등 query, 단일 seller query)
- [ ] `SearchProductService` rerank chain 에 통합
- 산출물: 코드 + 테스트

### P3-T6 ProductEsDocument.brand 매핑 (XS, P3-T0 완료 후)
- [ ] `brand: String?` 필드 추가
- [ ] alias swap (또는 P2 alias swap 과 통합)
- [ ] consumer 가 brand 동기화
- 산출물: 코드 + 마이그레이션

**Phase 3 Exit Criteria**: P3-T0 완료, 다중 scope blend + diversity rerank 활성화 가능 상태, 회귀 보호 (default off) 동작

---

## Phase 4 — Evaluation Infrastructure (총 ~10md+)

### P4-T1 RankingMetrics 도메인 함수 (S)
- [ ] `search/domain/.../eval/RankingMetrics.kt` — NDCG@k, MRR, MAP@k
- [ ] property test (monotonicity, 경계, reference vector)
- 산출물: 코드 + 테스트

### P4-T2 ClickHouse judgment 테이블 (XS)
- [ ] `search_judgments` 테이블 DDL
- [ ] analytics 측 약지도 INSERT 잡 (daily)
- 산출물: 마이그레이션 SQL + 잡

### P4-T3 평가 잡 Spring Batch (M)
- [ ] `search:batch` 신규 `SearchEvaluationJobConfig`
- [ ] Step1: judgment 로딩 → Step2: ES 검색 → Step3: metric → Step4: 적재
- [ ] K8s CronJob (daily 02:00)
- 산출물: 코드 + manifest

### P4-T4 Variant 비교 운영 (S)
- [ ] variant A/B ConfigMap 두 벌
- [ ] CronJob 매니페스트 두 개 (variant 별)
- [ ] Grafana 대시보드에 variant 비교 패널
- 산출물: 운영 문서 + manifest + dashboard

### P4-T5 Search Debug API (M)
- [ ] `SearchDebugController` — `/api/v1/search/debug` GET
- [ ] ES `explain` 결과 + score breakdown 직렬화
- [ ] Multi-variant `Map<Variant, Properties>` 보유 구조
- [ ] ADMIN 권한 + Rate Limit
- 산출물: 코드 + API 문서

### P4-T6 Raw Query API (S)
- [ ] `POST /api/v1/search/debug/raw-query` — ADMIN 만, 화이트리스트 인덱스
- [ ] 보안 테스트 (권한 없는 호출 차단)
- 산출물: 코드 + 테스트

### P4-T7 admin-fe Side-by-Side UI (L)
- [ ] 페이지 `/admin/search-debug/side-by-side`
- [ ] 좌/우 variant 선택 + query 입력 + 결과 카드
- [ ] score breakdown expand
- [ ] judgment set 가 있으면 양쪽 NDCG@10 / MRR 표시
- 산출물: FE 코드 + Vitest

### P4-T8 admin-fe Query Builder UI (L)
- [ ] 페이지 `/admin/search-debug/query-builder`
- [ ] `GET /api/v1/search/debug/fields` API + UI
- [ ] 필드별 토글 + function_score 슬라이더
- [ ] "Apply to side-by-side" 액션
- 산출물: FE 코드 + Vitest

### P4-T9 judgment set 운영 가이드 (S)
- [ ] spot-check 절차 (`docs/runbooks/search-judgment-spotcheck.md`)
- [ ] 약지도 self-fulfilling 위험 + 분기별 50개 query 수동 보정 절차
- 산출물: 운영 문서

### P4-T10 Grafana 대시보드 확장 (S)
- [ ] `search.eval.ndcg10{variant}` 패널
- [ ] `search.diversity.unique_sellers_at_k` 패널
- [ ] `search.score.update.lag` 알람 (Slack)
- 산출물: dashboard JSON + alert rules

**Phase 4 Exit Criteria**: daily 평가 잡 가동 + variant A/B 비교 dashboard 운영 + admin UI 좌우 비교 가능

---

## 의존 / 순서 그래프

```
P1 (독립, 즉시 가능) ──────►  활성화 ramp 시작
                                  │
P2-T1 (ES 매핑) ──► P2-T4 (consumer) ──► P2-T5 (function_score)
P2-T2 (스무딩) ──► P2-T4
P2-T3 (GMV) ──────► P2-T4
P2-T6 (모니터링) — 독립

P3-T0 (brand 합의) ──► P3-T6 (brand 매핑)
P3-T1 (BanditKey) ──► P3-T2 (blender) ──► P3-T3 (properties)
P3-T4 (Redis TTL) — 독립, 운영 선행 권장
P3-T5 (diversity) — P3-T6 완료 후 활성화

P4-T1 (RankingMetrics) ──► P4-T3 (eval job)
P4-T2 (judgment 테이블) ──► P4-T3
P4-T3 ──► P4-T4 (variant 비교)
P4-T5 (debug API) ──► P4-T7 (side-by-side UI)
P4-T6 (raw query) ──► P4-T8 (query builder UI)
P4-T9, P4-T10 — 독립
```

## 사이즈 합계 (추정)

| Phase | XS | S | M | L | 합계 (md) |
|---|---|---|---|---|---|
| P1 | 2 | 3 | - | - | ~3 |
| P2 | 1 | 3 | 2 | - | ~5 |
| P3 | 1 | 3 | 2 | - | ~10 |
| P4 | 1 | 5 | 2 | 2 | ~12+ |
| **총** | | | | | **~30md** |

(사용자 원 추정 5md + 10md + 10md + 1mm 와 대략 일치)
