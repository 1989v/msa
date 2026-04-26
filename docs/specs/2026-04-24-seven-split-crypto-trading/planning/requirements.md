---
spec: seven-split-crypto-trading
date: 2026-04-24
updated: 2026-04-24 (post review-1)
status: requirements-draft
source-planning:
  - planning/initialization.md
  - context/open-questions.yml
decisions-confirmed-on: 2026-04-24
author: shape-agent (sharded from initialization.md via Q-A ~ Q-E)
---

# Requirements — 세븐스플릿 기반 암호화폐 퀀텀 매매 웹 서비스

> 본 문서는 `planning/initialization.md`(seed PRD)와 사용자 응답 Q-A ~ Q-E(2026-04-24)를 기반으로 요구사항을 정제한 결과물입니다.
> 추상 전략 원리는 initialization.md 섹션 1~2, 기술 스택은 섹션 4를 참조하고 중복 서술하지 않습니다.
> review-1(2026-04-24) 이후 A-06(FE 배치 확정)과 §11 기술 스택 버전 정정 반영.

---

## 1. Initial Description (압축 요약)

박성현 『세븐 스플릿』 분할 매매 전략을 빗썸·업비트 등 국내 암호화폐 거래소에 적용하는 **자동매매 웹 서비스**. 자본을 N(기본 7) 회차로 나누어 **각 회차가 독립 매수가 기준으로 독립 익절**하고, 손절은 없음. 단계적 출시(**Phase 1 백테스트 → Phase 2 페이퍼 → Phase 3 실매매**)이며, 코드는 멀티테넌트 SaaS 구조로 시작하되 MVP 운용은 본인 1인 1계정이다.

세부 원리·7원칙·서비스 구조는 `planning/initialization.md` §1~§5를 단일 출처로 삼는다.

---

## 2. Q&A (2026-04-24 확정분)

### Q-A 실시간성 SLO
- **질문 요지**: 시세 수신 → 주문 집행 경로의 지연/가용성 목표, WebSocket 단절 복구, 백테스트 재생 속도
- **결정**: 기본값 채택
  - 틱 수신 → 전략 평가 → 주문 송신 지연: **p50 200ms / p95 500ms / p99 1s**
  - WebSocket 재연결: 끊김 감지 후 **5초 내 재시도**
  - 연속 **10초 이상 끊김** 시 **REST 매초 폴링으로 폴백**
  - 백테스트: **30일치 분봉 5분 내 재생**

### Q-B 용량·멀티테넌시
- **질문 요지**: MVP 동시 가동 전략 수, 미래 확장 상한, 테넌트 분리 방식
- **결정**: 기본값 채택
  - MVP: **본인 1명**
  - 동시 활성 슬롯: **5 거래쌍 × 7 회차 = 35 슬롯**
  - 코드 한도: **최대 50 거래쌍 × 50 회차**까지 설정 가능하도록 `SplitStrategyConfig` 검증 한도 설계
  - **`tenantId` 기반 멀티테넌트**: 모든 테이블·Kafka 토픽·Key Vault 경로에 `tenantId` 포함, 1일차부터 포함

### Q-C 알림 채널 (변경됨)
- **질문 요지**: 체결/손익/이상 상황 알림을 어느 채널로 어떤 SLA로 발송할지
- **결정**:
  - **MVP 필수 채널 = 텔레그램 봇** (기본값이던 이메일을 교체)
  - **Phase 2 이후 선택**: 이메일
  - **Phase 4 이후**: 웹 푸시 / 모바일 푸시
  - 알림 이벤트 필수 종류: 체결 성공, 체결 실패, 전 회차 소진, 긴급 청산, 거래소 API 에러, Rate Limit 임박
  - 재시도 정책: 텔레그램 API 실패 시 exponential backoff 3회, 최종 실패는 감사 로그에 기록

### Q-D 백테스트 데이터 범위
- **질문 요지**: 어느 거래쌍을 어느 해상도·어느 기간으로 준비할지, 수집 경로
- **결정**: 기본값 채택
  - **대상**: BTC/KRW, ETH/KRW (2종)
  - **기간**: 2023-01-01 ~ 현재
  - **해상도**: 분봉(1m OHLCV)
  - **수집 경로**: **빗썸 REST 히스토리 API 배치 수집** → ClickHouse 적재
  - 추가 거래쌍/초봉 확장은 Phase 2 이후 판단

