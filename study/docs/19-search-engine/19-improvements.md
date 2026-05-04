---
parent: 19-search-engine
seq: 19
title: 개선 후보 통합 — ADR 4건 Proposed 초안 (ES 일원화 / 변동성 필드 / 색인 lag SLA / Hybrid)
type: deep
created: 2026-05-03
---

# 19. 개선 후보 통합 — ADR 4건

> §15 grounding 의 점검 포인트 + 영상 요약 자료의 7개 액션 아이템을 ADR (Architecture Decision Record, 아키텍처 결정 기록) 4건의 Proposed 초안으로 통합. 학습 자료 단계의 초안이며, `docs/adr/` 승격은 별도 검토 필요.

## 1. 한 줄 핵심

> **본 ADR 4건은 msa search 의 "정통 패턴 준수 + 점검 포인트" 의 시니어 결론.**
> 우선순위: ① 색인 lag SLA (Service Level Agreement, 서비스 수준 협약) (즉시) → ② 변동성 필드 컨벤션 (즉시) → ③ ES (Elasticsearch) 일원화 (분기) → ④ Hybrid Search (반기).

---

## ADR-XXXX-1: 검색 인덱스 색인 Lag SLA 정의 + ADR-0025 보강

**Status**: Proposed
**Date**: 2026-05-03
**Deciders**: backend-platform, search-team
**Related**: ADR-0025 (latency budget), ADR-0012 (idempotent consumer)

### Context

msa 의 search 서비스는 product DB 를 SoR 로 두고 Kafka + ES 인덱싱으로 read 모델 유지 (eventual consistency). 그러나 **색인 lag (RDB commit → ES 검색 가능까지의 시간) 의 SLA 가 명시 ❌**.

문제:
- 운영 모니터링 기준 없음 — "lag 가 얼마면 alert?" 불명확
- 사용자 UX 설계 어려움 — "결제 직후 검색 결과에 안 보이는가?" 의 답이 없음
- 변경 영향 평가 불가 — refresh_interval / consumer batch 변경의 영향 측정 기준 없음

### Decision

**다음 SLA 를 ADR-0025 (latency budget) 에 추가:**

> **검색 색인 lag SLA**:
> - P50 < 1초
> - P95 < 3초
> - P99 < 5초
> 측정: product 도메인 이벤트 timestamp ↔ ES doc indexed_at 메타필드.

**부가 결정:**
- search:consumer 가 인덱싱 시 doc 에 `indexed_at` (server timestamp) 필드 추가
- Prometheus metric: `search_indexing_lag_seconds_histogram`
- Grafana dashboard 에 lag P50/P95/P99 panel
- Alert: P99 > 10s for 5m → warning, P99 > 30s for 5m → critical

### Consequences

**Positive:**
- 운영 알람 명확화
- 사용자 UX 의 lag 인지 (5초 이내 = 일반 사용자 무인지)
- 변경 영향 측정 가능

**Negative:**
- ProductEsDocument 매핑 변경 → reindex 1회 필요
- Prometheus metric 수집 비용 (소량)

**Neutral:**
- ADR-0025 의 latency budget 표에 행 1줄 추가

### Alternatives Considered

- **A. SLA 명시 안 함 (현재)** — 문제 지속. 거절.
- **B. 더 엄격 (P99 < 1s)** — refresh_interval 100ms 필요 → segment 폭증. 비용 ↑↑. 거절.
- **C. 더 관대 (P99 < 30s)** — 사용자 인지 한계 초과. 거절.

### Implementation

1. ProductEsDocument 에 `indexedAt: Long` 추가 (`server timestamp millis`)
2. EsBulkDocumentProcessor 에서 set
3. Prometheus exporter / metric 정의
4. Grafana dashboard 추가
5. Alert rule 작성
6. ADR-0025 보강

**Effort**: 2-3 day. **Risk**: 낮음 (additive 변경).

---

## ADR-XXXX-2: 검색 인덱스 변동성 필드 컨벤션 — Two-Phase Lookup 강제

**Status**: Proposed
**Date**: 2026-05-03
**Deciders**: search-team, product-team

### Context

영상 요약 + §01 §14 의 검색 시스템 4원칙 중:
> "변동성 큰 필드 (가격/재고) 는 ES 에 색인 ❌, RDB 에서 fetch (Two-Phase Lookup)."

