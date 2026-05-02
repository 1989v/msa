---
parent: 10-observability
phase: 4
title: 면접 Q&A 카드 — 40문항
created: 2026-05-01
---

# 14. Observability 면접 Q&A — 40문항

> 한국 대기업 백엔드 10년차 Tech / Lead 면접 대비. 회독용 — 학습 종료 후 1주일 간격 2-3회.
> 답변은 30초-2분 길이를 기준. 구조: **개념 → 트레이드오프 → msa 적용 사례 → 한계**.

---

## Phase 1 — 기본 개념 (8문)

### Q1. Observability 와 Monitoring 의 차이?

> Monitoring 은 **사전에 정의한 known-unknowns** 를 추적합니다 (예: CPU > 80% alert). Observability 는 **사전에 정의 불가능한 unknown-unknowns** 를 사후 자유 질의로 좁혀가는 능력입니다. 모니터링이 운전석 계기판이라면 관측성은 디버거에 가깝습니다. 도구 차원에서는 monitoring 은 dashboard + alert 가 1차 산출물, observability 는 high-cardinality event + trace 가 1차 산출물입니다.

### Q2. 3 Pillars 의 자료형이 다르다는 게 무슨 뜻?

> Metrics 는 (label set, ts, float) 의 시계열, Logs 는 자유 형식 raw event, Traces 는 span 의 인과 그래프입니다. 자료형이 다르므로 **저장 비용 / 보관 기간 / 카디널리티 한계** 모두 다른 도구가 필요합니다. 이걸 한 도구 (예: ELK 만) 로 묶으면 비용이 폭증합니다. 그래서 Prometheus + Loki + Tempo 같은 분리된 stack 이 표준입니다.

### Q3. RED / USE / Golden Signals 차이?

> RED (Rate / Errors / Duration) 는 **서비스 단위** 표준 — Spring Boot 의 `http_server_requests_seconds` 가 그대로 RED 입니다. USE (Utilization / Saturation / Errors) 는 **리소스 단위** — CPU/Memory/Disk 에 적용. Golden Signals (Latency / Traffic / Errors / Saturation) 는 SLO 정의의 input 으로 사용합니다. 실무에선 RED 는 service dashboard, USE 는 node dashboard 에 분리합니다.

### Q4. Cardinality 가 왜 1번 적인가?

> 시계열 1개당 Prometheus head 메모리 ~3KB 를 차지합니다. label `userId` (10만) × `productId` (1만) = 10억 시계열이면 3TB 메모리 — 즉시 OOM. 그래서 라벨은 **enum / 상수만** 허용하고, raw URL 은 template path (`/users/{id}`) 로 변환해야 합니다. msa 의 `QuantMetrics.kt` 가 모범 — 모든 라벨에 카디널리티 상한을 docstring 에 명시합니다.

### Q5. SLI / SLO / SLA / Error Budget 정의?

> SLI 는 측정 가능한 신호 (예: 5xx 비율), SLO 는 그 신호의 내부 목표 (예: 99.9), SLA 는 외부 계약 (penalty 포함) 입니다. Error Budget 은 (1 - SLO) × time 으로, 99.9 SLO 라면 한 달에 43분의 허용 다운타임을 가집니다. **속도 vs 안정성의 정량 trade-off** 도구로 — Budget 이 남으면 신기능 배포, 다 쓰면 freeze 검토합니다.

### Q6. SLO 에 99 가 하나 더 붙으면 비용이 어떻게 변하나?

> 대략 10배입니다. 99.9 는 단일 region single AZ failover 면 충분, 99.99 는 multi-region active-active + 즉시 failover 가 필요합니다. 99.999 는 인간 개입 시간 (ack 자체 26초) 이 한계라 거의 비현실적. 그래서 **무턱대고 99.99 를 쓰면 안 되고, 사용자 영향 분석을 해서 99.9 가 baseline 이고 핵심 path 만 99.95 정도로 올립니다.**

### Q7. RED 의 Errors panel 만으로 충분한가?

> 부족합니다. 5xx 비율은 알지만 4xx (예: 429 rate-limit) 는 사용자에게 영향이 있어도 RED 의 E 에 안 잡힙니다. 또한 latency 분포가 bimodal 이면 P99 line chart 만으로 못 보고 **Heatmap** 이 필요합니다. ADR-0025 가 Heatmap 패널을 강제하는 이유가 이거고, msa 의 http-dashboard 가 누락된 항목입니다 — 개선 ADR 후보입니다.

