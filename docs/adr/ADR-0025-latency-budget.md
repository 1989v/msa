# ADR-0025 Latency Budget 을 설계 입력으로 강제

## Status

Proposed

**Date**: 2026-04-26
**Updated**: 2026-04-26 — ADR-0026 에 따라 분해됨 (실천 / 운영 부분은 conventions 로 이동)
**Authors**: kgd
**Related**: ADR-0015 (Resilience Strategy), ADR-0019 (K8s Migration), ADR-0026 (docs taxonomy)

## Context

msa 플랫폼은 다양한 backend (MySQL / Redis / Elasticsearch / Kafka / ClickHouse / 외부 API) 와 호출 경로 (같은 K8s 노드 / 다른 노드 / 다른 AZ / 다른 리전) 를 갖는다. 그러나:

1. 설계 토론에서 **latency 자릿수 합의가 없다** — "이 호출은 빠르다 / 느리다" 가 직관에 의존
2. 신규 호출 경로 추가 시 **fan-out tail 곱셈 / 외부 API P99 영향이 사전 검토 누락**
3. SLA 가 평균 기준 → P99 / P999 분포가 무시되어 사용자 경험과 메트릭이 괴리
4. 멀티 리전 / 외부 의존 / 캐시 정책 의사결정의 **정량 근거 부재**

본 ADR 은 **결정 / 정책 부분** 만 정의한다. 자릿수 어휘 / 측정 표준 / Tier 별 budget 같은 **실천 / 운영 부분** 은 `docs/conventions/latency-budget.md` 로 분리한다 (ADR-0026 분해 원칙).

## Decision

### 1. Latency 가 설계 의사결정의 1급 입력이다

신규 / 변경 호출 경로는 latency 영향을 **사전 검토 + PR 에 명시** 해야 한다. 더 이상 "빠르다 / 느리다" 의 직관 토론은 허용하지 않는다.

### 2. 자릿수 기반 어휘를 도입한다

ns / µs / ms 의 3 그룹으로 모든 호출 / 컴포넌트 latency 를 분류한다. 구체 어휘 정의 + 호출 경로 라벨 표 → `docs/conventions/latency-budget.md`.

### 3. Tier 1 (사용자 직접 응답 경로) 는 P99 SLA 강제

- Tier 1 경로는 **P99 alerting 룰 등록 강제** (budget 의 80% warning, 100% critical)
- Tier 2 (비동기) / Tier 3 (백오피스) 는 throughput / best-effort 기준 (강제 X, 권장)
- 구체 Tier 별 budget 숫자 → `docs/conventions/latency-budget.md` (living 부록)

### 4. 측정 표준 채택

모든 JVM 서비스는:
- Spring Boot Actuator + Micrometer 로 `http_server_requests_seconds_*` 메트릭 노출
- `percentiles-histogram: true` + bucket SLO 설정
- Prometheus + Grafana 의 RED + Heatmap 패널 필수

구체 설정 / PromQL 예시 → `docs/conventions/latency-budget.md`.

### 5. 신규 호출 경로 PR 체크리스트 강제

PR 템플릿에 "Latency Budget Impact" 섹션을 포함하여 다음을 명시:
- 속한 Tier
- 예상 자릿수 (ns / µs / ms / 100ms+)
- fan-out / 외부 호출 / 캐시 적용 여부
- 측정 방법

체크리스트 본문 → `docs/conventions/latency-budget.md`.

## Alternatives Considered

### Alternative 1: 절대값 SLO 강제 (모든 API P99 100ms)

- **거부 이유**: 환경마다 (k3d / managed K8s / 멀티 리전) 자릿수 베이스라인이 다름. 일률 강제는 비현실적.

### Alternative 2: 권장만 하고 강제하지 않음

- **거부 이유**: 강제력 없으면 설계 토론은 다시 직관 의존으로 회귀. 최소 Tier 1 의 P99 alerting 은 강제 필요.

### Alternative 3: 자릿수 그룹 더 세밀화 (5-7 그룹)

- **거부 이유**: 인지 부하 ↑. 3 그룹 (ns / µs / ms) 가 직관 + 의사결정에 충분.

### Alternative 4: 본 결정을 conventions/ 만으로 처리 (ADR 없이)

- **거부 이유**: "latency 를 설계 입력으로 강제" 는 cross-cutting 정책 결정 (ADR-0026 §2 의 ripple effect 기준 해당). PR 리뷰 / 설계 회의 / alerting 룰에 강제 적용되므로 ADR 의 거버넌스 (Status: Accepted) 가 필요. 단, 실천 / 운영 부분은 ADR-0026 분해 원칙에 따라 conventions/ 로 분리.

## Consequences

### Positive

- 설계 토론의 정량 베이스라인 — "이 호출은 어느 자릿수" 가 결정으로 합의됨
- 신규 호출 경로 검토 강제 — fan-out / 외부 의존 / tail 영향이 사전 검토됨
- Tier 1 P99 alerting 으로 SLA 와 메트릭 일치
- 멀티 리전 / 외부 의존 의사결정의 정량 근거 (광속 한계 / fan-out 곱셈)

### Negative

- PR / 설계 리뷰의 부담 증가 (체크리스트 작성)
- 모니터링 인프라 의존 (Prometheus + Grafana 미배포 환경에선 부분 적용)
- 초기 Tier 별 budget 값이 학습 단계 추정 — production 측정으로 갱신 필요

### Mitigation

- 체크리스트는 PR 템플릿에 흡수하여 자연스럽게 강제
- Prometheus + Grafana 본격 배포는 별도 ADR (Observability stack) — 본 ADR 은 "측정 표준 채택" 까지만
- conventions/latency-budget.md 의 Tier 부록은 living 문서로 분기마다 production 데이터로 갱신

## References

- 실천 / 운영 가이드: `docs/conventions/latency-budget.md`
- 학습 노트 (배경): `study/docs/12-latency-numbers/`
- Jeff Dean, "Numbers Everyone Should Know" (LADIS 2009)
- Jeff Dean & Luiz André Barroso, "The Tail at Scale" (CACM 2013)
- ADR-0015: Resilience Strategy (CircuitBreaker / DLQ / Rate Limiting 과 결합)
- ADR-0019: K8s Migration (배포 모드별 자릿수 베이스라인)
- ADR-0026: docs taxonomy (본 ADR 의 분해 근거)

## Open Questions

- [ ] PR 템플릿에 "Latency Budget Impact" 섹션 추가는 별도 작업
- [ ] Observability stack (Prometheus + Grafana 본격 배포) 은 별도 ADR
- [ ] 멀티 리전 도입 시 Tier 별 budget 의 변경 (cross-region call 비용) 추가 정의
