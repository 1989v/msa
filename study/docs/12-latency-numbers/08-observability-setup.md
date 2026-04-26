---
parent: 12-latency-numbers
phase: 3
order: 08
title: Observability 셋업 — Prometheus + Grafana + Micrometer
created: 2026-04-26
estimated-hours: 2
---

# 08. Observability 셋업 — latency 분포를 항상 보이게

> 06-07 의 단발성/일회성 측정에서 한 단계 — **상시 메트릭** 으로 latency 히스토그램을 시각화.
> **10번 Observability 주제의 prerequisite** — 본 세션에서 만든 셋업을 그대로 재활용.

## 0. 이 파일에서 얻을 것

- Spring Boot Actuator + Micrometer 로 HTTP / JVM / 커스텀 메트릭 노출
- Prometheus 가 메트릭 scrape, Grafana 가 시각화
- latency **히스토그램 + heatmap** 으로 분포 변화 관측
- 면접 카드: "latency 모니터링 어떻게 하시나요?"

---

## 1. Spring Boot 측 — Micrometer + Prometheus 노출

### 의존성 (이미 msa 에 있을 가능성 높음)

```kotlin
// {service}/app/build.gradle.kts
dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("io.micrometer:micrometer-registry-prometheus")
}
```

### 노출 설정

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
        http.server.requests: true     # 핵심: 히스토그램 활성화
      percentiles:
        http.server.requests: 0.5, 0.95, 0.99, 0.999
      slo:
        http.server.requests: 10ms, 50ms, 100ms, 500ms, 1s
    tags:
      application: ${spring.application.name}
```

### 노출 확인

```bash
curl http://product:8080/actuator/prometheus | grep http_server_requests
```

출력 예:
```
# HELP http_server_requests_seconds
# TYPE http_server_requests_seconds histogram
http_server_requests_seconds_bucket{...,le="0.005"} 1234
http_server_requests_seconds_bucket{...,le="0.01"} 2456
http_server_requests_seconds_bucket{...,le="0.025"} 3120
...
http_server_requests_seconds_count{...} 4567
http_server_requests_seconds_sum{...} 12.34
```

→ Prometheus histogram 형식. 각 bucket 별 누적 카운트.

---

## 2. Prometheus 배포 (k3d)

### 간단한 배포 (kube-prometheus-stack 헬름차트가 정석이지만, 학습용으로는 단순 manifest)

```yaml
# prometheus-quick.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 5s
    scrape_configs:
      - job_name: 'spring-boot'
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
        metrics_path: /actuator/prometheus
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels: { app: prometheus }
  template:
    metadata:
      labels: { app: prometheus }
    spec:
      containers:
        - name: prometheus
          image: prom/prometheus:latest
          args: ["--config.file=/etc/prometheus/prometheus.yml"]
          ports: [{containerPort: 9090}]
          volumeMounts:
            - name: config
              mountPath: /etc/prometheus
      volumes:
        - name: config
          configMap: { name: prometheus-config }
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  selector: { app: prometheus }
  ports: [{ port: 9090, targetPort: 9090 }]
```

```bash
kubectl create namespace monitoring
kubectl apply -f prometheus-quick.yaml
kubectl port-forward -n monitoring svc/prometheus 9090:9090
# 브라우저에서 http://localhost:9090
```

### Spring Boot Pod 어노테이션

```yaml
# k8s/base/{service}/deployment.yaml 의 podTemplate 에 추가
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: "/actuator/prometheus"
    prometheus.io/port: "8080"
```

---

## 3. 핵심 PromQL — latency 분석

### P50 / P99 (지난 5분)

```promql
# P50 latency (초 단위)
histogram_quantile(0.5,
  sum(rate(http_server_requests_seconds_bucket[5m])) by (le, application, uri)
)

# P99
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket[5m])) by (le, application, uri)
)
```

### Throughput (req/s)

```promql
sum(rate(http_server_requests_seconds_count[1m])) by (application, uri)
```

### 에러율

```promql
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) by (application)
/
sum(rate(http_server_requests_seconds_count[5m])) by (application)
```

### Apdex (사용자 만족도) — 100ms 만족 / 500ms 허용

```promql
(
  sum(rate(http_server_requests_seconds_bucket{le="0.1"}[5m]))
  +
  sum(rate(http_server_requests_seconds_bucket{le="0.5"}[5m])) / 2
)
/
sum(rate(http_server_requests_seconds_count[5m]))
```

---

## 4. Grafana 배포 + 핵심 대시보드

### 배포

```yaml
# grafana-quick.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: grafana, namespace: monitoring }
spec:
  replicas: 1
  selector: { matchLabels: { app: grafana } }
  template:
    metadata: { labels: { app: grafana } }
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:latest
          ports: [{containerPort: 3000}]
          env:
            - name: GF_AUTH_ANONYMOUS_ENABLED
              value: "true"
            - name: GF_AUTH_ANONYMOUS_ORG_ROLE
              value: "Admin"
