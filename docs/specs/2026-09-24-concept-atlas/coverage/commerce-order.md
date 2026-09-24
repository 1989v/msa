# 주문 · 결제 · 정산 — 커버리지 체크리스트

원천:
- 볼트 `1989v/claude/artifact/commerce-order-payment-map.md` §01–10 (부록 「1989v.com commerce」 는 코드 참조로만)
- 레포 `docs/specs/2026-09-24-commerce-enterprise/spec.md` (SR-0 ~ SR-14, 용어 표)
- 레포 `docs/specs/2026-04-07-inventory-fulfillment/spec.md` (이행 상태 머신)
- ADR-0011 · ADR-0013 · ADR-0032 · ADR-0099
- 코드 `order/` · `payment/` · `fulfillment/` · `settlement/` · `seller/` · `common/messaging/outbox`
- 분야 표준 — 결제 수단 · 카드 거래 구조(발급사 · 매입사 · VAN) · 이행(3PL · 송장) · 클레임(반품 · 교환) · 회계(복식부기 · 계정과목 · 시산표 · 세금계산서) · 마켓플레이스 지표(GMV · 테이크레이트)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| commerce-order | 주문 · 결제 · 정산 | 주문·결제·정산 지도 §01 · ADR-0099 | placed |
| ord-order-domain | 주문 | 주문·결제·정산 지도 §02 | placed |
| ord-transaction-modeling | 거래 모델링 | 주문·결제·정산 지도 §01~02 | placed |
| ord-three-timelines | 세 시간축 (주문 · 이행 · 정산 시점) | 주문·결제·정산 지도 §01 | placed |
| ord-reversal-by-phase | 시점별 되돌리기 (무효 · 환불 · 차감) | 주문·결제·정산 지도 §01 | placed |
| ord-separate-state-machines | 상태 머신 분리 (주문 · 결제 · 이행 · 클레임) | 주문·결제·정산 지도 §02 · commerce-enterprise SR-2 | placed |
| ord-order-state-machine | 주문 상태 머신 | 주문·결제·정산 지도 §02 · commerce-enterprise SR-2 · 코드 | placed |
| ord-partner-confirmation | 파트너 확정 대기 | 주문·결제·정산 지도 §02 | placed |
| ord-line-status | 주문 라인 상태 (부분 취소 · 구매 확정) | commerce-enterprise SR-2 · 코드 | placed |
| ord-transition-guard | 전이 가드 (도메인 메서드) | 주문·결제·정산 지도 §02 · 코드 | placed |
| ord-status-history | 상태 전이 이력 | 주문·결제·정산 지도 §02 · commerce-enterprise SR-2 · 코드 | placed |
| ord-impossible-state-combination | 표현할 수 없는 상태 조합 | 주문·결제·정산 지도 §02 | placed |
| ord-order-sheet | 주문서 · 금액 계산 | 주문·결제·정산 지도 §03 · commerce-enterprise SR-7 | placed |
| ord-order-sheet-snapshot | 주문서 스냅샷 | 주문·결제·정산 지도 §03 · commerce-enterprise SR-7 · 코드 | placed |
| ord-sheet-expiry | 주문서 만료 · 재계산 | 주문·결제·정산 지도 §03 · 코드 | placed |
| ord-server-side-pricing | 서버 금액 재계산 | 주문·결제·정산 지도 §03 · commerce-enterprise SR-0 · ADR-0099 | placed |
| ord-availability-check | 가용성 확인 (판매 상태 · 재고 · 판매 기간) | 주문·결제·정산 지도 §03 | placed |
| ord-benefit-quote | 혜택 견적 (쿠폰 · 포인트 · 제휴페이) | 주문·결제·정산 지도 §03 · commerce-enterprise SR-3 | placed |
| ord-line-snapshot | 주문 라인 스냅샷 (정가 · 판매가 · 상품명) | 주문·결제·정산 지도 §03 (정가 · 판매가) | placed |
| ord-discount-allocation | 할인 안분 | 주문·결제·정산 지도 §03 (할인 분해) · 주문·결제·정산 지도 §09 (부담 주체 안분) | placed |
| ord-rounding-residual | 원 단위 잔차 처리 | commerce-enterprise SR-7 · 코드 | placed |
| ord-shipping-fee-line | 판매자별 배송비 라인 | commerce-enterprise SR-7 · 코드 | placed |
| ord-stored-total | 합계 저장 | 주문·결제·정산 지도 §03 (합계) | placed |
| ord-fx-snapshot | 환율 스냅샷 | 주문·결제·정산 지도 §03 (통화 · 금액 타입) | placed |
| ord-order-read-model | 주문 측 읽기 모델 | commerce-enterprise SR-3 · ADR-0099 | placed |
| ord-client-price-tampering | 클라이언트 가격 위변조 | 주문·결제·정산 지도 §부록 ⚑2 · ADR-0099 | placed |
| ord-stale-quote | 주문서 이후 가격 · 혜택 변동 | 주문·결제·정산 지도 §03 | placed |
| ord-order-placement | 주문 접수 | 주문·결제·정산 지도 §07~08 | placed |
| ord-api-idempotency-key | API 멱등 키 (Idempotency-Key) | 주문·결제·정산 지도 §07 (API) · commerce-enterprise SR-4 | placed |
| ord-idempotency-lease | 처리 중 리스 | commerce-enterprise SR-4 · 코드 | placed |
| ord-unique-business-key | 업무 키 유니크 제약 | 주문·결제·정산 지도 §07 (데이터) | placed |
| ord-async-accept | 접수형 처리 (202 Accepted + 상태 조회) | 주문·결제·정산 지도 §08 · commerce-enterprise SR-4 | placed |
| ord-pending-order-limit | 결제 대기 주문 상한 | commerce-enterprise SR-4 | placed |
| ord-double-submit | 중복 주문 (더블클릭 · 재전송) | 주문·결제·정산 지도 §07 | placed |
| ord-slow-dependency | 느린 외부 의존 (게이트웨이 타임아웃) | 주문·결제·정산 지도 §08 | placed |
| ord-hold-abuse | 결제 없는 예약 점유 | commerce-enterprise SR-4 | placed |
| ord-saga-orchestration | 주문 사가 | 주문·결제·정산 지도 §05 · ADR-0099 | placed |
| ord-order-saga-coordinator | 주문 사가 코디네이터 (오케스트레이션) | 주문·결제·정산 지도 §05 (오케스트레이션) · commerce-enterprise SR-4 | placed |
| ord-saga-step-order | 사가 단계 순서 (보상 가능 → 피벗 → 재시도 가능) | 주문·결제·정산 지도 §05 · ADR-0099 | placed |
| ord-saga-state-table | 사가 상태 테이블 | 주문·결제·정산 지도 §05 · commerce-enterprise SR-4 | placed |
| ord-compensation-plan | 역순 보상 | 주문·결제·정산 지도 §05 · commerce-enterprise SR-4 | placed |
| ord-post-pivot-retry | 피벗 뒤 재시도 · STUCK | commerce-enterprise SR-4 | placed |
| ord-step-deadline | 단계 기한 · 명령 재발행 | commerce-enterprise SR-4 | placed |
| ord-hold-expiry-handling | 보류 만료 처리 | commerce-enterprise SR-4 · 주문·결제·정산 지도 §부록 ⚑3 | placed |
| ord-command-partition-key | 사가 메시지 키 = 주문 id | commerce-enterprise SR-4 | placed |
| ord-choreography-flow | 코레오그래피 주문 흐름 | 주문·결제·정산 지도 §05 (코레오그래피) · ADR-0032 | placed |
| ord-best-effort-side-effects | 사가 밖 부가 작업 (최선 노력) | 주문·결제·정산 지도 §05 | placed |
| ord-post-pivot-failure | 피벗 뒤 실패 | 주문·결제·정산 지도 §05 | placed |
| ord-saga-stuck | 멈춘 사가 | commerce-enterprise SR-2 · SR-10 | placed |
| ord-paid-stock-resold | 결제된 재고의 재판매 | 주문·결제·정산 지도 §부록 ⚑3 · ADR-0099 | placed |
| ord-saga-dwell-time | 사가 체류 시간 | 주문·결제·정산 지도 §10 · commerce-enterprise SR-10 | placed |
| ord-compensation-count | 보상 발생 수 | 주문·결제·정산 지도 §10 | placed |
| ord-payment-domain | 결제 | 주문·결제·정산 지도 §04 · commerce-enterprise SR-5 | placed |
| ord-payment-processing | 결제 처리 (승인 · 매입 · 무효 · 환불) | 주문·결제·정산 지도 §04 | placed |
| ord-payment-state-machine | 결제 상태 머신 | 주문·결제·정산 지도 §02 (결제) · commerce-enterprise SR-2 | placed |
| ord-authorization | 승인 (authorize) | 주문·결제·정산 지도 §04 (승인) | placed |
| ord-capture | 매입 (capture) | 주문·결제·정산 지도 §04 (매입) | placed |
| ord-auth-capture-split | 승인 · 매입 분리 | 주문·결제·정산 지도 §04~05 | placed |
| ord-immediate-payment | 즉시 결제 (승인 + 매입) | 주문·결제·정산 지도 §04 · 분야 표준 | placed |
| ord-void | 무효 (void) | 주문·결제·정산 지도 §04 (무효) | placed |
| ord-refund | 환불 (refund) | 주문·결제·정산 지도 §04 (환불) | placed |
| ord-partial-refund | 부분 환불 | 주문·결제·정산 지도 §02 · commerce-enterprise SR-5 | placed |
| ord-net-cancel | 망취소 | 주문·결제·정산 지도 §04 (망취소) | placed |
| ord-pg-integration | PG 연동 (포트 · 어댑터) | commerce-enterprise SR-5 · ADR-0099 | placed |
| ord-mock-pg | 모의 PG | commerce-enterprise SR-5 · ADR-0099 | placed |
| ord-payment-window-confirm | 결제창 인증 후 승인 확인 (confirm) | commerce-enterprise SR-5 | placed |
| ord-pg-timeout | PG 호출 타임아웃 · 서킷 브레이커 | 주문·결제·정산 지도 §08 (타임아웃) · commerce-enterprise SR-0 | placed |
| toss-payments | 토스페이먼츠 | commerce-enterprise SR-5 · 코드 | placed |
| ord-double-charge | 이중 결제 | 주문·결제·정산 지도 §07 | placed |
| ord-payment-decline-rate | 결제 거절률 | 주문·결제·정산 지도 §10 | placed |
| ord-payment-uncertainty | 결과 미상 처리 | 주문·결제·정산 지도 §04 | placed |
| ord-unknown-state | UNKNOWN (결과 미상) 상태 | 주문·결제·정산 지도 §04 (UNKNOWN) | placed |
| ord-payment-inquiry | 거래 재조회 (백오프) | 주문·결제·정산 지도 §04 | placed |
| ord-pg-webhook | PG 웹훅 (서명 검증 · 중복 무시) | 주문·결제·정산 지도 §04 · commerce-enterprise SR-5 | placed |
| ord-single-transition-function | 세 경로 단일 전이 | 주문·결제·정산 지도 §04 | placed |
| ord-merchant-order-no | 가맹점 주문번호 (외부 호출 멱등 키) | 주문·결제·정산 지도 §07 (외부 호출) | placed |
| ord-pending-void | 지연 무효 예약 | commerce-enterprise SR-4 | placed |
| ord-timeout-as-failure | 타임아웃을 실패로 처리 | 주문·결제·정산 지도 §04 · 주문·결제·정산 지도 §부록 ⚑4 | placed |
| ord-unknown-count | 결과 미상 결제 수 | commerce-enterprise SR-10 | placed |
| ord-payment-methods | 결제 수단 | 분야 표준 | placed |
| ord-composite-payment | 복합 결제 | 분야 표준 | placed |
| ord-easy-pay | 간편결제 (제휴페이) | 주문·결제·정산 지도 §03 (제휴페이) | placed |
| ord-virtual-account | 가상계좌 · 입금 대기 | 분야 표준 | placed |
| ord-card-authentication | 카드 본인 인증 (3DS · ISP · 앱카드) | 분야 표준 | placed |
| ord-billing-key | 빌링키 (정기 · 자동 결제) | 분야 표준 | placed |
| ord-escrow | 에스크로 (구매 안전 서비스) | 분야 표준 | placed |
| ord-card-data-scope | 카드 정보 비보관 (PCI-DSS 범위 밖) | commerce-enterprise SR-5 | placed |
| ord-aftercare-domain | 이행 · 클레임 | 주문·결제·정산 지도 §01 (이행 시점) | placed |
| ord-fulfillment | 이행 (출고 · 배송) | 주문·결제·정산 지도 §02 (이행) · inventory-fulfillment spec | placed |
| ord-fulfillment-state-machine | 이행 상태 머신 | 주문·결제·정산 지도 §02 · inventory-fulfillment spec §3.3 | placed |
| ord-split-fulfillment | 분할 이행 (주문 1 : 이행 N) | 주문·결제·정산 지도 §02 (주문 1 : 이행 N) | placed |
| ord-pick-pack-ship | 피킹 · 패킹 · 출고 | 분야 표준 | placed |
| ord-shipment-tracking | 송장 · 배송 추적 | 분야 표준 | placed |
| ord-delivery-completion | 배송 완료 처리 | commerce-enterprise SR-8 | placed |
| ord-line-fulfillment-cancel | 출고 전 라인 취소 | commerce-enterprise SR-8 · 코드 | placed |
| ord-3pl | 3PL · 풀필먼트 센터 위탁 | 분야 표준 | placed |
| ord-non-shipping-fulfillment | 비배송 이행 (발권 · 바우처 · 디지털) | 주문·결제·정산 지도 §08 (발권) | placed |
| ord-fulfillment-lead-time | 출고 리드타임 | 분야 표준 | placed |
| ord-claims | 클레임 (취소 · 반품 · 교환) | 주문·결제·정산 지도 §02 (클레임) · commerce-enterprise SR-8 | placed |
| ord-claim-record | 클레임 레코드 | 주문·결제·정산 지도 §02 | placed |
| ord-claim-state-machine | 클레임 상태 머신 | 주문·결제·정산 지도 §02 · commerce-enterprise SR-2 | placed |
| ord-order-cancel | 주문 취소 (전체) | commerce-enterprise SR-8 | placed |
| ord-partial-cancel | 부분 취소 (라인) | commerce-enterprise SR-8 | placed |
| ord-return | 반품 (회수 · 검수) | 분야 표준 | placed |
| ord-exchange | 교환 | 분야 표준 | placed |
| ord-refund-amount-calc | 환불 금액 계산 | commerce-enterprise SR-8 | placed |
| ord-return-shipping-fee | 반품 배송비 · 귀책 판정 | 분야 표준 | placed |
| ord-seller-claim-approval | 판매자 클레임 승인 | commerce-enterprise SR-8 | placed |
| ord-cancel-after-shipment | 출고 뒤 취소 요청 | commerce-enterprise SR-8 | placed |
| ord-claim-rate | 클레임률 (취소 · 반품률) | 분야 표준 | placed |
| ord-purchase-confirmation | 구매 확정 | 주문·결제·정산 지도 §02 · commerce-enterprise SR-8 | placed |
| ord-purchase-confirm | 구매 확정 (고객) | commerce-enterprise SR-8 | placed |
| ord-auto-purchase-confirm | 자동 구매 확정 | commerce-enterprise SR-8 | placed |
| ord-settlement-domain | 정산 · 원장 | 주문·결제·정산 지도 §09 · commerce-enterprise SR-9 | placed |
| ord-ledger | 원장 기록 | 주문·결제·정산 지도 §09 | placed |
| ord-double-entry | 복식부기 (차변 · 대변) | 주문·결제·정산 지도 §09 · commerce-enterprise SR-9 | placed |
| ord-append-only-ledger | 추가 전용 원장 | 주문·결제·정산 지도 §09 | placed |
| ord-reversing-entry | 역분개 | commerce-enterprise SR-9 | placed |
| ord-journal-rules | 분개 규칙 (매입 · 환불 · PG 입금 · 지급) | commerce-enterprise SR-9 | placed |
| ord-ledger-idempotency | 원천 이벤트 키 멱등 | commerce-enterprise SR-9 | placed |
| ord-trial-balance | 시산표 | 코드 · 분야 표준 | placed |
| ord-unbalanced-journal | 차대 불일치 | 주문·결제·정산 지도 §09 | placed |
| ord-settlement-calc | 정산 계산 | 주문·결제·정산 지도 §09 | placed |
| ord-settlement-basis-date | 정산 기준일 | 주문·결제·정산 지도 §09 (정산 기준일) | placed |
| ord-settlement-cycle | 정산 주기 | 주문·결제·정산 지도 §09 (정산 주기) | placed |
| ord-commission-rule | 수수료 규칙 · 요율 스냅샷 | 주문·결제·정산 지도 §09 (수수료 규칙) | placed |
| ord-net-sales-calc | 순매출 · 지급액 계산 | commerce-enterprise SR-9 | placed |
| ord-settlement-statement | 정산서 | commerce-enterprise SR-9 | placed |
| ord-holdback | 보류 · 차감 | 주문·결제·정산 지도 §09 (보류 · 차감) | placed |
| ord-carry-over | 상계 · 이월 | 주문·결제·정산 지도 §09 · commerce-enterprise SR-2 | placed |
| ord-settlement-batch | 정산 배치 | commerce-enterprise SR-9 | placed |
| ord-gmv | GMV (총 거래액) | 분야 표준 | placed |
| ord-take-rate | 테이크레이트 | 분야 표준 | placed |
| ord-payout | 지급 | 주문·결제·정산 지도 §09 · commerce-enterprise SR-9 | placed |
| ord-seller-payout | 판매자 송금 | commerce-enterprise SR-9 | placed |
| ord-payout-account-protection | 지급 계좌 암호화 · 마스킹 | commerce-enterprise SR-6 | placed |
| ord-reconciliation | 대사 | 주문·결제·정산 지도 §04 · 09 | placed |
| ord-pg-reconciliation | PG 대사 | 주문·결제·정산 지도 §04 (대사) · commerce-enterprise SR-5 | placed |
| ord-three-way-reconciliation | 3자 대사 (주문 · 결제 · 원장) | 주문·결제·정산 지도 §09 (3자 대사) | placed |
| ord-mismatch-queue | 불일치 수동 큐 | 주문·결제·정산 지도 §09 | placed |
| ord-reconciliation-mismatch-count | 대사 불일치 수 | commerce-enterprise SR-10 | placed |
| ord-tax-evidence | 세금 · 증빙 | 주문·결제·정산 지도 §09 (세금 · 증빙) | placed |
| ord-vat | 부가세 · 과세 유형 | 주문·결제·정산 지도 §09 | placed |
| ord-tax-invoice | 세금계산서 · 현금영수증 | 주문·결제·정산 지도 §09 | placed |
| ord-record-retention | 거래 기록 보존 | commerce-enterprise SR-14 | placed |
| ord-operations | 거래 운영 (사람이 끼어드는 자리) | 주문·결제·정산 지도 §10 | placed |
| ord-ops-issue-queue | 운영 큐 (운영 이슈) | 주문·결제·정산 지도 §10 (운영 큐) · commerce-enterprise SR-10 | placed |
| ord-dlt-reprocess | DLT 적재 · 재처리 도구 | 주문·결제·정산 지도 §08 (DLQ + 재처리 도구) · commerce-enterprise SR-10 | placed |
| ord-manual-resolution | 수동 재시도 · 종결 | 주문·결제·정산 지도 §10 | placed |
| ord-audit-log | 감사 로그 | 주문·결제·정산 지도 §10 (감사 로그) | placed |
| ord-order-tracing | 주문 흐름 추적 (traceId 전파) | 주문·결제·정산 지도 §10 (추적) · commerce-enterprise SR-10 | placed |
| ord-order-query-performance | 주문 조회 성능 | 주문·결제·정산 지도 §10 (조회 성능) · 부트캠프 day1 | placed |
| ord-saga-e2e-test | 사가 E2E · 장애 주입 테스트 | 주문·결제·정산 지도 §10 (테스트) | placed |
| ord-order-success-rate | 주문 성공률 | 주문·결제·정산 지도 §10 (지표 · 알림) | placed |
| ord-outbox-backlog | 아웃박스 적체 | 주문·결제·정산 지도 §10 · commerce-enterprise SR-10 | placed |
| ord-glossary | 주문 · 결제 · 정산 용어 | 구조 노드 | placed |
| ord-glossary-order | 주문 용어 | 구조 노드 | placed |
| ord-term-order | 주문 (Order) | 주문·결제·정산 지도 §02 (주문) | placed |
| ord-term-order-line | 주문 라인 | commerce-enterprise 용어 | placed |
| ord-term-order-no | 주문번호 | 분야 표준 | placed |
| ord-term-pivot | 피벗 트랜잭션 | 주문·결제·정산 지도 §05 | excluded — 같은 개념 dist-pivot-transaction 로 합쳤다 |
| ord-term-hold-period | 보류 기한 | commerce-enterprise SR-4 | placed |
| ord-glossary-payment | 결제 용어 | 구조 노드 | placed |
| ord-term-payment | 결제 (Payment) | 주문·결제·정산 지도 §02 (결제) | placed |
| ord-term-pg | PG (전자지급결제대행) | 분야 표준 | placed |
| ord-term-van | VAN (부가가치통신망) | 분야 표준 | placed |
| ord-term-card-parties | 발급사 · 매입사 · 카드 네트워크 | 분야 표준 | placed |
| ord-term-payment-key | PG 거래 키 | commerce-enterprise SR-5 | placed |
| ord-term-pg-settlement-file | PG 정산 파일 | 주문·결제·정산 지도 §04 · commerce-enterprise SR-5 | placed |
| ord-glossary-fulfillment | 이행 · 클레임 용어 | 구조 노드 | placed |
| ord-term-fulfillment | 이행 (Fulfillment) | 주문·결제·정산 지도 §02 (이행) | placed |
| ord-term-claim | 클레임 (Claim) | 주문·결제·정산 지도 §02 (클레임) | placed |
| ord-term-waybill | 송장번호 | 분야 표준 | placed |
| ord-glossary-ledger | 원장 용어 | 구조 노드 | placed |
| ord-term-journal | 거래 · 분개 | commerce-enterprise 용어 | placed |
| ord-term-account | 계정과목 | 분야 표준 | placed |
| ord-term-pg-receivable | PG 미수금 | commerce-enterprise SR-9 | placed |
| ord-term-seller-payable | 판매자 미지급금 | 주문·결제·정산 지도 §09 · commerce-enterprise SR-9 | placed |
| ord-term-commission-revenue | 수수료 수익 | commerce-enterprise SR-9 | placed |
| ord-term-promo-expense | 판촉 비용 | commerce-enterprise SR-9 | placed |

