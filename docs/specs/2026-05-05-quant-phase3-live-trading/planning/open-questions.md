# Phase 3 Open Questions — Closure 양식

> 본 문서는 Phase 3 진입 차단 OQ 8 개의 closure 양식.
> 각 OQ 는 사용자/Admin 이 결정해야 하는 정책. 답이 모두 채워지고 ADR-0037 가 Accepted 로 전환되어야 H5 이후 task (TG-P3-09 ~ TG-P3-45) 진행 가능.

## OQ-011 — 거래소 약관 자동매매 허용

**상태**: OPEN
**책임**: 운영자 (4 거래소 약관 검토)

각 거래소의 자동매매(API 주문) 허용 조건과 KYC 등급 / 한도를 확인하고 결정.

| 거래소 | 약관 페이지 (검토 시 갱신) | 자동매매 허용? | 일일 한도 (KRW) | 결론 |
|---|---|---|---|---|
| 빗썸 | https://www.bithumb.com/ | ☐ Yes ☐ No | | |
| 업비트 | https://upbit.com/ | ☐ Yes ☐ No | | |
| Bybit | https://www.bybit.com/ | ☐ Yes ☐ No (한국 IP 가능?) | | |
| OKX | https://www.okx.com/ | ☐ Yes ☐ No (한국 IP 가능?) | | |

**Closure 조건**: 4 거래소 모두 결정.

---

## OQ-012 — 일일 손실 한도 default

**상태**: OPEN
**책임**: 운영자 + 사용자 정책

ADR-0037 spec 의 default `dailyLossLimitKrw=100,000` 검토. 신규 가입 시 이 default 가 적절한지, 사용자가 override 시 상한선이 필요한지.

- Default: ☐ 50,000 ☐ 100,000 (제안) ☐ 500,000 ☐ Other: ___
- 사용자 override 상한선: ☐ 없음 ☐ 1,000,000 ☐ 10,000,000
- override 시 추가 인증: ☐ 2FA only ☐ 2FA + 24h 대기 ☐ Admin 승인

---

## OQ-013 — 글로벌 kill-switch 권한

**상태**: OPEN
**책임**: 운영자

전체 사용자의 실매매를 일시 정지하는 권한 보유자.

- Admin 1 인 단독: ☐ Yes
- Admin 2 인 승인 필요: ☐ Yes (Phase 4 에서?)
- 자동 trigger 조건: ☐ 평가 시간 동안 거래소 reject 비율 X% 이상 ☐ 글로벌 audit chain mismatch ☐ 기타: ___

---

## OQ-014 — Reconcile drift 자동 보정 vs 수동

**상태**: OPEN
**책임**: 운영자 + 보안 검토

거래소 reconciliation 결과 거래소 상태 ↔ 내부 OrderRecord 불일치 발견 시.

- 단순 status 차이 (PENDING → FILLED): ☐ 자동 반영 ☐ 수동 확인
- 수량/가격 mismatch: ☐ 자동 tenant suspend ☐ Admin 수동
- 거래소가 모르는 주문 (LOST): ☐ 6시간 후 자동 LOST 마킹 ☐ Admin 수동

---

## OQ-015 — Gateway 우회 차단

**상태**: OPEN
**책임**: SRE / 보안

Quant API 가 gateway 를 통하지 않는 직접 호출(클러스터 내부 또는 LB bypass)을 막는 정책.

- NetworkPolicy 로 quant Pod 의 ingress 를 gateway namespace 만 허용: ☐ Yes ☐ No
- mTLS 강제 (gateway → quant): ☐ Phase 3 ☐ Phase 4
- 외부 LB → quant 직접 노출: ☐ 절대 불가 (제안) ☐ 조건부 허용

---

## OQ-016 — 2FA seed 분실 복구 절차

**상태**: OPEN
**책임**: 운영자 + 보안

사용자가 TOTP 단말 분실 + 백업 코드 분실 시.

- 백업 코드만으로 복구: ☐ 가능 (8 개 1회용)
- 백업 코드도 분실 시: ☐ 신분증 + 24h 대기 후 Admin 수동 재등록 ☐ 영구 불가 (자기책임)
- Admin 재등록 시 추가 인증: ☐ Admin 1 인 ☐ Admin 2 인 ☐ 외부 본인인증

---

## OQ-019 — Bybit/OKX 한국 사용자 약관

**상태**: OPEN
**책임**: 법무 / 운영자

한국 거주자 / 한국 IP 사용자의 Bybit / OKX 사용 가능 여부 (지역 제한).

- Bybit 한국 사용자 약관: 검토 결과 ___
- OKX 한국 사용자 약관: 검토 결과 ___
- VPN 통한 사용 차단: ☐ 운영자 책임 (사용자 자기책임 명시) ☐ 플랫폼이 IP 검사

---

## OQ-020 — Audit chain root hash 외부 anchoring

**상태**: OPEN
**책임**: 운영자 + 보안

Phase 4 검토 항목. 일일 chain tip hash 를 외부 timestamp authority 에 anchoring 하여 내부 변조도 검출 가능하게 할지.

- Phase 3 GA 까지: ☐ 내부 chain only ☐ 외부 anchoring 까지
- Anchoring 대상: ☐ 외부 TSA (RFC 3161) ☐ 공개 블록체인 (Bitcoin OP_RETURN, Ethereum 등) ☐ 둘 다
- 비용 부담: 사용자당 연 ~1,000 KRW 추정 (블록체인 fee)

---

## Closure 진행 (운영자가 갱신)

| OQ | 상태 | Closure 일자 | 결정자 | 결론 요약 |
|---|---|---|---|---|
| OQ-011 | OPEN | | | |
| OQ-012 | OPEN | | | |
| OQ-013 | OPEN | | | |
| OQ-014 | OPEN | | | |
| OQ-015 | OPEN | | | |
| OQ-016 | OPEN | | | |
| OQ-019 | OPEN | | | |
| OQ-020 | OPEN | | | |

**모두 CLOSED 시 ADR-0037 → Accepted 전환** 후 TG-P3-09 ~ 진행.
