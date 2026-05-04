---
parent: 10-observability
seq: 99
title: Observability 개념 카탈로그 — Full-Coverage + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://opentelemetry.io/docs/
  - https://prometheus.io/docs/
  - https://grafana.com/docs/
  - https://opentelemetry.io/docs/specs/otel/
  - https://github.com/open-telemetry/semantic-conventions
  - https://docs.honeycomb.io/concepts/
---

# 99. Observability 개념 카탈로그

> **목적** — 10-observability 의 14+ deep file + OpenTelemetry / Prometheus / Grafana / OTLP 표준 기준 빠진 영역 발굴 (eBPF profiling, exemplars, log → trace correlation, RUM, SLI/SLO/Error Budget 운영, OTel Collector pipeline 등).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 3 pillars | Metrics / Logs / Traces | ✅ |
| Metrics | Prometheus PromQL, exposition format, exporters | ✅ |
| Logs | structured logging, ELK / Loki | ✅ |
| Traces | OpenTelemetry, Jaeger, span / trace id | ✅ |
| Sampling | head / tail | ✅ |
| Cardinality | label explosion | ✅ |
| msa 적용 | actuator, exporter, collector | ✅ |
| Prometheus 심화 | TSDB / WAL / Sample compression / Federation / Remote write / SD / PromQL | ✅ 커버 ([15](15-prometheus-internals.md)) |
| OpenTelemetry 심화 | OTel SDK / Collector / Context propagation / Sampling / OTLP / Semantic Conventions | ✅ 커버 ([16](16-opentelemetry-deep.md)) |

### 1-A. 갭 진단

1. **OTel Collector pipeline** — receivers / processors / exporters / pipelines (logs/metrics/traces 분리)
2. **OTLP protocol (gRPC/HTTP)** + binary encoding
3. **Semantic Conventions** — `service.name`, `http.*`, `db.*`, `messaging.*`
4. **Resource attributes vs span attributes**
5. **Span kind** (CLIENT / SERVER / PRODUCER / CONSUMER / INTERNAL)
6. **Trace context propagation** — W3C Trace Context (`traceparent`, `tracestate`), B3 legacy
7. **Baggage** propagation
8. **Exemplars** — metric → trace 링크
9. **Log → trace correlation** — log 안의 trace_id
10. **Continuous Profiling** — Pyroscope / Parca / Grafana Phlare — pprof / JFR / async-profiler 통합
11. **eBPF profiling** — Pixie, Beyla
12. **Synthetic monitoring** — Blackbox / curl-based
13. **Real User Monitoring (RUM)** — browser SDK
14. **Frontend tracing** — OTel Web SDK
15. **Distributed Tracing 의 sampling 전략** — head-based / tail-based / probabilistic / rate-limit
16. **Tail sampling collector** — error / latency / random 비율 결합
17. **Metric types** — Counter / Gauge / Histogram / Summary / **Native Histogram (Prometheus 2.40+)**
18. **Histogram bucket 설계** — exponential / custom
19. **Recording rules / Alerting rules** (Prometheus)
20. **PromQL 함수** — rate / irate / increase / histogram_quantile / topk / sum by / avg_over_time / predict_linear / sgolay
21. **Alertmanager** — silencing / routing / grouping / inhibition / receivers
22. **Grafana Dashboard** — variables / templating / annotations / repeat
23. **Loki** — log labels / LogQL / parser
24. **Tempo / Jaeger / Zipkin** — trace store 비교
25. **Mimir / Cortex / Thanos** — Prometheus long-term storage
26. **VictoriaMetrics** — Prometheus 호환 + 효율
27. **SLI / SLO / Error Budget** 운영 표준
28. **Burn rate alerting** — multi-window multi-burn-rate
29. **USE method (Utilization/Saturation/Errors)** — resource focus
30. **RED method (Rate/Errors/Duration)** — service focus
31. **4 Golden Signals** (Latency / Traffic / Errors / Saturation) — SRE
32. **Black-box vs White-box monitoring**
33. **Deployment markers** — Grafana annotation 으로 변경 추적
34. **Cost-aware logging** — sampling, drop, parsing
35. **Trace explorer / Service Map**
36. **OpenTelemetry Operator** (k8s) — auto-instrumentation injection
37. **Auto-instrumentation** (JVM agent, Python, Node)
38. **Manual instrumentation** + custom span attributes
39. **Span events** — log within span
40. **Span links** — multiple parent (cross-trace 연결, batching)
41. **OTel Logs SDK** — log signal (3rd pillar 표준화)
42. **Native histogram → cardinality 절감**
43. **Service Level Indicator (SLI) 측정 패턴** — request-based / window-based
44. **Synthetic + real-user 결합 (browser + api)**
45. **OpenMetrics** (CNCF) — Prometheus exposition 표준화
46. **Prometheus federation** (간단한 분산)
47. **Pushgateway** — short-lived job (anti-pattern 자주)
48. **Service mesh observability** (Istio/Envoy 메트릭 자동)

