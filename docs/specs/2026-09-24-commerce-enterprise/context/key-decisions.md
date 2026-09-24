# Key Decisions

열린 pre-impl 질문: 0 건

- 2026-09-24 COMPLETED 는 구매 확정으로 재정의 (사용자)
- 2026-09-24 주문서는 order 읽기 모델로 계산, 할인은 견적 · 최종 판정은 TCC reserve (사용자)
- 2026-09-24 정산식에서 환불 상계 제외 — 환불은 구매 확정 전 라인만이라 이중 차감 (리뷰 domain N3·implementation N1)
- 2026-09-24 부분 취소는 주문 상태가 아니라 라인 상태 + refunded_amount (리뷰 usecase N2)
- 2026-09-24 운영 실측: orders 0 · outbox_event 0(order·inventory·fulfillment) · inventory 0 · products 24 — 주문이 한 번도 끝까지 간 적 없다. 전환 마이그레이션은 빈 데이터 대상
- 2026-09-24 아웃박스: attempts 는 NOT NULL DEFAULT 0(옛 코드와 공존 무해), 10번째 실패에 FAILED, 릴레이 트랜잭션 READ COMMITTED(REPEATABLE READ 에서 갭 잠금 교착 재현)
- 2026-09-24 기존 결함 발견: common OutboxEntity 에 no-arg 생성자가 없어 옛 릴레이가 행을 못 읽었다(행이 0이라 드러나지 않음)
- 2026-09-24 사용자 쿠폰 상태는 별도 토픽 없이 `promotion.hold.*` 의 userCouponStatus 로 order 읽기 모델에 전달(토픽 추가 안 함)
- 2026-09-24 promotion reserve 는 주문서 견적 couponDiscount 를 싣고, 재계산과 다르면 failed(DISCOUNT_MISMATCH) — 결제액 불일치 방지. 쿠폰 유효기간 [from, until), 판매자 쿠폰 최소금액은 그 판매자 라인 기준, 배송비는 쿠폰 대상 제외
- 2026-09-24 안분 잔차가 최대 라인 금액을 넘으면 그 라인은 자기 금액까지만 받고 나머지는 다음 큰 라인으로(라인 결제액 음수 방지)
- 2026-09-24 포인트 상한은 쿠폰 뒤 상품 금액(배송비 제외) — 포인트는 라인에 안분되고 배송비 라인은 받지 않는다. 초과는 422
- 2026-09-24 남의 주문서 GET 은 404(존재 누설 방지), 주문 생성 시 소유자·재사용·만료는 422