**현 상태** (§15):
- ProductEsDocument 에 `price` (BigDecimal) 색인 ✅ (변동성 의문)
- 가격 변경 빈도가 높으면:
  - product 이벤트 폭증 → ES 인덱싱 부하 ↑
  - 검색 결과의 가격이 stale 가능 (사용자 lag 5초)
  - 부정확한 결제 흐름 위험

### Decision

**다음 컨벤션 신규 작성** (`docs/conventions/search-index-fields.md`):

> **검색 인덱스에 색인할 수 있는 필드 기준:**
> - **허용**: 정적 / 저빈도 변경 (이름, 카테고리, 브랜드, 설명, 생성일)
> - **검토**: 중빈도 변경 — 검색 필터 / sort 에 필요한 경우만 (가격 range, 평점)
> - **금지**: 고빈도 변경 (재고, 실시간 인기도, 광고 슬롯)
>
> **Two-Phase Lookup 패턴:**
> ES 는 ID + 점수 + 검색에 필요한 최소 필드만. 본문 / 변동 필드는 RDB / API 에서 fetch.

**예외 규정**:
- 가격 range 검색 (필터) 가 필수 → ES 의 `price_range_bucket` (정수 그룹) 색인 검토
- 자주 갱신되는 score 는 별도 partial update event (msa 의 ScoreUpdateEvent 패턴 ✅)

### Consequences

**Positive:**
- 인덱싱 부하 ↓
- ES stale 데이터 위험 ↓
- product / search 도메인 책임 분리 명확

**Negative:**
- 검색 결과 응답 시 RDB fetch 추가 round trip
- 가격 range 필터의 정확도 ↓ (bucket 화)

**Neutral:**
- 기존 매핑 검토 + 일부 필드 제거 (reindex 1회)

### Alternatives Considered

- **A. 모든 필드 ES 색인 (현재)** — Dual update 부담. 거절.
- **B. 모든 필드 RDB fetch** — ES filter 효율 ↓. 거절.
- **C. 컨벤션 명시 + 예외 규정** — 위 결정. 채택.

### Implementation

1. 컨벤션 문서 작성 (`docs/conventions/search-index-fields.md`)
2. 현 ProductEsDocument 검토 → `price` 가 자주 변하면 제거 / range bucket 으로 대체
3. ProductSearchAdapter 의 응답에서 price → product API fetch 통합
4. 검색 응답 latency 측정 (RDB fetch 추가 영향)

**Effort**: 1 sprint. **Risk**: 중간 (사용자 응답 latency 영향).

---

## ADR-XXXX-3: ES vs OpenSearch 일원화 — OpenSearch 인프라 정리

**Status**: Proposed
**Date**: 2026-05-03
**Deciders**: backend-platform, infra-team

### Context

msa 인프라 (`k8s/infra/local/`, `k8s/infra/prod/`) 에 **Elasticsearch + OpenSearch 둘 다 배포** (CLAUDE.md 명시). 그러나:

- search 서비스 코드 (§15): `co.elastic.clients.elasticsearch.*` import → **ES 8.x client 만 사용**
- OpenSearch 가 사용되는 다른 서비스 ❓ (확인 필요)

→ 한 쪽이 안 쓰이면 운영 부담 (학습 / 모니터링 / 백업 / 보안 / 패치) 이 2배로 낭비.

### Decision

**조사 후 다음 중 하나 선택:**

#### Option A: ES 일원화 (OpenSearch 제거)

조건:
- OpenSearch 가 어떤 서비스에서도 사용 안 됨
- 라이선스 (AGPLv3 / SSPL) 가 비즈니스에 문제 없음
- ES 8+ 신기능 (ESQL, semantic_text) 활용 의도

작업:
- OpenSearch StatefulSet / Operator 제거
- 디스크 / 백업 정리
- 문서 (CLAUDE.md, k8s README) 업데이트

#### Option B: OpenSearch 일원화 (ES 제거)

조건:
- AWS 환경 + managed service 사용 의도
- 라이선스 자유 / 재배포 / SaaS 가능성
- ES 신기능 (ESQL, semantic_text) 불필요

