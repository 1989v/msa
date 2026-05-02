---
parent: 10-observability
phase: 2
title: SLO / SLI / Error Budget + Burn Rate Alert + ADR-0025 결합
created: 2026-05-01
---

# 10. SLO / SLI / Error Budget — Burn Rate Alert 와 ADR-0025

## 1. 정의 — 4개 단어 (면접 단골)

| 약어 | 풀이름 | 정의 | 주체 |
|---|---|---|---|
| **SLI** | Service Level Indicator | 측정 가능한 신호 (예: 5xx 비율) | 운영자 |
| **SLO** | Service Level Objective | SLI 의 목표값 (예: 99.9%) | 운영자 + 제품 |
| **SLA** | Service Level Agreement | 고객과의 계약 (penalty 포함) | 영업 / 법무 |
| **Error Budget** | (1 - SLO) × time | 허용된 실패량 (예: 0.1% × 30d = 43.2분) | 운영자 |

> **2026 면접 모범 답변**: "SLI 는 측정 신호, SLO 는 그 신호의 내부 목표, SLA 는 외부 계약입니다. Error Budget 은 (1 - SLO) 인 허용 실패 시간으로, '안정성과 속도의 trade-off 를 수치로 만드는' 도구입니다 — Budget 이 남으면 새 기능 배포, 다 쓰면 freeze."

## 2. SLI 의 좋은 정의 — "사용자 행복도"

SLI 는 단순히 "시스템 메트릭" 이 아니라 **"고객이 행복한 비율"**.

### 2.1 GSCS - Google SRE 의 4가지 좋은 SLI

```
SLI = Good events / Valid events
    예: 200ms 내에 응답한 요청 / 전체 요청
```

- **Availability**: 성공 응답 / 전체
- **Latency**: P95 < 300ms 인 요청 / 전체
- **Quality**: 정확한 응답 / 전체 (캐시 stale 등 감점)
- **Freshness**: 최신 데이터로 응답한 / 전체

### 2.2 좋은 SLI 의 기준

1. **고객 영향과 직결** — CPU 사용률은 SLI 가 아니다 (proxy)
2. **명확한 측정** — `http_server_requests_seconds` 같은 표준 메트릭
3. **이진 분류 가능** — good vs bad
4. **유효 요청 정의** — health check / 봇 / 의도적 4xx 는 분모에서 제외

### 2.3 msa 적용 예시 SLI

```promql
# Tier 1: 상품 조회
SLI_product_availability = 
  sum(rate(http_server_requests_seconds_count{application="product",uri="/api/products/{id}",status=~"2..|3.."}[5m]))
  /
  sum(rate(http_server_requests_seconds_count{application="product",uri="/api/products/{id}"}[5m]))

# Tier 1: 주문 생성 latency
SLI_order_create_latency =
  sum(rate(http_server_requests_seconds_bucket{application="order",uri="/api/orders",method="POST",le="0.1"}[5m]))
  /
  sum(rate(http_server_requests_seconds_count{application="order",uri="/api/orders",method="POST"}[5m]))
```

→ "100ms 내에 응답한 비율".

## 3. SLO 설정 — 99 의 개수 게임

| SLO | 한 달 허용 다운타임 | 주간 |
|---|---|---|
| 99% | 7시간 12분 | ~100분 |
| 99.5% | 3시간 36분 | ~50분 |
| **99.9%** ("three nines") | **43분** | **~10분** |
| 99.95% | 22분 | ~5분 |
| 99.99% ("four nines") | 4분 | ~1분 |
| 99.999% ("five nines") | 26초 | ~6초 |

### 3.1 99.9 vs 99.99 의 비용 차이

```
99.9   : 단일 region, single AZ failover 가능
99.95  : multi-AZ
99.99  : multi-region active-active + 즉시 failover
99.999 : 비현실적 — 인간 개입 시간 자체가 26초
```

