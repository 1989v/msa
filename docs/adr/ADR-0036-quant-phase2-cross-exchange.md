# ADR-0036: Quant Phase 2 — Cross-Exchange Signal & charting 폐기

- **Status**: Proposed
- **Date**: 2026-05-05
- **Deciders**: kgd
- **Related**: ADR-0033, ADR-0034, ADR-0035, charting/docs/adr/ADR-001 (Errata → Superseded 후속)

## Context

ADR-0033 Phase 1 후반 완료 시점에서 다음 영역이 미해결:

1. **해외 거래소 미통합** — 빗썸 단일 (Phase 1 결정 Q5=C)
2. **김치프리미엄 시그널 부재** — 도메인은 spec 에 정의됐으나 구현 deferred
3. **charting 서비스 병행 운영** — Phase 1 종료 후 폐기 결정 미실행
4. **HybridStrategy 도메인만 있고 백테스트 평가 로직 부재**

본 ADR 은 위 4 영역을 Phase 2 로 묶어 진행한다.

## Decision

### Cross-exchange 어댑터

- `BinanceMarketAdapter` 신규 — public REST (인증 0) + Resilience4j RateLimiter (1200 weight/min)
- `MarketAdapter` 인터페이스에 `candles()` 메서드 추가 (Phase 1 의 latestPrice 만으로는 부족)
- 자산 매핑은 거래소별 mapper (BTC ↔ BTCUSDT)

### KimchiPremium 시그널

- `SignalConfig` sealed 에 `KimchiPremiumThreshold` 자식 추가
- `KimchiPremiumCalculator` (Bithumb · Binance · FX 합성)
- ClickHouse `quant.kimchi_premium_tick` 스키마

### charting 폐기

- 4 단계 Runbook (`docs/runbooks/charting-deprecation.md`):
  1. 트래픽 검증
  2. Soft scale 0
  3. Hard remove (manifest/image/ingress)
  4. 데이터 마이그레이션 (`pattern` → `quant_pattern` INSERT SELECT)
- ADR-001 (charting) Status → Superseded

### HybridStrategy 백테스트

- `RunHybridBacktestUseCase` — signal gate trigger 시 tranche entry 시작
- 단위 테스트: 무발화/항상발화 boundary

## Consequences

### Positive

- 단일 거래소 한계 해소 (cross-exchange 차익거래 시그널)
- charting 서비스 폐기 → 운영 표면 ↓
- HybridStrategy 가 실 사용 가능 (Phase 1 에서는 도메인 모델만)

### Negative

- Binance API 정책 변경 위험 (rate limit / endpoint deprecation)
- charting 폐기 시 임베딩 데이터 마이그 비용
- HybridStrategy 의 백테스트 시퀀스가 정통 BacktestEngine 로 흡수되어야 — 규모 ↑

### Mitigations

- Binance: public 만 사용 + R4j RateLimiter 보수적 설정
- charting 폐기: Soft scale 0 후 1주 monitor → Hard remove
- HybridStrategy: 단위 테스트 boundary 명확화 (gate 무발화 / 항상발화 두 케이스)

## Phase 3 trigger

다음 중 하나라도 발생 시 Phase 3 ADR 작성:

- Binance 실주문 요구 (실매매)
- kill-switch / 2FA / 다중 거래소 (Bybit/OKX)
- 어드민 미디어 업로드

## References

- spec: `docs/specs/2026-05-05-quant-phase2-cross-exchange/planning/spec.md`
- tasks: `docs/specs/2026-05-05-quant-phase2-cross-exchange/planning/tasks.md`
- ADR-0033 / 0034 / 0035 (Phase 1)
- charting/docs/adr/ADR-001 (Phase 2 종료 시 Superseded)