### Q8. Observability 의 4번째 pillar 가 있다면?

> Continuous Profiling 입니다. Pyroscope / Parca / Datadog Profiler 가 1초 단위 stack sampling 을 영구 보관하여 "6시간 전 P99 spike 시점의 flame graph" 를 볼 수 있게 합니다. Trace 는 외부 호출까지만 보지만 Profile 은 **그 호출 내의 어느 함수가 80% CPU** 인지까지 답합니다. 비용은 trace 의 1/10 수준이라 ROI 가 좋습니다. msa 의 차기 후보입니다.

---

## Phase 2 — Metrics (10문)

### Q9. Prometheus 가 Pull 모델인 이유?

> 첫째, scrape 가 endpoint healthcheck 와 동시에 수행됩니다. 둘째, scrape 주기를 서버가 결정해 클라이언트 폭주가 backend 를 다운시키지 않습니다. 셋째, Service Discovery 가 자연스럽게 통합 (K8s API / file_sd). 단 short-lived job (예: cron 배치) 은 Pushgateway 를 경유해야 하고, 이걸 일반 메트릭에 남용하면 안티패턴입니다.

### Q10. Counter / Gauge / Histogram / Summary 차이?

> Counter 는 단조 증가 (rate 로 봐야 의미 있음), Gauge 는 즉시 값, Histogram 은 bucket 분포 + cluster aggregation 가능, Summary 는 client-side quantile 인데 합산 불가입니다. **분산 환경에서는 거의 항상 Histogram 이 정답** — `sum(rate(..._bucket[5m])) by (le)` 후 `histogram_quantile` 로 cluster P99 를 구할 수 있는 유일한 방법입니다.

### Q11. `histogram_quantile` 에서 `by (le)` 누락하면?

> 결과가 empty 가 됩니다. histogram_quantile 은 `le` 라벨을 키로 bucket 분포를 보간하는데, sum 으로 le 를 제거하면 bucket 정보가 사라져 보간 불가입니다. 가장 흔한 PromQL 실수입니다. 정확한 식은 `histogram_quantile(0.99, sum(rate(..._bucket[5m])) by (le, application))` 입니다.

### Q12. Histogram bucket 설계 룰?

> SLO 라인 부근에 dense bucket 을 둡니다. 예: SLO P99 100ms 라면 50/100/200ms 가 bucket 에 있어야 보간 정밀도가 나옵니다. ADR-0025 §4 가 `slo: 50ms, 100ms, 200ms, 500ms, 1s, 2s` 강제, Spring Boot 가 이걸 SLO bucket 으로 추가합니다. Native Histogram (Prometheus 2.40+) 은 sparse bucket 으로 비용 10x 절감 — 차세대 후보입니다.

### Q13. Pushgateway 를 언제 써야 하나?

> short-lived batch job 의 마지막 결과만. 예: nightly DB backup 결과. 일반 메트릭을 push 하면 Prometheus 의 healthcheck 효과가 사라지고 anti-pattern. Pushgateway 의 메트릭은 **instance label 이 의미 없는 그룹 메트릭** 만 허용한다는 룰입니다.

### Q14. Recording Rule 와 Alerting Rule 차이?

> Recording Rule 은 비싼 PromQL 을 미리 계산해 새 시계열로 저장합니다 (dashboard 가속). Alerting Rule 은 expression 이 true 일 때 alert state (pending/firing) 를 만들어 Alertmanager 로 전송합니다. 둘 다 evaluation_interval 마다 평가됩니다. naming 은 `<level>:<metric>:<operation>` (예: `msa:http_p99:5m`) 권장입니다.

### Q15. Alertmanager 의 routing / grouping / silencing 차이?

> Routing 은 alert 를 receiver 에 매칭 (route tree). Grouping 은 alert storm 방지 — 10개 Pod 가 동시에 5xx 폭발하면 1개 grouped alert 로 묶어서 발송 (`group_by: [alertname, cluster]`). Silencing 은 의도된 침묵 (배포/점검) — 만료 시간 필수, 영구 silence 는 안티패턴. Inhibition 은 별도로 더 큰 alert 가 작은 alert 를 자동 무시 (예: NodeDown 시 같은 노드의 모든 service alert 차단).

