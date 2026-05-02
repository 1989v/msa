---
parent: 10-observability
phase: 2
title: Prometheus Pull 모델 + Pushgateway + ServiceMonitor
created: 2026-05-01
---

# 02. Prometheus — Pull 모델, Exposition Format, ServiceMonitor

## 1. Pull vs Push — 왜 Prometheus 는 Pull 인가

| 항목 | Pull (Prometheus) | Push (StatsD / Graphite) |
|---|---|---|
| 신뢰성 모델 | Prometheus 가 매번 endpoint 를 긁음 → endpoint 가 살아있으면 healthcheck 동시 수행 | 클라이언트가 보내야만 도착 |
| Service Discovery | K8s API / Eureka / Consul / file_sd | 클라이언트가 endpoint 알아야 함 |
| 시간 기준 | 서버(Prometheus)의 scrape 시각 → drift 감소 | 클라이언트 시간 |
| 부하 제어 | Prometheus 가 scrape interval 결정 | 클라이언트가 폭주하면 backend 다운 |
| 단점 | short-lived job (배치) 는 안 맞음 → Pushgateway 로 우회 | 기본 매끄러움 |

> **면접 답변**: "Prometheus 는 Pull 모델로 endpoint 가 살아있는지 동시에 검증되며, scrape 주기를 서버가 결정해 backend overload 를 방지합니다. 단, 30초 미만의 short-lived job (예: cron 배치) 은 Pushgateway 를 경유시키는 예외 패턴이 있습니다."

### 1.1 Pushgateway — 안티패턴이 되기 쉬운 이유

- **사용 케이스**: short-lived batch job 의 마지막 결과 (예: nightly backup 결과)
- **남용하면**: 모든 메트릭을 push 하는 anti-pattern → Prometheus 의 healthcheck 효과 손실
- 운영 룰: "Pushgateway 에 들어가는 메트릭은 instance label 이 의미 없는 그룹 메트릭" 만

```
짧은 배치 → Pushgateway 에 푸시 → Prometheus 가 Pushgateway 를 scrape
           (타이밍 mismatch 해결)
```

## 2. Exposition Format — 텍스트 기반 약속

Prometheus 가 scrape 하는 endpoint 는 단순 HTTP GET → text/plain 응답.

### 2.1 형식

```
# HELP http_server_requests_seconds Duration of HTTP requests
# TYPE http_server_requests_seconds histogram
http_server_requests_seconds_bucket{application="product",method="GET",status="200",uri="/api/products/{id}",le="0.005"} 1247
http_server_requests_seconds_bucket{application="product",method="GET",status="200",uri="/api/products/{id}",le="0.01"}  1389
http_server_requests_seconds_bucket{application="product",method="GET",status="200",uri="/api/products/{id}",le="+Inf"} 1500
http_server_requests_seconds_count{application="product",method="GET",status="200",uri="/api/products/{id}"} 1500
http_server_requests_seconds_sum{application="product",method="GET",status="200",uri="/api/products/{id}"} 22.4
```

라인 단위:
- `# HELP <name> <description>`
- `# TYPE <name> <type>` — counter / gauge / histogram / summary / untyped
- `<name>{<labels>} <value> [<timestamp>]`

### 2.2 OpenMetrics — Prometheus exposition 의 후계 표준

OpenMetrics (CNCF) 는 exposition format 의 IETF 표준화 시도. 호환되지만 **Exemplar** 지원이 큰 차이:

```
http_server_requests_seconds_bucket{le="0.05"} 24054 # {trace_id="3a72fd1a"} 0.045 1714617600
                                                       └─ Exemplar (trace ID)
```