---

## 2. 카테고리별 개념 트리

### A. Metrics (Prometheus + OpenMetrics)

| 개념 | 정의 | 상태 |
|---|---|---|
| Counter / Gauge / Histogram / Summary | 4 타입 | ✅ |
| **Native Histogram** (Prom 2.40+) | sparse exponential bucket | ✅ 커버 ([15](15-prometheus-internals.md)) |
| Histogram bucket 설계 | exponential vs custom | ✅ 커버 ([15](15-prometheus-internals.md)) |
| Exposition format / OpenMetrics | text/plain or proto | 🟡 |
| Pull (scrape) vs Push (Pushgateway, OTel push) | 2가지 | ✅ |
| Cardinality | label explosion 방지 | ✅ |
| **Recording rules / Alerting rules** | 사전 계산 / 알람 정의 | ✅ 커버 ([15](15-prometheus-internals.md)) |
| **Federation** | Prometheus 분산 | ✅ 커버 ([15](15-prometheus-internals.md)) |
| Mimir / Cortex / Thanos / VictoriaMetrics | 장기 저장 | ✅ 커버 ([15](15-prometheus-internals.md)) |
| PromQL — rate, increase, histogram_quantile, topk, predict_linear, ... | 함수 셋 | ✅ 커버 ([15](15-prometheus-internals.md)) |

### B. Logs

| 개념 | 정의 | 상태 |
|---|---|---|
| Structured logging (JSON) | key-value | ✅ |
| Log levels (TRACE / DEBUG / INFO / WARN / ERROR / FATAL) | 표준 | ✅ |
| Loki (log labels + LogQL) | label index, content full-scan | 🟡 |
| ELK (Elasticsearch + Logstash + Kibana) / EFK | 인덱스 기반 | ✅ |
| **Log → trace correlation** | trace_id field | ★ 신규 |
| Log sampling / drop | 비용 절감 | ★ 신규 |
| Log retention 정책 | hot / warm / cold | 🟡 |
| OTel Logs SDK | 표준화 | ✅ 커버 ([16](16-opentelemetry-deep.md)) |

### C. Traces

| 개념 | 정의 | 상태 |
|---|---|---|
| Trace / Span / Span context | 트리 모델 | ✅ |
| Span kind (CLIENT/SERVER/PRODUCER/CONSUMER/INTERNAL) | 5종 | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| **W3C Trace Context (traceparent / tracestate)** | 표준 propagation | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| Baggage | cross-service 메타데이터 | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| Span events / links | log within span / multi-parent | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| Sampling — head / tail / probabilistic / rate-limit / parent-based | 5종 | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| Trace store — Jaeger / Zipkin / Tempo | 비교 | 🟡 |
| Service map | 자동 토폴로지 | ★ 신규 |

### D. OpenTelemetry

| 개념 | 정의 | 상태 |
|---|---|---|
| OTel SDK (Java / Python / Node / Go) | API + impl | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| **Auto-instrumentation** (JVM agent) | 0-config 계측 | ✅ |
| Manual instrumentation | custom span/attr | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| **OTel Collector** | receivers / processors / exporters / pipelines | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| **OTLP** (gRPC / HTTP) | wire protocol | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| **Semantic Conventions** | `service.name`, `http.*`, `db.*` | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| Resource vs Span attributes | 식별 vs 컨텍스트 | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| **OpenTelemetry Operator** (k8s) | injection | ★ 신규 |

### E. Profiling (Continuous)