### Q16. Multi-Window Multi-Burn-Rate Alert 가 무엇인가?

> Google SRE Workbook 의 정석 알람 패턴입니다. 짧은 윈도우 (5m) 만 보면 false positive 많고 긴 윈도우 (1h) 만 보면 늦습니다. 그래서 5m AND 1h 둘 다 burn rate 14.4× 이상일 때 page 합니다. 4-pair (5m+1h, 30m+6h, 2h+24h, 6h+3d) 를 모두 등록하면 fast/slow 양쪽 cover. 절대값 alert 보다 **현재 속도로 가면 며칠에 budget 다 소진?** 으로 판단해 false positive 가 줄어듭니다.

### Q17. Spring Boot Actuator 의 `percentiles-histogram` 옵션?

> `true` 로 두면 bucket 시계열을 노출 → cluster aggregation 가능 (Histogram). `percentiles=0.5,0.95,0.99` 만 쓰면 client-side quantile 으로 Summary 와 같음 → 단일 인스턴스 한정. ADR-0025 §4 가 모든 서비스에 `percentiles-histogram=true` 강제하지만 msa 의 application.yml 에는 아직 미반영 — 즉시 시작할 quick win 입니다.

### Q18. msa 의 ServiceMonitor 는 어떻게 동작하나요?

> `k8s/infra/prod/monitoring/servicemonitor-apps.yaml` 한 개로 16개 서비스 모두 자동 scrape 합니다. `app.kubernetes.io/part-of: commerce-platform` 라벨을 가진 commerce namespace 의 Service 의 `http` named port 의 `/actuator/prometheus` 를 30초마다 scrape. 새 서비스 추가 시 part-of 라벨만 붙이면 zero-config 등록입니다. kube-prometheus-stack Operator 가 이 ServiceMonitor 를 watch 해서 Prometheus config 를 자동 합성합니다.

---

## Phase 2 — Logs (6문)

### Q19. ELK vs Loki 결정 룰?

> 검색 자유도가 1순위면 ELK, 비용/Grafana 통합이 1순위면 Loki. ELK 는 모든 필드를 인덱스 (full-text), Loki 는 라벨만 인덱스 (메타데이터). Loki 의 chunk 는 단순 gzip 텍스트라 저장 비용이 5-10x 저렴합니다. msa 처럼 운영 비용 절감 + Grafana 단일 UI 가 우선이면 Loki 가 정답이고, 보안 SIEM 이 필요하면 ELK 또는 Splunk 별도 검토합니다.

### Q20. 구조화 로그 (JSON) vs 비구조화?

> 거의 항상 JSON 입니다. Loki / ES 양쪽 모두 자동 파싱, 필드 검색 1줄, 신규 필드 자유 추가 가능. 가독성 손실은 Grafana / Kibana UI 가 prettify 해주므로 무시 가능. msa 는 logback-spring.xml 을 common 모듈에 표준화하는 ADR 초안 단계입니다.

### Q21. Trace ID 를 어디서 어떻게 전파하나?

> incoming 은 Servlet Filter (Webflux 는 WebFilter) 가 W3C `traceparent` 헤더 파싱 → MDC 에 put. outgoing 은 WebClient builder filter 가 MDC 에서 trace_id 를 꺼내 traceparent 헤더 추가. Kafka 는 record header 에 traceparent 를 producer interceptor 가 자동 주입, consumer 가 listener 진입 시 MDC 에 set. 이 모든 게 OpenTelemetry SDK 가 도입되면 자동화됩니다.

### Q22. MDC 가 Async / Coroutine / Webflux 에서 깨진다는 게?

> MDC 는 ThreadLocal 기반이라 thread 가 바뀌면 사라집니다. `@Async` 는 TaskDecorator 로 MDC 복사, Coroutine 은 `kotlinx-coroutines-slf4j` 의 `MDCContext`, Webflux 는 Reactor Context + ContextWrite 로 보존합니다. Spring Boot 3.2+ 의 micrometer context-propagation 이 ThreadLocal ↔ Reactor Context 자동 전파를 제공합니다. msa 의 quant (ADR-0002 Coroutine) 은 MDCContext 적용 검증이 필요합니다.

