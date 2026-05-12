# ADR-0045 Recommendation 데이터 파이프라인 — analytics ClickHouse + Argo Workflows

## Status
Proposed (2026-05-12)

## Context

ADR-0044 의 Phase 1 (룰 기반 Category Best) 도입 시 데이터 파이프라인 필요:
1. **이벤트 수집** — 사용자 행동 (page view / click / addwish / reservation)
2. **점수 산출** — 행동 가중합 + Wilson LCB
3. **Serving 캐시** — Top-N per (city, category)

msa 본 레포에는 이미 `analytics` 서비스가 운영 중 — Kafka Streams + ClickHouse 기반. 추천 도입 시 새 인프라를 만들 것인지 기존 인프라를 확장할 것인지의 결정.

산업 표준 패턴 비교 (학습 노트 §18):
- **A. Kafka Streams + ClickHouse 만으로 — msa native** — 실시간 강함, batch 약함
- **B. BigQuery + Airflow — 산업 표준** — GCP 의존, msa 와 인프라 이원화
- **C. Spark + ClickHouse + Argo Workflows — Hybrid** — msa 인프라 통합 + 정교한 DAG

## Decision

**기존 analytics ClickHouse 를 공유 + Argo Workflows** 로 일별 sync.

### 1. ClickHouse 스키마 (analytics DB 내)

```sql
-- 추천 이벤트 raw
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
```

Wilson LCB 는 ClickHouse 22.x+ UDF 또는 SQL 인라인. 별도 미정의 (구현 시 결정).

### 2. Kafka topic 컨벤션

| Topic | 역할 | recommendation 서비스 |
|---|---|---|
| `analytics.event.collected` | analytics 가 수집한 raw 이벤트 (기존) | **consume** (group: `recommendation-events-consumer`) |
| `recommendation.event.tracked` | 추천 노출 / 클릭 이벤트 (신규) | **publish** |
| `recommendation.score.computed` | 점수 업데이트 알림 (신규, optional) | publish |

→ analytics 의 기존 topic 을 `recommendation-events-consumer` 라는 별도 consumer group 으로 **fan-out 소비**. analytics 서비스 코드 수정 없음.

### 3. Argo Workflows — 일별 ClickHouse → Redis sync

```
schedule: "0 2 * * *"  (매일 02:00)
steps:
  - clickhouse-query     # SELECT Top-N from recommendation_score_daily
  - redis-sync           # ZSET reco:cb:{cityId}:{categoryId} 갱신
```

K8s native (Airflow 와 달리 별도 cluster 불필요). msa 의 K8s 표준 인프라 활용.

### 4. Redis 캐시 키 패턴

```
reco:cb:{cityId}:{categoryId}   → ZSET (itemId, score)
TTL: 25 시간 (다음 batch 가 갱신할 여유)
```

## Alternatives Considered

### A. Kafka Streams 만으로 (Spark 미도입)
- 실시간 집계는 OK
- 그러나 CF (Phase 2) 도입 시 Spark 필요 — 어차피 도입해야
- 일단 Phase 1 만 Kafka Streams 로 가도 되지만, Phase 2 진입 시 인프라 이원화

### B. BigQuery + Airflow — 산업 표준
- GCP 의존 — msa 의 self-hosted 원칙과 충돌
- Airflow 별도 cluster 운영 부담
- 산업 OTA 추천 엔진 카탈로그 (학습 노트) 가 이 패턴이지만, msa 에 직수입 부적합

### C. recommendation 전용 ClickHouse 인스턴스
- 도메인 분리 — 운영 부담 ↑
- analytics 와 같은 데이터 (사용자 행동) 중복 저장
- → 가치 불분명

### D. K8s CronJob (Argo 미사용)
- 단순하지만 의존성 관리 / 재시도 / 모니터링 약함
- Phase 2 (Spark) / Phase 3 (Python 학습) 도입 시 정교한 DAG 필요 — Argo 가 미리 도입되면 후속 단계 쉬움

→ analytics ClickHouse 공유 + Argo Workflows 가 msa 인프라 통합 + 단계적 확장 최적.

## Consequences

### 긍정
- msa 인프라 100% 활용 — 별도 GCP / Airflow 없이 self-hosted 일관
- analytics 서비스 **수정 없음** — Kafka topic fan-out 만 활용
- Argo Workflows 도입은 Phase 2/3 의 Spark / Python 학습 잡에도 재활용
- ClickHouse SQL 만으로 표현 가능 — 단순 + 빠른 prototype
- 학습-서빙 skew 위험 적음 (단순 룰 기반)

### 부정
- ClickHouse 운영 부담 자체 (BigQuery 처럼 매니지드 아님) — 단, analytics 가 이미 운영 중이라 추가 부담 적음
- Argo Workflows 학습 곡선 — Airflow 보다 산업 친숙도 낮음 (단, K8s 친화)
- `analytics.event.collected` topic 의 retention 의존 — 7일 retention 가정 (실패 시 재처리 윈도우)

### 리스크 완화
- ClickHouse 권한: `recommendation_writer` user 추가 (DBA 협의)
- Kafka retention 7일 보장 (현재 default 확인 필요)
- Argo CronWorkflow 실패 시 24시간 retention TTL 로 Redis 캐시 만료 후 빈 응답 — fallback 필요 (향후 Phase 2 with multi-source fallback chain)
- 초기 Cold-start: launch 시 ClickHouse 에 데이터 없음 → mock seeding script

## Implementation

Phase 1 plan: `docs/plans/2026-05-12-recommendation-phase1.md`

### 마이그레이션 순서
1. ClickHouse 스키마 마이그레이션 (V1__recommendation_events.sql)
2. `recommendation-events-consumer` 추가 (analytics topic consume)
3. `CbScoreSync` batch 잡 작성
4. Argo CronWorkflow manifest 추가
5. K8s overlay 에 RBAC + ServiceAccount 추가

## References

- 학습 노트: `study/docs/20-recommendation-modeling/18-infra-ota-vs-msa.md`, `20-msa-adr-three.md`, `22-msa-rule-based-cb.md`
- 함께 작성: ADR-0044 (도입 단계)
- 향후 작성: ADR-0046 (ANN 인덱스 선택, Phase 3)
- Plan: `docs/plans/2026-05-12-recommendation-phase1.md`