작업:
- search 서비스 client 교체 (`co.elastic.clients` → `org.opensearch.client`)
- ES 매핑 / 쿼리 문법 약간 수정 (vector / kNN 부분)
- ES Operator 제거

#### Option C: 명시적 분리 유지

조건:
- 두 엔진을 의도적으로 다른 용도 (예: ES = 사용자 검색, OS = 로그/분석)
- 운영 부담 감수

→ 그렇다면 **명시적 ADR + 운영 매뉴얼** 필요.

### Consequences

**Option A (ES 일원화):**
- ✅ 운영 부담 50% ↓
- ✅ ES 8+ 신기능 (semantic_text, ESQL) 가용
- ⚠ 라이선스 검토 (AGPL 의 SaaS 영향)
- ⚠ AWS managed service 사용 시 비용 ↑ (Elastic Cloud)

**Option B (OS 일원화):**
- ✅ 운영 부담 50% ↓
- ✅ 라이선스 자유
- ✅ AWS managed service 비용 ↓
- ⚠ search 서비스 코드 마이그레이션 (수~수십 시간)
- ⚠ ES 8+ 신기능 미가용

**Option C (분리 유지):**
- ✅ 도메인별 최적
- ⚠ 운영 부담 2배

### Recommendation (시니어 결론)

→ **Option A (ES 일원화) 우선 검토**:
- 코드가 이미 ES → 마이그레이션 비용 0
- 라이선스는 자체 운영 / 일반 SaaS 면 무관
- 신기능 (semantic_text, ESQL) 의 미래 가치 ↑

단, AWS managed 사용 의도가 강하면 → **Option B (OS 일원화)** 재검토.

### Implementation (Option A 가정)

1. 모든 서비스에 OpenSearch 사용 검색 (분석 / 로그 / 데이터 stream 등)
2. 의존도 확인 → 없으면 제거 결정
3. K8s manifest 정리
4. 문서 업데이트
5. 백업 / snapshot 정책 통합

**Effort**: 분기 단위. **Risk**: 중간 (기존 의존 발견 시).

---

## ADR-XXXX-4: Hybrid Search 도입 — BM25 + Dense Vector + RRF

**Status**: Proposed
**Date**: 2026-05-03
**Deciders**: search-team, ml-platform (가상)
**Related**: §18 의 PoC 결과

### Context

msa search 는 BM25 + function_score 만 사용 (§15). 한계:
- 자연어 / 동의어 / 변형 검색 약함 ("접히는 폰" → "갤럭시 폴드" 매칭 ❌)
- 의미 기반 검색 ❌

§09 의 Hybrid (BM25 + dense vector + RRF) 와 §18 의 PoC 가능성 검증.

### Decision

**다음 4개 옵션 중 PoC 결과로 결정:**

#### Option A: 전면 도입 (모든 검색 hybrid)

PoC 결과:
- 모든 query 유형에 nDCG ↑
- 인덱싱 throughput / 메모리 비용 정당화

작업:
- 임베딩 모델 선택 + 인프라 (self-host / API)
- 매핑 변경 (모든 인덱스 vector 추가) + reindex
- search:consumer 임베딩 통합
- search:app 검색 코드 통합 (retriever / RRF)
- LTR 파이프라인 검토 (§10)

#### Option B: 부분 도입 (검색 유형별 분리)

조건:
- 자연어 query (질문형) 만 hybrid, 정확 query (제품명) 는 BM25
- 카테고리별 분리 (가전 = hybrid, 일반 = BM25)

작업:
- 쿼리 분류 로직 (자연어 vs 키워드)
- A/B 테스트 인프라

#### Option C: 보류 — 추가 PoC

조건:
- PoC 결과 효과 미검증
- 메트릭 (nDCG / CTR / CVR) 데이터 부족

작업:
- judgment list 인프라 (analytics → judgment)
- 다른 모델 (e5, OpenAI) 비교

#### Option D: 폐기

조건:
- PoC 결과 효과 미미 (nDCG +5% 미만)
- 비용 (latency 2배, 메모리 +30%) 정당화 ❌

### Consequences (Option A 기준)

**Positive:**
- 자연어 / 동의어 검색 품질 ↑↑
- LLM 통합 / 추천 시스템 기반 마련
- ML 파이프라인 문화 도입

