# Latency Budget — 자릿수 어휘 / 측정 표준 / Tier 부록

> **상위 결정**: [ADR-0025 Latency Budget 을 설계 입력으로 강제](../adr/ADR-0025-latency-budget.md)
> 본 문서는 ADR-0025 의 **실천 가이드 + 운영 부록 (living)**. 분기마다 production 측정 데이터로 갱신.

## 1. 자릿수 어휘

모든 호출 / 컴포넌트 latency 를 다음 3 그룹으로 분류한다:

| 그룹 | 범위 | 매체 / 환경 | 대표 케이스 |
|---|---|---|---|
| **ns 그룹** | 1 ns ~ 1 µs | CPU 캐시, DRAM, in-process 함수 호출 | L1/L2/L3, mutex |
| **µs 그룹** | 1 µs ~ 1 ms | SSD, NIC, 같은 K8s 노드 / 같은 DC | NVMe random, 같은 DC RTT |
| **ms 그룹** | 1 ms ~ 200 ms | HDD seek, 같은 AZ / 같은 리전 / 대륙 간 RTT | 다른 노드, 대륙 간 |

### 외울 비율 5개

```
L1 → DRAM         ≈ ×100      "캐시 친화 코드"
DRAM → SSD        ≈ ×1000     "메모리 캐싱 압승"
SSD → DC 내 RTT   ≈ ×30       "Redis vs 로컬 디스크"
DC → 대륙 간 RTT  ≈ ×300      "광속 한계"
평균 → P99        ≈ ×3 ~ ×10  "tail latency"
```

> 절대값은 외우지 않는다. 그룹과 비율로 직관 형성.

## 2. 호출 경로 자릿수 라벨

> 환경별 추정값. 실측은 PR 단위로 보강 (기준 값으로 활용 후 production 데이터로 본 표 갱신).

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

## 3. Tier 별 P99 Latency Budget (운영 부록 — living)

> 초기값은 학습 단계 추정. **production 측정 후 분기마다 갱신** (last-updated 명시).

### Tier 1 — 사용자 직접 응답 경로 (P99 SLA 강제, alerting 등록)

`Last-updated`: 2026-04-26 (initial estimate, pre-production)

| 경로 | P99 budget | 근거 |
|---|---|---|
| 단순 상품 조회 (cache hit) | 50 ms | 외부 RTT + 서버 ~5ms |
| 단순 상품 조회 (cache miss) | 80 ms | 위 + DB ~3ms (tail +30ms) |
| 검색 | 300 ms | ES P99 ~100ms + 외부 RTT |
| 주문 생성 (동기 부분) | 100 ms | DB INSERT + Kafka produce |
| 위시리스트 추가 | 80 ms | 단순 INSERT + cache invalidate |

### Tier 2 — 비동기 처리 경로 (Throughput 기준, 강제 X / 권장)

| 경로 | Throughput budget | 비고 |
|---|---|---|
| Kafka consumer (order events) | 1000 msg/s/partition | partition 수로 scale |
| Inventory 예약 처리 | 500 req/s | DB lock contention 한계 |
| Analytics ingestion | 10,000 events/s | Kafka Streams + 배치 |

### Tier 3 — 백오피스 경로 (Best-effort)

| 경로 | budget | 비고 |
|---|---|---|
| Admin 분석 대시보드 | 5 s | OLAP 특성상 유연 |
| 일일 리포트 생성 | 30 min | 배치성 |

## 4. 신규 / 변경 호출 경로 PR 체크리스트

신규 호출 경로 추가 또는 기존 경로 변경 시 PR 본문에 다음 섹션 포함 (PR 템플릿에 통합 예정):

```markdown
### Latency Budget Impact

- [ ] **속한 Tier**: Tier 1 / 2 / 3
- [ ] **예상 자릿수**: ns / µs / ms / 100ms+
- [ ] **fan-out 여부**: 있다면 N 개 백엔드, 단일 P99 와 전체 P99 분리 추정
- [ ] **외부 호출 여부**: 있다면 timeout, CircuitBreaker (ADR-0015), 비동기화 검토
- [ ] **캐시 적용 여부**: hit ratio 목표, miss 시 fallback latency
- [ ] **측정 방법**: 어떤 메트릭으로 budget 준수 확인할지
```

