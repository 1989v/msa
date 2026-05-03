# ADR-0033: Quant 통합 플랫폼 도입 (charting 흡수)

- **Status**: Accepted
- **Date**: 2026-05-04
- **Deciders**: kgd
- **Supersedes**: 부분적으로 charting/docs/adr/ADR-001 (charting 별도 서비스 도입)
- **Related**: ADR-0019 (k8s migration), ADR-0024 (quant service), ADR-0034, ADR-0035

## Context

현재 코드베이스에는 **두 개의 차트 기반 서비스**가 분리되어 있다.

| 서비스 | 포트 | 자산 | 스택 | 핵심 |
|---|---|---|---|---|
| `quant` | 8094 | 암호화폐 (빗썸/업비트) | Kotlin/Spring | 분할 진입(Tranche) 자동매매 |
| `charting` | 8010 | 주식 (US/KR) | Python/FastAPI + pgvector | 차트 패턴 유사도 분석 |

두 서비스는 다음 공통점이 있다:
- 차트(시계열)을 1급 데이터 모델로 사용
- 자산 클래스에 무관하게 일반화 가능한 도메인(거래소 어댑터, 패턴 임베딩)
- 사용자는 두 도구를 함께 쓰는 흐름이 자연스러움 (차트로 분석 → 전략 등록)

분리 운영의 비용:
1. **사용자 경험 분절** — 도메인/라우팅/인증/UI 톤이 따로 진화
2. **데이터/지표 재사용 어려움** — strategy 평가에서 차트 분석 결과 재사용하려면 추가 통신 계층 필요
3. **운영 비용 ↑** — 두 서비스의 deployment/매니페스트/ingest/모니터링 별도

내부 사용자 요구로 다음 신규 기능이 식별됨:
- 시장 비효율(거래소 간 가격 차이) 기반 시그널 strategy
- 자동매매·차트 분석·입문자 지표 학습 메뉴를 단일 진입점으로 묶기

## Decision

**옵션 C (full merge)** 를 채택. quant 서비스가 charting 의 모든 기능을 흡수해 단일 통합
플랫폼이 된다. 메뉴를 3개로 분리:

1. **/quant/strategies** — 자동매매 전략 (분할 진입 + 시그널 + Phase 3 융합)
2. **/quant/charts** — 차트 분석 (OHLCV + 기술적 지표 + 패턴 유사도 + Phase 2 김치프리미엄)
3. **/quant/learn** — 입문자 지표 학습 (CMS 기반)

자산 클래스(주식·암호화폐)는 단일 추상 모델 (`Asset`, `Market`) 로 다룬다.

### 도메인 모델 변경

- 신규 sealed `Strategy` (도메인) — 기존 `TrancheStrategy` 가 자식이 되고 `SignalStrategy`,
  `HybridStrategy` 가 추가됨
- 거래소 어댑터 인터페이스를 일반화 (`MarketAdapter`) — 자산 클래스 무관

### 비고려 옵션

- **옵션 A (별개 유지 + quant 모듈 추가)** — 사용자 경험 분절 유지. 거부.
- **옵션 B (charting 일반화)** — Python 메인 유지. quant 의 Kotlin/Spring 자산이 더 큰 점, MSA
  나머지 모듈(common, gateway, order, ...) 과 스택 일관성을 위해 거부.

## Consequences

### Positive

- 사용자 경험 일관 (단일 SPA / 단일 도메인 인증)
- 데이터 재사용 (strategy 와 chart 분석이 동일 ClickHouse / pgvector 직접 read)
- 운영 단순화 (서비스 1개 폐기 → manifest/ingress/CI 일괄 정리)
- 미래 자산 추가 비용 ↓ (Asset/Market 추상화로 일반화)

### Negative

- **마이그레이션 비용** — charting Python 코드 → Kotlin 포팅 (ADR-0034 참조)
- **단기 위험** — Phase 1 동안 charting 서비스 병행 운영 → 데이터 불일치 가능성
- **도메인 응집도 시험** — sealed `Strategy` 가 분할/시그널/융합을 모두 포괄 → 복잡도 ↑

### Mitigations

- Phase 1 종료 시 charting 서비스/매니페스트/ingress 일괄 폐기 (PR 단위)
- Strategy sealed 의 자식별 책임을 별도 UseCase 클래스로 분리 (단일 거대 클래스 금지)
- pgvector schema rename (`pattern` → `quant_pattern`) 시 Flyway 마이그레이션 + 데이터 복사

## Phase Roadmap

| Phase | 범위 |
|---|---|
| Phase 1 | sealed `Strategy` 신규 + 빗썸 single-source 시그널 + 차트 분석 메뉴 + 학습 CMS + Python ingest sidecar |
| Phase 2 | charting 서비스 폐기 + 해외 거래소(Binance) + 김치프리미엄 + 시계열 저장소 통합 검토 |
| Phase 3 | 융합 strategy + 실매매 + 어드민 미디어 |

## Alternatives

본 ADR 의 옵션 평가는 [spec](../specs/2026-05-04-quant-unified-platform/planning/initialization.md)
의 §3 (3가지 옵션 비교) 참조.

## References

- [Spec](../specs/2026-05-04-quant-unified-platform/planning/spec.md)
- [Requirements](../specs/2026-05-04-quant-unified-platform/planning/requirements.md)
- ADR-0024 (quant service)
- charting/docs/adr/ADR-001 (charting introduction — Errata 추가)