### Q23. PII 마스킹은 어떻게 강제하나요?

> 5단 방어로 갑니다. 1) **코드 컨벤션** (`docs/conventions/logging.md` — 민감정보 금지) 2) **Logback Converter** 가 카드/주민번호/이메일 자동 마스킹 3) **Fluent Bit / Promtail filter** 2차 방어 4) **Grafana RBAC** 으로 검색 권한 분리 5) **Retention 만료**. 추가로 BehaviorSpec 단위 테스트로 "카드번호 포함 메시지가 마스킹되는가" 를 강제합니다.

### Q24. 로그 vs 메트릭 — 어디로 보낼지?

> 카운트 / 비율 / 분포 → 메트릭. 컨텍스트 / 디버깅 raw → 로그. 시계열 trend → 메트릭. 같은 정보를 둘 다에 보내면 비용 낭비. 단, "ERROR 발생 횟수" 는 둘 다 — 메트릭으로 rate 추적, 로그로 detail 보관합니다. Loki LogQL 의 `count_over_time` 으로 메트릭처럼 집계 가능하지만 비용이 커서 메트릭으로 가능한 건 메트릭이 정답입니다.

---

## Phase 2 — Traces (8문)

### Q25. OpenTelemetry vs Sleuth?

> Sleuth 는 Spring 생태계 한정 + Spring Boot 3 에서 deprecated 입니다. OpenTelemetry 는 CNCF 표준 — vendor-neutral 이라 Jaeger / Tempo / Datadog / Honeycomb 어떤 백엔드든 연결 가능하고, Spring Boot 3.x 는 Micrometer Tracing Bridge 로 OTel 을 1급 통합합니다. 새 도입은 무조건 OTel — Sleuth 는 마이그레이션 권장.

### Q26. Java Agent vs Manual SDK?

> Java Agent (auto-instrumentation) 는 코드 0줄 — Spring/JDBC/Kafka/WebClient 자동 계측됩니다. byte code instrumentation 으로 JVM 시작이 약간 느려지고 일부 라이브러리 지원 제한이 있습니다. Manual SDK 는 정밀 비즈니스 attribute 추가 가능하지만 boilerplate 큽니다. **Spring Boot 3.x + Micrometer Bridge** 가 절충 — agent 없이 빌드시점 통합 + `@Observed` 어노테이션. msa 는 Bridge 가 1순위입니다.

### Q27. W3C Trace Context — `traceparent` 의 4 필드?

> `00-{trace_id 32hex}-{parent_span_id 16hex}-{flags 2hex}` 입니다. version 00, trace_id 16 byte, parent span_id 8 byte, flags 의 bit 0 가 sampled (01 = 샘플됨). `tracestate` 는 vendor 별 추가 컨텍스트 (예: Datadog 의 sampling decision). OTel / Jaeger / Zipkin / Datadog 모두 지원하는 W3C 표준이므로 새 시스템은 무조건 traceparent 입니다.

### Q28. Head-based vs Tail-based Sampling?

> Head 는 요청 시작 시 sampled flag 결정 → 모든 hop 이 따릅니다 (W3C flags). 빠르고 trace 가 항상 완전하지만 error trace 도 같은 확률로 drop. Tail 은 OTel Collector 가 모든 trace 를 buffering 후 종료시점에 결정 → error / slow trace 100% 보존 + 정상 1% 만. 표준 권장은 **App head 100% sampled flag → Collector tail sampling** 2단 — 정보 보존 + 비용 통제.

### Q29. Tail sampling 의 단점?

> Collector 가 모든 trace 를 buffering 해야 해서 메모리/CPU 부담. decision_wait (~30s) 동안 모든 span 이 도착 보장돼야 하므로 늦은 span 은 누락 위험. 분산 Collector 면 같은 trace 의 span 이 다른 Collector 로 갈 수 있어 consistent hashing (load balancer 의 trace_id 기반 routing) 필요합니다. Gateway pattern (cluster level Collector 1-2대) 이 일반적입니다.

### Q30. Jaeger vs Zipkin vs Tempo?

