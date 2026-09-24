# Key Decisions

열린 pre-impl 질문: 0 건

- 2026-09-24 COMPLETED 는 구매 확정으로 재정의 (사용자)
- 2026-09-24 주문서는 order 읽기 모델로 계산, 할인은 견적 · 최종 판정은 TCC reserve (사용자)
- 2026-09-24 정산식에서 환불 상계 제외 — 환불은 구매 확정 전 라인만이라 이중 차감 (리뷰 domain N3·implementation N1)
- 2026-09-24 부분 취소는 주문 상태가 아니라 라인 상태 + refunded_amount (리뷰 usecase N2)
- 2026-09-24 운영 실측: orders 0 · outbox_event 0(order·inventory·fulfillment) · inventory 0 · products 24 — 주문이 한 번도 끝까지 간 적 없다. 전환 마이그레이션은 빈 데이터 대상
- 2026-09-24 아웃박스: attempts 는 NOT NULL DEFAULT 0(옛 코드와 공존 무해), 10번째 실패에 FAILED, 릴레이 트랜잭션 READ COMMITTED(REPEATABLE READ 에서 갭 잠금 교착 재현)
- 2026-09-24 기존 결함 발견: common OutboxEntity 에 no-arg 생성자가 없어 옛 릴레이가 행을 못 읽었다(행이 0이라 드러나지 않음)
