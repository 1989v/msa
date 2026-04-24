# ADR-0024 Seven-Split 암호화폐 자동매매 서비스 도입

## Status
Proposed

> 루트 `docs/adr/`에 두는 이유: 플랫폼 최초 금융/트레이딩 도메인 진입 + analytics 인프라(ClickHouse) 공유 결정 포함.

## Context

박성현 『세븐 스플릿』의 7원칙(분할매수/분할매도, 독립회차 운용, 손실제한, 규칙 우선 등)을 국내 암호화폐 거래소(빗썸/업비트)에 적용하는 **규칙 기반(deterministic) 자동매매 서비스**를 MSA 플랫폼에 신규 추가한다.

- 기존 플랫폼 도메인은 이커머스(product/order/search/inventory 등) 중심 — 금융/트레이딩 도메인 최초 진입
- 결정론적 규칙 엔진 + 실시간 시세(WS) 처리 + 외부 거래소 REST/WS 통합이 함께 요구됨
- 1번 아이디어(`quant-trader`, LLM 토론 기반)와는 패러다임이 달라 별도 서비스로 분리
- 입력 스펙: `docs/specs/2026-04-24-seven-split-crypto-trading/planning/spec.md`, `requirements.md`, `ideabank/docs/12-seven-split-crypto.md`

## Decision

### 1. 서비스 모듈 구조
- 중첩 Gradle 서브모듈로 신설: `:seven-split:domain` / `:seven-split:app` (ADR-0001 패턴 준수)
- 기본 패키지: `com.kgd.sevensplit` (underscore 없음, 기존 컨벤션 준수)
- `common` 라이브러리만 domain에서 허용 (BusinessException/ErrorCode)

### 2. Clean Architecture 준수
- Domain 레이어는 순수 Kotlin — Spring/JPA/거래소 SDK/Kafka 의존성 금지
- 전략 엔진·회차(Round) 도메인·리스크 규칙은 domain에 위치
- Infrastructure에 거래소 어댑터, JPA Repository, Kafka Publisher, 텔레그램 어댑터

### 3. 런타임 모델 (ADR-0002 준수)
- Spring Boot 4.0.4 / Kotlin 2.2.21 / Java 25 (gradle/libs.versions.toml 기준)
- Spring MVC + Blocking JPA 기본
- 외부 거래소 REST/WS 호출은 WebClient + Kotlin Coroutine `suspend`
- Tomcat 가상 스레드 활성화: `spring.threads.virtual.enabled=true`
- WebFlux 전면 도입 금지

### 4. Phase 기반 출시
- **Phase 1 — 백테스트**: 과거 시세 기반 전략 검증, 실거래/주문 없음
- **Phase 2 — 페이퍼 트레이딩**: 실시간 시세 구독 + 가상 주문 체결, 자금 집행 없음
- **Phase 3 — 실매매**: 빗썸 실매매 집행, 이후 업비트 추가
- 단계별 feature flag + 별도 Deployment 프로파일로 격리

### 5. ExecutionMode 추상화
- 백테스트/페이퍼/실매매가 **동일 전략 엔진 코드**를 공유
- Port 인터페이스(`ExchangeAdapter`, `MarketDataSubscriber`, `Clock`) 구현체만 교체
- 검증된 전략이 모드 전환 시에도 동일 동작을 보장 (손실 = 구현 차이 축소)

### 6. 거래소 어댑터 Port
- Phase 1~2: 빗썸 우선 지원
- Phase 3: 업비트 추가 (동일 `ExchangeAdapter` 인터페이스 구현체)
- 해외 거래소(Binance 등)는 로드맵 — 본 ADR 범위 밖

### 7. 상태 관리 패턴
- CRUD 테이블(`round_slot` 현재 상태) + **도메인 이벤트 outbox(append-only) + Kafka 발행** 하이브리드
- 순수 Event Sourcing은 UI 질의 복잡도로 인해 채택하지 않음
- 회차/주문/체결은 outbox를 통해 Kafka로 재구성 가능

### 8. 보안
- 거래소 API Key, 텔레그램 Bot Token은 **AES-GCM 봉투 암호화(envelope encryption)** 저장
- tenantId(사용자) 단위 크레덴셜 격리
- 키 회전 및 KMS 연동은 후속 ADR에서 상세화

### 9. 인증/인가
- Gateway가 JWT 검증 단독 수행, 서비스는 `X-User-Id` / `X-User-Roles` 헤더 신뢰 (ADR-0002, ADR-0004 패턴)
- 실매매 권한은 별도 Role 또는 tenant flag로 제한

### 10. 알림 채널
- **텔레그램 Bot MVP 필수 채널** — 주문 체결/손실 제한/긴급 청산 등 실시간 푸시
- 이메일/슬랙은 Phase 2 이후 선택 확장