→ **"99 하나 더 쓰면 비용 ~10x"**. 무턱대고 99.99 로 쓰지 말 것.

### 3.2 ADR-0025 와 결합 (실제 인용)

> Tier 1 (사용자 직접 응답 경로) 는 **P99 alerting 룰 등록 강제** (budget 의 80% warning, 100% critical)
> Tier 2 (비동기) / Tier 3 (백오피스) 는 throughput / best-effort 기준 (강제 X, 권장)

→ ADR-0025 가 SLI 후보를 명시. SLO 는 별도 ADR (Observability stack) 에서 확정.

### 3.3 msa Tier 별 SLO 초안 (#13 ADR 후보)

| Tier | 경로 | SLO (latency) | SLO (availability) | Error Budget (월) |
|---|---|---|---|---|
| Tier 1 | 상품 조회 (cache hit) | P95 < 50ms, P99 < 100ms | 99.9% | 43분 |
| Tier 1 | 주문 생성 동기 부분 | P95 < 100ms, P99 < 200ms | 99.95% | 22분 |
| Tier 1 | 검색 | P99 < 500ms | 99.5% | 3.6시간 |
| Tier 2 | Kafka consumer (order) | lag < 30s 의 비율 99% | n/a | n/a |
| Tier 3 | Admin 분석 | P99 < 5s | 99% | 7.2시간 |

## 4. Error Budget — 핵심 운영 도구

### 4.1 정의

```
Error Budget = (1 - SLO) × time
            예: (1 - 0.999) × 30d = 0.001 × 720h = 0.72h = 43분/월
```

### 4.2 운영 룰 — Budget 정책

```
Budget 잔여  →  허용된 행동
─────────────────────────────────────────────
> 50%       →  자유로운 배포 / 실험 / 카오스
20-50%      →  주의 (배포는 정상)
< 20%       →  배포 freeze 검토
< 0%        →  배포 freeze + 안정화 sprint 의무
```

→ Error Budget 은 **속도 vs 안정성의 정량 trade-off**. 속도가 떨어지는 게 아니라 **"어떻게 배분할 지 협의"** 가 가능해짐.

### 4.3 Soft / Hard Budget

- Soft: 권고 (코드 freeze 까지는 안 가지만 압박)
- Hard: 자동 freeze (CI 가 차단)

→ 작은 조직은 soft → 신뢰 쌓이면 hard.

## 5. Burn Rate — Multi-Window Multi-Burn-Rate Alert

P99 절대값 alert 의 문제:
- 1초 latency 폭증에 alert → false positive
- 작은 increment 가 누적되어 SLO 를 천천히 소진 → alert 안 옴

→ **Burn Rate** = "지금 속도로 가면 며칠에 SLO 다 소진?"

### 5.1 Burn Rate 공식

```
burn_rate = error_rate / (1 - SLO)
         예: error_rate = 5%, SLO = 99.9% → burn_rate = 5% / 0.1% = 50
            "정상의 50배 속도로 budget 소진"
```

| burn_rate | 의미 |
|---|---|
| 1 | 정상 (한 달 budget 정확히 소진) |
| 14.4 | 1시간 안에 budget 의 2% 소진 |
| 36 | 30분 안에 budget 의 5% 소진 |
| 100 | 분 단위 소진 (사고 수준) |

### 5.2 Multi-Window 의 이유

```
짧은 윈도우 (5m) 만 보면: 
  - 즉각 반응 ✅ 
  - false positive 많음 ❌ (1분 spike 도 alert)

긴 윈도우 (1h) 만 보면:
  - 정확 ✅
  - 늦음 ❌ (page 뜰 때 이미 1시간 burning)

해결: 5m AND 1h 둘 다 burning 일 때만 alert
```

### 5.3 Google SRE Workbook §5 의 정석 설정