### Q-E 추가 제외 / 대시보드·리더보드 포함
- **명시 제외 (유지)**: 마진/선물/파생상품 거래, 자동 종목 추천
- **명시 포함 (추가)**:
  - **대시보드 / 현황판**: 회차별 상태, 전략별 실현/미실현 손익, 누적 수익률, 매매 이력, 체결 타임라인
  - **리더보드**: 본인 용도 기준 **전략별 성과 랭킹 및 히스토리 비교** (공개 랭킹 아님, 자기 비교용)
- 사용자 원문: "별개 프로젝트이나 이와 무관하게 리더보드/대시보드/현황판은 다 필요함" → 본 피처 범위에 포함

---

## 3. Existing Code to Reference

| 영역 | 참조 대상 | 이유 |
|---|---|---|
| 클린 아키텍처 패키지 구조 | `product/domain`, `product/app`, `order/domain`, `order/app` | Nested submodule, `com.kgd.{service}` 패키지 컨벤션 |
| 도메인 이벤트 + Outbox 패턴 | `order/app` 주문 상태 전이, `common` outbox 유틸 | `OrderPlaced`/`OrderFilled` 등과 동형의 도메인 이벤트 append-only 저장 |
| Kafka 컨벤션 | `docs/architecture/kafka-convention.md` | 토픽 네이밍(`seven-split.<event>.v1`), 스키마 버전링 |
| API 응답 포맷 | `docs/architecture/api-response.md` | `ApiResponse<T>` 표준 |
| 멱등성 소비자 | `docs/adr/ADR-0012-idempotent-consumer.md` | 체결 이벤트 중복 처리 방어 |
| 장애 대비 | `docs/adr/ADR-0015-resilience-strategy.md` | CircuitBreaker, DLQ, Rate Limiting, CQRS 패턴 |
| 트랜잭션 | `docs/adr/ADR-0020-transactional-usage.md` | 외부 IO 분리 (거래소 REST 호출은 트랜잭션 밖) |
| 로깅 | `docs/adr/ADR-0021-logging-conventions.md` | kotlin-logging 람다 형식 |
| Entity 수정 | `docs/adr/ADR-0022-entity-mutation-conventions.md` | `RoundSlot` 상태 전이 캡슐화 |
| K8s 배포 | `k8s/overlays/k3s-lite`, `k8s/overlays/prod-k8s` | `seven-split` Deployment/Service overlay 추가 |
| 시계열 저장소 | `analytics` 서비스의 ClickHouse 사용 패턴 | 백테스트 OHLCV, 틱 재생 (인프라만 공유, DB는 `seven_split` 분리) |
| 차트/시각화 협업 | `charting/` (Python FastAPI) | 공개 차트 엔드포인트 — 내부 대시보드는 별도 FE 모듈 |
| 테스트 규칙 | `docs/standards/test-rules.md` (Kotest BehaviorSpec + MockK) | 도메인 규칙 given/when/then 서술 |
| FE 디자인 가드 | `docs/conventions/frontend-design.md` | 대시보드 타이포/색상/접근성 |

---

## 4. Visual Assets

- `planning/visuals/` 디렉토리 존재 (비어 있음). 시각 자료 없음 (bash 체크 결과: `No visual files found`).
- 대시보드/리더보드 와이어프레임은 Phase 1 UI 착수 시 추가로 `planning/visuals/`에 수집 예정.

---

## 5. User Stories

### 5.1 전략 운영자 (본인, MVP 1인)
- **US-01 (전략 셋업)**: 사용자로서, 거래소 API Key를 암호화 저장하고 대상 거래쌍·회차 수·매수 간격 %·회차별 익절 %를 입력해 전략을 활성화하고 싶다. 그래야 자동 운용이 시작된다.
- **US-02 (자동 운용 관찰)**: 사용자로서, 활성 전략의 회차별 포지션·미실현 손익·누적 수익률을 실시간 대시보드로 확인하고 싶다.
- **US-03 (매매 이력·타임라인)**: 사용자로서, 체결 타임라인과 회차별 매매 이력을 조회해 전략 성과를 복기하고 싶다.
- **US-04 (파라미터 재조정)**: 사용자로서, 전략을 일시 중지하고 파라미터(회차 수, 간격 %, 익절 %)를 변경한 뒤 재가동하고 싶다.
- **US-05 (긴급 중단/청산)**: 사용자로서, 시장 이상 시 한 번의 액션으로 전체 전략을 중지하거나 열린 회차를 전량 청산하고 싶다.
- **US-06 (실시간 알림)**: 사용자로서, 체결·전 회차 소진·거래소 에러·긴급 청산·Rate Limit 임박을 **텔레그램 봇**으로 즉시 받고 싶다.