→ Prometheus 가 bucket 안에 trace ID sample 1개를 끼워 보낼 수 있음 → Grafana 에서 클릭하면 Tempo / Jaeger 로 점프. (자세히 #09 에서)

### 2.3 Spring Boot Actuator 의 Exposition

`/actuator/prometheus` 가 자동으로 위 형식 응답. 의존성:

```kotlin
// product/app/build.gradle.kts:16 (실제 코드 인용)
implementation("io.micrometer:micrometer-registry-prometheus")
implementation(libs.spring.boot.starter.actuator)
```

설정 (실제 `product/app/src/main/resources/application.yml:54-77`):

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      probes:
        enabled: true
      group:
        liveness:
          include: livenessState
        readiness:
          include: readinessState
  metrics:
    tags:
      application: ${spring.application.name}
```

### 2.4 percentiles-histogram 옵션 (ADR-0025 강제)

ADR-0025 §4 (실제 인용):
> 모든 JVM 서비스는 `http_server_requests_seconds_*` 메트릭 노출 + `percentiles-histogram: true` + bucket SLO 설정.

추가 설정:

```yaml
management:
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true   # bucket 자동 생성
      slo:
        http.server.requests: 50ms, 100ms, 200ms, 500ms, 1s, 2s
      percentiles:
        http.server.requests: 0.5, 0.95, 0.99   # client-side calc
```

- `percentiles-histogram=true`: bucket 시계열을 노출 → Prometheus 측에서 `histogram_quantile` 가능 (cluster aggregation 가능)
- `percentiles`: client-side 에서 quantile 직접 계산 (단일 인스턴스 한정 — Summary 와 동등)
- `slo`: SLO 라인을 bucket boundary 에 추가 (Tier 1 SLA 주변에서 정밀도 확보)

→ msa 는 ADR-0025 의 이 부분이 아직 application.yml 에 미반영 (Phase 3 grep 에서 확인 — 단지 ADR 에 명시된 상태).

## 3. Service Discovery — K8s 환경에서 ServiceMonitor

수십 개 Pod 의 IP/Port 를 매번 Prometheus config 에 적기는 불가능 → SD (Service Discovery).

### 3.1 K8s SD 메커니즘 비교

| 메커니즘 | 도구 | 동작 |
|---|---|---|
| `kubernetes_sd_configs` | Prometheus 직접 | API 서버 watch + relabel_configs 로 필터 |
| **ServiceMonitor / PodMonitor CRD** | Prometheus Operator (kube-prometheus-stack) | 선언적 CRD → Operator 가 Prometheus config 자동 합성 |
| Eureka SD | `eureka_sd_configs` | (msa 의 ADR-0019 이후 제거됨) |

→ msa 는 ServiceMonitor 방식 (kube-prometheus-stack).

### 3.2 msa 의 ServiceMonitor — 실제 코드

`k8s/infra/prod/monitoring/servicemonitor-apps.yaml` 전문:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: commerce-platform-apps
  namespace: monitoring
  labels:
    release: kube-prometheus-stack  # Helm chart selector 매칭
spec:
  namespaceSelector:
    matchNames:
      - commerce
  selector:
    matchLabels:
      app.kubernetes.io/part-of: commerce-platform
  endpoints:
    - port: http
      path: /actuator/prometheus
      interval: 30s
      scrapeTimeout: 10s
```

해석:

1. `release: kube-prometheus-stack` 라벨로 Helm chart Operator 가 발견
2. `commerce` namespace 의 Service 중 `app.kubernetes.io/part-of=commerce-platform` 라벨이 있는 것 모두
3. 각 Service 의 `http` named port 의 `/actuator/prometheus` 를 30초마다 scrape

→ **새 서비스 추가 시 별도 Prometheus 수정 불필요** — `part-of` 라벨만 붙이면 자동 등록.

### 3.3 ServiceMonitor 대신 PodMonitor 를 쓰는 경우

- Service 가 없는 Pod (DaemonSet)
- Headless service 인데 Pod 단위로 scrape 하고 싶을 때
- 다른 namespace 의 Service 의 endpoint 를 직접 잡고 싶을 때

## 4. scrape_interval 트레이드오프

| Interval | 장점 | 단점 |
|---|---|---|
| 5s | rate() 의 latency 빠름 | scrape 부하 6배 증가 |
| **30s (msa 기본)** | 표준 | 5xx 첫 alert 까지 ~1분 |
| 60s | 비용 최소 | rate() 정밀도 떨어짐 (counter delta 작음) |

> Prometheus 권장: `scrape_interval >= 4 × evaluation_interval`. 즉 alert 평가가 1m 이면 scrape 는 15s 이하.

### 4.1 msa 의 30s 선택 — 적절한가?

- ADR-0025 Tier 1 P99 SLA: 50-300ms 범위
- Alert evaluation: 1m
- → scrape 30s 는 표준. 단, **버스트 스파이크 (5초 이내 5xx 폭발)** 는 인지 지연 발생.
- 개선 ADR 후보: Tier 1 서비스만 15s 로 줄이는 옵션 (gateway, product, order)

## 5. Prometheus 자체 운영 — 면접 함정

### 5.1 retention vs Long-term Storage

`values.yaml`:
```yaml
prometheus:
  prometheusSpec:
    retention: 15d
```

15d 이후는 어떻게 하나? 3가지 옵션:

| 옵션 | 도구 | 비용 |
|---|---|---|
| 그냥 버린다 | (없음) | 0 |
| **Thanos** | Thanos sidecar + S3 | 중간, 복잡 |
| **Mimir** | Grafana Mimir (Cortex 후계) | 중간, multi-tenant |
| Cortex | (legacy) | n/a |

### 5.2 HA 구성 — Prometheus 자체 HA 는 어렵다

- Prometheus 는 **single-writer** (replication 없음)
- HA: 같은 scrape config 의 Prometheus 2대 → Thanos / Mimir 가 dedup
- alert routing: Alertmanager 자체는 cluster 모드 지원 → 알람 중복 발송 방지

### 5.3 Cardinality Explosion 신호

- `prometheus_tsdb_head_series` 가 급증
- `prometheus_tsdb_head_series_created_total` rate 가 새 라벨 도입과 동시에 튐
- Prometheus 가 OOM Kill → restart 후 head 다시 채워지며 계속 죽음 (death spiral)

→ 응급 조치: drop relabel 로 라벨 제거. 영구 조치: 해당 메트릭 제거 / re-design.

```yaml
# 응급 drop relabel 예시 — productId 라벨 제거
metric_relabel_configs:
  - source_labels: [__name__]
    regex: 'cart_item_added_total'
    action: keep
  - regex: 'productId'
    action: labeldrop
```

## 6. /actuator/prometheus 가 expose 하는 것

표준 Spring Boot 가 자동으로 노출하는 메트릭 (실제):

| 메트릭 | 타입 | 의미 |
|---|---|---|
| `http_server_requests_seconds_*` | Histogram | RED 의 R/E/D |
| `jvm_memory_used_bytes` | Gauge | 메모리 |
| `jvm_gc_pause_seconds_*` | Timer | GC 지연 (#02 cross-ref) |
| `jvm_threads_states_threads` | Gauge | 스레드 상태 |
| `process_cpu_usage` | Gauge | CPU |
| `tomcat_threads_busy_threads` | Gauge | Tomcat 워커 (#15 cross-ref Saturation) |
| `hikaricp_connections_*` | Gauge | DB 풀 (#15 cross-ref) |
| `kafka_consumer_*` | Gauge | Kafka consumer lag |
| `logback_events_total` | Counter | 로그 레벨별 카운트 (PII 안전) |

→ **별도 코드 없이 RED + USE + JVM dashboard** 가 거의 완성된다. msa 의 jvm-dashboard.json / http-dashboard.json 이 이 메트릭들로 구성됨.

## 7. 보안 — Prometheus endpoint 노출 위험

`/actuator/prometheus` 는 **인증 없음** 이 기본. 노출되면:

- 메트릭 자체에 민감정보 라벨이 포함될 수 있음 (예: `email` 라벨)
- 시스템 운영 정보 누출 (instance 수 / memory 사용 / DB 연결 수)
- timing attack 입력으로 사용 가능

→ 운영 권장:
1. K8s ClusterIP 만 노출 (Ingress 에서 차단 — msa Gateway 가 actuator 차단)
2. NetworkPolicy 로 monitoring namespace → commerce namespace 만 허용
3. `management.server.port` 를 별도 포트로 분리 + 외부 차단

## 8. 핵심 정리

- Prometheus = **Pull + 텍스트 exposition + Service Discovery** (3종 세트)
- Pushgateway 는 short-lived job 한정 — 남용 금지
- ServiceMonitor = K8s 의 선언적 SD → msa 는 `part-of: commerce-platform` 라벨로 자동 등록
- scrape_interval 30s 는 표준 — 버스트 scenario 만 15s 검토
- retention 15d 이상은 Thanos / Mimir
- `/actuator/prometheus` 는 인증 없음 — Ingress / NetworkPolicy 로 차단

## 9. 다음 단계

- [03-metric-types-and-cardinality.md](03-metric-types-and-cardinality.md) — Counter/Gauge/Histogram/Summary 의 트레이드오프 + Cardinality 설계