```yaml
# 빠른 burn (1시간 안에 budget 의 2% 소진) — 즉시 page
- alert: ErrorBudgetBurnFast
  expr: |
    (
      sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) by (application)
        / sum(rate(http_server_requests_seconds_count[5m])) by (application)
    ) > 14.4 * 0.001
    and
    (
      sum(rate(http_server_requests_seconds_count{status=~"5.."}[1h])) by (application)
        / sum(rate(http_server_requests_seconds_count[1h])) by (application)
    ) > 14.4 * 0.001
  for: 2m
  labels:
    severity: page
  annotations:
    summary: "{{$labels.application}} burning error budget at 14.4x"

# 느린 burn (6시간에 budget 의 5%) — ticket
- alert: ErrorBudgetBurnSlow
  expr: |
    (...30m rate > 6 * 0.001 ...) and (...6h rate > 6 * 0.001 ...)
  for: 15m
  labels:
    severity: ticket
```

### 5.4 표준 4-pair

| Long window | Short window | Burn rate | 시간 안에 소진 | severity |
|---|---|---|---|---|
| 1h | 5m | 14.4 | 2% in 1h | page |
| 6h | 30m | 6 | 5% in 6h | page |
| 24h | 2h | 3 | 10% in 24h | ticket |
| 72h | 6h | 1 | 100% in 30d (정상) | (정보) |

→ 4-pair 모두 등록하면 fast / slow 양쪽 cover.

## 6. SLO Dashboard 설계

### 6.1 필수 panel 5개

```
┌─────────────────────────────────────────────┐
│  Panel 1: Error Budget 잔량 (gauge)         │
│  Panel 2: 30d Burn Rate Trend (line)        │
│  Panel 3: SLI 30d compliance (stat)         │
│  Panel 4: 4-pair Burn Rate (table)          │
│  Panel 5: Recent Incidents (annotation)     │
└─────────────────────────────────────────────┘
```

### 6.2 Error Budget Recording Rules

```yaml
- record: msa:slo:error_budget_remaining_ratio
  expr: |
    1 - (
      (
        1 - sum(rate(http_server_requests_seconds_count{application="product",status=~"2..|3.."}[30d]))
            / sum(rate(http_server_requests_seconds_count{application="product"}[30d]))
      ) / (1 - 0.999)
    )
```

`1.0` = 모든 budget 남음, `0.0` = 모두 소진, 음수 = 초과.

### 6.3 30d 윈도우 vs Rolling

- **30d rolling**: 매 시점 직전 30일 → 자연스러움
- **calendar month**: 1일 reset → 비교 쉬움
- **weekly**: 7d, 변동 ↑

→ rolling 30d 가 운영 표준.

## 7. ADR-0025 와 SLO 의 관계

ADR-0025 가 다루는 것:
- Tier 분류 (1/2/3)
- 자릿수 어휘 (ns/µs/ms)
- P99 alerting 강제
- 측정 표준 (`percentiles-histogram=true`)

ADR-0025 가 다루지 **않는** 것:
- 구체적인 SLO 값
- Error Budget 정책
- Burn Rate alert

→ **#13 ADR 초안**: "Observability SLO + Error Budget" 별도 ADR. ADR-0025 가 input.

## 8. 운영 안티패턴

### 8.1 모든 metric 에 alert
- alert fatigue
- 정말 page 받아야 할 alert 만 (SLO burn rate 기반)

### 8.2 SLO 100%
- "장애 0건" 목표 = 비현실, freeze 영구
- 99.95% 정도가 인간이 운영 가능한 한계

### 8.3 SLO 가 너무 낮음
- 99% = 거의 항상 budget 남음 → freeze 룰 무력화
- 사용자 만족도와 거리

### 8.4 SLI 가 SLA 와 동일
- SLI 가 SLA 보다 엄격해야 함 (예: SLA 99.9, SLO 99.95)
- SLA 위반 직전에 SLO alert → 회복 시간 확보

