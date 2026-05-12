# Plan — Recommendation 서비스 Phase 1 (룰 기반 Category Best)

> 작성: 2026-05-12
> 범위: Full Phase 1 — Domain + App + Argo Workflow + Gateway 라우팅
> 데이터 소스: analytics 서비스의 ClickHouse 활용 (recommendation_events 테이블 신규)
> 학습 근거: `study/docs/20-recommendation-modeling/` (§01-27, 12K 줄)

---

## 1. 목표

msa 본 레포에 **첫 추천 서비스 도입**. 룰 기반 Category Best 알고리즘으로 도시×카테고리 단위 인기 상품을 산출 → 노출. 향후 Phase 2 (CF Spark) / Phase 3 (Two-Tower ANN) 의 토대.

### 1-1. 비즈니스 가치

- 추천 서비스 production 진입 (현재 미존재)
- Cold-start 안전망 — 모든 후속 Phase 의 fallback 역할
- ClickHouse / Redis / Kafka 등 기존 인프라 100% 재활용
- 운영 개입 (business boost) 가능한 단순 알고리즘 — 운영팀 학습 부담 적음

### 1-2. 산출물

1. `recommendation/domain` + `recommendation/app` nested submodule
2. ClickHouse 의 `analytics.recommendation_events` 테이블 + Materialized View
3. Argo CronWorkflow (daily ClickHouse → Redis sync)
4. REST API `GET /api/v1/recommendations/category-best`
5. Kafka topic `recommendation.event.tracked` (이벤트 수집 채널)
6. Gateway 라우팅 + Ingress
7. ADR-XXXX-1 (도입 단계) 의 Phase 1 Acceptance 갱신

---

## 2. 학습 자료 → 구현 매핑

| 학습 노트 | 본 plan 적용 위치 |
|---|---|
| §05 행동 가중합 `100:20:10:1` | ClickHouse SQL 의 score 계산식 |
| §06 Wilson LCB | ClickHouse UDF + Kotlin common 유틸 |
| §02 §10 sparse 함정 | 최소 노출 필터 (action_count ≥ 10) |
| §17 cold-start fallback | 향후 Phase 2/3 에 fallback chain 추가 시 활용 |
| §20 ADR-1/2 초안 | docs/adr/ 에 정식 ADR 작성 |
| §21 스캐폴딩 가이드 | recommendation/domain + app 구조 |
| §22 룰 기반 CB 구현 | ClickHouse SQL + Redis sync + API 코드 그대로 |

---

## 3. 현재 상태 분석

### 3-1. analytics 서비스 (이미 운영 중)

- `analytics.events` (raw) + `analytics.product_scores` (집계) 테이블 운영
- Kafka Streams 가 1시간 윈도우로 `analytics.event.collected` → `analytics.product_scores` 적재
- `AnalyticsStreamTopology.kt` 의 패턴 재활용 가능

### 3-2. 추천 도입 시 영향

- analytics ClickHouse 에 **테이블 1개 추가** (`analytics.recommendation_events`)
- `analytics.event.collected` 의 일부 event_type 을 recommendation 서비스가 별도로 consume
  - **두 서비스가 같은 topic 을 다른 consumer group 으로 consume** — Kafka 의 자연스러운 fan-out
- analytics 서비스 코드는 **수정 없음** (recommendation 이 독립 consume)

### 3-3. 신규 인프라

- `recommendation` Spring Boot 서비스 (port 8092)
- ClickHouse 의 `recommendation_events` 테이블 + Materialized View
- Argo CronWorkflow (daily 02:00)
- Redis 키 `reco:cb:{cityId}:{categoryId}` (ZSET)

---

## 4. 결정 사항

### 4-1. ClickHouse 스키마 — analytics DB 공유