## 5. Budget 위반 시 행동 가이드

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

## 6. 측정 표준 (구체 설정)

### 6.1 Spring Boot 측 — Micrometer 노출

```kotlin
// {service}/app/build.gradle.kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")
}
```

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus,metrics
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
      percentiles:
        http.server.requests: 0.5, 0.95, 0.99, 0.999
      slo:
        http.server.requests: 10ms, 50ms, 100ms, 500ms, 1s
    tags:
      application: ${spring.application.name}
```

### 6.2 K8s manifest — Prometheus scrape 어노테이션

```yaml
# k8s/base/{service}/deployment.yaml 의 podTemplate.metadata.annotations
prometheus.io/scrape: "true"
prometheus.io/path: "/actuator/prometheus"
prometheus.io/port: "8080"
```

### 6.3 핵심 PromQL

```promql
# P99 latency
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket[5m])) by (le, application, uri)
)

# Throughput (req/s)
sum(rate(http_server_requests_seconds_count[1m])) by (application, uri)

# 에러율
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) by (application)
/
sum(rate(http_server_requests_seconds_count[5m])) by (application)

# Heatmap (latency 분포 시각화)
sum(rate(http_server_requests_seconds_bucket[1m])) by (le)
```

### 6.4 필수 Grafana 패널

- **RED** (Rate / Errors / Duration) — 서비스별 throughput, 에러율, P50/P99
- **Latency Heatmap** — 시간 × bucket 의 색상 분포 (tail 변화 가시화)
- **JVM Metrics** — heap, GC pause, threads
- **HTTP Status 분포** — 2xx / 4xx / 5xx 시계열

### 6.5 Tier 1 alerting 룰 (예시)

```yaml
# Prometheus rules
- alert: Tier1P99BudgetWarning
  expr: |
    histogram_quantile(0.99,
      sum(rate(http_server_requests_seconds_bucket{tier="1"}[5m])) by (le, application, uri)
    ) > <budget_seconds * 0.8>
  for: 5m
  annotations:
    summary: "Tier 1 P99 latency 가 budget 의 80% 도달"

- alert: Tier1P99BudgetCritical
  expr: |
    histogram_quantile(0.99,
      sum(rate(http_server_requests_seconds_bucket{tier="1"}[5m])) by (le, application, uri)
    ) > <budget_seconds>
  for: 5m
  annotations:
    summary: "Tier 1 P99 budget 초과 (SLA 위반)"
```

## 7. 학습 / 측정 도구 참조

| 도구 | 측정 대상 | 자릿수 |
|---|---|---|
| `redis-cli --latency` | Redis RTT | µs ~ ms |
| `curl -w '@fmt'` | HTTP 단계별 (DNS / connect / TTFB) | ms |
| `ping`, `mtr` | 네트워크 RTT | µs ~ ms |
| `dd`, `fio` | 디스크 throughput / IOPS | MB/s, µs |
| `wrk`, `k6` | HTTP 부하 + P50/P99/P999 | ms |

상세 사용법 + 예상 출력 / 해석 → `study/docs/12-latency-numbers/06-baseline-measurement.md`, `07-load-test-tail.md`, `08-observability-setup.md`.

## 8. 주의 — 함정 9가지

1. 평균이 좋으면 사용자도 좋다 (X) → P99 / heatmap
2. 캐시 hit ratio 90% 면 충분 (X) → P99 는 99%+ 필요
3. throughput ↑ → latency ↓ (X) → 독립, utilization 70% 목표
4. 큰 인스턴스 = 낮은 latency (X) → 자릿수 옮기기 (매체 변경) 가 답
5. 빠른 네트워크가 RTT 줄여준다 (X) → 광속 한계, CDN/edge
6. MSA = 빨라짐 (X) → 함수→네트워크 ×1000 비용
7. fan-out N ↑ → 평균 ↓ (X) → tail 곱셈
8. 5xx 0% = 건강함 (X) → latency 분포가 진짜 SLA
9. tail latency 변화 = 배포 탓 (X) → 5축 (코드/데이터/외부/인프라/트래픽)

상세 → `study/docs/12-latency-numbers/10-pitfalls.md`.
