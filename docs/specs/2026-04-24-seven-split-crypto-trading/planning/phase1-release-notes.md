# Seven-Split Phase 1 Release Notes

**릴리즈 일자**: 2026-04-26
**스펙**: [seven-split-crypto-trading](.)
**ADR**: [ADR-0024](../../../adr/ADR-0024-seven-split-service.md) (Proposed)

---

## 요약

박성현 『세븐 스플릿』 7원칙을 빗썸/업비트 암호화폐 거래소에 적용하는 규칙 기반 자동매매 서비스의 **Phase 1 (백테스트 엔진)** 릴리즈. 실거래/페이퍼 트레이딩은 Phase 2/3 범위.

---

## 구현 범위 (Functional Requirements)

### 도메인 / 전략 엔진 (FR-ENG)
- ✅ **FR-ENG-01** — `SplitStrategyConfig` (roundCount/entryGapPercent/takeProfitPercentPerRound/initialOrderAmount) 검증, INV-07 강제
- ✅ **FR-ENG-02** — 전략 활성화 시 1회차 시장가 진입 (백테스트 첫 Bar)
- ✅ **FR-ENG-03** — 매수 트리거: `currentPrice ≤ lastFilledEntryPrice × (1 + entryGapPercent/100)`
- ✅ **FR-ENG-04 / INV-02** — 회차별 독립 익절 (각 슬롯의 `entryPrice` 만 참조)
- ✅ **FR-ENG-05** — 매도 후 슬롯 EMPTY 복귀 → 재매수 가능
- ✅ **FR-ENG-06** — 전 회차 소진 시 `AWAITING_EXHAUSTED` 상태 전이 (신규 매수 발행 중단)
- ✅ **FR-ENG-07** — 도메인 이벤트 outbox 패턴 (MySQL append-only)
- ✅ **FR-ENG-08** — CRUD 테이블 + 도메인 이벤트 outbox 하이브리드

### 시세 데이터 (FR-MKT)
- ✅ **FR-MKT-01** — `HistoricalMarketDataSource` Port + `CsvHistoricalMarketDataSource` 구현 (CSV → Flow<Bar>)
- ⏸ **FR-MKT-02/03** — WebSocket / REST 폴백은 Phase 2

### 거래소 (FR-EX)
- ✅ **FR-EX-01** — `ExchangeAdapter` Port + `BacktestExchangeAdapter` 구현 (가상 잔고 + 즉시 체결)
- ✅ **FR-EX-02** — `OrderId` UUIDv7 멱등 키 (INV-06)
- ⏸ **FR-EX-03/04** — Rate Limiter / 부분체결 복구는 Phase 2 (`filledQty / targetQty` 필드 방식 OQ-020 결정)

### Phase 모드 (FR-PH)
- ✅ **FR-PH-01** — Phase 1 백테스트 모드 (`ExecutionMode.BACKTEST`)
- ✅ **FR-PH-04** — 단일 엔진 코드 + Port 어댑터 교체로 모드 전환 (`StrategyExecutor`)

### 대시보드 / 리더보드 (FR-DASH)
- ✅ **FR-DASH-01~03** — REST API 엔드포인트 + FE 페이지
- ✅ **FR-DASH-04** — 체결 타임라인 (FE `ExecutionTimeline` 컴포넌트)
- ✅ **FR-DASH-05** — 회차별 손익 분포 (`PnLBreakdown`)
- ✅ **FR-DASH-06** — 가격 차트 + 매수/매도 마커 (`BacktestRunChart`, lightweight-charts)

### 알림 (FR-NOTIF)
- ✅ Port 정의 (`NotificationSender`)
- ⏸ Telegram 어댑터 구현은 Phase 2

### 리스크 (FR-RISK)
- ✅ **FR-RISK-02** — `POST /liquidate` 엔드포인트 (Phase 1은 stub `NotImplementedInPhase1Exception` 501)
- ⏸ **FR-RISK-01** — 손실 한도 장치는 Phase 3 (OQ-012)