**Negative:**
- 임베딩 인프라 운영 부담
- 인덱싱 throughput ↓ (10배)
- 검색 latency ↑ (50% 증가)
- 비용 (cloud GPU / API)

**Neutral:**
- 매핑 / reindex 작업

### Recommendation (시니어 결론)

→ **§18 의 PoC 우선 실행 + 결과로 Option 결정**.

PoC 의 측정 항목이 결론을 결정:
- nDCG@10 향상 정도
- 인덱싱 throughput 영향
- 검색 latency P99 영향
- 비용 추정 (cloud GPU / API / 메모리)

PoC 추정 권장 순서:
1. 한 카테고리 (예: 가전) 만 hybrid PoC
2. 메트릭 측정 + A/B (1주)
3. 결과로 전면 / 부분 / 보류 / 폐기 결정

### Implementation (Option B - 부분 도입 가정)

1. §18 의 PoC endpoint 운영 환경 적용
2. 쿼리 분류 로직 (자연어 vs 키워드 — 길이 / 형태소 등)
3. 자연어 → /search/hybrid, 키워드 → /search
4. A/B 테스트 (msa experiment 서비스)
5. 4주 측정 → 확대 결정

**Effort**: 분기 단위 (PoC 후). **Risk**: 중간 (인프라 의존성).

---

## 보너스: 점검 결과 추가 ADR 후보

§15 의 점검 포인트에서 도출됐지만 위 4건과 별개로 작성 가능:

### ADR-XXXX-5: ES 인덱싱 멱등성 표준 — version_type=external 강제

§15 점검 11. ES 인덱싱 코드에 `version_type=external` + 도메인 version (예: updated_at epoch) 명시 컨벤션.

→ ADR-0012 (idempotent-consumer) 의 search 영역 보강.

### ADR-XXXX-6: 검색 인덱스 매핑 표준 — multi-field, search_analyzer

§15 점검 2, 3. text 필드는 항상 multi-field (`raw` keyword), synonym 사용 시 search_analyzer 분리.

### ADR-XXXX-7: ES Bulk 영구 실패 메시지 DLQ

§15 점검 13. retry ingester 후에도 실패한 메시지를 DLQ (Kafka topic) 로 백업.

### ADR-XXXX-8: search:batch reindex 시 refresh_interval=-1 / replica=0 토글

§15 점검 15. IndexAliasManager 의 createIndex 에 throughput 최적화 settings 명시.

### ADR-XXXX-9: Alias Swap 후 검증 단계 + 옛 인덱스 보관

§15 점검 16. swap 후 일정 시간 (예: 1시간) 옛 인덱스 보관, 메트릭 정상 확인 후 cleanup.

→ 위 5개는 별도 ADR 또는 1개 통합 ADR ("search 운영 표준") 으로.

---

## 평가 / 스코어링 / 자동완성 ADR 후보 (#34~36 추가, 2026-05-04)

§34 / §35 / §36 deep file 작성 결과 도출:

### ADR-XXXX-10: 검색 품질 측정 — judgment + nDCG@10 + A/B 통합

출처: [34-eval-metrics-precision-recall-ndcg.md](34-eval-metrics-precision-recall-ndcg.md) §8.

현재 검색 품질을 객관 측정 ❌. analytics 의 클릭/구매 로그를 등급화 (노출=0/클릭=1/카트=2/구매=3) → ES `_rank_eval` 일배치 → nDCG@10 시계열 + Grafana 대시보드. PM 라벨 cross-check + experiment 서비스 도입 후 A/B 통합.

- 우선순위: 즉시 (S11/S12 효과 검증의 전제)
- Effort: Phase 1 1 sprint (judgment 인프라) + Phase 2~4 점진적
- ADR-0025 (latency budget) 와 결합 → "품질 SLA + latency SLA" 동시 정의

### ADR-XXXX-11: function_score modifier 표준 — featureScore 는 LN2P

출처: [35-field-value-factor-modifiers.md](35-field-value-factor-modifiers.md) §10.

`ProductSearchAdapter.kt:149` 의 LOG1P 가 0~1 정규화 featureScore 에 적용되면 0 입력 (예: 신상품) 시 boost_mode=multiply 로 score 폭사. **LN2P** (`ln(2+x)`) 로 교체 — 1.59x 압축 + 0 자동 가드. raw 카운트는 LOG1P + range>0 가드 유지.

