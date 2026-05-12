# Plan — Recommendation 서비스 Phase 2 (Item-Item CF Spark PoC)

> 작성: 2026-05-12
> 범위: Item-Item CF — 공출현 행렬 + PPMI + Spark Operator + similar-items API
> 학습 근거: `study/docs/20-recommendation-modeling/02` (유사도 메트릭) + `03` (MF/ALS) + `23` (msa CF Spark PoC)
> 선행: ADR-0044 (Phase 1 완료), ADR-0045 (데이터 파이프라인)

---

## 1. 목표

ADR-0044 의 Phase 2. 사용자 이력 기반 **개인화 시작점** — 한 상품과 유사한 상품을 찾는 Item-Item CF.

### 1-1. 비즈니스 가치

- 상품 상세 페이지의 "비슷한 상품" 섹션
- 룰 기반 (Phase 1) 보다 한 단계 개인화 — 사용자가 본 상품의 컨텍스트 활용
- Two-Tower (Phase 3) 의 학습 데이터 (item embedding 초기값) 으로도 활용 가능

### 1-2. 산출물

1. `recommendation/batch` 모듈 신규 — Scala 또는 PySpark
2. Spark Operator (K8s) 도입 — analytics ClickHouse 에서 30일 사용자 행동 추출 → Item-Item 공출현 → PPMI
3. ClickHouse `analytics.item_similarity` 테이블
4. Redis `reco:similar:{itemId}` ZSET (Top-50 per item)
5. REST API `GET /api/v1/recommendations/similar-items?itemId=&limit=`
6. Argo CronWorkflow (weekly 일요일 03:00 KST, batch 시간 길어서 daily 부담)
7. Phase 1 의 `GetSimilarItemsUseCase` 확장 — sparse 시 CB 로 fallback (§17 cold-start)

---

## 2. 학습 자료 → 구현 매핑

| 학습 노트 | Phase 2 적용 |
|---|---|
| §02 §3 Jaccard | Spark `collect_set` + 집합 연산 — 단순 baseline |
| §02 §5 PMI/PPMI | **산업 default — 산업 추천 엔진 vt 와 동일 패턴** |
| §02 §9 보정 | 최소 공출현 ≥ 5, popular item bias 회피 |
| §03 §6 Implicit ALS | 대안 옵션 (Spark MLlib ALS, `implicitPrefs=true`) |
| §17 cold-start fallback | similar 데이터 부족 시 CB 로 보완 |
| §23 msa CF Spark PoC | Spark Scala 코드 그대로 활용 |

---

## 3. 현재 상태 분석 + 영향

### 3-1. 사용 가능 인프라

- ✅ ClickHouse `analytics.recommendation_events` (Phase 1 이미 적재 중)
- ✅ Redis (Phase 1 사용 중, 별도 keyspace `reco:similar:*` 추가)
- ✅ K8s + ArgoCD (Phase 1 사용 중)
- ✅ Wilson LCB / ActionWeightedScore 유틸 (common + recommendation/domain)
- ⏳ Spark Operator — **신규 설치 필요**
- ⏳ Spark image build pipeline — **신규**

### 3-2. 영향 범위

| 컴포넌트 | 영향 |
|---|---|
| `recommendation/domain` | port 추가 (`ItemSimilarityPort`) + Aggregate (`SIMILAR_ITEMS` 종류 이미 정의됨) |
| `recommendation/app` | useCase 추가 + adapter 추가 |
| `recommendation/batch` (신규) | Scala Spark 잡 |
| `analytics` 서비스 | **수정 없음** — ClickHouse 의 같은 테이블 read |
| `gateway` | 라우팅 그대로 (`/api/v1/recommendations/**` 가 이미 모든 endpoint catch) |
| K8s | Spark Operator 설치 + SparkApplication CR + Argo CronWorkflow |
| ADR | ADR-0044 의 Phase 2 acceptance 갱신 |

---

## 4. 결정 사항

### 4-1. 알고리즘 — PPMI vs ALS

**Option A: Spark 수동 공출현 + PPMI** ⭐ 추천
- 학습 §02 §5 의 표준 메트릭
- 단순 + 안정적 + 디버깅 쉬움
- Spark RDD/DataFrame 만으로 구현
- 산업 추천 엔진 vt 패밀리가 정확히 이 패턴
- 결과: Item-Item similarity matrix (sparse)

