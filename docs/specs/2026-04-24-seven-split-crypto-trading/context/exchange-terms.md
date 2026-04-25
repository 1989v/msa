# 거래소 OpenAPI 자동매매 약관 검토 (Preflight P.0 / OQ-011)

**상태**: ⚠ **사용자 수동 확인 필요** (자동 fetch 차단됨)
**대상**: 빗썸 / 업비트 OpenAPI 자동매매 허용 여부 + Rate Limit + API Key 관리 의무
**작성일**: 2026-04-26
**연관 OQ**: OQ-011 (exchange-terms, high)

---

## 검토 범위

Phase 1 백테스트는 거래소 호출 없음 → 본 검토는 **Phase 2 페이퍼 트레이딩(WebSocket 시세 구독)** 및 **Phase 3 실매매(주문 발송)** 진입 전 종결 필수.

**원칙적으로 본인 1인 자기 자본 자동매매는 양 거래소 모두 허용 사례가 다수**이지만, 본 검토 시점(2026-04-26) 약관 원문 확인 + 변경 이력 추적이 필요하다.

---

## 빗썸 (Bithumb) 체크리스트

확인할 페이지:
- API Docs: https://apidocs.bithumb.com/
- 일반 이용약관: https://www.bithumb.com/customer-support/info-userguide/terms-of-use
- API 이용약관 (별도 존재 시): API Docs 내 Policy 섹션

| 항목 | 확인 결과 | 출처 (URL + 조항 번호) |
|---|---|---|
| 개인 자동매매 허용 여부 | TBD | |
| 상업적 사용 / 재판매 제한 | TBD | |
| Public REST Rate Limit | TBD (관행: 약 120 req/10s 추정) | |
| Private REST Rate Limit | TBD | |
| WebSocket 동시 구독 한도 | TBD | |
| API Key 관리 의무 (IP whitelist 등) | TBD | |
| API Key 노출 시 책임 / 면책 조항 | TBD | |

---

## 업비트 (Upbit) 체크리스트

확인할 페이지:
- API Docs: https://docs.upbit.com/
- Open API 이용약관: https://upbit.com/open_api_agreement
- 두나무 OpenAPI 정책: https://upbit.com/service_center/notice

| 항목 | 확인 결과 | 출처 (URL + 조항 번호) |
|---|---|---|
| 개인 자동매매 허용 여부 | TBD | |
| 상업적 사용 / 재판매 제한 | TBD | |
| REST Rate Limit (요청 단위) | TBD (관행: 8 req/s 추정) | |
| WebSocket 연결 한도 | TBD | |
| JWT 토큰 갱신 주기 / 만료 정책 | TBD | |
| API Key 관리 의무 | TBD | |
| 약관 변경 통지 방식 | TBD | |

---

## 검토 절차 (사용자 수행)

1. 위 7-8개 항목을 양 거래소 약관에서 직접 확인 → "확인 결과" / "출처" 컬럼 채우기
2. 결과를 본 문서에 커밋
3. **`open-questions.yml` OQ-011 status: open → closed** 갱신 + decisions_log 추가
4. 만약 약관 위반 / 모호한 조항 발견 시:
   - 해당 거래소 지원에 문의 → 답변 캡처 보존
   - 위반 위험이 있다면 ADR-0024 Status를 Proposed → On Hold 변경
   - Phase 2/3 착수 보류

---

## 자동 fetch 결과 (참고)

2026-04-26 시도:
- `apidocs.bithumb.com/docs/policy` → 404
- `docs.upbit.com/docs/user-request-guide` → 가이드 본문 미접근, 메뉴 링크만
- `upbit.com/open_api_agreement` → 본문 추출 실패 (헤더만 노출)
- `apidocs.bithumb.com/` → 메인 페이지, 정책 섹션 위치 미특정

→ **브라우저 또는 cURL로 직접 약관 페이지 방문 후 본 문서 채워야 한다.**

---

## Phase 1 영향

- Phase 1 (백테스트만)은 거래소 API 호출 없음 → 본 검토 미완료여도 Phase 1 출고 가능
- **Phase 2 진입 전 본 문서 closed 필수**
- spec.md §6 Phase 표 + ADR-0024 Consequences에 "Phase 2 게이트 = 본 문서 closed" 명시 권장