다른 도메인이 소유하는 일반 개념 — 이 파일은 USES · MITIGATES 로 잇는다.

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| saga-pattern | 사가 패턴 | 주문·결제·정산 지도 §05 | excluded — owned by distributed |
| dist-saga-choreography | 코레오그래피 사가 (일반형) | 주문·결제·정산 지도 §05 | excluded — owned by distributed |
| dist-saga-orchestration | 오케스트레이션 사가 (일반형) | 주문·결제·정산 지도 §05 | excluded — owned by distributed |
| two-phase-commit | 2PC · XA | 주문·결제·정산 지도 §05 | excluded — owned by distributed |
| dist-tcc | TCC (일반형) | 주문·결제·정산 지도 §05 | excluded — owned by distributed |
| dist-compensating-transaction | 보상 트랜잭션 | 주문·결제·정산 지도 §05 | excluded — owned by distributed |
| outbox-pattern | 트랜잭셔널 아웃박스 | 주문·결제·정산 지도 §06 | excluded — owned by distributed |
| dist-outbox-polling-relay | 아웃박스 폴링 릴레이 | 주문·결제·정산 지도 §06 | excluded — owned by distributed |
| dist-cdc | CDC (Debezium) | 주문·결제·정산 지도 §06 | excluded — owned by distributed |
| dist-inbox-pattern | 인박스 (processed_event, 메시지 층 멱등) | 주문·결제·정산 지도 §06~07 (메시지) | excluded — owned by distributed |
| idempotency | 멱등성 | 주문·결제·정산 지도 §07 | excluded — owned by distributed |
| dist-idempotency-key | 멱등 키 (일반형) | 주문·결제·정산 지도 §07 | excluded — owned by distributed |
| dist-dual-write | DB · 메시지 이중 쓰기 | 주문·결제·정산 지도 §06 | excluded — owned by distributed |
| dist-duplicate-delivery | 최소 한 번 전달 중복 | 주문·결제·정산 지도 §07 | excluded — owned by distributed |
| dist-timeout | 타임아웃 (일반형) | 주문·결제·정산 지도 §08 | excluded — owned by distributed |
| circuit-breaker | 서킷 브레이커 | 주문·결제·정산 지도 §08 | excluded — owned by distributed |
| bulkhead-pattern | 벌크헤드 | 주문·결제·정산 지도 §08 | excluded — owned by distributed |
| retry-pattern | 재시도 + 지수 백오프 | 주문·결제·정산 지도 §08 | excluded — owned by distributed |
| dist-jitter | 지터 | 주문·결제·정산 지도 §08 | excluded — owned by distributed |
| dist-dead-letter-queue | DLQ (일반형) | 주문·결제·정산 지도 §08 | excluded — owned by distributed |
| net-webhook | 웹훅 (일반형) | 주문·결제·정산 지도 §04 | excluded — owned by network |
| sse | SSE · 푸시 | 주문·결제·정산 지도 §08 | excluded — owned by network |
| net-cursor-pagination | 커서 페이징 | 주문·결제·정산 지도 §10 · 부트캠프 day1 | excluded — owned by network |
| n-plus-one | N+1 | 주문·결제·정산 지도 §10 · 부트캠프 day1 | excluded — owned by data |
| data-composite-index | 복합 인덱스 | 주문·결제·정산 지도 §10 | excluded — owned by data |
| pessimistic-lock | 비관적 락 (일반형) | 주문·결제·정산 지도 §07 · 부트캠프 day2 | excluded — owned by data |
| optimistic-lock | 낙관적 락 (일반형) | 주문·결제·정산 지도 §07 · 부트캠프 day2 | excluded — owned by data |
| data-transaction | 트랜잭션 속성 · OSIV | 부트캠프 day2 | excluded — owned by data |
| caching | 캐싱 | 부트캠프 day1 | excluded — owned by data |
| distributed-tracing | 분산 추적 (traceId) | 주문·결제·정산 지도 §10 | excluded — owned by observability |
| testcontainers | Testcontainers | 주문·결제·정산 지도 §10 | excluded — owned by testing |
| bean-validation | Bean Validation · 전역 예외 처리 · 요청 로깅 | 부트캠프 day0 | excluded — owned by spring |
