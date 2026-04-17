---
id: 10
title: Observability 3축
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [observability, metrics, logs, tracing, prometheus, grafana, opentelemetry]
difficulty: intermediate
estimated-hours: 18
codebase-relevant: true
---

# Observability 3축 (Metrics + Logs + Traces)

## 1. 개요

관측성(Observability)의 3축 — **Metrics**(Prometheus + Grafana), **Logs**(ELK / Loki), **Traces**(OpenTelemetry + Jaeger) — 를 학습한다. 10년차 백엔드의 "운영 감각" 을 드러내는 핵심 주제로, 프로덕션 장애 대응 능력을 보여주는 지표.

msa 프로젝트가 다중 서비스 구조라 관측성 필요도가 매우 높음. `docs/specs/2026-04-09-monitoring-infrastructure-design.md` 존재.

## 2. 학습 목표

- 관측성 3축의 역할과 상호 보완 관계 설명
- Prometheus 의 Pull 모델, exposition format, PromQL 이해
- Micrometer + Spring Boot Actuator 메트릭 수집
- Grafana 대시보드 설계 (USE / RED 방법론)
- 로그 구조화 (JSON) + 수집 파이프라인 (Fluent Bit → Loki/ELK)
- 분산 트레이싱 (OpenTelemetry) 의 Trace/Span/Context 전파
- SLI / SLO / SLA 정의와 측정
- AlertManager 알람 설계
- 면접 "장애 어떻게 탐지/대응하나요?" "트레이싱 도입 경험?" 방어

## 3. 선수 지식

- K8s 기본
- 로그 파일 기본
- HTTP header 개념

## 4. 학습 로드맵

### Phase 1: 기본 개념
- 관측성 vs 모니터링 차이
- 3축: Metrics / Logs / Traces — 각각의 역할
- Cardinality, Retention, Sampling 개념
- USE 방법론 (Utilization / Saturation / Errors) - 리소스
- RED 방법론 (Rate / Errors / Duration) - 서비스
- Golden Signals (Latency / Traffic / Errors / Saturation)
- SLI / SLO / SLA / Error Budget

### Phase 2: 심화
**Metrics (Prometheus + Grafana)**
- Prometheus Pull 모델, exposition format (text-based)
- 메트릭 타입: Counter, Gauge, Histogram, Summary
- Label cardinality 위험 (폭발적 시계열 생성)
- PromQL: rate(), histogram_quantile(), aggregation
- AlertManager: 알람 그룹화, 침묵, 라우팅
- Recording Rules
- Micrometer 의 Registry + Spring Boot Actuator 통합
- Grafana 대시보드 설계 (Panel, Variable, Annotation)

**Logs (ELK / Loki)**
- 구조화 로그 (JSON) vs 평문 로그
- 로그 수집: Fluent Bit, Vector, Filebeat
- 저장: Elasticsearch vs Loki (label 기반 인덱싱)
- 로그 파이프라인: 수집 → 파싱 → 인덱싱 → 검색
- 샘플링 전략 (정보 과잉 방지)
- 개인정보 마스킹
- Correlation ID (로그 간 연결)

**Traces (OpenTelemetry)**
- OpenTelemetry: 표준 SDK + Collector + Exporter
- Trace / Span / Context
- Context 전파: W3C Trace Context, B3 헤더
- Sampling 전략 (head-based vs tail-based)
- Jaeger / Tempo / Datadog APM 백엔드
- Span 간 관계: ChildOf, FollowsFrom
- 자동 계측 (Java agent) vs 수동 계측

**상호 연결**
- Trace ID 를 로그에 포함 → Trace → Log drill-down
- 메트릭 라벨에 Span 연결
- Exemplars (Prometheus 에 Trace ID 연결)

### Phase 3: 실전 적용
- msa 프로젝트 Actuator 노출 확인 (`/actuator/prometheus`)
- Prometheus + Grafana K8s 배포 확인 (`k8s/infra/prod/monitoring/`)
- `docs/specs/2026-04-09-monitoring-infrastructure-design.md` 설계 검토
- 분산 Trace 도입 현황 (OpenTelemetry / Sleuth 존재 여부)
- 주요 서비스의 Grafana 대시보드 제안
- SLO 정의 (예: gateway latency p99 < 500ms)
- 로그 Correlation ID 전파 점검 (gateway → product → order)

### Phase 4: 면접 대비
- "프로덕션 장애를 어떻게 탐지하나요?"
- "Observability 와 Monitoring 차이는?"
- "SLI/SLO/SLA 를 어떻게 정의하나요?"
- "Prometheus 의 cardinality 문제가 뭔가요?"
- "분산 Tracing 을 도입해보셨나요? 어떤 문제를 해결했나요?"
- "로그와 트레이스를 어떻게 연결하나요?"
- "OpenTelemetry vs Sleuth?"

## 5. 코드베이스 연관성

- **Actuator 설정**: `{service}/app/src/main/resources/application.yml`
- **Common 설정**: `common/` (공통 Actuator 설정)
- **모니터링 K8s**: `k8s/infra/prod/monitoring/`
- **대시보드**: `k8s/infra/prod/monitoring/dashboards/`
- **관련 Spec**: `docs/specs/2026-04-09-monitoring-infrastructure-design.md`

## 6. 참고 자료

- "Observability Engineering" - Charity Majors 외
- Prometheus 공식 문서
- OpenTelemetry 공식 문서
- Google SRE Book (SLI/SLO 챕터)

## 7. 미결 사항

- 실습 범위: 로컬 Prometheus + Grafana 스택 구축?
- 분산 Tracing 도입 여부 (msa 에 현재 미도입 상태일 가능성)
- SLO 설계 실습 깊이
- 로그 파이프라인 (Loki vs ELK) 선택 근거 비교

## 8. 원본 메모

Observability 3축 (Metrics: Prometheus + Grafana / Logs: ELK, Loki / Tracing: OpenTelemetry, Jaeger)
