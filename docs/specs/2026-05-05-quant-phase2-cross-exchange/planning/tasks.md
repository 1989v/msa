---
spec: quant-phase2-cross-exchange
date: 2026-05-05
parent: spec.md
phase: Phase 2
---

# Tasks — Phase 2

## 그룹

| 그룹 | Task | 추정 |
|---|---|---|
| Binance 어댑터 | P2-T01~T05 | 1주 |
| KimchiPremium 시그널 | P2-T06~T10 | 1.5주 |
| charting 흡수 (코드) | P2-T11~T15 | 2주 |
| HybridStrategy 백테스트 | P2-T16~T19 | 1주 |
| Migration / 폐기 | P2-T20~T23 | 1주 |
| Validation / Runbook | P2-T24~T26 | 0.5주 |
| **총계** | **26 task** | **~7주** (1인) / ~3.5주 (2인 병렬) |

---

## Binance 어댑터

- **P2-T01** `BinanceMarketAdapter` 신규 (`MarketAdapter` 구현, public REST)
- **P2-T02** `BinanceSymbolMapper` (BTC ↔ BTCUSDT 변환)
- **P2-T03** Resilience4j RateLimiter (1200 weight/min)
- **P2-T04** Binance candles API (`/api/v3/klines`) 구현
- **P2-T05** integration test (Testcontainers + WireMock)

## KimchiPremium 시그널

- **P2-T06** `KimchiPremium` 도메인 + `KimchiPremiumThreshold` SignalConfig 자식
- **P2-T07** `KimchiPremiumCalculator` (Bithumb·Binance·FX 합성)
- **P2-T08** ClickHouse `quant.kimchi_premium_tick` 스키마 + 적재 스케줄러
- **P2-T09** `RunSignalBacktestUseCase` 가 KimchiPremiumThreshold 평가 가능하도록 확장
- **P2-T10** REST `/api/v1/charts/kimchi-premium` (실시간/이력)

## charting 흡수

- **P2-T11** `PredictionQuery` 신규 (pgvector top-K → 평균 future return)
- **P2-T12** REST `/api/v1/charts/prediction`
- **P2-T13** charting 의 임베딩 적재 배치 → Python ingest sidecar 로 통합
  (yfinance 데이터 수집 후 `quant_pattern` 적재)
- **P2-T14** 기존 charting `pattern` 테이블 → `quant_pattern` INSERT SELECT
- **P2-T15** FE `/quant/charts` 메뉴에 패턴 검색 + 예측 패널 wire-up

## HybridStrategy 백테스트

- **P2-T16** `RunHybridBacktestUseCase` 평가 시퀀스 (signal gate → tranche entry)
- **P2-T17** `signal_gate_eval_log` 시계열 (디버깅용)
- **P2-T18** REST `/api/v1/strategies/{id}/backtests` Hybrid 분기
- **P2-T19** 단위 테스트 (gate 무발화 / 항상 발화 두 케이스 동등성 검증)

## Migration / 폐기

- **P2-T20** Soft scale 0 — `patches/charting-replicas-zero.yaml` 활성 (Runbook 2단계)
- **P2-T21** Hard remove — k8s/base/charting + charting-fe 디렉토리 삭제, frontend-ingress 의 /charting 경로 제거
- **P2-T22** charting 서브모듈 archive 브랜치로 이전, main 에서 분리
- **P2-T23** ADR-001 (charting) Status → Superseded

## Validation / Runbook

- **P2-T24** 외부 노출 키워드 검사 (CI grep)
- **P2-T25** e2e smoke — Binance ticker / KimchiPremium / Prediction 모두 동작
- **P2-T26** Runbook 업데이트 — `quant-phase2-cross-exchange.md`
