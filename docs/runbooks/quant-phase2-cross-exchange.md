# Runbook — Quant Phase 2 (Cross-Exchange + charting 흡수)

ADR-0036 운영 안내.

## 1. 신규 endpoint

| 메서드 | path | 설명 |
|---|---|---|
| GET | `/api/v1/charts/prediction?asset=BTC&market=BITHUMB&k=50` | 패턴 유사도 top-K 의 평균 future return |
| GET | `/api/v1/charts/kimchi-premium?asset=BTC&krMarket=BITHUMB&foreignMarket=BINANCE` | 김치프리미엄 실시간 |

## 2. 활성화 토글

| Property | Default | 효과 |
|---|---|---|
| `quant.binance.enabled` | false | BinanceMarketAdapter 활성 (김치프리미엄에 필수) |
| `quant.pgvector.enabled` | false | quant_postgres 어댑터 활성 (Prediction/Similarity 검색 정상화) |
| `quant.fx.provider` | `bithumb-proxy` | 환율 proxy (USDT/KRW). 다른 옵션은 추후 |

k3s-lite overlay 의 quant SPRING_APPLICATION_JSON 에 위 키 주입.

## 3. charting 폐기 진행 상태

| 단계 | 상태 |
|---|---|
| 트래픽 검증 (1주) | ✅ Phase 1 후반 완료 |
| Soft scale 0 | ✅ k3s-lite overlay patches 활성 (ADR-0036 P2-T20) |
| Hard remove | ⏳ 후속 PR (k8s/base/charting/* 삭제 + ingress /charting 정리) |
| 데이터 마이그 | ⏳ pattern → quant_pattern INSERT SELECT, charting 의 PostgreSQL 데이터 보존 |
| ADR-001 Status | ✅ Superseded |

## 4. 알려진 한계 (Phase 2)

- KimchiPremiumThreshold 시그널 strategy 의 백테스트 wire-up 은 후속 (P2 follow-up):
  현재 RunSignalBacktestUseCase 가 KimchiPremium 평가 미지원.
- HybridStrategy 백테스트 (RunHybridBacktestUseCase) 는 단순화:
  슬리피지/수수료 미반영, 단일 진입 회차 시작점만 시뮬.
- Binance 어댑터 인증 0 — Phase 3 실매매 시 API key + HMAC 추가.
- Prediction/Similarity API 는 quant_postgres 어댑터 활성 (`quant.pgvector.enabled=true`) 시에만 결과 반환.

## 5. Phase 3 trigger

다음 발생 시 Phase 3 ADR:
- 실매매 요구 (Binance/빗썸 실 주문)
- kill-switch / 2FA / 다중 거래소 (Bybit/OKX)
- 어드민 미디어 업로드