### 11. 회복 탄력성 (ADR-0015 패턴 재사용)
- CircuitBreaker: 거래소 REST/WS 호출 단위
- Rate Limiter: **유저 API Key 단위**로 거래소별 한도 준수
- DLQ: Kafka consumer 실패 이벤트 격리
- Idempotent order key: **UUIDv7** 기반 클라이언트 주문 ID
- 시세 WS 재연결 + REST 폴링 폴백

### 12. 데이터 스토어
- **MySQL**: 전략/회차/주문/체결/크레덴셜 (트랜잭션 정합성)
- **Kafka**: 도메인 이벤트(outbox relay)
- **ClickHouse**: 시세 틱·백테스트 시계열
  - analytics ClickHouse **인프라(노드/클러스터)는 재사용**하되, **별도 데이터베이스 `seven_split`을 신설**하여 스키마/테이블 소유는 독립. analytics DB/schema 직접 참조 금지.
  - 테이블 네이밍은 prefix 없이 db 네임스페이스로 격리: `seven_split.market_tick_{exchange}`, `seven_split.backtest_run`, `seven_split.execution_result` 등.
- **Redis**: Rate Limit 카운터, WS 세션 메타

### 13. 프론트엔드 배치
- **`seven-split/frontend/` 독립 모듈 신설** (React + Vite)
- `charting` 서비스 재사용 대신 독립 유지
- 사유: 대시보드/리더보드가 **내부 관리용**이라 `charting`의 **공개 차트 렌더링**과 도메인 분리 필요

## Alternatives Considered

- **1번 아이디어(quant-trader) 통합**: LLM 토론 기반과 결정론 규칙 기반이 요구하는 테스트·재현성·주문 집행 패턴이 충돌 → 독립 서비스 채택
- **WebFlux 전면 리액티브**: ADR-0002에서 금지 — Coroutine 혼용으로 대체
- **순수 Event Sourcing**: 회차/포지션 UI 질의 복잡도 폭증 → CRUD + 이벤트 outbox 하이브리드
- **빗썸 + 업비트 동시 MVP**: 개발 기간 2배, 우선순위 분산 → 순차 지원 (빗썸 → 업비트)
- **모의매매 생략(백테스트에서 바로 실매매)**: 버그 = 실제 손실. 검증 없이 프로덕션 진입 불가 → Phase 3단 출시 필수
- **analytics ClickHouse DB 공유**: 테이블 네임스페이스 충돌·변경 커플링 위험 → `seven_split` DB 분리로 인프라만 공유
- **charting 서비스에 내부 대시보드 탑재**: 공개 차트와 관리용 UI의 접근제어·SLO·도메인 경계가 달라 독립 FE 모듈로 분리

## Consequences

**긍정적:**
- MSA 플랫폼 **금융/트레이딩 도메인 확장 첫 사례** — 이후 주식/해외 거래소 확장 시 `ExchangeAdapter` port 재사용
- analytics 인프라(ClickHouse) 공유로 신규 인프라 비용 최소화 (DB 레벨에서는 분리하여 커플링 차단)
- ExecutionMode 추상화로 백테스트 → 페이퍼 → 실매매 **전략 코드 동일성** 보장

**부정적/주의:**
- 외부 거래소 API 장애·정책 변경이 서비스 가용성에 직접 영향 → CircuitBreaker + Rate Limit 필수. 대체 거래소 fallback은 Phase 3 이후 과제
- **법적 리스크**: 국내 개인 자동매매의 법적 위치는 회색지대. 개인 운용 단계는 이슈가 낮지만, **SaaS 외부 오픈 시점 전** 투자자문/일임업 규제 검토 필수 (OQ-005). 거래소 약관상 자동매매 허용 여부 (OQ-011) 별도 확인 필요.
- 실매매 Phase 3 진입 전 페이퍼 트레이딩 검증 기간 최소 N주 확보 (정확한 기간은 구현 단계에서 정의) + 정량 승격 게이트 (OQ-019)
- 긴급 청산 스위치(kill-switch) 및 사용자별 손실 한도 장치 필수 (OQ-012/013)

**후속 ADR 후보:**
- 거래소 API Key 저장 상세 표준 — AES-GCM 봉투 암호화 + KMS 연동 패턴 별도 ADR
- ExecutionMode 추상화 세부 — 구현 후 회고 기반 ADR
- Seven-Split 리스크 규칙 엔진 — 손실 제한/긴급 청산 정책 규약화
- 페이퍼 → 실매매 승격 게이트 ADR (OQ-019)
- 실매매 권한/2FA/Gateway 우회 방지 ADR (OQ-013/015/016)
