---
parent: 20-recommendation-modeling
seq: 20
title: ADR 3건 작성 — 추천 서비스 도입 단계 + 데이터 파이프라인 + ANN 인덱스 선택
type: deep
created: 2026-05-12
---

# 20. ADR 3건 — msa 추천 서비스 도입

> **Phase 10 시작**. msa 본 레포의 `docs/adr/` 에 추가할 ADR 3건의 초안. 실제 ADR 번호는 작성 시점에 확정.

---

## ADR-XXXX-1: MSA 추천 서비스 도입 단계

### Status
Proposed (2026-05-12)

### Context

msa 본 레포에 추천 서비스 미구현. 추천 시스템 도입의 비즈니스 가치 큼 (cross-sell, retention, GMV). 그러나 한 번에 풀스택 (Two-Tower, DLRM, ANN) 구축은 비용/리스크 큼.

산업 검증 — **단계적 도입 (incremental delivery)** 이 추천 시스템의 성공 패턴. 룰 기반 → CF → DL 순서로 진화.

### Decision

4단계 도입:

**Phase 1: 룰 기반 Category Best (룰 기반 retrieval)**
- 산출물: `recommendation` 서비스 + ClickHouse SQL 룰 기반 CB
- 알고리즘: 행동 가중합 + Wilson LCB (사용자 약점 영역 §06 활용)
- 도메인: 도시×카테고리 Top-N
- 가치: cold-start 안전망, 운영 개입 가능, 즉시 production

**Phase 2: CF Spark PoC (Item-Item CF retrieval)**
- 산출물: `recommendation/batch` 모듈 + Spark 잡
- 알고리즘: 공출현 행렬 + PPMI (§02 §5 활용) 또는 ALS (§03)
- 도메인: 상품 간 유사도
- 가치: 개인화 시작 — 사용자 이력 기반

**Phase 3: Two-Tower retrieval (deep retrieval)**
- 산출물: Python 사이드카 또는 ONNX Runtime + FAISS
- 알고리즘: Two-Tower (§13) + ANN (§10)
- 도메인: 사용자별 personalized 추천
- 가치: deep embedding 의 scalable serving

**Phase 4 (향후): DLRM Ranking**
- 산출물: ranking 모델 도입 (Funnel Stage 2)
- 알고리즘: DLRM (§14) 또는 Wide & Deep (§12)
- 가치: precision ↑ Top-K quality

### Consequences

**긍정**:
- 단계별 가치 확인 — 매 Phase 가 production
- 리스크 분산 — 한 단계 실패해도 다음 갈 수 있음
- 인프라 점진 도입 — Spark, ANN serving 등 필요한 시점에

**부정**:
- 4 단계 운영 = 4 종 인프라 동시 관리
- Phase 1 → Phase 4 의 코드 진화 부담
- 단기 ROI 작음 — Phase 1 만으로는 큰 매출 효과 어려움

**리스크 완화**:
- 각 Phase 마다 A/B 테스트로 정량 검증
- Phase 별 인프라가 누적 (이전 단계 폐기 안 함)
- Fallback 체인 — 신상품 cold-start 는 항상 Phase 1 (룰 기반) 가능

### Alternatives Considered

- **A. 한 번에 Two-Tower 도입**: 학습 인프라 + 서빙 인프라 동시 구축. 리스크 큼. 단기 가치 부재.
- **B. 룰 기반만 유지**: 개인화 가치 손실. CTR/CVR ceiling 명확.
- **C. 외부 SaaS (Amazon Personalize, Vertex AI)**: 비용 + 데이터 외부 이동. 자체 운영 우선 원칙과 충돌.

→ Phase 별 도입이 비용/가치/리스크 균형 최적.

### Cross-ref
- §17 (Cold-start 3축 — Phase 1 의 fallback 역할)
- §22-24 (구현 세부)

---

## ADR-XXXX-2: 추천 데이터 파이프라인 — Spark + ClickHouse + Argo Workflows

### Status
Proposed (2026-05-12)

### Context

추천 도입 시 (1) 사용자 행동 수집, (2) 점수/임베딩 산출, (3) serving cache 갱신 의 데이터 파이프라인 필요. msa 본 레포의 인프라 (Kafka, ClickHouse) 와 통합되어야 함.

### Decision

다음 구성:

```
Source: 사용자 행동 이벤트
   ↓
Kafka topic: recommendation.events.*
   ↓
   ├─ Kafka Streams → ClickHouse (실시간 집계)
   │   * Phase 1 의 ClickHouse SQL 룰 기반 score 입력
   │
   └─ Spark batch → ClickHouse / S3 (CF 학습)
       * Phase 2 의 Item-Item CF 산출
   
Argo Workflows: DAG 오케스트레이션
   - Daily: ClickHouse aggregation refresh
   - Weekly: Spark CF 재학습
   - On-demand: Embedding ANN 재빌드 (Phase 3)
   
Redis: serving cache (도시×카테고리 Top-N, item similarity Top-K)
```

### Consequences

**긍정**:
- msa 인프라 100% 활용 (Kafka, ClickHouse, K8s)
- Self-hosted — 외부 의존성 없음
- Argo Workflows 가 K8s native — Airflow 의 분리 인프라 회피
- 실시간 (Kafka Streams) + Batch (Spark) 둘 다 지원

**부정**:
- Argo Workflows 학습 곡선 (Airflow 더 흔함)
- ClickHouse 용량 관리 자체 부담 (BigQuery 처럼 자동 안 됨)
- Spark Operator 운영 부담