### 보안 (FR-SEC)
- ✅ **FR-SEC-01** — `ExchangeCredential` / `NotificationTarget` AES-GCM 봉투 암호화 필드 (`apiKeyCipher` ByteArray)
- ✅ **FR-SEC-02** — `audit_log` 테이블 + 평문 toString 마스킹 (`SensitiveDataMaskingSpec` 검증)
- ✅ **FR-SEC-03** — tenantId 격리 (모든 Repository port 시그니처)

---

## 비기능 요구사항 (NFR)

### 성능 (NFR-PERF)
- ⏳ **NFR-PERF-01** — SLO 메트릭 노출 (`seven_split_strategy_evaluation_latency_seconds` 등록), 실측은 Phase 2 부하 시
- ⏳ **NFR-PERF-02** — WS 재연결 SLO는 Phase 2
- ✅ **NFR-PERF-03** — 백테스트 30일 분봉 < 5분 (TG-05 결정론 테스트로 부분 검증)
- ⏳ **NFR-PERF-04** — 대시보드 p95 ≤ 500ms (실측 Phase 2)

### 용량 (NFR-CAP)
- ✅ **NFR-CAP-01** — MVP 본인 1명 / 5거래쌍 × 7회차 = 35 슬롯 가정
- ✅ **NFR-CAP-02** — 코드 한도 50×50 = 2500 슬롯 (도메인 검증)

### 안정성 (NFR-REL)
- ✅ **NFR-REL-01** — Outbox 패턴
- ⏸ **NFR-REL-02~04** — CircuitBreaker / DLQ / Reconcile은 Phase 2/3

### 관측 (NFR-OBS)
- ✅ **NFR-OBS-01** — kotlin-logging 람다 형식 통일
- ✅ **NFR-OBS-02** — Micrometer 메트릭 5종 노출
- ✅ **NFR-OBS-03** — 평문 시크릿 로그 금지 검증 테스트

### 보안 (NFR-SEC)
- ✅ **NFR-SEC-01** — AES-GCM 봉투 암호화 스키마 정의
- ⏸ **NFR-SEC-02** — KEK 회전 (Phase 2, OQ-017)
- ⏸ **NFR-SEC-03** — `audit_log` 불변성 (Phase 2, OQ-018)

### 배포 (NFR-DEP)
- ✅ **NFR-DEP-01** — k3s-lite overlay (개발용)
- ⏸ **NFR-DEP-02** — prod-k8s overlay는 Phase 3

---

## 명시적 미포함 (Out of Scope)