- 우선순위: 즉시 (코드 변경 1d)
- Effort: 1d (분포 점검 + 코드 변경 + 회귀 테스트)
- 효과 측정: ADR-XXXX-10 의 nDCG@10 으로 비교

### ADR-XXXX-12: 검색 자동완성 단계적 도입

출처: [36-autocomplete-ngram-edgengram.md](36-autocomplete-ngram-edgengram.md) §10.

현재 자동완성 미적용 (§15 점검 2). 3 단계 도입:
- Phase 1 (1주): `search_as_you_type` 매핑 추가 — 영문 prefix 즉시
- Phase 2 (2~3주): `analysis-icu` 플러그인 + custom edge_ngram + 자모 분리 (NFD) — 한국어 풀 자동완성
- Phase 3 (analytics 연동 후): completion suggester + weight 기반 정렬

- 우선순위: Phase 1 즉시, Phase 2 분기, Phase 3 반기
- 효과 측정: typing-to-result latency P99 + 자동완성 클릭률

---

## 인덱스 / 매핑 / 운영 / 시계열 / 벡터 ADR 후보 (#37~41 추가, 2026-05-05)

§37 / §38 / §39 / §40 / §41 deep file 작성 결과:

### ADR-XXXX-13: 검색 인덱스 component template 분해

출처: [37-index-templates.md](37-index-templates.md) §7.

현재 `IndexAliasManager` 가 inline mapping/settings 를 코드로 들고 있음. 8.x composable 표준에 맞게 4 개 component template (`base` / `search_settings` / `product_mapping` / `lifecycle`) 로 분해 → 새 인덱스 도입 시 재사용성 ↑, mapping 변경 시 영향 범위 좁힘.

- 우선순위: 분기 (기존 코드 리팩터 비용 있음, 새 인덱스 도입 시 즉시 도입)
- Effort: 1~2 sprint (component 분리 + apply 자동화 + alias swap 흐름 통합)
- 효과: 새 인덱스 추가 시 boilerplate 90% ↓

### ADR-XXXX-14: ProductEsDocument 매핑 v2

출처: [38-mapping-power-features.md](38-mapping-power-features.md) §9.

`ProductEsDocument.kt` 의 다음 항목 매핑 변경:
- `price: BigDecimal` Double 색인 → `scaled_float` (`scaling_factor=100`) — 정밀도 손실 (소수점 4자리) 해소
- `popularityScore: Double` → `scaled_float` (`scaling_factor=1000`) — 정렬/집계 효율
- `name` → multi-field (`name.raw` keyword) — sort / agg / 정확 매칭 가능
- `_routing` 을 `category_id` 에 고정 — 카테고리 검색 fan-out 90% ↓
- `options` array → `nested` (정확 매칭 보장) 또는 `flattened` (기본값) 결정

- 우선순위: 즉시 (가격 정밀도는 운영 사고 위험)
- Effort: 1 sprint (매핑 변경 + reindex + 검증)
- 효과 측정: ADR-XXXX-10 nDCG@10 + 가격 정밀도 회귀 테스트

### ADR-XXXX-15: search:app 의 _msearch + Mustache search template

출처: [39-search-ops-apis.md](39-search-ops-apis.md) §12.

검색 페이지의 multi-call (메인 검색 + 필터별 count + 카테고리별 hits 등) 을 `_msearch` (NDJSON) 1 round-trip 통합. Mustache `_search/template` 로 client-query 분리 (배포 없이 query 변경).

- 우선순위: 즉시 (latency P99 30% 개선 기대)
- Effort: 2 sprint (template 정의 + client wrapper + 검증)
- 효과 측정: typing-to-result P99, ADR-XXXX-10 nDCG (회귀 없는지)

### ADR-XXXX-16: analytics 시계열 인덱스를 Data Stream + DSL 로 표준화

출처: [40-data-streams-downsampling.md](40-data-streams-downsampling.md) §12.

`analytics` 의 event/click/view 를 ES Data Stream 으로 색인 (현재 ClickHouse 가 SoR). DSL (8.x) 으로 30일 hot retention + Downsampling (5m → 1h interval) 으로 30일 후 압축 → 메모리·디스크 ↓.

