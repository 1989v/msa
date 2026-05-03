---
spec: quant-unified-platform
date: 2026-05-04
status: draft
parent: initialization.md
---

# Requirements — Quant 통합 플랫폼

## 0. Glossary

| 용어 | 의미 |
|---|---|
| **자산(Asset)** | 시계열 가격이 정의되는 거래 대상 — 주식, 암호화폐 모두 포함 |
| **시장(Market)** | 거래소 (KRX, NYSE, Bithumb, Upbit, Binance, ...) |
| **분할 진입 (Tranche)** | 자본을 N 회차로 나눠 회차별 독립 매수가/익절 |
| **시장 비효율 시그널** | 동일 자산이 다른 시장에서 다른 가격에 거래될 때 발생하는 지표 (예: 김치프리미엄) |
| **차트 패턴 유사도** | 60일 가격 윈도우의 임베딩 벡터 cosine 유사도 |
| **융합 strategy** | 분할 진입 + 시그널을 합성한 hybrid strategy |

---

## 1. 비즈니스 목표

- **G1**: 두 분절 서비스(자동매매 + 차트 분석) 를 단일 진입점으로 통합해 사용자 경험 일관화
- **G2**: 시장 비효율 시그널을 1급 도메인으로 도입해 분할 진입 전략과 함께 선택 가능
- **G3**: 입문자가 지표·시그널을 차트 위에서 즉시 학습할 수 있는 교육 메뉴 제공
- **G4**: 자산 클래스(주식/암호화폐) 무관 단일 추상 모델로 미래 자산 추가 비용 ↓

---

## 2. 사용자 페르소나

| 페르소나 | 행동 | 주요 메뉴 |
|---|---|---|
| **트레이더** | 자동매매 strategy 등록·운용·백테스트 | 자동매매 전략 |
| **분석가** | 차트 패턴 검색·지표 비교·시장 비효율 모니터 | 차트 분석 |
| **입문자** | 지표 학습·예제 시각화 | 입문자 지표 학습 |

---

## 3. 핵심 기능

### F1. 자동매매 전략 메뉴
- F1-1. 분할 진입(Tranche) strategy 등록 — 기존 기능
- F1-2. **시장 비효율 시그널 strategy 등록 (신규)**
  - 자산 + 비교 시장 쌍 선택 (예: BTC, Bithumb vs Binance)
  - 진입 임계 (예: 프리미엄 ≥ 5%), 청산 임계, 환율 보정 옵션
  - 백테스트 / paper trading / 실매매 토글
- F1-3. **융합 strategy 등록 (신규)** — 분할 + 시그널 합성
- F1-4. strategy 비교/leaderboard — 통합 dashboard

### F2. 차트 분석 메뉴
- F2-1. 자산 검색 + OHLCV 차트 (주식/암호화폐 무관)
- F2-2. 차트 패턴 유사도 검색 — 기존 charting 기능 그대로
- F2-3. 미래 수익률 예측 (+5d/+20d/+60d)
- F2-4. **기술적 지표 토글** (RSI, MACD, MA, BB, Ichimoku, Volume)
- F2-5. **시장 비효율 지표 패널 (신규)**
  - 김치프리미엄 실시간/이력 차트
  - 거래소 간 갭 분포
  - 환율 보정 비교

### F3. 입문자 지표 학습 메뉴 (신규)
- F3-1. 지표 카탈로그 — 정의, 공식, 해석
- F3-2. 인터랙티브 차트 — 실제 자산 위에 지표 토글로 학습
- F3-3. 시그널 카탈로그 — 시장 비효율 지표의 의미와 활용 사례
- F3-4. (선택) 학습 진도 / 완료 표시

### F4. 거래소 어댑터 확장
- F4-1. 해외 거래소 신규 어댑터 — Binance, Bybit (REST + WebSocket)
- F4-2. 환율 데이터 소스 — 한국은행 또는 Open Exchange Rates 추상화
- F4-3. 어댑터 인터페이스 통일 — `MarketAdapter` port (기존 `ExchangeAdapter` 일반화)

---

## 4. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 시그널 갱신 주기 | 시장 비효율 지표 ≤ 5초 (WebSocket 또는 폴링) |
| 백테스트 throughput | 1년 데이터 / 자산 1종 ≤ 30초 (Phase 1 P95) |
| 데이터 보관 | OHLCV: ClickHouse, 임베딩 벡터: pgvector(또는 ClickHouse 통합 결정) |
| 멀티테넌트 | tenantId 격리 (INV-05) — 모든 strategy/run/notification |
| 외부 노출 차단 | 본 spec 의 도메인 용어/시그널은 표준 금융 용어만 사용 — 외부 도구 출처 인용 금지 |

---

## 5. 의존 / 영향

| 영역 | 영향 |
|---|---|
| ADR-0024 (quant service) | 도메인 확장 — Errata 추가 |
| ADR-001~004 (charting) | full merge 시 ADR-003(Python/FastAPI) 결정 재검토 필요 |
| ADR-0025 (market data hub) | 거래소 어댑터 일반화 영향 |
| 기술 스택 | open-questions Q1 으로 분리 |
| K8s 매니페스트 | charting deployment 흡수 또는 일반화 |

---

## 6. Phase 분할 (제안)

| Phase | 범위 |
|---|---|
| Phase 1 | 시장 비효율 시그널 strategy + 거래소 어댑터 확장 + 김치프리미엄 차트 패널 + 지표 학습 메뉴 정적 콘텐츠 |
| Phase 2 | charting 코드 흡수 (full merge) — 패턴 유사도 API 를 통합 플랫폼으로 |
| Phase 3 | 융합 strategy + 실시간 알림 + 학습 진도 |

---

## 7. 성공 지표

- 단일 도메인 모델로 주식/암호화폐 1종씩 strategy 등록·백테스트 성공
- 김치프리미엄 차트 panel 이 1초 갱신 + 임계 알림 발화
- 입문자 학습 메뉴에서 지표 ≥ 6 종 토글 가능
- 통합 후 외부 노출 산출물에 외부 도구 출처 0회 (자동 grep 검사)
