# ADR-0037 — Quant Phase 3 실매매 (Live Trading)

- 상태: Proposed (OQ-011 ~ OQ-020 closure 시 Accepted 전환)
- 일자: 2026-05-05
- 컨텍스트: ADR-0024 (Quant 서비스), ADR-0033 (통합 플랫폼), ADR-0036 (Phase 2 cross-exchange)
- 관련 스펙: [docs/specs/2026-05-05-quant-phase3-live-trading/](../specs/2026-05-05-quant-phase3-live-trading/planning/spec.md)

## Context

Phase 1 (백테스트) → Phase 2 (페이퍼 + cross-exchange) 완료 후, Phase 3 은 사용자가 실제 자본을 거래소에 주문하는 단계로 진입한다. 이 단계는 Phase 1/2 와 위험 등급이 질적으로 다르다 — 잘못된 1줄의 코드가 사용자에게 회복 불가능한 자본 손실을 일으킬 수 있다.

따라서 Phase 3 은 단순한 기능 추가가 아니라, **사고 발생 가능성을 0 에 수렴시키기 위한 다층 방어체계** + **사고 발생 후 ≤200ms 내 차단할 수 있는 제어판** 의 조합이다.

## Decision

### D-1. 4단계 게이트 + 3-레벨 Kill-Switch + 2FA + Audit Chain 동시 채용

```
[게이트] live-mode → kill-switch (G/T/S) → risk-limit (loss/vol/single)
[제어판] global / tenant / strategy kill-switch (Redis ≤200ms)
[인증] 2FA (TOTP RFC 6238) 강제 적용 — live-mode 토글 / 한도 변경 / kill-switch 해제
[감사] hash chain (SHA-256, prev_hash → current_hash) — 일일 verify
```

**Why all 4**: 단일 방어선만으로는 부족하다 — 게이트가 잘못 평가될 수 있고, kill-switch 가 늦게 반영될 수 있고, 2FA 가 우회될 수 있다. 4개 layer 가 동시에 깨질 확률 ≪ 1개 layer 깨질 확률.

### D-2. 실거래소 4종 (빗썸/업비트/Bybit/OKX)

- 빗썸/업비트: 한국 사용자 주력
- Bybit/OKX: 글로벌 (한국 IP 접근 가능 거래소). 라인업 4종은 사용자 선택지를 보장하면서, 어댑터 별 RateLimiter / 서명 알고리즘 / nonce 정책 차이를 일관 인터페이스(`LiveExchangeAdapter`)로 추상화.

### D-3. Audit Chain (단순 append-only 가 아닌 hash chain)

각 AuditEvent 의 `current_hash = SHA-256(prev_hash || canonical(payload) || occurred_at)`. 변조 시 chain 이 깨지므로 발견 가능. Phase 4 에서 외부 timestamp authority 에 일일 root hash anchoring 검토 (OQ-020).

### D-4. Beta → Closed Beta → GA 순차 출시

- Beta: Admin 본인 1계정 1주 monitoring
- Closed Beta: 신청자 5명, 일일 한도 100,000 KRW 강제
- GA: 전체 open

각 단계에서 incident 1건 이상 발생 시 한 단계 후퇴.

### D-5. Kill-Switch 자동 trigger

- 일일 손실 한도 초과
- 일일 거래량 한도 초과
- 거래소 reject burst (15초 내 5건)
- Reconcile drift mismatch (수량/가격)

자동 trigger 는 사용자 명시 해제 (2FA) 까지 OFF 유지.

## Consequences

### Positive

- 실매매 단계의 위험을 다층 방어로 압축
- 모든 주문이 audit chain 으로 검증 가능 → 분쟁 시 객관적 증거
- ≤200ms kill-switch 반영 → 폭주 시 빠른 차단
- 4개 거래소 지원 → 사용자 선택폭

### Negative

- 구현 복잡도 ↑ 약 17주 추정 (Phase 1/2 합산보다 큼)
- Redis dual write + MySQL append 일관성 책임이 코드 곳곳에 흩뿌려짐
- 거래소 4종의 서명/nonce/rate 정책 차이는 어댑터마다 재작업
- 7년 audit 보존 → S3/GCS storage cost (사용자당 연 ~50MB 추정)

### Neutral

- 페이퍼 모드 코드 (Phase 2) 와 90% 공유 — `TradeMode` enum 으로 분기 충분
- 4개 거래소 모두 paper-mode 로 먼저 통합 후 live 로 승격 (Phase 2 와 동일 패턴)

## Alternatives Considered

### A-1. 거래소 1개부터 (빗썸만)

- 장점: 작게 시작
- 단점: 사용자 선택지 제약 → Phase 4 에서 결국 추가하므로 Phase 3 에 함께 검증

### A-2. Kill-Switch 1-레벨 (글로벌만)

- 장점: 단순
- 단점: 사용자가 자기 strategy 1개만 끄고 싶을 때 글로벌 끌 수 없음 → 3-레벨 필수

### A-3. Audit chain 대신 단순 append-only

- 장점: 구현 단순
- 단점: DB 운영자가 변조 가능. 7년 보존하면서 변조 검출 불가. → chain 채택

### A-4. 2FA 없이 JWT 만

- 장점: UX 단순
- 단점: 토큰 탈취 시 즉시 실 자본 손실. → 2FA 필수

## Open Questions (Phase 3 진입 차단 — closure 필수)

- OQ-011 거래소 약관 자동매매 허용 (4 거래소 각각)
- OQ-012 일일 손실 한도 default 값
- OQ-013 글로벌 kill-switch 권한 (1인 vs 2인 승인)
- OQ-014 reconcile drift 자동 보정 vs 수동
- OQ-015 Gateway 우회 차단
- OQ-016 2FA seed 분실 복구 절차
- OQ-019 Bybit/OKX 한국 사용자 약관
- OQ-020 Audit root hash 외부 anchoring

## Roll-out

| 단계 | 조건 | 시기 |
|---|---|---|
| ADR Accepted | OQ closure | TBD |
| 도메인+보안 | TG-P3-04 ~ TG-P3-12 | +3주 |
| Kill-Switch+Risk | TG-P3-13 ~ TG-P3-18 | +1주 |
| 어댑터 4종 | TG-P3-19 ~ TG-P3-25 | +3주 |
| 라이프사이클+Audit | TG-P3-26 ~ TG-P3-33 | +2.5주 |
| API+FE+Obs | TG-P3-34 ~ TG-P3-42 | +3주 |
| Beta → GA | TG-P3-43 ~ TG-P3-45 | +4주 |
| **총** | — | **~17주** |

## References

- [ADR-0024 quant-service](ADR-0024-quant-service.md)
- [ADR-0033 quant-unified-platform](ADR-0033-quant-unified-platform.md)
- [ADR-0036 quant-phase2-cross-exchange](ADR-0036-quant-phase2-cross-exchange.md)
- [ADR-0027 OCI Vault KEK envelope encryption](ADR-0027-oci-vault-kek-envelope-encryption.md)
- [Phase 3 Spec](../specs/2026-05-05-quant-phase3-live-trading/planning/spec.md)
- [RFC 6238 — TOTP](https://datatracker.ietf.org/doc/html/rfc6238)
- [Bybit V5 API](https://bybit-exchange.github.io/docs/v5/intro)
- [OKX V5 API](https://www.okx.com/docs-v5/en/)