### 5.2 백테스터 / 튜너
- **US-07 (백테스트 실행)**: 사용자로서, BTC/KRW·ETH/KRW 분봉 2023-01 ~ 현재 구간으로 파라미터를 변경하며 백테스트를 돌리고 수익률·MDD·회차 활용도를 비교하고 싶다.
- **US-08 (골든셋 리그레션)**: 개발자로서, 고정된 시드 데이터에 대한 골든셋 결과를 테스트로 고정해 엔진 변경 시 회귀를 탐지하고 싶다.

### 5.3 성과 비교자 (리더보드)
- **US-09 (리더보드)**: 사용자로서, 내가 돌려 본 여러 파라미터 세트·기간별 전략 성과를 **본인 용도 리더보드**에서 랭킹/비교하고 싶다 (공개 랭킹 아님).
- **US-10 (히스토리 비교)**: 사용자로서, 과거 실행 내역을 오버레이 비교해 어느 설정이 유리했는지 판단하고 싶다.

### 5.4 플랫폼 관리자 (멀티테넌트 기반)
- **US-11 (tenant 분리)**: 관리자로서, 모든 저장소/이벤트/Key Vault 경로가 `tenantId`로 격리돼 외부 오픈 시점에 즉시 다계정 운용이 가능하길 원한다.

---

## 6. Functional Requirements

### 6.1 전략 엔진 (FR-ENG)
- **FR-ENG-01**: `SplitStrategyConfig`는 `roundCount`(1~50), `entryGapPercent`(음수, 예 `-3.0`), `takeProfitPercentPerRound`(배열, 각 요소 양수), `initialOrderAmount`(모든 회차 동일), `targetSymbol`을 보유한다.
- **FR-ENG-02**: 최초 진입은 전략 활성화 즉시 현재 시세로 1회차 시장가 매수. (고점-대비 대기 트리거는 Phase 4 이후 옵션)
- **FR-ENG-03**: 매수 트리거 = **직전 체결된 회차 매수가 대비 `entryGapPercent` 이하로 하락** 시 다음 회차 매수.
- **FR-ENG-04**: 매도 트리거 = **각 회차 매수가 대비 해당 회차 `takeProfitPercentPerRound[i]` 이상 상승** 시 해당 회차만 독립 매도. 평균단가 기준 아님.
- **FR-ENG-05**: 매도된 회차 슬롯은 비워지고, 추가 하락으로 매수 트리거가 다시 충족되면 재사용된다.
- **FR-ENG-06**: 전 회차 소진 후 추가 하락은 **대기** (손절 없음, 원칙 7). `StrategyRun.status = AWAITING_EXHAUSTED` 로 전이하고 신규 매수 트리거 중단.
- **FR-ENG-07**: 모든 상태 전이는 도메인 이벤트(`SlotOpened`, `OrderPlaced`, `OrderFilled`, `SlotClosed`, `StrategyPaused`, `StrategyLiquidated` 등)로 Outbox에 append-only 기록 후 Kafka 발행.
- **FR-ENG-08**: 현재 상태는 CRUD 테이블 `round_slot`에서 읽기 최적화하여 제공(하이브리드 패턴).

### 6.2 시세 수신 & 실행 인프라 (FR-MKT)
- **FR-MKT-01**: 거래소 WebSocket 구독을 1차 경로, REST 매초 폴링을 폴백으로 사용한다. Phase 1~2는 **public 시세 WS만** 사용하며, private 채널(주문/체결)은 REST 폴링.
- **FR-MKT-02**: WebSocket 끊김 감지 후 **5초 내 재연결**을 시도한다.
- **FR-MKT-03**: **10초 이상 연속 끊김 시 자동으로 REST 폴링 폴백**으로 전환하고, WebSocket 복구 시 원복한다.
- **FR-MKT-04**: 수신된 틱은 내부 이벤트 버스(Phase 1 in-process SharedFlow, Phase 2 이후 Kafka 검토 — OQ-007)로 전파한다.
- **FR-MKT-05**: 거래소 REST 호출은 WebClient + Kotlin Coroutine `suspend`, WebSocket 시세 구독은 Coroutine `Flow`로 구현한다 (ADR-0002 준수, WebFlux 금지).

