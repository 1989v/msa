# Quant Phase 2 Release Notes

**릴리즈 일자**: 2026-04-27
**스펙**: [quant-phase2-paper-trading](.)
**ADR**: [ADR-0024](../../../adr/ADR-0024-quant-service.md) (Errata) + [ADR-0025](../../../adr/ADR-0025-market-data-hub.md) + [ADR-0026](../../../adr/ADR-0026-audit-log-immutability.md) + [ADR-0027](../../../adr/ADR-0027-oci-vault-kek-envelope-encryption.md) (모두 Proposed)

---

## 요약

Phase 1 백테스트 엔진 위에 **실시간 시세 + 가상 체결 + 보안 인프라**를 추가한 Phase 2 (페이퍼 트레이딩) 릴리즈. 실거래(Phase 3) 진입 전 안전판 역할.

**16/16 Task Group 완료** (TG-P2-01 ~ TG-P2-16).

---

## 구현 범위 (Functional Requirements)

### 시세 수신 / Hub (FR-P2-WS / FR-P2-HUB)
- ✅ **FR-P2-WS-01~06** — BithumbWebSocketSubscriber (reactor-netty), 5s 재연결 지수 백오프, 10s 단절 시 REST 폴백, 도메인 이벤트 발행, INV-P2-08 Tick.source enum
- ✅ **FR-P2-HUB-01~05** — MarketDataHub SharedFlow primary + 옵셔널 Kafka fan-out collector + latestTick 캐시

### 페이퍼 트레이딩 (FR-P2-SIM / FR-P2-USE)
- ✅ **FR-P2-SIM-01~06** — PaperExchangeAdapter + FixedSlippageModel(0.05%) + V003 PaperAccount + paper- prefix
- ✅ **FR-P2-USE-01~04** — Start/Stop/Pause/Resume PAPER UseCase, ExecutionMode=PAPER 분기, BacktestResult 스키마 재사용

### 알림 (FR-P2-NOTIF)
- ✅ **FR-P2-NOTIF-01~06** — TelegramBotNotificationSender (WebClient + Coroutine), 우선순위 큐 (CRITICAL/RISK/INFO), per-chat 1msg/s, 5xx 3회 backoff, 실패 audit

### 회복 탄력성 (FR-P2-RES)
- ✅ **FR-P2-RES-01~04** — Resilience4j CB 3종, Redis Lua token bucket, Kafka DLQ 3회 재시도, Outbox → Kafka 활성

### 보안 (FR-P2-SEC)
- ✅ **FR-P2-SEC-01** — KeyManagementService Port + OciVault/LocalFile/Fake Adapter + DEK 캐시 stale-on-error
- ✅ **FR-P2-SEC-02** — Envelope encryption + V002 + LazyReencryptionJob (optimistic lock)
- ✅ **FR-P2-SEC-03** — audit_log quant_audit DB 분리 + RBAC SOP + prev_hash chain + Kafka mirror

### FE / SSE (FR-P2-FE)
- ✅ **FR-P2-FE-01~06** — PaperStreamSseController (SseEmitter), Gateway long-lived 라우트, FE PaperTradingMonitorPage + EventSource 5s exp backoff 재연결

### 관측 (FR-P2-OBS)
- ✅ Phase 1 5종 + Phase 2 신규 12종 메트릭 노출:
  - `quant_market_tick_received_total{exchange,symbol,source}`
  - `quant_market_hub_dropped_total{reason}`, `_kafka_publish_failure_total`
  - `quant_ws_reconnect_attempts_total{exchange,outcome}`, `_connection_state{exchange}`
  - `quant_kek_cache_{hits,misses,stale}_total`, `_rotation_lazy_reencrypt_total`
  - `quant_audit_log_appended_total`, `_hash_chain_invalid_total`
  - `quant_notification_send_latency_seconds{channel,priority}`, `_failure_total`, `_queue_depth`
  - `quant_outbox_publish_total{topic}`, `_failure_total`

---

## 명시적 미포함 (Out of Scope, Phase 3+)

- 빗썸/업비트 실매매 주문 발송
- 업비트 어댑터
- 글로벌 kill-switch (전 테넌트 일괄 중지)
- 손실 한도 / 페이퍼 → 실매매 정량 승격 게이트
- NetworkPolicy / mTLS (Gateway 우회 방지)
- 실매매 Role + 2FA / step-up auth
- 분할 원칙1·3·4 (포트폴리오 차원, AccountPortfolio)
- 마진/선물/파생 (SpotOrderType sealed로 컴파일 차단)

---

## 기술 스택 (Phase 1 대비 추가)

### 백엔드
- Resilience4j 2.3.0 (CircuitBreaker + Kotlin coroutine 통합)
- OCI Java SDK 3.46.0 (Vault KMS encrypt/decrypt)
- Nimbus Jose JWT 9.40 (HS256, 빗썸/업비트 JWT 인증 후속용)
- Caffeine 3.1.8 (DEK 캐시 TTL + stale-on-error)
- Reactor Netty (WebSocketClient)
- Spring Kafka (Outbox relay)
- Spring Boot Data Redis (Lua token bucket)

