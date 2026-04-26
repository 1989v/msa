# ADR-0025 Latency Budget 표준

## Status

Proposed

**Date**: 2026-04-26
**Authors**: kgd
**Related**: ADR-0015 (Resilience Strategy), ADR-0019 (K8s Migration)

## Context

msa 플랫폼은 다양한 backend (MySQL / Redis / Elasticsearch / Kafka / ClickHouse / 외부 API) 와 호출 경로 (같은 K8s 노드 / 다른 노드 / 다른 AZ / 다른 리전) 를 갖는다. 그러나 현재까지 다음 문제가 있다:

1. **설계 토론에서 latency 자릿수 합의가 없다.** "이 호출은 빠르다 / 느리다" 가 직관에 의존
2. **신규 호출 경로 추가 시 영향 분석이 ad-hoc** — fan-out 의 tail 곱셈, 외부 API 의 P99 영향이 사전 검토 누락
3. **SLA 가 평균 기준** — P99 / P999 분포가 무시되어 사용자 경험과 메트릭이 괴리
4. **멀티 리전 / 외부 의존 / 캐시 정책 의사결정의 정량 근거가 없다**

본 ADR 은 자릿수 기반 latency budget 표준을 도입해 위 문제를 구조화한다.

## Decision

### 1. 자릿수 그룹 합의

모든 호출 / 컴포넌트 latency 를 다음 3 그룹으로 분류한다:

| 그룹 | 범위 | 매체 / 환경 |
|---|---|---|
| **ns 그룹** | 1 ns ~ 1 µs | CPU 캐시, DRAM, in-process 함수 호출 |
| **µs 그룹** | 1 µs ~ 1 ms | SSD, NIC, 같은 K8s 노드 / 같은 DC |
| **ms 그룹** | 1 ms ~ 200 ms | HDD seek, 같은 AZ / 같은 리전 / 대륙 간 RTT |

### 2. 호출 경로 자릿수 라벨 (현재 인프라 기준)

| 경로 | 자릿수 (k3d) | 자릿수 (managed K8s) |
|---|---|---|
| in-process 함수 | ns | ns |
| 같은 노드 Pod ↔ Pod | µs | µs |
| 다른 노드 Pod ↔ Pod | µs ~ ms | ms |
| 다른 AZ | n/a | ms |
| 같은 리전 다른 리전 | n/a | 큰 ms |
| 대륙 간 (한 ↔ 미) | n/a | ~150 ms (광속 한계) |
| service → MySQL (PK + 캐시 hit) | ms | ms |
| service → MySQL (full scan) | ms ~ 100ms | ms ~ 100ms |
| service → Redis (GET) | < 1 ms | µs ~ ms |
| service → Elasticsearch (검색) | 10-50 ms | 10-50 ms |
| service → Kafka (produce ack=1) | ms | ms |
| service → ClickHouse (OLAP) | 50-500 ms | 50-500 ms |
| service → 외부 결제 API | 수십-수백 ms | 수십-수백 ms |

### 3. Tier 별 P99 Latency Budget

#### Tier 1 — 사용자 직접 응답 경로 (P99 SLA 강제)

| 경로 | P99 budget | 근거 |
|---|---|---|
| 단순 상품 조회 (cache hit) | 50 ms | 외부 RTT + 서버 ~5ms |
| 단순 상품 조회 (cache miss) | 80 ms | 위 + DB ~3ms (tail +30ms) |
| 검색 | 300 ms | ES P99 ~100ms + 외부 RTT |
| 주문 생성 (동기 부분) | 100 ms | DB INSERT + Kafka produce |
| 위시리스트 추가 | 80 ms | 단순 INSERT + cache invalidate |

#### Tier 2 — 비동기 처리 경로 (Throughput SLA)

| 경로 | Throughput budget | 비고 |
|---|---|---|
| Kafka consumer (order events) | 1000 msg/s/partition | partition 수로 scale |
| Inventory 예약 처리 | 500 req/s | DB lock contention 한계 |
| Analytics ingestion | 10,000 events/s | Kafka Streams + 배치 |

#### Tier 3 — 백오피스 경로 (Best-effort)

| 경로 | budget | 비고 |
|---|---|---|
| Admin 분석 대시보드 | 5 s | OLAP 특성상 유연 |
| 일일 리포트 생성 | 30 min | 배치성 |

### 4. 신규 / 변경 호출 경로 검토 체크리스트

신규 호출 경로 추가 또는 기존 경로 변경 시 PR / 설계 리뷰에 다음 항목 명시:

```markdown
### Latency Budget Impact

- [ ] **속한 Tier**: Tier 1 / 2 / 3
- [ ] **예상 자릿수**: ns / µs / ms / 100ms+
- [ ] **fan-out 여부**: 있다면 N 개 백엔드, 단일 P99 와 전체 P99 분리 추정
- [ ] **외부 호출 여부**: 있다면 timeout, CircuitBreaker (ADR-0015), 비동기화 검토
- [ ] **캐시 적용 여부**: hit ratio 목표, miss 시 fallback latency
- [ ] **측정 방법**: 어떤 메트릭으로 budget 준수 확인할지
```

### 5. Budget 위반 시 행동 가이드

```
1. tail 만 큰가, 평균도 큰가?
   - 평균도 크다 → 본질 비용 (DB scan / 외부 API) → 캐시/인덱스/비동기화
   - tail 만 크다 → outlier (GC, lock, miss) → APM trace + heatmap

2. fan-out 이 있는가?
   - Yes → 단일 백엔드 P99 의 곱셈 효과
   - 완화: hedged request, micro-partitioning, 백엔드 P99 자체 개선

3. 외부 호출이 있는가?
   - Yes → CircuitBreaker (ADR-0015) + timeout
   - 가능하면 비동기화 (Kafka)

4. 자릿수 자체를 옮길 수 있는가?
   - DB → 캐시 (ms → µs)
   - 동기 → 비동기 (사용자 체감 latency 0)
   - 직렬 → 병렬 (sum → max)
```

### 6. 측정 / 모니터링 표준

- 모든 서비스는 Spring Boot Actuator + Micrometer 로 `http_server_requests_seconds_*` 메트릭 노출
- `percentiles-histogram: true` + bucket SLO `[10ms, 50ms, 100ms, 500ms, 1s]` 설정
- Grafana 대시보드에 RED (Rate / Errors / Duration) + Heatmap 패널 필수
- Tier 1 경로는 P99 alerting 룰 등록 (budget 의 80% 도달 시 warning, 100% 초과 시 critical)

## Alternatives Considered

### Alternative 1: 절대값 SLO 강제 (예: "모든 API P99 100ms 이내")

- **거부 이유**: 환경마다 (k3d / managed K8s / 멀티 리전) 자릿수 베이스라인이 다름. 일률 강제는 비현실적

### Alternative 2: ADR 없이 PR 리뷰 규칙으로만 관리

- **거부 이유**: 리뷰어 개인 의존, 일관성 / 추적성 부족. ADR 로 명문화하여 신규 합류자도 같은 베이스라인 공유

### Alternative 3: 자릿수 그룹 더 세밀화 (5-7 그룹)

- **거부 이유**: 인지 부하 ↑. 3 그룹 (ns / µs / ms) 가 직관 + 의사결정에 충분

## Consequences

### Positive

- **설계 토론의 정량 베이스라인** — "이 호출은 어느 자릿수" 가 ADR 로 합의됨
- **신규 호출 경로 검토의 체크리스트 강제** — fan-out / 외부 의존 / tail 영향이 사전 검토됨
- **SLA 가 P99 기반** — 사용자 경험과 메트릭이 일치
- **멀티 리전 / 외부 의존 의사결정의 근거** — 광속 한계 / fan-out 곱셈 등이 명문화

### Negative

- **PR / 설계 리뷰의 부담 증가** — 체크리스트 항목 작성 필요
- **모니터링 인프라 의존** — Prometheus + Grafana 미배포 환경에서는 부분 적용
- **초기 budget 값이 추정** — production 측정 데이터로 갱신 필요 (living 문서)

### Mitigation

- 체크리스트는 PR 템플릿에 포함하여 자연스럽게 강제
- Prometheus + Grafana 배포는 별도 ADR (Observability stack) 로 진행
- ADR-0025 는 분기마다 production 측정 데이터로 갱신

## References

- 본 학습 노트: `study/docs/12-latency-numbers/`
- Jeff Dean, "Numbers Everyone Should Know" (LADIS 2009 keynote, page 12) — https://research.cs.cornell.edu/ladis2009/talks/dean-keynote-ladis2009.pdf
- Colin Scott, Interactive Latency Numbers — https://colin-scott.github.io/personal_website/research/interactive_latency.html
- Jeff Dean & Luiz André Barroso, "The Tail at Scale" (CACM 2013) — fan-out tail 완화 전략
- ADR-0015: Resilience Strategy (CircuitBreaker, DLQ, Rate Limiting)
- ADR-0019: K8s Migration (배포 모드 이원화)

## Open Questions

- [ ] Tier 1 의 budget 값은 production 측정 후 갱신 필요. 초기값은 학습 단계 추정값
- [ ] 멀티 리전 도입 시 Tier 별 budget 의 변경 (특히 cross-region call) 추가 정의
- [ ] APM (분산 트레이싱) 도입 시 호출 경로별 자동 측정 가이드 추가