### 6.3 거래소 연동 (FR-EX)
- **FR-EX-01**: `ExchangeAdapter` port 인터페이스로 빗썸·업비트를 격리한다. MVP = 빗썸 우선(Phase 1~2), Phase 3 실매매 진입 시 업비트 추가.
- **FR-EX-02**: 주문은 **idempotent order ID**(UUID v7 기반)로 전송하고, 네트워크 장애 시 지수 백오프 재시도.
- **FR-EX-03**: 유저 API Key 단위 호출량 카운터를 유지하고, 거래소별 공식 Rate Limit 근접 시 백오프 (구체 수치는 OQ-004).
- **FR-EX-04**: 부분 체결 처리 정책은 서비스 ADR로 확정한다 (OQ-003, OQ-020).

### 6.4 Phase별 모드 (FR-PH)
- **FR-PH-01 (Phase 1 백테스트)**: ClickHouse `seven_split` DB의 과거 분봉을 소스로 한 **결정론적 시뮬레이터**. 동일 입력 → 동일 출력 보장. 30일치 5분 내 재생.
- **FR-PH-02 (Phase 2 페이퍼 트레이딩)**: 실시간 시세 + 가상 체결. 체결 지연/슬리피지 모델 파라미터화.
- **FR-PH-03 (Phase 3 실매매)**: 실제 거래소 주문. Phase 2 결과 정량 게이트(OQ-019) 승인 후 토글.
- **FR-PH-04 (공통)**: 세 모드는 `ExecutionMode` enum으로 런타임 전환 가능하되 데이터는 분리된 테이블/토픽에 기록.

### 6.5 대시보드 / 현황판 / 리더보드 (FR-DASH) — Q-E 추가
- **FR-DASH-01 (회차 현황판)**: 거래쌍별로 활성 회차 슬롯, 각 회차 매수가·현재가·미실현 %·목표 익절 %를 카드형으로 표시한다.
- **FR-DASH-02 (전략별 손익)**: 전략 단위로 실현 손익·미실현 손익·누적 수익률·MDD·체결 회수를 요약.
- **FR-DASH-03 (매매 이력)**: 체결 단위로 시각·회차·방향·수량·체결가·수수료를 테이블로 제공. 필터: 기간, 전략, 거래쌍.
- **FR-DASH-04 (체결 타임라인)**: 시간축에 매수/매도 이벤트를 가격 차트에 오버레이. `charting` 서비스 협업 가능.
- **FR-DASH-05 (리더보드 — 본인 용도)**: 사용자의 여러 전략 실행(실매매/페이퍼/백테스트 포함)을 **수익률·샤프·MDD·승률** 기준으로 랭킹/비교. 공개 랭킹 아님, `tenantId` 스코프 내부.
- **FR-DASH-06 (히스토리 비교)**: 2개 이상 실행을 선택해 수익률 곡선 오버레이 비교.

### 6.6 알림 (FR-NOTIF) — Q-C 텔레그램 확정
- **FR-NOTIF-01**: MVP 알림 채널은 **텔레그램 봇**. 테넌트별 `botToken`/`chatId` 설정.
- **FR-NOTIF-02**: 알림 이벤트 타입: 체결 성공, 체결 실패, 전 회차 소진, 긴급 청산 실행, 거래소 API 에러, Rate Limit 80% 도달.
- **FR-NOTIF-03**: 텔레그램 API 실패 시 exponential backoff 3회, 최종 실패는 감사 로그에 기록.
- **FR-NOTIF-04**: Phase 2 이후 이메일 어댑터 추가, Phase 4 이후 웹/모바일 푸시 어댑터 추가. 포트 인터페이스 `NotificationChannel` 추상화.

### 6.7 리스크 관리 (FR-RISK)
- **FR-RISK-01**: 전체 포트폴리오 손실 한도, 거래쌍별 최대 투입 금액, 긴급 청산 스위치를 설정·실행 가능하다. 구체 수치/강제 시점은 OQ-012에서 확정.
- **FR-RISK-02**: 긴급 청산은 1-click UI + REST API 둘 다 노출한다. 글로벌 kill-switch(전 테넌트)는 OQ-013으로 별도.

