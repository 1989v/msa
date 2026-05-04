---
spec: quant-phase2-cross-exchange
date: 2026-05-05
status: draft
parent: ../../2026-05-04-quant-unified-platform/planning/spec.md
---

# Phase 2 — Cross-Exchange Signal & charting 흡수

ADR-0033 Phase 2 진입. Phase 1 통합 플랫폼 완료 후 다음 영역:

1. **해외 거래소 어댑터 신규** — Binance(public + spot ticker)
2. **김치프리미엄 시그널 strategy** — 국내(빗썸/업비트) ↔ 해외(Binance) 가격 차이 기반
3. **charting 서비스 실제 폐기** — 패턴 유사도 / 미래 수익률 예측 로직 quant 흡수 + 매니페스트 제거
4. **융합(Hybrid) strategy 백테스트 와이어업** — Phase 1 도메인 모델만 있던 HybridStrategy 의 평가 로직

## 비고려 / Phase 3+

- 실매매 (real trading) — Phase 3
- kill-switch / 2FA — Phase 3
- 다른 해외 거래소 (Bybit / OKX) — Phase 3+
- 어드민 미디어 업로드 — Phase 3

## 외부 노출 차단

본 spec 의 도메인 용어는 표준 금융 용어 (kimchi premium / arbitrage / cross-exchange spread) 만
사용. 외부 도구 출처 인용 0회.