- 우선순위: 분기 (analytics 인프라 결정과 결합)
- Effort: 1 분기 (인덱스 마이그레이션 + DSL + Downsampling 정책 + 모니터링)
- 효과: 시계열 검색 latency 일관성 + 90일+ 데이터 보관 가능

### ADR-XXXX-17: Hybrid Search dense_vector quantization 표준 (int8_hnsw)

출처: [41-vector-advanced.md](41-vector-advanced.md) §12.

ADR-XXXX-4 (Hybrid Search) 도입 시 dense_vector 를 `int8_hnsw` 로 색인 — 1M~10M doc 기준 4x 메모리 절감 + recall ≥ 0.95 유지. BBQ (32x 절감) 는 정밀도 손실로 후순위.

- 우선순위: 반기 (S4 Hybrid Search 와 동시 도입)
- Effort: ADR-XXXX-4 의 일부
- 효과: 1억 doc × 768d 벡터 메모리 ~300GB → ~75GB

---

## 종합 요약

### ADR 우선순위

| 우선순위 | ADR | Effort | Risk | 효과 |
|---|---|---|---|---|
| 1 (즉시) | XXXX-1: 색인 lag SLA | 2-3d | 낮음 | 운영 가시성 ↑↑ |
| 1 (즉시) | XXXX-2: 변동성 필드 컨벤션 | 1 sprint | 중간 | 데이터 일관성 ↑ |
| 1 (즉시) | XXXX-10: 검색 품질 측정 (judgment + nDCG) | 1 sprint | 낮음 | 모든 검색 변경의 효과 검증 가능 |
| 1 (즉시) | XXXX-11: modifier 표준 (LN2P) | 1d | 낮음 | 0 입력 폭사 방지 |
| 1 (즉시) | XXXX-14: ProductEsDocument 매핑 v2 (scaled_float / _routing / multi-field) | 1 sprint | 중간 | 가격 정밀도 + sort/agg + fan-out 90% ↓ |
| 1 (즉시) | XXXX-15: _msearch + Mustache search template | 2 sprint | 낮음 | latency P99 30% ↓ |
| 2 (분기) | XXXX-3: ES vs OS 일원화 | 분기 | 중간 | 운영 부담 50% ↓ |
| 2 (분기) | XXXX-12: 자동완성 도입 (Phase 1~2) | 분기 | 중간 | 검색 UX ↑ |
| 2 (분기) | XXXX-13: component template 분해 | 1~2 sprint | 중간 | 새 인덱스 boilerplate 90% ↓ |
| 2 (분기) | XXXX-16: analytics Data Stream + DSL + Downsampling | 1 분기 | 중간 | 시계열 검색 일관성 + 90일+ 보관 |
| 3 (반기) | XXXX-4: Hybrid Search | 분기+ | 중간 | 검색 품질 ↑ (PoC 의존) |
| 3 (반기) | XXXX-17: Hybrid quantization 표준 (int8_hnsw) | XXXX-4 일부 | 낮음 | 메모리 4x ↓ |
| 보너스 | XXXX-5~9: 운영 표준 | 각 1-2d | 낮음 | 운영 안전성 ↑ |

### Effort 합산

- 즉시 ADR (1, 2): 약 1-1.5 sprint
- 분기 ADR (3): 1 분기
- 반기 ADR (4): PoC 1주 + 결정 1주 + 적용 분기

### 학습 → ADR 연결 주기

1. 본 §19 의 초안 → 시니어 리뷰 → `docs/adr/` 승격
2. 각 ADR 의 Status: Proposed → Accepted → Implemented
3. 6개월 후 회고 (§16 의 모니터링 데이터로 효과 측정)

## 다음 학습

- [20-interview-qa.md](20-interview-qa.md) — 본 ADR 내용을 면접 답변으로 변환

> **§19 회독 체크리스트**:
> - [ ] ADR 4건의 Context / Decision / Consequences 를 1분 안에 설명할 수 있다
> - [ ] 우선순위 (즉시 / 분기 / 반기) 의 근거
> - [ ] 각 ADR 의 Alternatives 검토 결과
> - [ ] msa 의 점검 포인트 → ADR 매핑이 정확한가
> - [ ] PoC 가 ADR 의사결정에 어떻게 기여하는가 (XXXX-4)