**Option B: Spark MLlib ALS**
- §03 §6 의 Implicit ALS — Hu, Koren, Volinsky 2008
- user/item embedding 학습 → embedding cosine similarity
- Phase 3 의 Two-Tower 와 결합 가능 (item embedding 재활용)
- 학습 시간 길음 + hyperparameter (rank, regParam) 튜닝

→ **Option A (PPMI)** 로 시작. Option B 는 Phase 3 통합 시 재검토.

### 4-2. 학습 윈도우 — 30일

```
이벤트: action_type IN ('click', 'addwish', 'reservation')   ← view 는 약 시그널이라 제외
윈도우: 30일
최소 공출현: 5번 이상 (sparse 함정 회피)
Top-K per item: 50
```

### 4-3. Spark 실행 환경

```yaml
SparkApplication:
  image: commerce/recommendation-batch:latest
  driver:
    cores: 1
    memory: 2g
  executor:
    cores: 2
    instances: 4
    memory: 4g
  schedule: "0 3 * * 0"  # 매주 일요일 03:00 KST
```

K3s-lite 에서는 resource 제약 — instances=2 로 축소.

### 4-4. ClickHouse 스키마

```sql
CREATE TABLE IF NOT EXISTS analytics.item_similarity (
    item_a UInt64,
    item_b UInt64,
    similarity Float32,
    co_count UInt32,
    metric Enum8('ppmi'=1, 'jaccard'=2, 'cosine'=3),
    computed_at DateTime
) ENGINE = ReplacingMergeTree(computed_at)
ORDER BY (item_a, similarity DESC, item_b)
TTL computed_at + INTERVAL 14 DAY;
```

ReplacingMergeTree — 매 배치 후 같은 (item_a, item_b) 의 새 row 가 이전 row 대체.

### 4-5. Redis 키 패턴

```
reco:similar:{itemId}    → ZSET (member=similarItemId, score=similarity)
TTL: 8일 (weekly batch 이후 안전 마진)
```

---

## 5. 단계별 작업

### Phase 2-A. Domain + Port (0.5h)

1. `ItemSimilarityPort` interface (이미 §21 에서 설계됨, 신규 추가)
2. `GetSimilarItemsUseCase` (이미 §23 에서 설계됨)
3. Cold-start fallback — Strategy chain (§17 §10) 첫 적용

### Phase 2-B. recommendation/batch 모듈 (3h)

4. `settings.gradle.kts` 에 `:recommendation:batch` 추가
5. `recommendation/batch/build.gradle.kts` (Scala + Spark dependencies)
6. `ItemItemCfJob.scala` — §23 §2 코드 그대로
7. Dockerfile + Jib convention 추가 (또는 별도 image)

### Phase 2-C. ClickHouse + Redis Adapter (1h)

8. ClickHouse `item_similarity` 테이블 migration
9. `ItemSimilarityCkAdapter` — ClickHouse 에서 Top-K 조회
10. `RedisItemSimilarityAdapter` — Redis ZSET 조회
11. `ItemSimilaritySync` — ClickHouse → Redis 적재 (CbScoreSync 와 같은 패턴)

### Phase 2-D. Use Case + API (0.5h)

12. `GetSimilarItemsUseCase` 구현
13. `RecommendationController` 에 `/similar-items` 추가
14. Kotest 단위 + 통합 테스트 (cold-start fallback 시나리오)

### Phase 2-E. K8s + Spark Operator (2h)

15. Spark Operator Helm chart 설치 (k3d-commerce 에 추가)
16. `k8s/base/recommendation-batch/sparkapplication.yaml`
17. Argo CronWorkflow `recommendation-similar-weekly`
18. NetworkPolicy 보강 — Spark executor → ClickHouse 허용

### Phase 2-F. 검증 (1h)

19. Spark 잡 수동 trigger → 성공 확인
20. ClickHouse `item_similarity` 적재 확인
21. Redis `reco:similar:{itemId}` 확인
22. `curl GET /api/v1/recommendations/similar-items?itemId=1010&limit=5` 응답 확인
23. Cold-start fallback (희소 item) 동작 확인