### 6.8 보안 (FR-SEC)
- **FR-SEC-01**: 거래소 API Key는 **AES-GCM 봉투 암호화** 후 저장. 키 관리(KMS vs 환경변수)는 OQ-006에서 결정. KEK 회전은 OQ-017.
- **FR-SEC-02**: IP 화이트리스트, 감사 로그 (접근/사용 기록) 필수. `audit_log` 불변성 보장 방식은 OQ-018.
- **FR-SEC-03**: 테넌트 간 데이터 격리 — 모든 조회 쿼리는 `tenantId` 조건 강제.

---

## 7. Non-Functional Requirements

### 7.1 성능·SLO (Q-A 확정)
- **NFR-PERF-01**: 틱 수신 → 전략 평가 → 주문 송신 **p50 200ms / p95 500ms / p99 1s** (실매매 경로 기준).
- **NFR-PERF-02**: WebSocket 재연결 시도 ≤ 5s, 10s 연속 끊김 시 REST 폴백.
- **NFR-PERF-03**: 백테스트 30일치 분봉 재생 ≤ 5분 (단일 전략, 단일 거래쌍 기준).
- **NFR-PERF-04**: 대시보드/리더보드 엔드포인트(`/dashboard/*`, `/leaderboard`) 응답 **p95 ≤ 500ms**. `seven_split.dashboard.response.latency_seconds{endpoint}` 메트릭 감시.

### 7.2 용량 (Q-B 확정)
- **NFR-CAP-01**: MVP 동시 활성 슬롯 35개 (5쌍 × 7회차) 운영 가능.
- **NFR-CAP-02**: 코드는 50×50 = 2500 슬롯까지 설정 유효성 검증 통과.
- **NFR-CAP-03**: 멀티 테넌트 1일차부터 격리 (`tenantId` 컬럼/키 필수).

### 7.3 가용성·신뢰성
- **NFR-REL-01**: 거래소 WebSocket 단절 복구 자동화 (5s/10s 규칙).
- **NFR-REL-02**: Kafka 이벤트 소비자는 멱등성 보장 (ADR-0012).
- **NFR-REL-03**: 장애 시 DLQ 전송 및 재처리 큐 (ADR-0015).
- **NFR-REL-04**: Outbox 기반 이벤트 publish로 전송 누락 방지.

### 7.4 관측성
- **NFR-OBS-01**: 구조화 로그 (kotlin-logging 람다 형식, ADR-0021).
- **NFR-OBS-02**: 메트릭: 틱 수신률, 평가 지연, 주문 성공률, Rate Limit 사용률, 알림 성공률, 대시보드 응답 지연.
- **NFR-OBS-03**: 각 전략 실행에 고유 `executionId` 부여하여 추적.

### 7.5 보안·컴플라이언스
- **NFR-SEC-01**: API Key 평문 로그/메트릭 금지.
- **NFR-SEC-02**: 감사 로그 보관 기간은 보안 설계 문서에서 확정 (OQ-006).
- **NFR-SEC-03**: 법적 이슈 검토 전 외부 오픈 금지 (OQ-005). 거래소 약관상 자동매매 허용 확인 (OQ-011).

### 7.6 이식성·배포
- **NFR-DEP-01**: `k8s/overlays/k3s-lite` 로컬 및 `k8s/overlays/prod-k8s` managed K8s 양쪽 overlay 제공 (ADR-0019).
- **NFR-DEP-02**: Jib 기반 이미지 빌드.
- **NFR-DEP-03**: prod-k8s HPA의 **p95 기준**은 Prometheus Adapter 구축 전제. 미구축 시 CPU 70% 기반으로 degrade.

---

## 8. Scope

### 8.1 In-Scope (MVP ~ Phase 3)
- 세븐스플릿 정통 7원칙 중 **2·5·6·7 + 회차 독립 익절** 강제 (원칙 1·3·4는 포트폴리오 차원으로 out-of-scope — spec §15.1)
- 빗썸 어댑터(Phase 1~2), 업비트 어댑터(Phase 3 추가)
- WebSocket 시세 + REST 폴백 (public 시세만, private는 REST)
- 백테스트 모드 (BTC/KRW, ETH/KRW 분봉, 2023-01~현재)
- 페이퍼 트레이딩 모드
- 실매매 모드 (Phase 3)
- 대시보드·현황판·매매 이력·체결 타임라인 (FR-DASH-01 ~ 04)
- **리더보드 — 본인 용도** 및 히스토리 비교 (FR-DASH-05/06)
- 텔레그램 봇 알림 (FR-NOTIF)
- 멀티테넌트 기반 (`tenantId`) — 1일차부터
- 리스크 관리: 손실 한도, 긴급 청산
- 감사 로그 + API Key AES-GCM 암호화 저장