---
apiVersion: v1
kind: Service
metadata: { name: grafana, namespace: monitoring }
spec:
  selector: { app: grafana }
  ports: [{ port: 3000, targetPort: 3000 }]
```

### 핵심 패널 (직접 만들거나 Grafana 공식 dashboard 12900 import)

1. **RED 패널** (Rate / Errors / Duration): 서비스별 throughput, 에러율, P50/P99
2. **Latency Heatmap**: 시간 축 × latency bucket 축의 색상 분포 (tail 변화 가시화)
3. **JVM Metrics**: heap, GC pause, threads
4. **HTTP Status 분포**: 2xx/4xx/5xx 시계열

### Heatmap 의 가치

```promql
sum(rate(http_server_requests_seconds_bucket[1m])) by (le)
```

→ Grafana 패널 타입 "Heatmap" 으로 시각화. **시간이 지나면서 분포가 어떻게 변하는지** 한눈에. 평균 그래프로는 안 보이는 tail 의 변화 (e.g. GC pause 가 늘어나는 시점) 가 보임.

---

## 5. 07번 부하 테스트와 결합

### 시나리오

1. Grafana 대시보드를 띄워둔다
2. wrk / k6 로 부하 발생
3. 캐시 hit ratio 100% → 50% → 0% 로 변경하면서 부하
4. Grafana 의 P99 / heatmap 이 어떻게 움직이는지 실시간 관측

### 예상 시각화

- P99 라인 그래프: 100% → 50% → 0% 이행 시점에서 계단식 상승
- Heatmap: 분포의 색상 영역이 위쪽 (느린 latency) 으로 확장
- 평균 라인: 비교적 완만하게만 증가 (tail 의 무게가 작아 보임)

→ "평균은 거짓말, P99 / heatmap 이 진실" 을 시각적으로 확신.

---

## 6. msa 프로젝트와의 연결

### 현재 상태 (코드베이스)

- `common/` 에 Micrometer 의존성과 기본 설정이 있을 가능성 높음 (확인 필요)
- 각 서비스의 `application.yml` 에 actuator 노출 설정 필요
- K8s manifest 에 prometheus.io 어노테이션 필요
- `k8s/infra/local/` 에 Prometheus / Grafana 미배포 상태 (10번에서 정식 배포 예정)

### 본 세션의 산출물 = 10번의 prerequisite

본 학습으로 만든 임시 Prometheus + Grafana 셋업이 **10번 Observability 본 학습 시 그대로 재활용**. 그때는 정식 helm chart (`kube-prometheus-stack`) + Loki (로그) + Tempo (트레이싱) 까지 확장.

### 관련 ADR

- 현재 observability 관련 ADR 없음. 본 학습 후 ADR-0025 (latency budget) 와 함께 ADR-0026 (observability stack) 도 후속 검토 가능.

---

## 7. 자가 점검

- [ ] Spring Boot 의 `/actuator/prometheus` 노출 확인
- [ ] Prometheus 가 Pod 메트릭 scrape 성공
- [ ] Grafana 에서 P50 / P99 PromQL 쿼리 가능
- [ ] Heatmap 패널로 latency 분포 시각화
- [ ] 부하 테스트와 결합하여 tail 변화 실시간 관측

## 8. 면접 답변 카드

**Q: "API latency 모니터링 어떻게 하시나요?"**

> Spring Boot Actuator + Micrometer 로 메트릭 노출하고, Prometheus 가 scrape, Grafana 로 시각화 합니다. 핵심은 평균만 보지 않고 **P50 / P95 / P99 + heatmap** 까지 같이 보는 것. histogram bucket 을 적절히 정의해서 (10ms, 50ms, 100ms, 500ms 등) `histogram_quantile` PromQL 로 percentile 을 계산합니다. heatmap 으로 분포 변화를 보면 GC pause 같은 tail 원인이 평균 그래프로는 안 보이는 패턴으로 드러나요.

**Q (꼬리): "Histogram 과 Summary 의 차이는?"**

> Histogram 은 bucket 별 카운트를 노출하고 Prometheus 쪽에서 percentile 을 계산. Summary 는 클라이언트 (Spring Boot) 에서 percentile 을 직접 계산해서 노출. 차이는 **집계 가능성** — Histogram 은 여러 인스턴스의 bucket 을 합쳐서 전체 percentile 을 계산할 수 있지만, Summary 는 그게 안 돼요. 그래서 분산 환경에서는 Histogram 이 정답입니다.

**Q (꼬리): "tail latency 가 갑자기 늘었어요. 어디부터 보세요?"**

> Heatmap 으로 분포 변화 시점을 정확히 잡고, 그 시점의 GC log / thread dump / DB slow query log 와 cross-check. heap 이 차거나 GC pause 가 늘어났는지, lock contention 이나 외부 API 의 outlier 가 있는지. APM (Datadog / New Relic / Pinpoint) 의 trace 로 어느 호출 단계에서 느려졌는지 확인합니다.

---

## 다음 파일

- **09. msa 호출 경로 budget** ([09-msa-call-budget.md](09-msa-call-budget.md))