### Alternatives Considered

- **A. Kafka Streams 만으로**: CF 같은 batch 학습 어려움.
- **B. BigQuery + Airflow (산업 표준)**: GCP 의존 + msa 인프라 이원화.
- **C. Spark + Airflow + ClickHouse**: Airflow 인프라 추가 = K8s 외부 운영. Argo 가 더 자연.
- **D. 단순 K8s CronJob**: 의존성 관리 / 재시도 / 모니터링 약함.

→ Spark + ClickHouse + Argo 가 msa 의 K8s 통합 + 산업 본질 결합.

### Cross-ref
- §18 (인프라 비교 — 본 ADR 의 분석)
- analytics 서비스 (Kafka Streams + ClickHouse 사용 사례)
- #11 K8s + ArgoCD

---

## ADR-XXXX-3: 임베딩 ANN 인덱스 선택 — FAISS Python Sidecar

### Status
Proposed (2026-05-12, Phase 3 도입 시점)

### Context

Phase 3 의 Two-Tower retrieval 시 임베딩 ANN 서빙 필요. 옵션:

1. **FAISS (Python sidecar)**: 별도 Python 서비스로 FAISS 인덱스 운영
2. **ES knn (native)**: 기존 search 서비스의 ES 에 dense_vector + knn
3. **Qdrant / Milvus (전용 Vector DB)**: 별도 인프라
4. **ONNX Runtime + DJL (Kotlin 내장)**: recommendation 서비스에 직접 통합

### Decision

**Option 1: FAISS Python Sidecar** 선택.

이유:
- ✅ **검증된 성숙** — FAISS 는 Meta 산업 표준
- ✅ **알고리즘 풍부** — IVF / PQ / HNSW 등 선택 가능
- ✅ **Python ML 생태계** — 모델 학습 후 즉시 활용
- ✅ **Decoupling** — 임베딩 모델 변경 시 recommendation 서비스 영향 없음
- ✅ **GPU 지원** — 향후 대규모 vector 검색

배포:
- `recommendation-ann` Python 서비스 (FastAPI + FAISS)
- gRPC 또는 REST 로 recommendation 서비스와 통신
- K8s Deployment + Service

### Consequences

**긍정**:
- FAISS 성숙도 + 유연성
- Python ML 친화
- recommendation 서비스 (Kotlin) 와 분리

**부정**:
- 두 서비스 운영 (Kotlin + Python)
- 네트워크 hop 추가 (1~2ms latency)
- 서비스 간 인증/모니터링 분리

### Alternatives Considered

**Option 2: ES knn (native)**
- ✅ 기존 인프라 활용
- ✅ Hybrid Search (BM25 + dense) 자연스러움
- ❌ ES 알고리즘 = HNSW 만 (다른 알고리즘 못 씀)
- ❌ Vector 만 운영하기에는 ES 무거움
- → 검색-추천 통합 가치 있을 때 재고

**Option 3: Qdrant**
- ✅ Rust 기반 빠름
- ✅ 풍부한 필터링
- ❌ 새 인프라 추가
- → 추후 ES 한계 시 도입

**Option 4: ONNX Runtime + DJL**
- ✅ recommendation 서비스 내장 — 네트워크 hop 없음
- ❌ FAISS 풍부함 부족
- ❌ Kotlin 의 ML 생태계 약함
- → Latency 매우 critical 한 use case 만

### Implementation Notes

```yaml
# recommendation-ann (Python FastAPI + FAISS)
service: recommendation-ann
image: recommendation-ann:1.0.0
endpoints:
  - POST /search
    body: { "user_vector": [...], "k": 100 }
    response: { "item_ids": [...], "scores": [...] }
  - POST /reindex
    body: { "items": [{ "id": ..., "vector": [...] }, ...] }

deployment:
  replicas: 2
  resources:
    requests: { cpu: 1, memory: 8Gi }
    limits:   { cpu: 4, memory: 16Gi }
```

### Cross-ref
- §10 (ANN 알고리즘 비교)
- §13 (Two-Tower)
- §24 (구현 세부)
- §18 (인프라 trade-off)

---

## 4. ADR 작성 체크리스트

각 ADR 의 표준 섹션:
- [x] Status (Proposed / Accepted / Deprecated)
- [x] Context (왜 결정이 필요한가)
- [x] Decision (무엇을 선택했는가)
- [x] Consequences (긍정 / 부정 / 리스크 완화)
- [x] Alternatives Considered (대안 비교)
- [x] Cross-ref (관련 문서)

msa 본 레포의 `docs/adr/` 표준에 맞춰 작성. 번호는 작성 시점에 확정.

---

## 5. ADR 3건 통합 도식

```
ADR-XXXX-1 (도입 단계, "무엇을")
   ↓ 결정: Phase 1~4 단계별
   
ADR-XXXX-2 (데이터 파이프라인, "어떻게 데이터")
   ↓ 결정: Spark + ClickHouse + Argo
   
ADR-XXXX-3 (ANN 인덱스, "어떻게 서빙")
   ↓ 결정: FAISS Python Sidecar (Phase 3 시점)
```

3 ADR 이 결합되어 추천 시스템 전체의 아키텍처 결정.

---

## 6. cross-ref

| 주제 | 연결된 study |
|---|---|
| 산업 인프라 분석 | §18 |
| ANN 인덱스 비교 | §10 |
| Two-Tower | §13 |
| msa 본 레포 ADR 표준 | docs/adr/ |
| 다음 단계: 스캐폴딩 | §21 |