| 개념 | 정의 | 상태 |
|---|---|---|
| **pprof** (Go 표준) | flame graph | ★ 신규 |
| async-profiler (JVM) | perf events | 🟡 |
| **Pyroscope / Parca / Grafana Phlare** | continuous | ★ 신규 |
| **eBPF profiler** — Pixie, Beyla | zero-instrument | ★ 신규 |
| Heap / CPU / Lock / Allocation profile | mode | 🟡 |

### F. Frontend / Synthetic

| 개념 | 정의 | 상태 |
|---|---|---|
| **RUM** (Real User Monitoring) | browser SDK | ★ 신규 |
| **OTel Web SDK** | frontend tracing | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| **Synthetic monitoring** — Blackbox exporter, k6, Synthetics | scripted | ★ 신규 |
| Web Vitals (LCP / INP / CLS) | UX 메트릭 | ★ 신규 |

### G. Alerting

| 개념 | 정의 | 상태 |
|---|---|---|
| Alertmanager — routing / grouping / inhibition / silencing | 표준 | ✅ |
| Receivers (Slack / PagerDuty / Email / Webhook) | 채널 | ✅ |
| **Burn rate (multi-window multi-burn-rate)** | SRE 표준 | ★ 신규 |
| Alert noise / actionability | 운영 품질 | 🟡 |

### H. SLI / SLO / Error Budget

| 개념 | 정의 | 상태 |
|---|---|---|
| **SLI** (request-based / window-based) | 측정 표준 | ★ 신규 |
| **SLO** target | 99.9% / 99.99% | ✅ |
| **Error Budget** | 1 - SLO | ✅ |
| Burn rate alert | 빠른 소진 감지 | ★ 신규 |
| **4 Golden Signals (Latency / Traffic / Errors / Saturation)** | SRE Book | ✅ |
| **USE method** (resource) / **RED method** (service) | dual lens | ✅ |
| Black-box vs White-box | 외부 vs 내부 | ✅ |

### I. Service Mesh / Auto

| 개념 | 정의 | 상태 |
|---|---|---|
| Istio / Envoy 자동 메트릭 | sidecar 노출 | ★ 신규 |
| Linkerd | golden metrics | ★ 신규 |
| Service Map (auto) | trace 기반 | ★ 신규 |
| Deployment marker / annotation | 변경 추적 | ★ 신규 |

### J. Cost / 운영

| 개념 | 정의 | 상태 |
|---|---|---|
| Log/metric cost (cardinality) | label explosion | ✅ |
| Tail sampling | 비싸지만 정확 | ✅ 커버 ([16](16-opentelemetry-deep.md)) |
| Long-term storage trade-off | hot vs cold | 🟡 |
| Pushgateway 함정 | short-lived job | ✅ 커버 ([15](15-prometheus-internals.md)) |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **OTel Collector pipeline + processors (tail_sampling, batch, attributes, resource)** | 운영 표준 |
| 2 | **W3C Trace Context + Baggage propagation** | cross-service trace 표준 |
| 3 | **Continuous Profiling (Pyroscope/Parca)** | latency 디버깅의 4번째 pillar |
| 4 | **Burn-rate alerting + Error Budget 운영** | SLO-based ops |
| 5 | **Native Histogram (Prom 2.40+)** | cardinality 절감 |
| 6 | **eBPF profiler / Pixie / Beyla** | zero-instrument 관측 |
| 7 | **Frontend RUM + OTel Web SDK** | full-stack 관측 |
| 8 | **Tail sampling collector** | 정확 + 비용 trade |
| 9 | **Loki LogQL + log → trace correlation** | log/trace 결합 |
| 10 | **Service Mesh (Istio/Envoy) auto observability** | sidecar 자동 메트릭 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Observability 특화:
- §3 → "Pull vs Push 다이어그램" + "scrape interval / push interval / sampling rate" 표
- §6 → "Prometheus vs Mimir vs Thanos vs VictoriaMetrics" / "Jaeger vs Tempo vs Zipkin"
- §7 → SLI / SLO / Error Budget 정의 (request-based)

---

## 5. 참고 자료

- OpenTelemetry: https://opentelemetry.io/docs/
- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/
- "Site Reliability Engineering" (Google) — SRE Book
- "Observability Engineering" (Charity Majors et al.)
- OTel Semantic Conventions: https://github.com/open-telemetry/semantic-conventions
- USE method: http://www.brendangregg.com/usemethod.html
- RED method: https://www.weave.works/blog/the-red-method-key-metrics-for-microservices-architecture/