### 8.2 Out-of-Scope (명시 제외)
- **마진/선물/파생상품 거래** (현물 전용, 원칙 2)
- **자동 종목 추천 (대상 거래쌍 자동 선정)** — 사용자 수동 선택만
- **해외 거래소 (Binance 등)** — 장기 로드맵
- **"고점 대비 -x% 대기" 최초 진입 옵션** — Phase 4 이후 검토
- **ATR·변동성 기반 동적 간격 %** — Phase 4 이후 옵션
- **외부 사용자 오픈 / SaaS 상용화** — 법적 검토(OQ-005) 후 판단
- **1번(퀀트 에이전트 토론) 서비스와의 코드 공유** — `trading-core` 공통 모듈 추출은 1번 구현 시점까지 보류
- **공개 리더보드** — 본 MVP는 본인 용도 한정, 외부 공개 랭킹 없음
- **이메일 알림** — Phase 2 이후
- **웹/모바일 푸시** — Phase 4 이후
- **세븐스플릿 원칙 1·3·4 (포트폴리오 차원)** — `AccountPortfolio` 도메인 확장 후 재검토 (spec §15.1)

---

## 9. Assumptions

- **A-01**: ClickHouse·Kafka·MySQL·K8s 등 기존 MSA 공통 인프라를 재사용한다. 단, ClickHouse는 **DB `seven_split` 신설**로 스키마 격리.
- **A-02**: 운영 초기에는 본인 1계정만 사용하지만, DB 스키마·Kafka 토픽·Key Vault 경로는 `tenantId`로 격리된 상태로 출발한다.
- **A-03**: Phase 1 백테스트에 쓸 BTC/KRW·ETH/KRW 분봉은 **빗썸 REST 히스토리 API 배치 수집**으로 ClickHouse에 적재 가능하다. 수집 스크립트는 Phase 1 착수 직전에 작성한다 (OQ-008).
- **A-04**: 텔레그램 봇 토큰은 사용자가 BotFather로 직접 생성해 제공한다. 서버는 토큰을 AES-GCM 암호화 저장한다.
- **A-05**: 본 MVP는 시뮬레이션/실매매에 실 자본을 투입하며, 손실 책임은 사용자에게 있다. 서비스는 투자자문/대행이 아니다.
- **A-06**: 대시보드 FE는 **신규 독립 FE 모듈 `seven-split/frontend/` (React + Vite)로 제공**. `charting` 서비스 재사용 안 함 (내부 관리용 ↔ 공개 차트 도메인 분리).
- **A-07**: `charting` 서비스와의 협업은 옵션이며, 실패 시 자체 경량 차트(Recharts/ECharts)로 대체한다.

---

## 10. Dependencies

### 10.1 내부 MSA 의존성
- **`gateway`**: 인증/라우팅 (JWT 기반, Rate Limiting 공통 필터)
- **`auth` / `member`**: `tenantId` = 사용자 식별자 근거, ROLE 체계
- **`common`**: `BusinessException`, `ErrorCode`, Outbox, ApiResponse 공통 라이브러리
- **`analytics`** (선택): 매매 이벤트 수집 및 2차 분석 — **ClickHouse 인프라만 공유, DB는 분리**
- **`charting`** (선택): 공개 차트 엔드포인트 — 내부 대시보드는 별도 FE
- **`experiment`** (선택): 파라미터 A/B 테스트 연동 (장기)

### 10.2 외부 의존성
- **빗썸 OpenAPI**: REST + WebSocket (HMAC-SHA512)
- **업비트 Open API**: REST + WebSocket (JWT, gzip 지원, idle 120s) — Phase 3부터
- **텔레그램 Bot API**: 알림 송신
- **ClickHouse**: 과거 틱·백테스트 시계열 저장 (`seven_split` DB)

### 10.3 블로커 (미결 → Plan 단계 전 해소)

**Phase 1 착수 전**:
- OQ-008 ClickHouse 틱 데이터 적재 파이프라인
- OQ-011 (신규) 거래소 약관상 자동매매 허용 확인
- OQ-020 (권장) 부분체결 substate 설계

