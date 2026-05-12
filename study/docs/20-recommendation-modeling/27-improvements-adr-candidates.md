---
parent: 20-recommendation-modeling
seq: 27
title: 개선 후보 + ADR 초안 — 학습 → msa 코드베이스 개선 + 추천 도입 ADR 통합
type: deep
created: 2026-05-12
---

# 27. 개선 후보 + ADR 초안

> **부록 2 / Phase 1-10 학습의 산출물**. msa 본 레포 적용 후보 + ADR 초안 통합. 학습 자산을 production 결정으로 연결.

---

## 1. ADR 3건 통합 (§20 의 정리)

### 1-1. ADR-XXXX-1: MSA 추천 서비스 도입 단계

**결정**: Phase 1 (룰 기반 CB) → Phase 2 (CF Spark) → Phase 3 (Two-Tower ANN) → Phase 4 (Ranking, 향후) 단계적 도입.

**근거**:
- §05-06 (룰 기반 + Wilson LCB) — Phase 1 즉시 가치
- §02-03 (CF + MF) — Phase 2 개인화 시작
- §13 (Two-Tower) — Phase 3 deep retrieval
- §17 (Cold-start fallback) — 각 Phase 의 안전망 보장

**상태**: Proposed → 단계별 acceptance.

### 1-2. ADR-XXXX-2: 추천 데이터 파이프라인 (Spark + ClickHouse + Argo)

**결정**: msa native 인프라 (Kafka + ClickHouse) + K8s 위 Spark Operator + Argo Workflows.

**근거**:
- §18 (인프라 비교) — 산업 스택 (BigQuery + Airflow) 의 자기 인프라 매핑
- §22 (룰 기반 CB) — ClickHouse SQL 활용
- §23 (CF Spark) — Spark Operator
- §24 (Two-Tower) — Python sidecar + Argo daily retraining

**상태**: Proposed.

### 1-3. ADR-XXXX-3: 임베딩 ANN 인덱스 (FAISS Python Sidecar)

**결정**: FAISS Python sidecar (`recommendation-ann` 서비스) 로 Two-Tower ANN 서빙.

**근거**:
- §10 (ANN 알고리즘 비교) — FAISS 성숙 + 알고리즘 풍부
- §13 (Two-Tower 학습 → ONNX export)
- §24 (Python FastAPI + FAISS HNSW 구현)

**대안 정리**:
- ES knn native: 검색-추천 통합 가치 있을 때 재고
- Qdrant: 향후 검토
- ONNX Runtime Kotlin 내장: latency critical 시

**상태**: Proposed → Phase 3 도입 시점에 확정.

---

## 2. 추가 개선 후보 (학습 중 발견)

### 2-1. 검색 (#19) 의 Hybrid Search 도입과 추천 임베딩 공유

**현재 상태**: msa `search` 서비스 = BM25 only. 추천 도입 시 별도 임베딩 인프라.

**개선 제안**: search 의 Hybrid Search (BM25 + dense vector) 도입 시 **추천의 Two-Tower item embedding 을 search 에 공유**.

```
Phase A: search 단독 — BM25 (현재)
Phase B: recommendation Phase 3 — Two-Tower item embedding 학습
Phase C: search → Hybrid Search (BM25 + Two-Tower item embedding)
   ↓
   인프라 공유: ES dense_vector + ANN, 또는 FAISS sidecar 공유
```

