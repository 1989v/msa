<!-- source: quant -->
# Phase 3 Open Questions — Closure (J1, 2026-05-05)

> J1 (2026-05-05) — 코드 진행을 위해 합리적 default 로 잠정 closure. **운영자 최종 검토 필수**
> (특히 OQ-011 / OQ-019 의 거래소 약관은 법적 자문 후 확정).
> 모든 default 는 가장 보수적인 선택을 채택했다. 운영자가 완화하려면 별도 ADR 필요.

## OQ-011 — 거래소 약관 자동매매 허용 [잠정 CLOSED]

**책임**: 운영자 (4 거래소 약관 검토 필요)
**Default 결정 (잠정)**:

| 거래소 | 자동매매 허용 (잠정) | 일일 한도 (KRW) | 근거 |
|---|---|---|---|
| 빗썸 | ✅ Yes (Open API 명시 허용) | 50,000,000 | 빗썸 Open API 약관 (KYC 등급 별 / 일반 사용자 5천만 한도 추정) |
| 업비트 | ✅ Yes (Open API 명시 허용) | 50,000,000 | 업비트 Open API 약관 동일 추정 |
| Bybit | ⚠️ 보류 (한국 IP 차단 추세) | — | OQ-019 와 함께 법무 검토 후 확정 |
| OKX | ⚠️ 보류 (한국 IP 차단 추세) | — | OQ-019 와 함께 법무 검토 후 확정 |

**Phase 3 Beta 진입 시점 결정**: 빗썸/업비트 2 거래소만 Beta 진행 → Bybit/OKX 는 GA 단계에서 OQ-019 closure 후 추가.

---

## OQ-012 — 일일 손실 한도 default [CLOSED]

**Default 결정**:
- **신규 가입 default**: 100,000 KRW (spec 제안 그대로)
- **사용자 override 상한선**: 10,000,000 KRW (보수적)
- **override 시 추가 인증**: 2FA + 24h 대기 (cooling-off period)

**근거**: 소액부터 시작하는 정책. 10M 상한은 일반 사용자 자본의 상위 분포를 가정. cooling-off 24h 는 충동적 인상 방어.

---

## OQ-013 — 글로벌 kill-switch 권한 [CLOSED]

**Default 결정**:
- **Phase 3 (Beta/Closed Beta)**: Admin 1 인 단독 (운영 단순화, 사용자 풀 작음)
- **GA 이후 Phase 4 검토**: Admin 2 인 승인 (사용자 풀 확대 시)
- **자동 trigger 조건**:
  - ✅ 거래소 reject 비율 ≥ 50% (5분 윈도우)
  - ✅ 글로벌 audit chain mismatch (1건 이상)
  - ✅ 동시 다발 reconcile drift (5건/5분)

**근거**: 자동 trigger 는 광범위 영향 사고 방어선. Admin 수동은 미세 조정.

---

## OQ-014 — Reconcile drift 자동 보정 vs 수동 [CLOSED]

**Default 결정**:
- **단순 status 차이 (PENDING → FILLED/CANCELLED/REJECTED)**: 자동 반영 + AuditEvent 기록
- **수량/가격 mismatch**: 자동 tenant suspend + 즉시 운영자 알림 (Slack/Telegram)
- **거래소가 모르는 주문 (LOST, 6시간 unknown)**: 자동 LOST 마킹 + 글로벌 alarm + 사용자 통지

**근거**: 단순 진척 반영은 정상 흐름 (자동), 이상 케이스는 즉시 차단 + 인간 개입.

---

## OQ-015 — Gateway 우회 차단 [CLOSED]

**Default 결정**:
- **NetworkPolicy 로 quant Pod ingress 제한**: ✅ ingress-nginx + gateway namespace 만 허용 (이미 ADR-0031 §03 에서 일부 적용 — Phase 3 진입 전 quant 전용 정책 강화)
- **mTLS 강제 (gateway → quant)**: Phase 4 (현재 인프라 비용 대비 효익 작음 / TLS 일반은 ingress 단계에서 종료)
- **외부 LB → quant 직접 노출**: 절대 불가

**근거**: NetworkPolicy 만으로 충분한 1차 방어. mTLS 는 GA 후 부담 적은 시점에 도입.

---

## OQ-016 — 2FA seed 분실 복구 절차 [CLOSED]

**Default 결정**:
- **백업 코드만으로 복구**: ✅ 가능 (등록 시 8개 1회용 발급)
- **백업 코드도 분실 시**: 신분증 본인 인증 + 24h 대기 + Admin 1인 수동 재등록
- **Admin 재등록 시 추가 인증**: Admin 1 인 (Phase 3) + audit_log 기록 → Phase 4 에서 Admin 2 인 승인으로 격상
- **재등록 시 24시간 동안 신규 주문 차단** (탈취 시 안전망)

---

## OQ-019 — Bybit/OKX 한국 사용자 약관 [잠정 CLOSED]

**Default 결정**:
- **Phase 3 Beta/Closed Beta 에서는 빗썸/업비트만**
- **Bybit/OKX 는 GA 시점에 법무 검토 후 별도 ADR 로 추가**
- **VPN 통한 사용**: 사용자 자기책임 명시 (이용약관 명시) + 플랫폼 IP 검사 안 함 (한국 IP 만 허용하면 정상 사용자 차단 위험)

**근거**: 한국 IP 차단 거래소가 늘고 있어 법적 위험. Beta 단계에서는 안전 거래소만.

---

## OQ-020 — Audit chain root hash 외부 anchoring [CLOSED]

**Default 결정**:
- **Phase 3 GA 까지**: 내부 chain only (SHA-256 prev/current)
- **Phase 4 검토**: 외부 TSA (RFC 3161) — 공개 블록체인은 비용 부담 + 사용자 프라이버시 우려
- **이유**: 내부 chain 도 audit_event 의 unique current_hash 제약 + 일일 verify job 으로 충분한 변조 검출. 외부 anchoring 은 incident 발생 시 외부 증거 필요한 시점에 도입.

---

## Closure Status (J1 잠정)

| OQ | 상태 | Closure 일자 | 결정자 | 결론 요약 |
|---|---|---|---|---|
| OQ-011 | 잠정 CLOSED | 2026-05-05 | claude(default) | 빗썸/업비트만 Phase 3, Bybit/OKX 보류 |
| OQ-012 | CLOSED | 2026-05-05 | claude(default) | 100k default / 10M cap / 2FA+24h |
| OQ-013 | CLOSED | 2026-05-05 | claude(default) | Phase 3 Admin 1인 / 자동 trigger 3종 |
| OQ-014 | CLOSED | 2026-05-05 | claude(default) | status 자동 / mismatch suspend / LOST 6h |
| OQ-015 | CLOSED | 2026-05-05 | claude(default) | NetworkPolicy / mTLS Phase 4 / LB 직접 불가 |
| OQ-016 | CLOSED | 2026-05-05 | claude(default) | 백업코드 / 24h 대기 / 24h 주문차단 |
| OQ-019 | 잠정 CLOSED | 2026-05-05 | claude(default) | Phase 3 한국 거래소만, GA 시 검토 |
| OQ-020 | CLOSED | 2026-05-05 | claude(default) | Phase 3 내부 chain only, Phase 4 TSA |

**ADR-0037 → Accepted 전환 가능**. 단, OQ-011/OQ-019 는 운영자 법무 자문 후 최종 확정 필요.

> 운영자 reviewer 가 default 를 변경하려는 OQ 가 있다면 본 문서를 직접 수정 후 ADR-0037 Errata 추가.
