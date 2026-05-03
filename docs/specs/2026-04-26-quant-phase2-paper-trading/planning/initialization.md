# Quant Phase 2 — Paper Trading
# Spec Initialization

**Date**: 2026-04-26
**Feature name**: quant-phase2-paper-trading
**Phase**: 2 of 3

---

## Phase 1 산출물 링크

| 산출물 | 경로 |
|--------|------|
| Phase 1 Spec | `docs/specs/2026-04-24-quant-crypto-trading/planning/spec.md` |
| Phase 1 ADR | `docs/adr/ADR-0024-quant-service.md` |
| Phase 1 Release Notes | `docs/specs/2026-04-24-quant-crypto-trading/planning/phase1-release-notes.md` |
| Phase 1 Readiness | `quant/docs/phase1-readiness.md` |
| 서비스 코드 루트 | `quant/` |

---

## 사전 합의 결정사항

### OQ-007 시세 이벤트 버스 — Coroutine SharedFlow primary + Kafka fan-out side-effect collector

- **hot path**: in-process `SharedFlow<Tick>` (Strategy Engine, Dashboard, Alert 소비)
- **side-effect collector**: 별도 coroutine이 비동기로 Kafka 토픽 발행 (analytics 등 외부 소비자)
- Kafka publisher bean은 optional (Phase 2 미활성, Phase 3+ 활성)
- 근거: 지연 없는 내부 팬아웃 + 외부 소비 확장성 확보

### OQ-011 거래소 약관 — 검토 완료 (코드 진행)

- 빗썸 약관 직접 검토: 자동매매 명시적 금지 조항 미발견
- Order rate limit 별도 존재 = 자동매매 전제 설계 확인
- 상태: 진행 중으로 두되 코드 블로킹 없음

### OQ-017 KEK 회전 — Phase 2 사이클 내 결정 필요 (open)

- 본 사이클에서 회전 주기, 키 저장소, 롤링 전략 결정 필요

### OQ-018 audit_log 불변성 — Phase 2 사이클 내 결정 필요 (open)

- append-only 보장 방안(WORM 스토리지 / 외부 서명 / 별도 감사 DB) 결정 필요

---

## Phase 2 범위 (In-Scope)

| 컴포넌트 | 설명 |
|----------|------|
| 빗썸 WebSocket Public 시세 구독 | `Flow<Tick>`, 재연결 5 s, 10 s 끊김 시 REST 폴백 |
| `MarketDataHub` | SharedFlow + Kafka fan-out 신설 |
| `SimulatedExchangeAdapter` | 실시간 시세 + 가상 체결, slippage 모델, 부분체결 시뮬 |
| 페이퍼 트레이딩 UseCase | `ExecutionMode=PAPER` 경로 전용 |
| `TelegramBotNotificationSender` | Telegram Bot API REST 호출, 체결/리스크 알림 |
| CircuitBreaker | 거래소 REST/WS 호출 단위, Resilience4j |
| Rate Limiter | per API Key, Redis token bucket 또는 Bucket4j |
| DLQ 활성화 | Kafka consumer 실패 격리 |
| Outbox → Kafka relay | Phase 1 log-only → 실 발행 전환 |
| KEK 회전 정책 | OQ-017 결정 반영 구현 |
| audit_log 불변성 강화 | OQ-018 결정 반영 구현 |
| FE 페이퍼 트레이딩 모니터링 | 현재가, 최근 체결, 호가 흐름 실시간 대시보드 |

## Phase 2 명시적 미포함 (Out-of-Scope)

| 항목 | 예정 페이즈 |
|------|-------------|
| 빗썸 실매매 주문 발송 | Phase 3 |
| 업비트 어댑터 | Phase 3 |
| 글로벌 kill-switch | Phase 3 |
| 손실 한도 / 페이퍼→실매매 승격 게이트 | Phase 3 |
| NetworkPolicy / mTLS | Phase 3 |
| 실매매 2FA Role | Phase 3 |
| 분할 원칙 1·3·4 포트폴리오 차원 (스펙 §15.1 유지) | Phase 3+ |

---

## 미결 사항 (Open Questions)

`context/open-questions.yml` 참조.

- **OQ-P2-001** KEK 회전 주기 및 키 저장소 전략
- **OQ-P2-002** audit_log 불변성 보장 방안
- **OQ-P2-003** SimulatedExchangeAdapter slippage 모델 파라미터
- **OQ-P2-004** Telegram Bot API 알림 Rate Limit 정책
- **OQ-P2-005** MarketDataHub SharedFlow buffer 전략 (DROP_OLDEST vs SUSPEND)
- **OQ-P2-006** Rate Limiter 구현체 선택 (Redis token bucket vs Bucket4j in-process)
- **OQ-P2-007** FE 모니터링 실시간 연결 방식 (SSE vs WebSocket)
