---
parent: 20-recommendation-modeling
seq: 18
title: 인프라 비교 — Spark + BigQuery + Airflow vs Kafka Streams + ClickHouse, Feature Store
type: deep
created: 2026-05-12
---

# 18. 인프라 비교 — 산업 스택 vs MSA 스택

> **Phase 8 단일 파일, 사용자 익숙 영역 압축**. 산업 추천 인프라 (Spark + BigQuery + Airflow) 와 msa 의 인프라 (Kafka Streams + ClickHouse) 의 매핑 + trade-off. Feature Store 고려.

---

## 1. 두 스택의 출발점

### 1-1. 산업 OTA 추천 스택 (전형)

```
Source: 행동 로그 (page view, click, purchase)
   ↓ (BigQuery sink)
BigQuery (warehouse, OLAP)
   ↓
   ├─ Airflow DAG (룰 기반 score: cb, lb, sba, th, ...)
   │   → BigQuery 결과 테이블
   │
   └─ Spark Dataproc (CF: vt, st, bt, ct, ...)
       → BigQuery 결과 테이블
   
   ↓ (export job)
Redis / Bigtable / Memorystore (serving cache)
   ↓
Application (실시간 추천 API)
```

특징:
- **Batch 중심** — 매일/매주 학습
- **GCP 통합** — BigQuery + Dataproc + Airflow + Bigtable
- **GitOps** — cloudbuild + Airflow workflow 레포 sync

### 1-2. MSA 추천 스택 (가상)

```
Source: 도메인 이벤트 (Kafka topics)
   ↓
Kafka (event stream)
   ↓
   ├─ Kafka Streams (실시간 집계)
   │   → ClickHouse
   │
   └─ Spark (batch CF) — 향후
       → ClickHouse / object storage
   
ClickHouse (OLAP, score 저장)
   ↓
Redis (serving cache, optional)
   ↓
recommendation 서비스 (Spring Boot, REST API)
```

특징:
- **Stream 중심** — Kafka Streams 실시간
- **On-prem / 자체 인프라** — K8s 위 Spring Boot
- **MSA 패턴** — 도메인별 서비스 분리

---

## 2. 컴포넌트별 매핑

### 2-1. 데이터 수집

| 역할 | 산업 스택 | MSA 스택 |
|---|---|---|
| 이벤트 수집 | BigQuery sink (직접) 또는 GCS | **Kafka** (msa 표준) |
| 형식 | JSON / Avro / Protobuf | **Avro / Protobuf** (스키마 진화) |
| 보관 | BigQuery (저렴, 무한) | ClickHouse / S3 (저렴, 자체 관리) |

**MSA 가 우월한 점**: Kafka 의 실시간 + replay 능력. 산업 BigQuery 는 batch 만.
**산업이 우월한 점**: BigQuery 의 무한 보관 + SQL 분석. MSA 는 ClickHouse 용량 관리 필요.

### 2-2. 배치 처리 — Spark vs Spark

둘 다 Spark 사용 가능:
- 산업: GCP Dataproc (Scala 2.11, Spark 2.4.4)
- MSA: K8s 위 Spark Operator (최신 Scala 2.13, Spark 3.5)

**산업의 보수성**: 2.4.4 가 안정적이라 업그레이드 안 함. 7년 된 버전.
**MSA 의 유연성**: 최신 버전 도입 자유. 단점은 운영 안정성 검증 필요.

### 2-3. OLAP — BigQuery vs ClickHouse

| 축 | BigQuery | ClickHouse |
|---|---|---|
| **타입** | Managed (GCP) | Self-hosted (또는 ClickHouse Cloud) |
| **쿼리** | SQL (BigQuery dialect) | SQL (ClickHouse dialect) |
| **속도** | 수십 초~수분 (large) | **밀리초~초** (real-time) |
| **비용** | Pay-per-query | 인스턴스 기반 |
| **스케일** | 자동, 무한 | 클러스터 수동 관리 |
| **실시간 ingestion** | 약함 (streaming insert 비쌈) | **강함** (실시간 표준) |

**선택 기준**:
- 대규모 batch + 저비용 보관 → BigQuery
- 실시간 dashboard + 빠른 쿼리 → ClickHouse
- 둘 다 → 양쪽 운영 (산업은 BigQuery 만, MSA 는 ClickHouse 가 표준)

