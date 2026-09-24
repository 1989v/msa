# 관측성 · 성능 — 커버리지 체크리스트

원천:
- study/docs/10-observability/99-concept-catalog.md (§1-A 갭 48개 · §2 A~J 개념 트리)
- study/docs/10-observability/01~16 본문 노트 (foundations · Prometheus pull · metric types/cardinality · PromQL/alerting · Grafana · ELK vs Loki · structured logging · OpenTelemetry · sampling/correlation · SLO/error budget · eBPF/Pyroscope · msa 현황 · Prometheus internals · OTel deep)
- study/docs/12-latency-numbers/99-concept-catalog.md (§1-A 갭 43개 · §2 자릿수 표 · §3 측정/모델/도구)
- study/docs/12-latency-numbers/01~13 본문 노트 (자릿수 지도 · CPU 캐시 · 메모리/스토리지 · 네트워크 물리 · tail/fan-out · 실측 · 부하 테스트 · msa 예산 · 함정 · 현대 하드웨어)
- 볼트 system-resources-cheatsheet.md (§01 메모리 · §04 CPU · §05 디스크 · §08 증상→명령)
- docs/adr/ADR-0025-latency-budget.md · docs/conventions/latency-budget.md · 레포 k8s/infra/prod/monitoring · Micrometer 메트릭 코드 · scripts/perf
- 분야 표준 — Google SRE Book · SRE Workbook(SLO · 번 레이트), OpenTelemetry 명세, Prometheus 문서, Brendan Gregg USE · Systems Performance, The Tail at Scale, Latency Numbers Every Programmer Should Know

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| obs-observability | 관측성 · 성능 | 구조 노드 (활동 묶음) | placed |
| obs-telemetry | 텔레메트리 | 구조 노드 (활동 묶음) | placed |
| obs-instrumentation | 계측 | 구조 노드 (활동 묶음) | placed |
| obs-opentelemetry | OpenTelemetry | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| otel-operator | OpenTelemetry Operator | 카탈로그 §1-A 36 | excluded — 레포에 없는 제품 — 자동 계측 주입은 obs-auto-instrumentation 에 흡수 |
| obs-metrics-facade | 계측 파사드 | study/10 12-msa-current-state · 레포 Micrometer | placed |
| micrometer | Micrometer | study/10 12-msa-current-state · 레포 Micrometer | placed |
| obs-auto-instrumentation | 자동 계측 | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-manual-instrumentation | 수동 계측 | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-whitebox-monitoring | 화이트박스 모니터링 | 카탈로그 §2F·H · §1-A 12·32 | placed |
| obs-blackbox-monitoring | 블랙박스 모니터링 | 카탈로그 §2F·H · §1-A 12·32 | placed |
| obs-synthetic-monitoring | 합성 모니터링 | 카탈로그 §2F·H · §1-A 12·32 | placed |
| obs-real-user-monitoring | 실사용자 모니터링 | study/10 카탈로그 §2F · study/12 카탈로그 §1-A 37 | placed |
| obs-web-vitals | Web Vitals | study/10 카탈로그 §2F · study/12 카탈로그 §1-A 37 | placed |
| obs-telemetry-pipeline | 텔레메트리 수집 · 전송 | 구조 노드 (활동 묶음) | placed |
| obs-otel-collector | OpenTelemetry Collector | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-otlp | OTLP | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-collector-topology | 수집기 배치 형태 | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-metrics | 메트릭 수집 · 질의 | 구조 노드 (활동 묶음) | placed |
| obs-pull-scrape | 풀 방식 수집 | study/10 02-prometheus-pull-model · 15 §6 · 카탈로그 §1-A 45·47 | placed |
| obs-push-gateway | 푸시 게이트웨이 | study/10 02-prometheus-pull-model · 15 §6 · 카탈로그 §1-A 45·47 | placed |
| obs-scrape-discovery | 수집 대상 발견 · 재라벨링 | study/10 02-prometheus-pull-model · 15 §6 · 카탈로그 §1-A 45·47 | placed |
| obs-exposition-format | 노출 형식 | study/10 02-prometheus-pull-model · 15 §6 · 카탈로그 §1-A 45·47 | placed |
| obs-metric-types | 메트릭 타입 | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-counter | Counter | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-gauge | Gauge | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-histogram | Histogram | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-summary | Summary | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-native-histogram | 네이티브 히스토그램 | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-bucket-design | 버킷 설계 | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-label-design | 라벨 설계 규칙 | study/10 01 §3 · 03 §6 · 15 §11 | placed |
| obs-promql | PromQL | study/10 04 · 15-prometheus-internals · 카탈로그 §1-A 19·20·25·26·46 | placed |
| obs-recording-rule | 기록 규칙 | study/10 04 · 15-prometheus-internals · 카탈로그 §1-A 19·20·25·26·46 | placed |
| obs-tsdb | 시계열 데이터베이스 | study/10 04 · 15-prometheus-internals · 카탈로그 §1-A 19·20·25·26·46 | placed |
| obs-long-term-storage | 장기 보관 · 확장 | study/10 04 · 15-prometheus-internals · 카탈로그 §1-A 19·20·25·26·46 | placed |
| thanos | Thanos · Mimir · Cortex · VictoriaMetrics | study/10 15 §9 | excluded — 레포에 없는 제품 — obs-long-term-storage 동의어로 흡수 |
| prometheus | Prometheus | study/10 04 · 15-prometheus-internals · 카탈로그 §1-A 19·20·25·26·46 | placed |
| obs-cardinality-explosion | 카디널리티 폭발 | study/10 01 §3 · 03 §6 · 15 §11 | placed |
| obs-between-scrape-blindness | 수집 간격 사이 유실 | study/10 03-metric-types · 카탈로그 §2A · §1-A 17·18·42 | placed |
| obs-active-series | 활성 시계열 수 | study/10 01 §3 · 03 §6 · 15 §11 | placed |
| obs-logging | 로깅 | 구조 노드 (활동 묶음) | placed |
| obs-structured-logging | 구조화 로깅 | study/10 07-structured-logging · docs/conventions/logging.md | placed |
| obs-contextual-logging | 문맥 로깅 | study/10 07-structured-logging · docs/conventions/logging.md | placed |
| conc-mdc-propagation | MDC 전파 (스레드 · 코루틴 · 리액터) | study/10 07 §2·3 | excluded — owned by concurrency — obs-contextual-logging 이 USES 로 잇는다 |
| obs-log-pipeline | 로그 수집 파이프라인 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| obs-full-text-log-store | 전문 색인 로그 저장소 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| obs-label-indexed-log-store | 라벨 색인 로그 저장소 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| loki | Loki · Promtail | study/10 06 §3 | excluded — 레포에 없는 제품 — obs-label-indexed-log-store 동의어로 흡수 |
| obs-log-sampling | 로그 샘플링 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| obs-pii-masking | 개인정보 마스킹 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| obs-log-retention-tiering | 보관 계층화 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| kotlin-logging | kotlin-logging | study/10 07-structured-logging · docs/conventions/logging.md | placed |
| obs-log-volume-explosion | 로그 폭증 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| obs-pii-in-logs | 로그 속 개인정보 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| obs-log-volume | 로그 수집량 | study/10 06-logs-elk-vs-loki · 카탈로그 §2B · §1-A 23·34 | placed |
| obs-tracing | 분산 추적 | 구조 노드 (활동 묶음) | placed |
| obs-distributed-tracing | 분산 트레이싱 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-context-propagation | 문맥 전파 | study/10 07 §4·5 · 16 §6 · 카탈로그 §1-A 6·7 | placed |
| obs-w3c-trace-context | W3C Trace Context | study/10 07 §4·5 · 16 §6 · 카탈로그 §1-A 6·7 | placed |
| obs-b3-propagation | B3 전파 | study/10 07 §4·5 · 16 §6 · 카탈로그 §1-A 6·7 | placed |
| obs-baggage-propagation | 배기지 전파 | study/10 07 §4·5 · 16 §6 · 카탈로그 §1-A 6·7 | placed |
| obs-async-trace-propagation | 비동기 문맥 전파 | study/10 07 §4·5 · 16 §6 · 카탈로그 §1-A 6·7 | placed |
| obs-trace-sampling | 트레이스 샘플링 | study/10 09-sampling-and-correlation · 카탈로그 §1-A 15·16 | placed |
| obs-head-sampling | 헤드 샘플링 | study/10 09-sampling-and-correlation · 카탈로그 §1-A 15·16 | placed |
| obs-tail-sampling | 꼬리 샘플링 | study/10 09-sampling-and-correlation · 카탈로그 §1-A 15·16 | placed |
| obs-probabilistic-sampling | 확률 샘플링 | study/10 09-sampling-and-correlation · 카탈로그 §1-A 15·16 | placed |
| obs-rate-limited-sampling | 속도 제한 샘플링 | study/10 09-sampling-and-correlation · 카탈로그 §1-A 15·16 | placed |
| obs-service-map | 서비스 맵 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-trace-store | 트레이스 저장소 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| tempo | Tempo · Jaeger · Zipkin | study/10 08 §6 | excluded — 레포에 없는 제품 — obs-trace-store 동의어로 흡수 |
| obs-broken-trace | 끊긴 트레이스 | study/10 07 §4·5 · 16 §6 · 카탈로그 §1-A 6·7 | placed |
| obs-span-explosion | 스팬 폭증 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-signal-correlation | 신호 연결 | 구조 노드 (활동 묶음) | placed |
| obs-exemplar | Exemplar | study/10 05 §6 · 09 §4 · 카탈로그 §1-A 8·9·33 | placed |
| obs-log-trace-correlation | 로그-트레이스 연결 | study/10 05 §6 · 09 §4 · 카탈로그 §1-A 8·9·33 | placed |
| obs-deployment-annotation | 변경 표시 | study/10 05 §6 · 09 §4 · 카탈로그 §1-A 8·9·33 | placed |
| obs-drill-down-investigation | 드릴다운 조사 | study/10 05 §6 · 09 §4 · 카탈로그 §1-A 8·9·33 | placed |
| obs-profiling | 프로파일링 | 구조 노드 (활동 묶음) | placed |
| conc-lock-profiling | 락 프로파일링 | 카탈로그 §2E | excluded — owned by concurrency — obs-profiling 이 USES 로 잇는다 |
| rt-jfr | JFR · async-profiler | study/10 11 §5·10 | excluded — owned by runtime (JVM 진단 도구) |
| obs-sampling-profiler | 샘플링 프로파일러 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-instrumenting-profiler | 계측 프로파일러 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-cpu-profiling | CPU 프로파일링 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-allocation-profiling | 할당 프로파일링 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-wall-clock-profiling | 벽시계 프로파일링 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-flame-graph | 플레임 그래프 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-differential-flame-graph | 차분 플레임 그래프 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-continuous-profiling | 연속 프로파일링 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| pyroscope | Pyroscope · Parca · Pixie · Beyla | study/10 11 §4 · 카탈로그 §1-A 10·11 | excluded — 레포에 없는 제품 — obs-continuous-profiling · obs-ebpf-observability 에 흡수 |
| pprof | pprof | 카탈로그 §2E | excluded — Go 전용 프로파일 형식이라 이 레포(JVM) 범위 밖 |
| obs-ebpf-observability | eBPF 관측 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-safepoint-bias | 세이프포인트 편향 | study/10 11-ebpf-profiling-pyroscope · 카탈로그 §2E · §1-A 10·11 | placed |
| obs-reliability | 신뢰성 목표 · 대응 | 구조 노드 (활동 묶음) | placed |
| obs-service-level | 서비스 수준 정의 | 구조 노드 (활동 묶음) | placed |
| obs-sli-design | SLI 설계 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-slo-setting | SLO 설정 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| sloth | Sloth · Pyrra | study/10 10 §11 | excluded — 레포에 없는 SLO 규칙 생성 도구 — obs-burn-rate-alerting · obs-recording-rule 에 흡수 |
| obs-error-budget-policy | 에러 버짓 정책 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-perfection-target | 100% 목표 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-availability | 가용성 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-error-budget-remaining | 남은 에러 버짓 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-apdex | Apdex | study/10 04 §3.2 · study/12 카탈로그 §1-A 36 | placed |
| obs-monitoring-methods | 모니터링 방법론 | 구조 노드 (활동 묶음) | placed |
| obs-red-method | RED 방법 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-use-method | USE 방법 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-golden-signals | 황금 신호 넷 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| service-mesh | 서비스 메시 자동 관측 | 카탈로그 §2I · §1-A 48 | excluded — owned by distributed |
| obs-request-rate | 요청률 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-error-rate | 오류율 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-utilization | 사용률 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-saturation | 포화도 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-alerting | 알림 | 구조 노드 (활동 묶음) | placed |
| obs-alert-rule | 알림 규칙 | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-symptom-based-alerting | 증상 기반 알림 | 분야 표준(SRE Book 6장 · 알림 철학) | placed |
| obs-cause-based-alerting | 원인 기반 알림 | 분야 표준(SRE Book 6장 · 알림 철학) | placed |
| obs-burn-rate-alerting | 번 레이트 알림 | study/10 10 §5 · 카탈로그 §1-A 28 | placed |
| obs-alert-routing | 알림 라우팅 | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-alert-grouping | 알림 묶기 | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-alert-inhibition | 알림 억제 | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-alert-silencing | 알림 잠재우기 | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-on-call | 온콜 · 에스컬레이션 | 분야 표준(SRE Book 6장 · 알림 철학) | placed |
| alertmanager | Alertmanager | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-alert-fatigue | 알림 피로 | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-alert-storm | 알림 폭주 | study/10 04 §5~8 · 카탈로그 §2G · §1-A 21 | placed |
| obs-mttd | MTTD | 분야 표준(SRE Book 6장 · 알림 철학) | placed |
| obs-visualization | 대시보드 | 구조 노드 (활동 묶음) | placed |
| obs-dashboard-design | 대시보드 설계 | study/10 05-grafana-dashboards · 카탈로그 §1-A 22 | placed |
| obs-heatmap | 히트맵 | study/10 05-grafana-dashboards · 카탈로그 §1-A 22 | placed |
| obs-dashboard-templating | 대시보드 변수 | study/10 05-grafana-dashboards · 카탈로그 §1-A 22 | placed |
| obs-dashboard-as-code | 대시보드 코드화 | study/10 05-grafana-dashboards · 카탈로그 §1-A 22 | placed |
| grafana | Grafana | study/10 05-grafana-dashboards · 카탈로그 §1-A 22 | placed |
| obs-dashboard-sprawl | 대시보드 난립 | study/10 05-grafana-dashboards · 카탈로그 §1-A 22 | placed |
| obs-incident-response | 장애 대응 | 구조 노드 (활동 묶음) | placed |
| obs-incident-triage | 장애 분류 | study/10 14 Q40 · 분야 표준(SRE Book 14·15장) | placed |
| obs-mitigate-first | 완화 우선 | study/10 14 Q40 · 분야 표준(SRE Book 14·15장) | placed |
| obs-blameless-postmortem | 비난 없는 사후 분석 | study/10 14 Q40 · 분야 표준(SRE Book 14·15장) | placed |
| obs-mttr | MTTR | study/10 14 Q40 · 분야 표준(SRE Book 14·15장) | placed |
| obs-performance | 성능 분석 | 구조 노드 (활동 묶음) | placed |
| obs-latency-intuition | 지연 자릿수 판단 | 구조 노드 (활동 묶음) | placed |
| arch-back-of-envelope | 봉투 뒷면 계산 | study/12 01 §6 · 09 | excluded — owned by architecture — obs-latency-intuition 이 USES 로 잇는다 |
| obs-orders-of-magnitude | 자릿수 사다리 | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-latency-budget | 지연 예산 | study/12 06·09·12 · ADR-0025 | placed |
| obs-latency-decomposition | 지연 분해 | study/12 06·09·12 · ADR-0025 | placed |
| obs-ttfb | 첫 바이트 시간 | study/12 06·09·12 · ADR-0025 | placed |
| obs-tail-latency-analysis | 꼬리 지연 분석 | 구조 노드 (활동 묶음) | placed |
| dist-tail-latency-amplification | fan-out 꼬리 증폭 (The Tail at Scale) | study/12 05 §2 · 카탈로그 §1-A 25·28 | excluded — owned by distributed |
| dist-hedged-request | 헤지 요청 · 요청 슬랙 | study/12 카탈로그 §1-A 26·27 | excluded — owned by distributed — obs-tail-latency-analysis 가 USES 로 잇는다 |
| latency-percentile | p99 지연 (METRIC) | study/12 카탈로그 §3-A | excluded — owned by search — RED · 황금 신호 · 부하 테스트가 MEASURED_BY 로 잇는다 |
| obs-distribution-analysis | 분포로 보기 | study/12 05·10 · 카탈로그 §3-A · §1-A 29·33·34 | placed |
| obs-hdr-histogram | HdrHistogram | study/12 05·10 · 카탈로그 §3-A · §1-A 29·33·34 | placed |
| obs-average-illusion | 평균의 착시 | study/12 05·10 · 카탈로그 §3-A · §1-A 29·33·34 | placed |
| obs-percentile-averaging | 백분위 평균 내기 | study/12 05·10 · 카탈로그 §3-A · §1-A 29·33·34 | placed |
| obs-quantile-interpolation-error | 백분위 추정 오차 | study/12 05·10 · 카탈로그 §3-A · §1-A 29·33·34 | placed |
| obs-capacity-planning | 용량 계획 | 구조 노드 (활동 묶음) | placed |
| conc-throughput | 처리량 | study/12 10 함정 #3 | excluded — owned by concurrency — obs-capacity-planning · obs-load-testing 이 MEASURED_BY 로 잇는다 |
| obs-littles-law | Little 의 법칙 | study/12 05 §3 · 10 함정 #3·#4 · 카탈로그 §3-B · §1-A 30~32 | placed |
| data-pool-sizing | Little 의 법칙으로 풀 크기 정하기 | study/12 05 §3 · 11 Q5 | excluded — owned by data |
| obs-queueing-model | 대기열 모델 | study/12 05 §3 · 10 함정 #3·#4 · 카탈로그 §3-B · §1-A 30~32 | placed |
| obs-scalability-law | 확장성 법칙 | study/12 05 §3 · 10 함정 #3·#4 · 카탈로그 §3-B · §1-A 30~32 | placed |
| obs-headroom-planning | 여유 용량 계획 | study/12 05 §3 · 10 함정 #3·#4 · 카탈로그 §3-B · §1-A 30~32 | placed |
| obs-trend-forecasting | 추세 예측 | study/12 05 §3 · 10 함정 #3·#4 · 카탈로그 §3-B · §1-A 30~32 | placed |
| obs-saturation-knee | 포화 무릎 | study/12 05 §3 · 10 함정 #3·#4 · 카탈로그 §3-B · §1-A 30~32 | placed |
| obs-headroom | 여유율 | study/12 05 §3 · 10 함정 #3·#4 · 카탈로그 §3-B · §1-A 30~32 | placed |
| obs-load-testing | 부하 테스트 | 구조 노드 (활동 묶음) | placed |
| obs-open-workload-model | 열린 부하 모델 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| obs-closed-workload-model | 닫힌 부하 모델 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| obs-load-test-types | 부하 테스트 종류 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| wrk | wrk · wrk2 · vegeta | study/12 07 §1 · 카탈로그 §3-C | excluded — 레포에 없는 부하 도구 — 레포는 k6 를 쓴다 |
| obs-baseline-test | 기준선 측정 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| obs-stress-test | 스트레스 테스트 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| obs-soak-test | 내구 테스트 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| obs-spike-test | 급증 테스트 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| obs-microbenchmark | 마이크로벤치마크 | study/12 카탈로그 §3-C · 레포 code-dictionary JMH | placed |
| rt-jvm-warmup | JIT 워밍업 편향 | study/12 카탈로그 §1-A 10 | excluded — owned by runtime — obs-microbenchmark 가 MITIGATES 로 잇는다 |
| k6 | k6 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| jmh | JMH | study/12 카탈로그 §3-C · 레포 code-dictionary JMH | placed |
| obs-coordinated-omission | 조정된 누락 | study/12 07-load-test-tail · 카탈로그 §3-A·C · 레포 scripts/perf | placed |
| obs-resource-diagnosis | 자원 진단 | 구조 노드 (활동 묶음) | placed |
| obs-syscall-tracing | 시스템 콜 추적 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| conc-epoll | epoll | 볼트 시스템 자원 한 판 §06 | excluded — owned by concurrency |
| obs-pressure-stall | 자원 압박 지표 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-load-average | load average | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-cpu-time-breakdown | CPU 시간 구성 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-run-queue-length | 실행 대기열 길이 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-rss | RSS | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-memory-available | 사용 가능 메모리 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| data-page-cache | OS 페이지 캐시 | 볼트 시스템 자원 한 판 §01 | excluded — owned by data |
| obs-major-page-faults | 메이저 페이지 폴트 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| rt-major-fault-storm | major 페이지 폴트 폭증 · 스왑 스래싱 | 볼트 시스템 자원 한 판 §01·§08 | excluded — owned by runtime |
| obs-iops | IOPS · 디스크 처리량 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-disk-fill | 디스크 고갈 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-glossary | 관측성 용어 사전 | 구조 노드 (용어 가지) | placed |
| obs-glossary-signal | 신호 용어 | 구조 노드 (용어 가지) | placed |
| obs-monitoring-vs-observability | 모니터링과 관측성 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-three-pillars | 세 기둥 | study/10 01-observability-foundations · 카탈로그 §1-A 29~31 | placed |
| obs-time-series | 시계열 | study/10 01 §3 · 03 §6 · 15 §11 | placed |
| obs-metric-label | 라벨 | study/10 01 §3 · 03 §6 · 15 §11 | placed |
| obs-sample | 샘플 | study/10 01 §3 · 03 §6 · 15 §11 | placed |
| obs-scrape-interval | 스크레이프 주기 | study/10 02-prometheus-pull-model · 15 §6 · 카탈로그 §1-A 45·47 | placed |
| obs-cardinality | 카디널리티 | study/10 01 §3 · 03 §6 · 15 §11 | placed |
| obs-log-level | 로그 레벨 | study/10 07-structured-logging · docs/conventions/logging.md | placed |
| obs-trace | 트레이스 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-span | 스팬 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-span-kind | 스팬 종류 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-trace-id | trace id | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-span-attribute | 스팬 속성 | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-resource-attribute | 리소스 속성 | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-span-link | 스팬 링크 | study/10 08-opentelemetry-tracing · 카탈로그 §2C · §1-A 5·24·35·39·40 | placed |
| obs-baggage | 배기지 | study/10 07 §4·5 · 16 §6 · 카탈로그 §1-A 6·7 | placed |
| obs-semantic-conventions | 의미 규약 | study/10 08·16-opentelemetry · 카탈로그 §2D · §1-A 1~4·36~38 | placed |
| obs-glossary-reliability | 신뢰성 용어 | 구조 노드 (용어 가지) | placed |
| obs-sli | SLI | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-slo | SLO | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-sla | SLA | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-error-budget | 에러 버짓 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-nines | 9 의 개수 | study/10 10-slo-sli-error-budget · 카탈로그 §2H · §1-A 27·43 | placed |
| obs-burn-rate | 번 레이트 | study/10 10 §5 · 카탈로그 §1-A 28 | placed |
| obs-runbook | 런북 | 분야 표준(SRE Book 6장 · 알림 철학) | placed |
| obs-glossary-latency | 지연 자릿수 용어 | 구조 노드 (용어 가지) | placed |
| obs-percentile | 백분위수 | study/12 05·10 · 카탈로그 §3-A · §1-A 29·33·34 | placed |
| obs-memory-hierarchy | 메모리 계층 | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| conc-false-sharing | 거짓 공유 · 캐시 라인 패딩 | study/12 02 §3 | excluded — owned by concurrency |
| obs-speed-of-light-bound | 광속 하한 | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| net-term-bdp | BDP (대역폭 지연 곱) | study/12 04 §3 | excluded — owned by network |
| obs-ux-response-thresholds | 체감 응답 한계 | study/12 카탈로그 §1-A 35 | placed |
| obs-lat-l1-cache | L1 캐시 참조 ≈ 1ns | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-branch-mispredict | 분기 예측 실패 ≈ 5ns | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| rt-branch-misprediction | 분기 예측 실패 (현상) | study/12 카탈로그 §1-A 3 | excluded — owned by runtime — 여기는 비용 자릿수만 둔다 |
| obs-lat-l2-cache | L2 캐시 참조 ≈ 4ns | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-l3-cache | L3 캐시 참조 ≈ 20ns | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-mutex-uncontended | 경합 없는 락 ≈ 25ns | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-main-memory | 메인 메모리 참조 ≈ 100ns | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-numa-remote | 원격 NUMA 메모리 ≈ 200ns | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| rt-numa | NUMA (메커니즘) | study/12 13 §2-C | excluded — owned by runtime — 여기는 비용 자릿수만 둔다 |
| obs-lat-syscall | 시스템 콜 ≈ 100ns~1µs | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-context-switch | 컨텍스트 스위치 ≈ 1~5µs | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| conc-context-switch | 컨텍스트 스위치 (개념) | study/12 카탈로그 §1-A 5 | excluded — owned by concurrency — 여기는 비용 자릿수만 둔다 |
| obs-lat-nvme-read | NVMe 랜덤 읽기 ≈ 10~100µs | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-hdd-seek | HDD 탐색 ≈ 5~10ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-dc-rtt | 데이터센터 안 왕복 ≈ 0.5ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-cross-az-rtt | 가용 영역 간 왕복 ≈ 1~2ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-cross-region-rtt | 대륙 간 왕복 ≈ 100~200ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-tls-handshake | TLS 핸드셰이크 ≈ 1~2 RTT | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| net-tls13-handshake | TLS 1.2 · 1.3 핸드셰이크 · 0-RTT | study/12 카탈로그 §1-A 11 | excluded — owned by network — 여기는 비용 자릿수만 둔다 |
| obs-lat-dns-lookup | DNS 조회 ≈ 1~100ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-redis-op | Redis 명령 ≈ 0.2~1ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-db-point-lookup | DB 기본키 조회 ≈ 1ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-kafka-produce | Kafka 발행 ≈ 1~10ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-gc-pause | GC 멈춤 ≈ 1~200ms | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| rt-gc | G1 · ZGC · Shenandoah | study/12 카탈로그 §2-E | excluded — owned by runtime — 여기는 멈춤 자릿수만 둔다 |
| obs-lat-jvm-startup | JVM 기동 ≈ 수~수십 초 | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| rt-aot-compilation | CRaC · AOT · 기동 최적화 | study/12 카탈로그 §1-A 24 | excluded — owned by runtime |
| obs-lat-container-start | 컨테이너 기동 ≈ 0.1~10초 | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-lat-serverless-cold-start | 서버리스 콜드 스타트 ≈ 0.1~5초 | study/12 01·02·03·04·13 · 카탈로그 §2 자릿수 표 | placed |
| obs-glossary-system | 운영체제 자원 용어 | 구조 노드 (용어 가지) | placed |
| obs-vsz | VSZ | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-anon-memory | 익명 메모리 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-page-fault | 페이지 폴트 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-dirty-page | 더티 페이지 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | excluded — 같은 개념 data-dirty-page 로 합쳤다 |
| obs-swap | 스왑 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
| obs-huge-page | 큰 페이지 | 볼트 시스템 자원 한 판 §01·§04·§05·§08 | placed |