### 8.5 Error Budget 정책 없음
- "Budget 다 썼는데 다음 sprint 도 신기능?" → 신뢰 무너짐
- 정책을 사전에 합의 (engineering + 제품 + 영업)

### 8.6 Burn Rate 단일 윈도우
- 5m only → false positive
- 1h only → 늦음
- → 항상 multi-window

## 9. ADR / SLO / Runbook — 운영 문서 5종

| 문서 | 내용 | 위치 |
|---|---|---|
| ADR | "왜 이 SLO 인가" | `docs/adr/` |
| SLO Definition | 구체 값 + 측정 식 | `docs/slos/` |
| Runbook | alert 받았을 때 절차 | `docs/runbooks/` |
| Postmortem | 사고 후 분석 | `docs/postmortems/` |
| Error Budget Policy | freeze 룰 | `docs/policies/` |

→ msa 는 ADR-0025 에 latency budget 만 명시 — SLO definition / runbook 미작성.

## 10. msa SLO 초안 (Phase 3 결과 + #13 ADR 후보)

### 10.1 Tier 1 — 상품 조회 (단순)

```yaml
service: product
sli:
  type: latency
  good: rate(http_server_requests_seconds_bucket{...,uri="/api/products/{id}",le="0.1"}[5m])
  total: rate(http_server_requests_seconds_count{...,uri="/api/products/{id}"}[5m])
slo: 99.9    # 한 달 43분 budget
```

### 10.2 Tier 1 — 주문 생성

```yaml
service: order
sli:
  type: availability
  good: rate(http_server_requests_seconds_count{...,uri="/api/orders",method="POST",status=~"2.."}[5m])
  total: rate(http_server_requests_seconds_count{...,uri="/api/orders",method="POST"}[5m])
slo: 99.95   # 한 달 22분 budget
burn_rate_alerts:
  - { long: 1h,  short: 5m,  rate: 14.4, severity: page }
  - { long: 6h,  short: 30m, rate: 6,    severity: page }
  - { long: 24h, short: 2h,  rate: 3,    severity: ticket }
```

### 10.3 Tier 2 — Kafka consumer

```yaml
service: search-consumer
sli:
  type: freshness
  good: lag_seconds < 30
slo: 99    # 1% 시간만 lag > 30s 허용
```

## 11. 측정 — Sloth / Pyrra (SLO 자동화 도구)

수동 PromQL 작성은 노가다. Sloth / Pyrra 가 SLO YAML → Recording Rules + Burn Rate Alert 자동 생성.

### 11.1 Sloth 예시

```yaml
version: prometheus/v1
service: product
slos:
  - name: requests-availability
    objective: 99.9
    sli:
      events:
        error_query: sum(rate(http_server_requests_seconds_count{application="product",status=~"5.."}[{{.window}}]))
        total_query: sum(rate(http_server_requests_seconds_count{application="product"}[{{.window}}]))
    alerting:
      page_alert: { severity: page }
      ticket_alert: { severity: ticket }
```

→ `sloth generate -i input.yml -o rules.yml` 으로 PrometheusRule 자동 생성.

→ msa 의 SLO 도입 시 Sloth 도입 권장.

## 12. 핵심 정리

- **SLI/SLO/SLA/Error Budget — 4개 단어** 면접 정확히 답할 것
- 좋은 SLI = "행복한 사용자 비율" (이진 분류, 표준 메트릭)
- "99 하나 더 쓰면 비용 10x" — SLO 는 99.9 가 baseline
- **Error Budget 정책으로 freeze 룰** — 정량 trade-off
- **Multi-Window Multi-Burn-Rate Alert** (Google SRE) 가 정석 — 4-pair 등록
- ADR-0025 (latency budget) → SLO 의 input. SLO ADR 별도.
- Sloth 같은 도구로 PrometheusRule 자동 생성

## 13. 다음 단계

- [11-ebpf-profiling-pyroscope.md](11-ebpf-profiling-pyroscope.md) — 4번째 pillar (Continuous Profiling)