**예상 총 시간**: 약 8h

---

## 6. 리스크

### 6-1. Spark Operator 인프라 부담

- K3s-lite 의 단일 노드에서 Spark 실행 → 메모리 압박
- 대안: 로컬에서 일회성 Spark 잡 실행 후 결과를 직접 ClickHouse 에 INSERT (운영 X, prototype)
- 또는 Spark Standalone (Operator 없이) 로 단순화

### 6-2. 데이터 부족

- Phase 1 launch 후 충분한 행동 데이터 누적 전에 Phase 2 시작 시 cold-start
- Mock seed 만으로는 의미 있는 similarity 안 나옴
- → Phase 2 시작 시점: Phase 1 production 1-2개월 후 권장

### 6-3. ALS 회피 vs Two-Tower 통합 결정

- Phase 2 를 PPMI 로 가면 Phase 3 Two-Tower 의 학습 데이터로 직접 못 씀
- ALS 로 가면 Two-Tower 와 통합 쉬움
- 학습 §03 §9-1 의 진화 경로 — MF → Two-Tower 가 자연스러움
- → Phase 2 시점에 재검토

---

## 7. 체크리스트

### Phase 2-A
- [ ] ItemSimilarityPort interface
- [ ] GetSimilarItemsUseCase 구현
- [ ] Cold-start fallback Strategy chain

### Phase 2-B
- [ ] settings.gradle.kts 등록
- [ ] recommendation/batch/build.gradle.kts (Scala 2.13 + Spark 3.5)
- [ ] ItemItemCfJob.scala
- [ ] Dockerfile / Jib 설정

### Phase 2-C
- [ ] ClickHouse V3__item_similarity.sql migration
- [ ] ItemSimilarityCkAdapter
- [ ] RedisItemSimilarityAdapter
- [ ] ItemSimilaritySync

### Phase 2-D
- [ ] RecommendationController /similar-items endpoint
- [ ] Cold-start fallback 테스트
- [ ] End-to-end Kotest

### Phase 2-E
- [ ] Spark Operator 설치 (Helm)
- [ ] SparkApplication manifest
- [ ] Argo CronWorkflow weekly
- [ ] NetworkPolicy Spark → ClickHouse

### Phase 2-F
- [ ] Spark 잡 production trigger
- [ ] item_similarity 데이터 적재 검증
- [ ] API 응답 검증
- [ ] Fallback 동작 검증

---

## 8. 다음 단계 (Phase 2 완료 후)

### 8-1. Phase 2.5 — A/B 검증

- experiment 서비스 통합
- CB (Phase 1) vs Similar (Phase 2) A/B
- CTR / CVR / dwell time 비교

### 8-2. Phase 3 (Two-Tower retrieval)

- 별도 plan: `docs/plans/YYYY-MM-DD-recommendation-phase3.md`
- ADR-0046 (ANN 인덱스 선택) 작성 시점
- Python ML 인프라 (PyTorch + GPU) 도입 결정

### 8-3. Phase 2.6 — ALS 전환 (선택)

PPMI 의 성능 한계 부딪힐 시 Spark MLlib ALS 로 전환. Two-Tower 와 통합 자연.

---

## 9. 학습 자료 cross-ref

| 항목 | 학습 노트 |
|---|---|
| 알고리즘 (PMI / Cosine / Jaccard) | `study/docs/20-recommendation-modeling/02` |
| MF / ALS / Implicit ALS | `study/docs/20-recommendation-modeling/03` |
| Spark CF Job 코드 | `study/docs/20-recommendation-modeling/23` |
| Cold-start fallback chain | `study/docs/20-recommendation-modeling/17` |
| ADR 초안 | `study/docs/20-recommendation-modeling/20` (§20-1 의 Phase 2 부분) |
| 면접 카드 | `study/docs/20-recommendation-modeling/26` (Q1-1-1: 메트릭 선택) |

---

**상태**: Proposed (2026-05-12)
**선결 조건**: Phase 1 production 안정 + A/B 검증 + 1-2개월 행동 데이터 누적
**다음 액션**: Phase 1 운영 안정화 후 Phase 2-A 부터 순차 실행