**Phase 2 착수 전**:
- OQ-007 이벤트 버스 in-process vs Kafka
- OQ-017 (신규) KEK 회전 정책
- OQ-018 (신규) `audit_log` 불변성 보장 방식

**Phase 3 착수 전 (실매매 출시 게이트)**:
- OQ-003 주문 실패/부분체결 복구 정책
- OQ-004 빗썸·업비트 공식 Rate Limit 수치
- OQ-006 API Key 저장·감사 로그 상세
- OQ-009 텔레그램 Bot Token 저장·멀티테넌트 분배
- OQ-010 리더보드 점수 산식 정의
- OQ-012 (신규) 유저별 손실 한도 정의
- OQ-013 (신규) 글로벌 kill-switch + 2FA
- OQ-014 (신규) 주문 reconcile 절차
- OQ-015 (신규) Gateway 우회 방지
- OQ-016 (신규) 실매매 Role + step-up auth
- OQ-019 (신규) 페이퍼 → 실매매 승격 정량 게이트

**외부 오픈 전**:
- OQ-005 국내 법적 이슈 검토

### 10.4 지침·ADR
- ADR-0002 Kotlin Coroutine 혼용 패턴
- ADR-0012 멱등성 소비자
- ADR-0015 장애 대비 전략
- ADR-0019 K8s 마이그레이션
- ADR-0020 `@Transactional` 사용 규칙 (외부 IO 분리)
- ADR-0021 로깅 규칙
- ADR-0022 Entity 수정 규칙
- ADR-0024 Seven-Split 서비스 도입 (본 스펙과 동반)
- `docs/standards/test-rules.md` (Kotest BehaviorSpec + MockK)

---

## 11. Requirements Summary

- **Functional**: 세븐스플릿 7원칙 중 2·5·6·7 + 회차 독립 익절 엔진 + 빗썸(→업비트) 어댑터 + 백테스트/페이퍼/실매매 3모드 + 대시보드·현황판·리더보드 + 텔레그램 알림 + 긴급 청산 + tenantId 격리.
- **Scope**: MVP 본인 1명·5쌍×7회차 슬롯, 코드는 50×50 확장 한도. 현물 전용, 자동 추천·마진·해외 거래소·공개 랭킹·원칙 1·3·4(포트폴리오 차원) 제외.
- **Technical**: Kotlin 2.2.21 + **Spring Boot 4.0.4**, Clean Architecture nested submodule (`com.kgd.sevensplit`), Coroutine Flow(WS)/suspend(REST), 도메인 이벤트 + Outbox + Kafka, MySQL + ClickHouse(`seven_split` DB) + Redis, K8s 양 overlay, p95 500ms SLO, WS 5s/10s 복구 규칙, 30일 분봉 5분 재생, FE는 `seven-split/frontend/` 독립 React+Vite.

---

## 12. Test Coverage Matrix (review-1 추가)

| 영역 | 라이브러리 | Phase | 목적 |
|---|---|---|---|
| 도메인 불변식 (INV-01 손절 없음, INV-07 양수 익절 등) | `kotest-property` | 1 | Property-based 테스트로 속성 강제 |
| Flow 기반 틱/이벤트 처리 | `turbine` | 1 | Coroutine Flow 단위 테스트 |
| MySQL 통합 | `testcontainers-mysql` | 1 | 영속화 레이어 통합 |
| ClickHouse 통합 (`seven_split` DB) | `testcontainers-clickhouse` | 1 | 백테스트 데이터 파이프라인 검증 |
| Kafka 이벤트 발행/소비 | `testcontainers-kafka` | 1 | Outbox → Kafka 통합 |
| CircuitBreaker + Coroutine | `resilience4j-kotlin` | 2 | 거래소 호출 CB + 지표 기반 테스트 |
| Rate Limiter | `bucket4j` 또는 Redis Lua | 2 | 유저 API Key 단위 한도 테스트 |
| WebSocket 구독 | `reactor-netty` (기존) | 2 | 거래소 WS public 시세 |

상세 계획은 `planning/test-quality.md` 참조.

---

## 13. Next Steps

1. open-questions.yml에 OQ-011 ~ OQ-020 추가 → review-1에서 처리 완료.
2. `test-quality.md` 보강 (§12 커버리지 매트릭스와 정합) → Plan 단계에서 처리.
3. Plan 단계로 이동: 모듈 구조, 데이터 모델, ADR 초안, Phase별 마일스톤, 블로커 OQ 해소 계획.