```sql
-- 신규 테이블 (analytics DB 내)
CREATE TABLE analytics.recommendation_events (
    user_id UInt64,
    item_id UInt64,
    action_type Enum8('pageview'=1, 'click'=2, 'addwish'=3, 'reservation'=4),
    city_id UInt32,
    category_id UInt32,
    timestamp DateTime64(3)
) ENGINE = MergeTree()
ORDER BY (city_id, category_id, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 90 DAY;

-- 일별 집계 Materialized View
CREATE MATERIALIZED VIEW analytics.recommendation_score_daily
ENGINE = SummingMergeTree()
ORDER BY (city_id, category_id, item_id, event_date)
AS SELECT
    city_id, category_id, item_id,
    toDate(timestamp) AS event_date,
    sumIf(1, action_type='reservation') AS reservation_count,
    sumIf(1, action_type='click') AS click_count,
    sumIf(1, action_type='addwish') AS addwish_count,
    sumIf(1, action_type='pageview') AS pageview_count
FROM analytics.recommendation_events
GROUP BY city_id, category_id, item_id, event_date;

-- Wilson LCB UDF (재사용 가능, 다른 추천에서도 활용)
CREATE FUNCTION analytics.wilson_lcb AS (positives, total) -> 
    if(total = 0, 0,
        let p = positives / total in
        let z = 1.96 in
        (p + z*z/(2*total) - z * sqrt(p*(1-p)/total + z*z/(4*total*total)))
        / (1 + z*z/total)
    );
```

### 4-2. Kafka Topic 컨벤션

- **신규 topic**: `recommendation.event.tracked` (발행용 — 추후 다른 시스템이 추천 노출 이벤트 publish)
- **공유 topic**: `analytics.event.collected` (소비, consumer group `recommendation-events-consumer`)
- DLQ: `recommendation.event.tracked.DLT` (자동)

### 4-3. 모듈 구조

```
recommendation/
├── domain/
│   ├── build.gradle.kts                          # common 만 의존
│   └── src/main/kotlin/com/kgd/recommendation/
│       ├── recommendation/
│       │   ├── Recommendation.kt                 # Aggregate
│       │   ├── RecommendationItem.kt
│       │   ├── RecommendationType.kt
│       │   └── RecommendationContext.kt
│       ├── port/
│       │   └── RecommendationRepository.kt
│       └── service/
│           └── ActionWeightedScore.kt            # §05 행동 가중합
└── app/
    ├── build.gradle.kts                          # Spring Boot
    └── src/main/kotlin/com/kgd/recommendation/
        ├── application/usecase/
        │   └── GetCategoryBestUseCase.kt
        ├── presentation/
        │   └── RecommendationController.kt
        ├── infrastructure/
        │   ├── persistence/
        │   │   └── RedisRecommendationAdapter.kt
        │   └── kafka/
        │       └── RecommendationEventConsumer.kt
        └── batch/
            └── CbScoreSync.kt                    # Argo 가 호출하는 sync 잡
```

`common/` 에 Wilson 유틸 추가:
```
common/src/main/kotlin/com/kgd/common/statistics/Wilson.kt
common/src/test/kotlin/com/kgd/common/statistics/WilsonSpec.kt
```

### 4-4. K8s Manifest

```
k8s/base/recommendation/
├── deployment.yaml      # port 8092, resources 512Mi
├── service.yaml         # ClusterIP
├── serviceaccount.yaml
└── kustomization.yaml

k8s/overlays/k3s-lite/recommendation/
├── kustomization.yaml   # redis-standalone 패치
└── (필요 시) resources-reduce.yaml
```

### 4-5. Gateway 라우팅

`gateway/src/main/resources/application.yml` 에 추가:
```yaml
- id: recommendation-service
  uri: http://recommendation:8092
  predicates:
    - Path=/api/v1/recommendations/**
  filters:
    - name: CircuitBreaker
      args:
        name: recommendationCircuit
        fallbackUri: forward:/recommendation-fallback

- id: actuator-recommendation
  uri: http://recommendation:8092
  predicates: [Path=/svc/recommendation/actuator/**]
  filters: [StripPrefix=2]
```

### 4-6. Argo Workflow — Daily Sync

```yaml
# k8s/base/recommendation/argo-workflow.yaml
apiVersion: argoproj.io/v1alpha1
kind: CronWorkflow
metadata:
  name: recommendation-cb-daily
spec:
  schedule: "0 2 * * *"
  workflowSpec:
    entrypoint: cb-pipeline
    templates:
      - name: cb-pipeline
        steps:
          - - name: sync-to-redis
              template: clickhouse-to-redis
      - name: clickhouse-to-redis
        container:
          image: ${IMAGE_RECOMMENDATION_BATCH}
          command: [java, -jar, /app/recommendation-batch.jar, --job=cb-sync]
```