> Tempo 는 Grafana Labs 가 만든 trace store — **검색을 안 함, S3 backend, trace_id 만으로 fetch**. 검색은 Loki/Prometheus 가 담당하는 분리 철학으로 비용이 폭락합니다. Jaeger 는 Cassandra/ES backend, ad-hoc 검색 강함. Zipkin 은 legacy. msa 처럼 Loki + Grafana 단일 UI 로 가는 stack 에서는 **Tempo 가 정답**, 별도 trace 검색이 핵심이면 Jaeger.

### Q31. Exemplar 란?

> Histogram bucket 안에 trace_id 를 끼워넣는 메커니즘 (Prometheus 2.30+, OpenMetrics). `bucket{le=0.05}=24054 # {trace_id="abc"} 0.045` 형태. Grafana Heatmap 의 outlier diamond marker 를 클릭하면 Tempo 의 해당 trace 로 점프합니다. P99 spike 의 정확한 trace 를 클릭 1번에 찾는 게임 체인저. Spring Boot 의 `percentiles-histogram=true` + Prometheus 의 `exemplar-storage` 활성화 + Grafana Tempo datasource 의 `tracesToLogs` 만 설정하면 동작합니다.

### Q32. Trace 와 Logs 를 어떻게 연결하나?

> 로그에 trace_id 가 박혀 있어야 합니다. logback-spring.xml 의 `%mdc{trace_id}` 가 진입점. Loki 는 `derivedFields` 로 trace_id 정규식 매칭 → Tempo URL 자동 생성. Tempo 는 `tracesToLogs` 로 trace_id 를 Loki query (`{trace_id="..."}`) 로 점프. 6 방향 drill-down (M↔T, T↔L, M↔L) 모두 trace_id 의 일관 전파가 전제입니다. msa 는 이 전제 (MDC 전파) 가 미구현 — ADR-X1 의 1순위 항목입니다.

---

## Phase 3 — msa 적용 (4문)

### Q33. msa 의 Observability 현재 상태를 한 줄로?

> Metrics 는 견고 (kube-prometheus-stack + Micrometer 16개 서비스), 그러나 **Logs / Traces / SLO Alert 는 0**. ServiceMonitor 1개로 자동 scrape, dashboard 3종 (jvm/http/overview) 동작. 이제 logback JSON + MDC 도입 → Loki + OTel 동시 적용 → Sloth SLO 순서로 12주 로드맵 ADR 초안을 준비 중입니다.

### Q34. ADR-0025 (Latency Budget) 와 Observability 의 관계?

> ADR-0025 가 Tier 1 P99 alerting 을 강제하지만 측정 표준 (`percentiles-histogram=true`, Heatmap 패널) 도 명시했습니다. 그러나 application.yml 에 percentiles-histogram 미반영, http-dashboard 에 Heatmap 미작성 등 **ADR 과 코드 격차**가 있습니다. SLO ADR (별도) 이 ADR-0025 를 input 으로 받아 구체 SLO 값 + Burn Rate Alert 를 정의해야 합니다.

### Q35. 새 메트릭 추가할 때 코드 리뷰 체크리스트는?

> 5가지를 봅니다. 1) **카디널리티 추정** docstring (예: `// label cardinality ≤ 12: exchange × symbol × source = 2 × 2 × 3`), 2) **enum/상수만** 라벨 사용, 3) **Counter 캐싱** (ConcurrentHashMap, 매번 build 금지), 4) **PII / token 라벨 금지**, 5) **type 적합성** (Histogram > Summary, latency 는 Timer). msa 의 QuantMetrics.kt 가 이 체크리스트를 코드 주석으로 강제하는 모범 사례입니다.

### Q36. quant 의 QuantMetrics 가 모범인 이유?

> 첫째, **모든 메트릭 상수가 companion object 에 명시** — typo 차단. 둘째, **Counter 캐싱** ConcurrentHashMap 사용 — 매번 build 안 함. 셋째, **카디널리티 룰을 docstring 으로 강제** — "topic 라벨은 `quant.events.v1` 단일 (카디널리티 1)" 까지 검증. 넷째, **OutboxPendingMetric 의 lazy gauge** 패턴 — scrape 시점 DB count 1회. 다섯째, **에러 시 마지막 값 유지** runCatching 으로 stale 보존. ADR-0025 가 코드 표준화 ADR 의 input 입니다.

---

## Phase 4 — 운영 / 함정 (4문)

### Q37. Cardinality 폭발이 났을 때 응급 조치?