### 2-4. 워크플로 오케스트레이션

| 역할 | 산업 스택 | MSA 스택 |
|---|---|---|
| 도구 | Airflow | (현재 없음, 도입 후보) |
| 스케줄링 | Airflow DAG | K8s CronJob (단순) 또는 Argo Workflows |
| 의존성 | Airflow 의 task dependency | K8s 의 init container 또는 Argo |

**MSA 의 빈자리**: Airflow 같은 정교한 DAG 도구 미도입. 도입 후보 → ADR.

### 2-5. Serving 인프라

| 역할 | 산업 스택 | MSA 스택 |
|---|---|---|
| Score 저장 | Bigtable / Memorystore | ClickHouse + Redis |
| 룰 lookup | Bigtable 의 row-by-row read | ClickHouse query + Redis 캐시 |
| Embedding ANN | FAISS 서비스 (Python) | (도입 후보) — FAISS / ES knn / Qdrant |
| Latency | ~10ms | ~10ms (목표) |

---

## 3. 빌드/배포 패턴 비교

### 3-1. 산업 — `cloudbuild-dags.yaml` GitOps

```yaml
# 각 추천 엔진 repo 의 cloudbuild-dags.yaml
steps:
  - name: 'gcr.io/cloud-builders/gcloud'
    args: [
      'storage', 'cp', '-r', 'dags/',
      'gs://airflow-workflows-bucket/dags/'
    ]
```

- 각 추천 엔진이 자체 DAG 정의
- Cloud Build 가 Airflow GCS 버킷에 동기화
- Airflow 가 자동 인식

**장점**: 엔진별 자율성. 운영팀 개입 없이 배포.
**단점**: 코드 중복 (morelike-com/offer 처럼).

### 3-2. MSA — Helm + ArgoCD GitOps

```yaml
# recommendation 서비스의 Helm chart
apiVersion: v2
name: recommendation
version: 1.0.0
dependencies:
  - name: spark-operator
  - name: clickhouse
```

- 모든 컴포넌트가 K8s 리소스
- ArgoCD 가 Git 상태와 클러스터 동기화
- Spark job 도 K8s 위에서 실행

**장점**: 통합 운영. 모든 인프라가 K8s.
**단점**: K8s 학습 곡선.

---

## 4. 기능 매핑 — 산업 → MSA 적용

### 4-1. 룰 기반 추천 (cb, lb, sba) — MSA 적용

산업: BigQuery + Airflow DAG 으로 매일 산출 → Bigtable 캐시.
MSA: **ClickHouse SQL** 로 동일 패턴.

```sql
-- ClickHouse 의 cb (Category Best) 구현
WITH offer_actions_30d AS (
  SELECT
    offer_id, city_id, category_id,
    sum(if(action = 'reservation', 1, 0)) AS reservation_cnt,
    sum(if(action = 'click', 1, 0)) AS click_cnt,
    sum(if(action = 'addwish', 1, 0)) AS addwish_cnt,
    sum(if(action = 'pageview', 1, 0)) AS pageview_cnt
  FROM action_log
  WHERE event_date >= today() - 30
  GROUP BY offer_id, city_id, category_id
)
SELECT
  city_id, category_id, offer_id,
  reservation_cnt * 100 + click_cnt * 20 + addwish_cnt * 10 + pageview_cnt AS score
FROM offer_actions_30d
ORDER BY city_id, category_id, score DESC
LIMIT 100 BY city_id, category_id
```

ClickHouse 의 `LIMIT N BY` 는 BigQuery 의 `ROW_NUMBER() OVER PARTITION` 와 동등.

### 4-2. CF (vt, bt) — MSA 적용

산업: Spark Dataproc + Scala.
MSA: K8s 위 Spark Operator + Kotlin/Scala/Python 선택.