---

## 5. 단계별 작업 (실행 순서)

### Phase 1-A. 기반 (1-2h)

1. `settings.gradle.kts` 에 `recommendation:domain`, `recommendation:app` 등록
2. `recommendation/domain/build.gradle.kts` 작성 (common 의존)
3. `recommendation/app/build.gradle.kts` 작성 (Spring Boot + ClickHouse JDBC + Spring Kafka + Redis)
4. `common/.../statistics/Wilson.kt` 추가 + Kotest test
5. ADR-XXXX-1/2 정식 작성 → `docs/adr/`

### Phase 1-B. Domain (0.5h)

6. `Recommendation`, `RecommendationItem`, `RecommendationType`, `RecommendationContext` 정의
7. `RecommendationRepository` port 정의
8. `ActionWeightedScore` 도메인 서비스 (`100:20:10:1` 가중합)

### Phase 1-C. Infrastructure — ClickHouse + Redis (1.5h)

9. ClickHouse 스키마 마이그레이션 (Flyway-style, `db/migration/V1__recommendation_events.sql`)
   - analytics DB 에 권한 필요 — 별도 user `recommendation_writer` 추가
10. `RedisRecommendationAdapter` — ZSET 기반 룩업
11. `CbScoreSync` — ClickHouse `recommendation_score_daily` 쿼리 + Redis `reco:cb:{cityId}:{categoryId}` 적재
12. `RecommendationEventConsumer` — `analytics.event.collected` 의 event_type=view/click/addwish/reservation 만 consume → ClickHouse `recommendation_events` insert

### Phase 1-D. Application + Presentation (0.5h)

13. `GetCategoryBestUseCase` — port 호출만
14. `RecommendationController` — `GET /api/v1/recommendations/category-best?cityId=&categoryId=&limit=`
15. `application.yml` (port 8092, Redis/ClickHouse/Kafka 설정)
16. Kotest BehaviorSpec — 단위 + 통합 (Testcontainers ClickHouse + Redis)

### Phase 1-E. K8s + Gateway (1h)

17. `k8s/base/recommendation/` 의 4개 manifest 작성
18. `k8s/overlays/k3s-lite/recommendation/` overlay 추가
19. `gateway/.../application.yml` 에 라우트 추가
20. Argo CronWorkflow manifest 추가
21. `docker/Dockerfile` 사용 가능 확인 (MODULE_GRADLE=recommendation:app)

### Phase 1-F. 검증 (0.5h)

22. `./gradlew :recommendation:app:build` 성공
23. `kubectl apply -k k8s/overlays/k3s-lite` 정상 배포
24. `curl http://localhost/api/v1/recommendations/category-best?cityId=1&categoryId=1&limit=20` 응답 확인
25. Argo Workflow 수동 trigger → Redis 키 확인

**예상 총 시간**: 약 5-6h

---

## 6. 영향 범위 / 리스크

### 6-1. 영향 받는 컴포넌트

| 컴포넌트 | 영향 | 비고 |
|---|---|---|
| `settings.gradle.kts` | +2 lines | 안전 |
| `common` 모듈 | +Wilson.kt (~50 lines) | 안전 |
| `analytics` 서비스 | **수정 없음** | 단지 같은 ClickHouse + Kafka topic 공유 |
| `gateway` 서비스 | +2 routes in application.yml | low risk |
| analytics ClickHouse | +1 테이블 + 1 MV + 1 UDF | 운영 권한 필요 |
| K8s | +manifest 4개 + overlay | 신규 deployment |
| `docs/adr/` | +ADR-XXXX-1/2 | docs only |

### 6-2. 리스크

- **ClickHouse 권한**: `recommendation_writer` user 추가 필요. DBA / DevOps 협의.
- **Kafka topic 공유**: `analytics.event.collected` 을 두 서비스가 다른 consumer group 으로 → Kafka 내장 fan-out 으로 안전하지만 **메시지 retention** 확인 필요 (현재 7일이면 OK).
- **Cold-start 데이터**: Phase 1 launch 시점에 ClickHouse 에 데이터 없음 → 초기 1-2일은 빈 응답. **Mock seeding script** 으로 demo 데이터 미리 주입 권장.
- **Wilson LCB UDF**: ClickHouse 버전에 따라 `CREATE FUNCTION` 지원 여부 다름. 22.x+ 권장. 미지원 시 SQL 인라인 표현.