**가치**:
- 추천과 검색의 embedding 인프라 중복 제거
- search 의 의미 검색 품질 ↑ (#19 §07 cross-ref)

**리스크**:
- 추천 도메인 (item-item) 과 검색 도메인 (query-item) 의 embedding 학습 task 다름 → 별도 모델 학습 필요할 수 있음

**ADR 후보**: "ADR-XXXX-4: Hybrid Search 와 Recommendation Embedding 공유 전략" — Phase C 시점에 작성.

### 2-2. analytics 서비스의 Feature Store 진화

**현재 상태**: `analytics` = Kafka Streams + ClickHouse. 자유로운 OLAP 분석.

**개선 제안**: **Feast 또는 자체 Feature Store** 도입 (§18 §5).

```
현재:
   analytics ClickHouse → 학습 데이터 (Spark)
                         → serving feature (Redis cache, 분리)
   문제: training-serving skew 위험

개선:
   analytics ClickHouse → Feature Store (Feast)
                         → training (offline)
                         → serving (online, Redis backed)
   가치: 단일 정의 + 일관성 보장
```

**ADR 후보**: "ADR-XXXX-5: Feature Store 도입" — Phase 3 (Two-Tower) 학습 안정 후 검토.

### 2-3. experiment 서비스의 MAB 통합

**현재 상태**: `experiment` = A/B 테스트 플랫폼 (Phase 9 §19).

**개선 제안**: **Thompson Sampling MAB 통합** (#19 §42-44 + §08 §6 + §19 §5).

```
현재:
   experiment 가 deterministic A/B (50:50 split)
   
개선:
   experiment 에 MAB 옵션 추가
   - bucketing 규칙: deterministic (A/B) 또는 thompson (MAB)
   - posterior 추적 (Beta(α, β) per variant)
   - dynamic 할당
```

**가치**:
- 작은 변경 (weight 튜닝) 의 빠른 최적화
- 추천 algorithm 비교에서 누적 reward 최대화

**리스크**:
- MAB 의 통계적 rigor 약함 → 큰 결정에는 여전히 A/B
- 사용자 경험 (variant 변동성) 고려 필요

**ADR 후보**: "ADR-XXXX-6: Experiment 서비스의 MAB 옵션 추가" — Phase 9 의 추천 성숙 후.

### 2-4. Position bias 보정 (IPW) 도입

**현재 상태**: 추천 ranking 에 position bias 보정 없음.

**개선 제안**: IPW (Inverse Propensity Weighting) 도입 (§17 §7).

```
1. Random position swap A/B 실험 → P(view | position) 측정
2. 학습 시 click 에 1/P 가중치 적용
3. 또는 Counterfactual evaluation 으로 offline 평가에 활용
```

**가치**:
- 1위 모델 영원히 1위 의 악순환 회피
- Selection bias 보정

**리스크**:
- P 추정 어려움 (소량 random exploration 필요)
- Variance 큼

**ADR 후보**: "ADR-XXXX-7: Position Bias 보정 (IPW)" — Phase 3 후 ranking 모델 도입 시점.

### 2-5. Ranking 모델 (Phase 4) 도입

**현재 상태**: Phase 1-3 = retrieval 만. Stage 2 (ranking) 없음.

**개선 제안**: Phase 4 — DLRM (§14) 또는 Wide & Deep (§12) 도입.

```
현재 Funnel:
   Retrieval (Two-Tower) → 후보 100개 → Top-20 노출
   
개선:
   Retrieval (Two-Tower) → 후보 100개 → Ranking (DLRM) → Top-20
```

**가치**:
- Precision ↑ — 정밀 정렬
- Side feature (user × item interaction) 활용
- 산업 표준 Two-stage 완성

**리스크**:
- 학습/서빙 인프라 추가 (DLRM 의 모델 크기 큼)
- ANN 서빙과 다른 인프라 — model parallelism 필요할 수 있음

**ADR 후보**: "ADR-XXXX-8: Phase 4 Ranking 모델 도입 (DLRM)" — Phase 3 production 안정 + A/B 검증 후.

### 2-6. 코드 중복 회피 — 공통 라이브러리 + 분리 DAG (§11 §4 교훈)

**관찰**: 산업 morelike-com / morelike-offer 의 코드 동일 + DAG 분리.

**msa 적용**: recommendation/batch 모듈에 공통 Spark 로직 추출 + 도메인별 DAG 분리.

```
recommendation/batch/
├── core/
│   ├── CfJob.scala        # 공통 CF 로직
│   ├── PpmiCalculator.scala
│   └── AlsTrainer.scala
└── jobs/
    ├── HotelCfJob.scala       # 호텔 도메인
    ├── ActivityCfJob.scala    # 액티비티 도메인
    └── PackageCfJob.scala     # 패키지 도메인
```

각 Job 은 도메인별 config 만 다름. Core 코드 공유.

**ADR 후보**: 코드 컨벤션 — `docs/conventions/recommendation-batch.md` 작성.

### 2-7. Cold-start Fallback Chain 표준화

**개선 제안**: §17 의 다층 fallback 을 명시적 chain pattern 으로:

```kotlin
interface RecommendationStrategy {
    fun retrieve(context: Context): Recommendation
    fun nextFallback(): RecommendationStrategy?
}

class TwoTowerStrategy(...) : RecommendationStrategy {
    override fun nextFallback() = CfStrategy(...)
}

class CfStrategy(...) : RecommendationStrategy {
    override fun nextFallback() = CategoryBestStrategy(...)
}

class CategoryBestStrategy(...) : RecommendationStrategy {
    override fun nextFallback() = null  // 최종 안전망
}

// 사용:
fun execute(context: Context): Recommendation {
    var strategy: RecommendationStrategy? = TwoTowerStrategy(...)
    while (strategy != null) {
        val result = strategy.retrieve(context)
        if (result.items.size >= context.requiredLimit) {
            return result
        }
        strategy = strategy.nextFallback()
    }
    throw IllegalStateException("All strategies exhausted")
}
```

**가치**:
- 명시적 fallback chain
- 새 strategy 추가 용이
- 디버깅 / 모니터링 친화

---

## 3. 학습 → 즉시 적용 가능한 작은 개선

### 3-1. ClickHouse 의 Wilson LCB SQL 모듈화

**개선**: §22 의 Wilson LCB SQL 을 ClickHouse UDF 로:

```sql
CREATE FUNCTION wilson_lcb AS (positives, total) -> 
    if(total = 0, 0,
        let p = positives / total in
        let z = 1.96 in
        (p + z*z/(2*total) - z * sqrt(p*(1-p)/total + z*z/(4*total*total)))
        / (1 + z*z/total)
    );

-- 사용
SELECT item_id, wilson_lcb(click_count, impression_count) AS wilson_ctr
FROM action_log_daily
```

**가치**: 모든 ClickHouse 쿼리에서 재사용. 한 번 정의.

### 3-2. Kotlin Wilson LCB 유틸 (common 모듈)

**개선**: `common/utility/statistics/Wilson.kt` 로 추출.

```kotlin
package com.kgd.common.statistics

object Wilson {
    fun lowerConfidenceBound(positives: Long, total: Long, z: Double = 1.96): Double {
        if (total == 0L) return 0.0
        val p = positives.toDouble() / total
        val n = total.toDouble()
        val numerator = p + z*z/(2*n) - z * Math.sqrt(p*(1-p)/n + z*z/(4*n*n))
        val denominator = 1 + z*z/n
        return Math.max(0.0, numerator / denominator)
    }
}
```

추천 외 다른 서비스에서도 활용 가능 (예: search 의 상품 ranking, analytics 의 CTR ranking).

### 3-3. Common Recommendation DTO

**개선**: `common` 모듈에 `RecommendationDto`, `RecommendationItem` 정의.

다른 서비스 (예: gateway, mobile-api) 가 추천 결과 type 참조 가능.

---

## 4. ADR 후보 통합 표

| # | ADR | Phase | 우선순위 | 의존성 |
|---|---|---|---|---|
| 1 | 추천 서비스 도입 단계 | Phase 1 시작 | **High** | - |
| 2 | 데이터 파이프라인 (Spark + ClickHouse + Argo) | Phase 1 | **High** | ADR-1 |
| 3 | ANN 인덱스 선택 (FAISS Python sidecar) | Phase 3 | High | ADR-1, ADR-2 |
| 4 | Hybrid Search + Recommendation 공유 | Phase 3 후 | Medium | ADR-3, #19 |
| 5 | Feature Store 도입 | Phase 3 후 | Medium | ADR-2 |
| 6 | MAB 옵션 (experiment 통합) | Phase 9 후 | Medium | ADR-1 |
| 7 | Position bias 보정 (IPW) | Phase 4 시점 | Low | ADR-1 |
| 8 | Phase 4 Ranking 모델 (DLRM) | Phase 3 후 | **High** | ADR-1, ADR-3 |

---

## 5. 학습 자산 → msa 코드베이스 매핑 (Summary)

| 학습 노트 | msa 적용 위치 |
|---|---|
| §01 Funnel + Two-Stage | recommendation 서비스 전체 구조 |
| §02 유사도 메트릭 | §23 CF Spark Job (PPMI) |
| §03 MF / ALS | §23 옵션 (ALS 사용 시) |
| §04 명명규칙 | 향후 다른 도메인 추천 확장 시 |
| §05 행동 가중합 | §22 ClickHouse SQL + Wilson 결합 |
| §06 Wilson / Bayesian | §22 SQL + common/Wilson 유틸 |
| §07 Geo-aware | 향후 거리 기반 추천 도입 시 (Phase 4+) |
| §08 시즌 / MAB | §25 experiment 통합 + 향후 stb |
| §09 Sentence-BERT | §24 item content embedding input |
| §10 ANN (FAISS/HNSW) | §24 recommendation-ann 서비스 |
| §11 MLT vs Dense | 향후 search Hybrid 도입 시 |
| §12 Wide & Deep | Phase 4 ranking 모델 옵션 |
| §13 Two-Tower | §24 Phase 3 핵심 모델 |
| §14 DLRM | Phase 4 ranking 표준 후보 |
| §15 TabTransformer | Phase 4 대안 |
| §16 Toy training | §24 production 화 기반 |
| §17 Cold-start | §22, §23 의 fallback + 향후 Strategy chain |
| §18 인프라 비교 | ADR-2 의 분석 |
| §19 A/B + MAB | §25 experiment 통합 |
| §20 ADR 3건 | docs/adr/ 에 추가 |
| §21-25 msa 구현 | recommendation 서비스 실제 코드 |

---

## 6. 학습 회고 — Phase 1-10 종합

### 6-1. 달성한 것

- ✅ 추천 시스템의 알고리즘 + 인프라 + 평가 전 영역 deep-dive
- ✅ 사용자 약점 영역 (CF 수식, ANN 파라미터, 딥러닝 모델 구조) 해소
- ✅ msa 본 레포의 추천 서비스 도입 ADR 3건 + 추가 후보
- ✅ Phase 1-3 의 구체 구현 코드 (ClickHouse SQL + Spark + Python + Kotlin)
- ✅ 면접 카드 (§26) — 5단계 꼬리 질문까지 답변 가능

### 6-2. 미달 영역 (향후 학습)

- ⚠️ vt-deep 14종의 정확한 라인업 — 사용자 본인이 회사 코드 확인 필요
- ⚠️ Counterfactual evaluation (IPS / Doubly Robust) — 학술 영역, 산업 적용 미흡
- ⚠️ LLM-based recommendation — 최신 트렌드 (GPT 등 활용)
- ⚠️ Graph-based recommendation — PinSage / LightGCN
- ⚠️ Sequential recommendation — SASRec / BERT4Rec

### 6-3. 다음 학습 토픽 후보

- 데이터 파이프라인 심화 (Spark + BigQuery + Airflow vs Kafka Streams)
- 분산 ML 시스템 설계
- LLM 추천 시스템
- Graph Neural Network 추천

---

## 7. Cross-ref — 마무리

본 파일은 §01-26 의 학습 결과를 production 결정으로 연결하는 마지막 문서. msa 본 레포의 `docs/adr/` 추가, `recommendation/` 서비스 구현, `common/` 유틸 추가의 실행 계획.

각 ADR 후보는 작성 시점에 docs/adr/ 에 새 번호로 추가.

---

**Phase 1-10 학습 완료** ✅
