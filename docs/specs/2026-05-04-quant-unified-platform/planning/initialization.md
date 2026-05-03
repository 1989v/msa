---
spec: quant-unified-platform
date: 2026-05-04
status: draft
---

# Quant 통합 플랫폼 — 초기 PRD

> 본 spec 은 quant 와 charting 두 서비스를 단일 통합 플랫폼으로 재구성하고
> 시장 비효율(거래소 간 가격 차이) 기반 투자 전략 + 차트 분석 + 입문자 지표 학습
> 메뉴를 추가하는 작업의 초기 PRD 다. 이후 requirements / spec / ADR / tasks 로
> 분해된다.

---

## 1. 배경

### 1.1 현재 상태
- **quant** (Kotlin/Spring Boot, port 8094)
  - 분할 진입(tranche) 전략 자동매매 (암호화폐 — 빗썸/업비트)
  - 백테스트 엔진 + ClickHouse 시계열 + Kafka outbox + paper trading
  - 거래소 어댑터 패턴 보유
- **charting** (Python/FastAPI, port 8010)
  - 차트 패턴 유사도 분석 (60일 윈도우 → 32차원 임베딩 → pgvector HNSW cosine)
  - 미래 수익률 예측 (+5d/+20d/+60d)
  - 데이터 소스: yfinance / FinanceDataReader

### 1.2 현재 자산 범위
- **quant** — Phase 1/2 모두 **암호화폐 전용** (빗썸/업비트). 도메인 모델(거래소 어댑터,
  분할 진입 strategy)은 자산 클래스에 무관하게 일반화 가능한 형태이지만 현 구현은 암호화폐로 한정.
- **charting** — **주식 전용** (yfinance/FinanceDataReader). 패턴 임베딩/유사도 로직은
  자산 무관하나 데이터 소스가 주식.
- 두 서비스 모두 **차트 기반**이라는 공통점이 있고 통합 후 자산 클래스 일반화 가능.
  통합 플랫폼은 주식·암호화폐를 단일 추상 모델로 다룬다.

---

## 2. 결정 (사용자 확인)

| 항목 | 결정 |
|---|---|
| 통합 방향 | **옵션 C — full merge** (quant 가 charting 기능을 흡수) |
| 자산 클래스 | 주식 + 암호화폐 모두 단일 플랫폼에서 처리 |
| 메뉴 분리 | (1) 자동매매 전략 (2) 차트 분석 (3) 입문자 지표 학습 |

---

## 3. 통합 후 메뉴 구조

### 3.1 자동매매 전략 (Quant Strategy)
- **분할 진입 strategy** (현재 quant 의 tranche)
- **시장 비효율 시그널 strategy** (신규)
  - 거래소 간 가격 차이(김치프리미엄 등) 기반 진입/청산
  - 환율 보정, 변동성 임계, 차익거래 윈도우
- **분할 + 시그널 융합 strategy** — 두 전략을 합성한 하이브리드
- 사용자가 위 3종 중 선택해 strategy 등록

### 3.2 차트 분석 (Chart Analysis)
- 패턴 유사도 분석 (현 charting 기능 그대로)
- **시장 비효율 지표 패널** — 김치프리미엄·거래소 갭·환율 비교를 차트와 동일 화면에서 시각화
- 자산 무관 (주식/암호화폐 동일 UI)

### 3.3 입문자 지표 학습 (Indicator Glossary)
- 기술적 지표 설명 (RSI, MACD, MA, Bollinger Band, Ichimoku 등) — 카드형 학습 콘텐츠
- 시장 비효율 지표 설명 (김치프리미엄, 거래소 갭의 의미·계산법)
- 각 지표를 실제 시세 차트 위에 토글로 비교 학습

---

## 4. 핵심 결정 사항 (open questions 후보)

1. **기술 스택 통합 방향** — Python/FastAPI 흡수 vs Kotlin/Spring 흡수 vs 폴리글랏 유지
   (ADR-003 기존 결정 검토 필요, 새 ADR 로 갱신)
2. **데이터 모델** — pgvector(charting) ↔ ClickHouse(quant) 통합 또는 양쪽 유지
3. **거래소 어댑터 확장** — 해외 거래소(Binance/Bybit) 추가, 환율 데이터 소스 (한국은행/Open Exchange Rates 등)
4. **시그널 strategy 도메인 모델** — 분할 진입 strategy 와 동일 sealed 계층에 추가할지 별도 sealed 로 분리할지
5. **차트 분석 ↔ 자동매매 데이터 공유** — patterns/indicators API 를 자동매매 strategy 가 호출 가능?
6. **입문자 학습 콘텐츠** — 정적 문서 vs DB 기반 CMS 형태

---

## 5. Out of scope (Phase 1)

- 실매매(real trading) — Phase 3+ (ADR-0024 Phase 3)
- 글로벌 kill-switch / 2FA — Phase 3
- 주식 실주문 — Phase 3+ (Phase 1 은 시각화·백테스트만)
- 입문자 학습 콘텐츠의 AI 생성 — 정적 콘텐츠로 시작

---

## 6. 비공개 원칙

본 플랫폼의 일부 도메인 모델(시장 비효율 지표 메뉴)은 외부 도구를 참고하지 않고 도메인
표준 시장 용어(김치프리미엄, 거래소 갭, 차익거래)를 그대로 따른다. 모든 산출물(코드/
문서/커밋 메시지)은 외부 사이트 출처를 인용하지 않는다.