### 6-3. 롤백

- Service 자체는 stateless — `kubectl delete -k k8s/overlays/k3s-lite/recommendation` 으로 즉시 제거
- ClickHouse 테이블 / Kafka topic 은 그대로 두어도 무해 (다른 서비스 영향 없음)
- gateway route 만 제거하면 외부 접근 차단

---

## 7. 체크리스트

### Phase 1-A 기반
- [ ] settings.gradle.kts 모듈 등록
- [ ] recommendation/domain/build.gradle.kts
- [ ] recommendation/app/build.gradle.kts
- [ ] common/Wilson.kt + 테스트
- [ ] ADR-XXXX-1 작성
- [ ] ADR-XXXX-2 작성

### Phase 1-B Domain
- [ ] Recommendation Aggregate
- [ ] RecommendationItem / RecommendationType / RecommendationContext
- [ ] RecommendationRepository port
- [ ] ActionWeightedScore 도메인 서비스
- [ ] Domain 테스트 (Kotest)

### Phase 1-C Infrastructure
- [ ] ClickHouse migration V1__recommendation_events.sql
- [ ] Wilson LCB UDF 등록
- [ ] RedisRecommendationAdapter
- [ ] CbScoreSync (batch)
- [ ] RecommendationEventConsumer
- [ ] Infrastructure 통합 테스트 (Testcontainers)

### Phase 1-D Application + Presentation
- [ ] GetCategoryBestUseCase
- [ ] RecommendationController
- [ ] application.yml
- [ ] Controller 테스트 (MockMvc)
- [ ] End-to-End 통합 테스트

### Phase 1-E K8s + Gateway
- [ ] k8s/base/recommendation/{deployment,service,serviceaccount,kustomization}.yaml
- [ ] k8s/overlays/k3s-lite/recommendation/ overlay
- [ ] gateway application.yml 라우트 추가
- [ ] Argo CronWorkflow manifest
- [ ] Dockerfile 빌드 확인

### Phase 1-F 검증
- [ ] ./gradlew :recommendation:app:build 성공
- [ ] kubectl apply 정상 배포
- [ ] API 응답 확인 (mock data)
- [ ] Argo Workflow 수동 trigger 성공
- [ ] Grafana 메트릭 노출

---

## 8. 다음 단계 (Phase 1 완료 후)

### 8-1. 운영 안정화 (Phase 1.5)

- 메트릭 / 알람 추가
- A/B 테스트 (experiment 서비스 연동)
- Mock data → 실제 product/order 이벤트로 전환
- 도메인별 (호텔 / 액티비티 / 패키지) score weight 튜닝

### 8-2. Phase 2 (CF Spark PoC) — 별도 plan 문서

학습 §23 의 구현. Spark Operator 도입 + Item-Item PPMI 계산. 별도 plan: `docs/plans/YYYY-MM-DD-recommendation-phase2.md`

### 8-3. Phase 3 (Two-Tower ANN) — 더 후속

학습 §24. Python 모델 학습 + ONNX export + FAISS Python sidecar. ADR-XXXX-3 작성 후 별도 plan.

---

## 9. 학습 자료 cross-ref

| 항목 | 학습 노트 |
|---|---|
| 알고리즘 (행동 가중합 + Wilson LCB) | `study/docs/20-recommendation-modeling/05` + `06` |
| ClickHouse SQL 구현 | `study/docs/20-recommendation-modeling/22` |
| 모듈 스캐폴딩 | `study/docs/20-recommendation-modeling/21` |
| ADR 초안 | `study/docs/20-recommendation-modeling/20` |
| 인프라 비교 (왜 ClickHouse) | `study/docs/20-recommendation-modeling/18` |
| 면접 카드 (Q&A) | `study/docs/20-recommendation-modeling/26` |

---

**상태**: Proposed (2026-05-12)
**다음 액션**: 사용자 검토 → Phase 1-A 부터 순차 실행