- 실거래소 주문 발송 (Phase 3)
- WebSocket 시세 구독 (Phase 2)
- 페이퍼 트레이딩 모드 (Phase 2)
- 텔레그램 알림 발송 (Phase 2)
- 업비트 어댑터 (Phase 3)
- 7원칙 1·3·4 (포트폴리오 차원 — `AccountPortfolio` 도메인 미도입, spec §15.1 명시)
- 마진/선물/파생 (원칙 2 — `SpotOrderType` sealed로 컴파일 차단)
- 자동 종목 추천
- 해외 거래소 (Binance 등)
- 공개 리더보드 (본인 용도만)
- ATR 동적 매매 간격
- LLM 에이전트 토론 매매 (별개 idea #1)

---

## 기술 스택

### 백엔드
- Kotlin 2.2.21 + Spring Boot 4.0.4 + Java 25
- 중첩 서브모듈: `:seven-split:domain` (순수 Kotlin) / `:seven-split:app` (Spring)
- JPA + QueryDSL (blocking) + Hibernate 7
- Coroutine + WebClient (외부 거래소 IO)
- Tomcat 가상 스레드 활성화
- Kotest BehaviorSpec + MockK + kotest-property + Turbine

### 인프라
- MySQL 8.0.33 (전략/회차/주문/Outbox)
- ClickHouse 24.3 (시세 시계열, `seven_split` DB 별도 신설)
- Kafka (Outbox relay 대상, Phase 2 활성화)
- Flyway (DB migration V001)

### 프론트엔드
- React 18 + TypeScript + Vite 6
- Tailwind CSS (mobile-first PWA)
- React Router v6 / TanStack Query v5 / react-hook-form + zod / lightweight-charts
- vite-plugin-pwa (Workbox 기반 SW)
- Pretendard 폰트

### K8s
- Base manifest: `k8s/base/seven-split/`
- k3s-lite overlay 자동 포함
- Jib convention 자동 적용 (이미지 `commerce/seven-split`)

---

## 출고 산출물

### 코드
- 백엔드: 60+ Kotlin 파일
- 프론트엔드: 60 TS/TSX 파일 (React PWA)
- DB: Flyway V001 (9 테이블) + ClickHouse DDL V001~V004
- K8s: ServiceAccount + Deployment + Service

### 테스트
- 도메인 35 tests (불변식 property + 상태머신 + 마스킹)
- App: UseCase 7 + Backtest 3 + Bithumb / Outbox / Mask 등 50+ tests
- Testcontainers MySQL/ClickHouse — Docker opt-in 환경에서 실행 (`-PincludeIntegration=true`)

### 문서
- ADR-0024 (Proposed)
- spec.md / requirements.md / test-quality.md / tasks.md
- open-questions.yml (OQ-001~020)
- exchange-terms.md (Preflight P.0 — 사용자 수동 검토 대기)
- data-ingestion.md (Preflight P.1 — closed)
- phase1-readiness.md (체크리스트)
- seven-split/CLAUDE.md + docs/README.md
- 루트 CLAUDE.md Navigation 갱신

---

## Phase 2 Preflight 후보 (다음 사이클 진입 전 해소)

| OQ | 영역 | 우선순위 |
|---|---|---|
| OQ-007 | 시세 틱 in-process 이벤트 버스 (Kafka vs SharedFlow) | medium |
| OQ-011 | 빗썸/업비트 약관 자동매매 허용 (Phase 2 진입 전 필수) | high |
| OQ-017 | KEK 회전 정책 | medium |
| OQ-018 | `audit_log` 불변성 보장 | medium |
| TG-12 | 골든셋 regression 도입 | medium (알고리즘 분기 시점) |
| TG-15 | Phase 1 통합 E2E (Docker 환경 1회 수동) | high (출고 전) |

---

## 알려진 제약 / TODO

1. `RoundSlot.targetQty` 가 placeholder `Quantity(BigDecimal.ONE)` — Phase 2 에서 동적 계산 (`initialOrderAmount / roundCount / firstBarPrice`) 도입
2. `OrderId.newV7()` 가 현재 `UUID.randomUUID()` (v4 fallback) — Phase 2 에서 v7 라이브러리 도입
3. Outbox `findUnpublished` payload deserialization 미구현 — Phase 2 Kafka relay 활성화 시 구현
4. `BacktestRunChart` priceSeries 백엔드 endpoint 미정 (현재 fill 가격으로 placeholder)
5. PWA 아이콘 placeholder (정식 디자인 후 PNG 추가)

---

## 회고 / Next

본 Phase 1은 **결정론 백테스트 엔진의 골격**을 갖추는 데 집중했다. 

Phase 2 진입 전:
- 약관 검토 (OQ-011) 종결
- 1회 Docker 환경에서 통합 E2E 수동 실행
- 실 빗썸 히스토리 적재 1회 시도 (실 데이터로 백테스트 검증)
- 위 3가지 통과 시 ADR-0024 Status를 Proposed → Accepted 승격

그 후 Phase 2 사이클 (`/ideabank:bs 12` 또는 새 spec 폴더) 진입.