```scala
// Spark CF (vt, View Together) 패턴
val viewLog = spark.table("action_log").filter($"action" === "view")

val viewPairs = viewLog
  .select($"user_id", $"item_id")
  .groupBy($"user_id")
  .agg(collect_list($"item_id").as("items"))

val itemPairs = viewPairs
  .flatMap { row =>
    val items = row.getAs[Seq[String]]("items")
    for (a <- items; b <- items if a != b) yield (a, b)
  }
  .toDF("item_a", "item_b")
  .groupBy($"item_a", $"item_b")
  .count()

// PMI / Jaccard / Cosine 계산
val itemSim = itemPairs
  .join(itemCounts.alias("ca"), $"item_a" === $"ca.item_id")
  .join(itemCounts.alias("cb"), $"item_b" === $"cb.item_id")
  .withColumn("pmi", log($"count" * lit(totalUsers) / ($"ca.count" * $"cb.count")))
```

결과를 ClickHouse 또는 Redis 에 저장 → 실시간 lookup.

### 4-3. ANN Serving — MSA 적용

산업: Python Flask + waitress + FAISS.
MSA 선택지:
- **Python sidecar** — 비슷한 패턴
- **Kotlin 내장** — ONNX Runtime + DJL (Deep Java Library)
- **ES knn** — 기존 search 서비스 활용 (#19 §08)

각 옵션 → Phase 10 §20 의 ADR 후보.

---

## 5. Feature Store — 차세대 패러다임

### 5-1. Feature Store 의 정체

학습 / serving 시 동일한 feature 보장 위한 데이터 인프라.

```
Training (batch):
   user feature, item feature → 학습 데이터 → 모델 학습

Serving (real-time):
   user_id, item_id → feature lookup → 모델 inference

문제: 학습 시 feature 와 serving 시 feature 가 다르면 모델 성능 저하 (training-serving skew)
```

Feature Store 가 **single source of truth** 로 두 path 통합.

### 5-2. 도구 비교

| 도구 | 출처 | 특징 |
|---|---|---|
| **Feast** | Open source, Tecton 사 | 가장 흔함, K8s 친화 |
| **Tecton** | SaaS (Feast 기반) | 매니지드 |
| **Vertex AI Feature Store** | GCP | BigQuery 통합 |
| **SageMaker Feature Store** | AWS | SageMaker 통합 |
| **자체 구현** | DIY | Redis + warehouse 결합 |

산업: 자체 구현 (대부분), Vertex AI 점진 도입.
MSA: Feast 또는 자체 구현 (ClickHouse + Redis).

### 5-3. MSA 의 Feature Store ADR 후보

```
Phase 1 (현재): 자체 구현
   - Offline: ClickHouse (학습 데이터)
   - Online: Redis (serving feature)
   - 동기화: Kafka Streams 로 ClickHouse → Redis 실시간
   
Phase 2 (확장): Feast 도입
   - 표준화된 feature 정의 + versioning
   - Training-serving consistency 자동 보장
```

---

## 6. ADR 후보 — 추천 데이터 파이프라인

Phase 10 §20 의 ADR 3건 중 "추천 데이터 파이프라인" 의 핵심:

### 6-1. 선택지

**Option A: Kafka Streams + ClickHouse + Redis (MSA native)**
- ✅ msa 인프라 100% 활용
- ✅ 실시간 강함
- ❌ Spark 잡 도입 시 인프라 추가
- ❌ Airflow 없음 (복잡한 DAG 어려움)

**Option B: Spark + BigQuery + Airflow (산업 표준)**
- ✅ 검증된 산업 패턴
- ❌ GCP 의존 (msa 는 self-hosted)
- ❌ 실시간 약함
- ❌ msa 와 인프라 이원화

**Option C: Spark + ClickHouse + Argo Workflows (Hybrid)**
- ✅ Spark CF 가능 + ClickHouse 활용
- ✅ Argo 가 Airflow 대체 (K8s native)
- ✅ msa 인프라 통합
- ❌ Argo Workflows 학습 곡선
- → **추천**

### 6-2. ADR 작성 패턴

```markdown
# ADR-XXXX: 추천 데이터 파이프라인 — Spark + ClickHouse + Argo

## 결정
Spark Operator + ClickHouse + Argo Workflows 로 추천 데이터 파이프라인 구축.

## 배경
- msa 인프라 (Kafka, ClickHouse) 활용
- Airflow 같은 정교한 DAG 필요
- Spark CF 잡 도입

## 대안
- Option A: Kafka Streams 만으로 → CF 어려움
- Option B: BigQuery + Airflow → 인프라 이원화
- Option C: Spark + ClickHouse + Argo → 통합

## 결과
- Kafka → ClickHouse (실시간 집계, Kafka Streams)
- Spark CF 잡 → ClickHouse (배치 학습)
- Argo Workflows 로 의존성 관리
```

---

## 7. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "산업 스택을 그대로 msa 에 적용" | GCP 의존성 + msa 의 self-hosted 철학 충돌. 본질 (Spark + 분석 DB + 워크플로) 만 매핑. |
| 2 | "ClickHouse 가 BigQuery 대체" | 비슷하지만 다름. 무한 보관 / 자동 스케일 부족. 운영 부담 + 용량 관리. |
| 3 | "Airflow 없이 K8s CronJob 으로 충분" | 의존성 + 재시도 + 모니터링 약함. Argo Workflows 가 더 적합. |
| 4 | "Feature Store 가 over-engineering" | 학습-서빙 skew 가 추천 성능에 큰 영향. 일정 규모 이상에서 필수. |
| 5 | "산업 시스템의 GitOps 그대로 적용" | cloudbuild → ArgoCD 매핑. 원리는 같지만 도구 다름. |
| 6 | "Kafka Streams 가 Spark 대체" | 실시간 OK, batch CF (수백 GB 데이터) 는 Spark 가 우월. 둘 다 필요. |
| 7 | "OnPrem 자체 운영이 더 저렴" | 인력 비용 포함하면 매니지드 (GCP) 가 저렴할 수 있음. TCO (Total Cost of Ownership) 계산. |

---

## 8. 꼬리 질문 (§26 면접 카드 후보)

1. **BigQuery 와 ClickHouse 의 선택 기준은?**
   - 답: BigQuery — 매니지드 + 무한 보관 + 자동 스케일, pay-per-query. 대규모 batch 분석에 우월. ClickHouse — self-hosted + 밀리초 쿼리 + 실시간 ingestion, 인스턴스 기반. 실시간 dashboard 에 우월. 둘 다 운영도 가능 (역할 분리).

2. **Feature Store 가 학습-서빙 skew 를 어떻게 해결?**
   - 답: 학습 시 feature pipeline 과 serving 시 feature pipeline 분리되어 있으면 미묘한 차이 발생 (집계 윈도우, NULL 처리, time-zone). Feature Store — 동일한 feature 정의를 offline (학습 데이터) + online (serving) 양쪽 제공. Single source of truth.

3. **Kafka Streams vs Spark Streaming 선택은?**
   - 답: Kafka Streams — Kafka 클라이언트 라이브러리, 가벼움, micro-batch 없음. Spark Streaming — Spark 의 micro-batch 모델, 풍부한 API. 단순 실시간 집계 → Kafka Streams. 복잡한 변환 + ML → Spark. 추천에서는 보통 둘 다 (실시간 집계 + batch 학습).

4. **Airflow 와 Argo Workflows 의 차이는?**
   - 답: Airflow — Python DSL 로 DAG 정의, scheduler 가 분리 (Celery / K8s executor). 풍부한 operator. Argo Workflows — K8s native, YAML 정의, Pod 기반 task. K8s 와 통합 우월. msa 의 K8s 위 운영에 자연.

5. **msa 추천 도입의 최소 인프라는?**
   - 답: Phase 1 (룰 기반 CB): ClickHouse + Redis + Spring Boot. Spark 불필요. Phase 2 (CF): Spark Operator 추가. Phase 3 (Two-Tower ANN): Python sidecar 또는 ONNX Runtime + FAISS. 점진적 도입.

---

## 9. cross-ref

| 주제 | 연결된 study |
|---|---|
| Kafka 인프라 | #6 (msa 의 이벤트 수집) |
| ClickHouse | analytics 서비스 (msa 본 레포) |
| K8s 운영 + GitOps | #11 (ArgoCD, Helm) |
| 분산 시스템 batch vs stream | #7 |
| Spark / BigQuery 일반 | 향후 데이터 파이프라인 토픽 |
| ADR 작성 | docs/adr/ 표준 |
| msa 추천 도입 단계 | Phase 10 §20 (ADR 3건) |
