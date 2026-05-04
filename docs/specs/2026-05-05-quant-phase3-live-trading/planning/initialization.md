# Quant Phase 3 — Live Trading Initialization

> 생성: 2026-05-05
> 상태: Draft
> 선행 ADR: [ADR-0024](../../../adr/ADR-0024-quant-service.md), [ADR-0033](../../../adr/ADR-0033-quant-unified-platform.md), [ADR-0036](../../../adr/ADR-0036-quant-phase2-cross-exchange.md)
> 본 ADR: [ADR-0037](../../../adr/ADR-0037-quant-phase3-live-trading.md) (생성 예정)

## Mission

Phase 1 (백테스트) → Phase 2 (페이퍼 트레이딩 + cross-exchange) 이후, **실제 주문이 실거래소에서 실행되는 모드**로 진입한다. 자본/사용자/플랫폼 모두에 대해 **돌이킬 수 없는 사고**가 가능한 단계이므로, **사고 발생 시 즉시 차단할 수 있는 제어판** 과 **사고가 일어나지 않게 막는 게이팅** 을 동시에 갖춰야 한다.

## Scope (P3 스코프)

### IN-SCOPE

1. **실거래소 통합** (`LiveExchangeAdapter`)
   - 빗썸 (이미 Phase 2 페이퍼 어댑터 보유) — JWT(HS256) 서명 (ADR-0024 Errata)
   - 업비트 — JWT 서명 (RS256/Open API key)
   - **Bybit** — V5 REST API + HMAC-SHA256 서명
   - **OKX** — V5 REST API + HMAC-SHA256 + Passphrase
   - 모든 어댑터: Resilience4j RateLimiter (거래소별 RPS 한도 준수)
2. **Kill-Switch** (글로벌 / per-tenant / per-strategy)
   - 글로벌: 플랫폼 운영자가 단일 액션으로 모든 실 주문 중단
   - per-tenant: 사용자가 자기 계정 전체 중단
   - per-strategy: 사용자가 특정 strategy 만 중단
   - 상태는 Redis (저지연) + MySQL (감사) 이중 보관
3. **2FA (실매매 진입 게이트)**
   - TOTP (Google Authenticator/Authy 호환) — RFC 6238
   - 강제 적용 단계: live-trading 활성화 토글, 일일 한도 변경, kill-switch 해제
4. **Risk Limit & Circuit Breaker**
   - 일일 손실 한도 (per-tenant configurable)
   - 일일 거래량 한도
   - 단일 주문 최대 금액
   - 레이트가 한도 초과 시 자동 kill-switch trigger
5. **주문 reconciliation**
   - 매 5분 간격으로 거래소 주문 상태 ↔ 내부 `OrderRecord` 정합 검증
   - drift 발견 시 alarm + audit_log
6. **Audit Chain** (Phase 2 outbox 위에 hash chain)
   - 모든 실주문 / kill-switch 토글 / 한도 변경 이벤트는 prev_hash → current_hash 체인으로 변조 방지
   - 주기적 chain 검증 job (1일 1회)

### OUT-OF-SCOPE (Phase 4+)

- 마진/선물 거래 (현물만)
- 자동 헤징 / 차익거래 자동 실행
- 다중 사용자 (B2B SaaS) 권한 분리
- 마켓메이킹

## 제약 / 비기능 요구

| 항목 | 요구 |
|---|---|
| 가용성 | live-trading 활성 사용자에 대해 99.9% (월 ~43분 다운) |
| 지연 (주문 round-trip) | p99 < 1.5s (네트워크 RTT 포함) |
| Kill-switch 반영 | 토글 후 ≤ 200ms 내 모든 신규 주문 차단 |
| 감사 보존 | 7년 (자본시장법 수준) — audit_log 별도 storage |
| 보안 | API key는 OCI Vault KEK 로 envelope encryption (Phase 2 동일) |

## Risk

- **돈을 날릴 수 있다** — Phase 1/2 와 비교 불가
- 거래소 약관 위반 (자동매매 미승인 계정) → Phase 3 진입 전 OQ-011 필수 확정
- 잘못된 주문 / 무한 루프 → Risk Limit + Kill-Switch 가 마지막 방어선
- 공격자가 사용자 계정 탈취 → 2FA + IP 화이트리스트(선택)

## Open Questions (P3 진입 전 closure 필요)

- OQ-011 거래소 약관 자동매매 허용 (각 거래소별)
- OQ-012 일일 손실 한도 default 값 / 사용자별 override 정책
- OQ-013 글로벌 kill-switch 권한 정책 (Admin 1인 / 2인 승인?)
- OQ-014 reconcile drift 발생 시 자동 보정 vs 수동 개입
- OQ-015 Gateway 우회 차단 (Quant API 직접 호출 금지)
- OQ-016 2FA seed 분실 시 복구 절차
- OQ-019 Bybit/OKX 한국 사용자 약관 (지역 제한 검증)
- OQ-020 Audit chain root hash anchoring (외부 timestamp authority?)

## 산출물

- `spec.md` — Phase 3 기술 스펙
- `tasks.md` — 구현 task 목록
- `ADR-0037-quant-phase3-live-trading.md` — 아키텍처 결정 기록