> 즉시 Prometheus `metric_relabel_configs` 로 폭발 라벨을 drop:
> ```yaml
> metric_relabel_configs:
>   - regex: 'userId'
>     action: labeldrop
> ```
> 이걸로 새 시계열 생성을 막은 후, head 가 retention 만료까지 자연 감소를 기다립니다. 영구 조치는 라벨 자체를 코드에서 제거 또는 enum 으로 변환. Prometheus 가 OOM kill → restart → 다시 죽음 (death spiral) 시 PV 의 head 를 직접 삭제할 수도 있지만 마지막 수단입니다.

### Q38. Alert fatigue 해결 방법?

> 첫째, **alert 절대 수 줄이기** — page 받을 alert 만 SLO burn rate 기반으로 등록 (절대값 alert 폐기). 둘째, **Multi-Window Multi-Burn-Rate** 로 false positive 차단. 셋째, **Inhibition** 으로 root cause alert 가 cascade alert 무시 (NodeDown 시 그 노드의 모든 service alert 자동 silence). 넷째, **group_by + group_wait** 로 storm 묶기. 다섯째, **runbook URL** 을 annotation 에 — alert 받자마자 행동 가능해야.

### Q39. Tracing 100% sampling 운영의 문제?

> 비용이 폭발합니다. Trace 는 raw payload 가 커서 (요청 1개 = N개 span × M attribute), 100% 면 메트릭/로그보다 훨씬 큰 storage 필요. Tempo 는 그나마 S3 라 비용이 적지만 OTel Collector 의 메모리/CPU 부담은 그대로. 권장: **App head 100% sampled flag → Collector tail sampling (error/slow + 1%)**. error/slow trace 는 보존하면서 비용 5-10% 수준. 단, dev/staging 은 100% — 검증.

### Q40. 장애 대응 5분 안에 root cause 찾는 워크플로?

> Multi-pillar drill-down 입니다. 1) **Slack alert** 수신 (SLO burn rate page) 2) **Grafana RED dashboard** 열어 application/uri 변수 적용 → outlier 시각 확인 3) **Heatmap 의 Exemplar diamond marker 클릭** → Tempo trace view 진입 4) **trace 의 가장 느린 span** 확인 → "Logs for this span" → Loki 로 trace_id 검색 5) 로그의 stack trace + Pyroscope **Profile** 으로 함수 단위 root cause 6) **Annotation** (배포 시각) 과 비교 → 회귀 함수 식별. 5분 — 단, MDC trace_id 전파 + 3축 datasource link + Exemplar 가 모두 갖춰져야 가능.

---

## 추가 빠른 회독 카드 (10개 핵심)

### C1. Prometheus 의 1번 적은? — **Cardinality**
### C2. Histogram > Summary 인 이유? — **cluster aggregation 가능 (sum by le)**
### C3. SLO 의 burn rate 다중 윈도우 표준 4-pair? — **(5m,1h,14.4) (30m,6h,6) (2h,24h,3) (6h,3d,1)**
### C4. W3C traceparent 의 flags? — **bit 0 = sampled (01)**
### C5. Loki 가 ELK 보다 싼 이유? — **chunk 가 그냥 gzip 텍스트, label 만 색인**
### C6. Exemplar 가 게임 체인저인 이유? — **Heatmap outlier 클릭 1번에 trace 점프**
### C7. msa 의 logback 표준 진입점? — **common/src/main/resources/logback-spring.xml + MDC**
### C8. quant QuantMetrics 가 모범? — **카디널리티 룰을 docstring 강제 + Counter 캐싱**
### C9. ADR-0025 가 강제하지만 미구현 항목? — **percentiles-histogram=true + Heatmap panel + P99 alert rule**
### C10. 새 ADR 우선순위 5개? — **X4 quick win → X1 logback+MDC → X2 Loki + X3 OTel → X5 SLO Sloth**

---

## 회독 순서 권장

- **1회독**: 학습 종료 직후 — 모든 답변 자력 시도
- **2회독**: 1주 후 — 막힌 답변만 다시
- **3회독**: 면접 직전 — C1-C10 핵심 카드만

각 답변은 **2-3 문장 + 한 가지 msa 사례** 구조로 압축. "msa 에서는…" 한 줄이 면접관 인상에 가장 강하게 남습니다.