### 인프라 (Phase 1 재사용 + 신규)
- Phase 1 MySQL/Kafka/ClickHouse/Redis 그대로
- ClickHouse 신규 DB: `quant_audit` (Phase 1 `quant` 와 격리)
- OCI Vault Service (Always Free Tier, 운영 KEK)

### 프론트엔드 (Phase 1 PWA 확장)
- EventSource (SSE) 클라이언트
- usePaperStream hook + PaperStreamClient (5s exp backoff 재연결)

### Gateway
- 신규 라우트: `quant-paper-sse` (response-timeout=0)
- 기존 short-lived REST 라우팅 영향 0

---

## 출고 산출물

### 코드 (Phase 1 대비 증가분)
- 백엔드: 약 30+ Kotlin 파일 (resilience, security, notification, audit, paper, presentation)
- 프론트엔드: 6 TSX/TS 파일 (sse client + hook + 4 components/page)
- DB: V002 (envelope) + V003 (paper_account)
- ClickHouse: quant_audit V001 (audit_log)
- K8s: k3s-lite quant-phase2.yaml 패치

### 테스트
- 도메인 35 tests (Phase 1 유지)
- 신규 Phase 2 단위 50+ specs (KMS / Envelope / Audit / Telegram / MarketHub / etc)
- Testcontainers IntegrationSpec 분리 (Docker 환경 opt-in)

### 문서
- 4 신규 ADR (0025/0026/0027 + 0024 Errata)
- spec.md / requirements.md / test-quality.md / tasks.md (16 TG)
- open-questions.yml (OQ-P2-001~008 + Phase 1 OQ 재사용)
- key-rotation-sop.md / audit-rbac-sop.md
- phase2-readiness.md (체크리스트)

---

## 알려진 제약 / TODO (Phase 3 이월)

| # | 영역 | 제약 / TODO |
|---|---|---|
| 1 | 빗썸 ticker JSON 파싱 | stub — Phase 3 실매매 진입 전 실 schema 정확 매핑 |
| 2 | WS gzip + heartbeat | 빗썸 사양 실측 후 보강 |
| 3 | StartPaperTradingUseCase long-running | stub — SSE 통합과 함께 활성화 |
| 4 | LazyReencryptionJob 단위 테스트 | stub repository 미스매치 → IntegrationSpec 분리 |
| 5 | first-message JWT (SSE) | query param `authToken` fallback — Phase 3 정식 wire-up |
| 6 | Bot Token KMS unwrap | env var 직접 — NotificationTarget repository + KMS 통합 |
| 7 | FE slot/order SSE 이벤트 → state | tick만 — 도메인 이벤트 SSE 송신 wire-up |
| 8 | 다중 거래쌍 탭 (FE) | BTC_KRW 고정 — 탭 전환 + 다중 SSE 구독 |
| 9 | Phase 1 envelope 데이터 마이그레이션 | dek_wrapped IS NULL fallback skip — 일회성 마이그레이션 스크립트 |
| 10 | OCI Vault key version → INT 매핑 | Math.abs(hashCode()) — 매핑 테이블 신설 ADR |
| 11 | Audit Kafka mirror | best-effort — ETL 일관성 강화 |
| 12 | Topic 정밀 매핑 | generic quant.events.v1 — eventType별 매핑 |
| 13 | Bucket4j 도입 | Phase 2는 Lua script 직접 — Phase 3 검토 |
| 14 | LazyReencryption 등 통합 테스트 | IntegrationSpec, Docker 환경 1회 수동 |

---

## Phase 3 진입 게이트

| OQ | 영역 | 우선순위 |
|---|---|---|
| OQ-011 | 빗썸/업비트 약관 자동매매 허용 (사용자 수동 검토) | high |
| OQ-012 | 유저별 손실 한도 정의 + 강제 시점 | high |
| OQ-013 | 글로벌 kill-switch + 2FA | high |
| OQ-014 | 주문 reconcile (timeout / 미확정 주문 재조회) | high |
| OQ-015 | Gateway 우회 차단 (NetworkPolicy / mTLS / X-Auth-Signature) | high |
| OQ-016 | 실매매 Role + step-up auth (2FA) | high |
| OQ-019 | 페이퍼 → 실매매 정량 승격 게이트 (체결 수 / MDD / 오류 임계) | high |
| OQ-P2-008 | PAPER vs 실 시장 slippage 격차 검증 (p95 ≤ 0.1%) | high |

---

## 회고

Phase 2는 **페이퍼 트레이딩 hot path + 보안 인프라**를 함께 도입했다. 핵심 기술 결정:
- SharedFlow primary + Kafka fan-out: 단일 인스턴스 latency 최소 + 미래 확장 여지
- OCI Vault Free Tier: 클러스터 리소스 부담 0 + 보안 정석
- audit chain: ClickHouse RBAC + prev_hash 체인 + Kafka mirror

Phase 2 출고 후:
- N주 운용 → OQ-P2-008 slippage 측정
- 약관 검토 (OQ-011) closed
- Docker 환경 통합 E2E 1회 수동
- 위 3개 통과 시 ADR-0024/0025/0026/0027 Status를 Proposed → Accepted 일괄 승격

그 후 Phase 3 사이클 진입 (실매매 + 업비트 + kill-switch + 2FA).
