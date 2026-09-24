# Review Closure — Round 2 이슈 종결 확인

- 일자: 2026-09-24
- 대상: `spec.md`(261줄) · `planning/test-quality.md`(89줄) · `planning/requirements.md` · `docs/adr/ADR-0099-commerce-orchestrated-saga-marketplace.md`
- 범위: 여섯 리뷰 파일의 `## Round 2` 이슈가 해소됐는지 확인하고, 수정 과정에서 새로 생긴 모순만 표시한다. 새 범위는 올리지 않는다.
- 줄 번호는 위 개정본 기준이다.

## 이슈별 종결 표

| 파일 | 이슈 | 해소 | 근거 |
|---|---|---|---|
| architecture | B1 이행 취소 명령 부재 · `onFulfillmentCancelled` | 해소 | spec.md:196 `fulfillment.command.{create,cancel}` · :197 `cancelled,cancel-rejected` · :148 cancel 선행, 환불은 cancelled 뒤 · :86 거절 시 판매자 승인 대기 · :57 `onFulfillmentCancelled` 삭제 |
| architecture | B2 product 동기화 confirmed·restocked | 해소 | spec.md:58 「confirmed·restocked 구독 추가」 |
| architecture | B3 quant 아웃박스 | 해소 | spec.md:161 「quant 는 자체 릴레이라 대상 아님」 |
| architecture | B4 ADR 표의 대사 소속 | 해소 | ADR-0099:45 payment 「PG 대사(결과를 이벤트로)」 · :48 settlement 「대사 결과는 payment 이벤트로 받는다」 |
| domain | N1 전이표 누락 | 해소 | spec.md:71 PAID→FAILED · :72 CREATED→CONFIRMED(0원) · :80 부분 취소를 라인 상태 + `refunded_amount` 로(안 (a)) · :77 COMPLETED = 취소 안 된 라인 전부 구매 확정 · :92 STUCK→RUNNING · :84 결제 `→` 단방향, CAPTURED→REFUNDED, PARTIALLY_REFUNDED 자기 전이 |
| domain | N2 출고 전 취소가 이행을 멈추지 못함 | 해소 | spec.md:148 · :86 · :196-197 · :57 (architecture B1 과 같은 근거) |
| domain | N3 환불 이중 차감 · 배송비 정산 | **부분** | 이중 차감은 해소: spec.md:156 「환불은 정산서에 들어오지 않는다」, :158 식에서 환불 상계 제거, test-quality.md:75 「환불 라인은 정산서에 없음」. **남은 것**: ① 배송비 라인이 어느 기간 정산서에 들어가는지 정하지 않았다. :158 배치는 `order.line.purchase-confirmed` 만 모으고 배송비 라인은 이 이벤트가 없다(:150). ② 배송비 환불(:147)의 분개 계정이 없다(:155 는 원천 이벤트만 적는다) |
| implementation | N1 환불 상계 · 순매출 · 분개 표 | **부분** | 환불 상계 제거 spec.md:156·:158, 순매출 정의 :157. **남은 것**: 요청한 「매입·환불·지급 세 시점의 분개(차·대 계정과 금액 식) 한 표」가 없다. :155 는 시점과 원천 이벤트만 적는다. 그래서 매입 때 미지급금 대변 금액(총액인지 순매출−수수료인지)이 정해지지 않았다. :158 「지급액 = 미지급금 감소분」이 성립하는지 확인할 수 없다 |
| implementation | N2 보류 만료 VOID 전이 · 확정 명령 응답 | 해소 | spec.md:71 PAID→FAILED · :109 「만료된 예약에 확정 명령이 오면 `…failed(reason=EXPIRED)`, DLT 로 새지 않는다」 · test-quality.md:61 |
| implementation | N3 ACTIVE 예약 전환의 수량 | 해소 | spec.md:209 CONFIRMED + `reserved_qty` 차감 + `stock.confirmed` 아웃박스, 기동 시 멱등 작업 · test-quality.md:82 |
| implementation | N4 quant 제외 · SENDING 롤백 | 해소 | spec.md:161 · :210 `UPDATE … SET status='PENDING' WHERE status='SENDING'` |
| implementation | N5 운영 큐 도메인 범위 | 해소 | spec.md:164 여덟 도메인 명시 |
| security | R2-1 상품 경로 · `/bulk` | 해소 | spec.md:60 `/api/products/**` → `/api/v1/products/**` 동시 교체 · :39 `/internal/products/bulk` + NetworkPolicy · :38 헤더 없으면 거부 |
| security | R2-2 라우트 표 테스트 | 해소 | test-quality.md:54 (gateway integration, 401·403·위조 헤더 제거·`/internal/**` 라우트 없음) · 웹훅 404 는 :43 |
| security | R2-3 `seller_id` 출처 · 키 기본값 금지 | **부분** | `seller_id` 는 spec.md:38 에서 해소, 테스트는 test-quality.md:51. 기본값 금지는 `SELLER_ACCOUNT_ENC_KEY` 만 적었다(spec.md:126). 리뷰가 함께 요구한 `TOSS_WEBHOOK_SECRET`(와 `TOSS_SECRET_KEY`)의 기본값 금지는 spec.md:215 에 없다 |
| test-strategy | R2-1 보류 만료 두 분기 | **부분** | (a)·(b) 분리는 test-quality.md:59-60, 회귀 주입 (b)는 :87 에 있다. **남은 것**: (b) 행에 리뷰가 요구한 두 판정이 없다. 「만료 직후 VOID 호출 0회」와 「조회 결론이 거절이면 VOID 0회」다. :63 은 보류 만료가 없는 UNKNOWN→FAILED 경우다 |
| test-strategy | R2-2 PAYMENT_PENDING 취소 409 | 해소 | test-quality.md:62 |
| test-strategy | R2-3 기본 프로필 웹훅 404 | 해소 | test-quality.md:43 |
| test-strategy | R2-4 작은 행들 | **부분 (비차단)** | 반영됨: 재조회 5회 :44 · UNKNOWN 결론 FAILED :63 · 수수료율 스냅샷 :52 · 클레임 분기 :70 · 주문 `@Version`·이력 :53 · 예약 전환 :82. 빠짐: 쿠폰 최소 주문·최대 할인·기간 ±1원(:34 는 정률 내림만 본다) · `order_saga @Version`(:53 은 주문만 본다). 리뷰어가 tasks 단계에서 넣어도 된다고 했다(engineer-review-test-strategy.md:221) |
| usecase | N1 보류 만료 VOID 전이 · 확정분 보상 | **부분** | 전이는 spec.md:71 에 있다(매입 전만, restock·restore). test-quality.md:59 도 있다. 리뷰가 요구한 「피벗 뒤는 재시도만」의 유일한 예외라는 문구가 spec.md:108 에 없다. 아래 C2 참조 |
| usecase | N2 PARTIALLY_REFUNDED 이후 전이 | 해소 | spec.md:80 라인 상태로 표현(안 (a)) · :77 COMPLETED 조건 · test-quality.md:71 |
| usecase | N3 정지 회피 재신청 | 해소 | spec.md:125 「ACTIVE·PENDING·SUSPENDED 기준」 · test-quality.md:51 |

집계: 22건 중 해소 16 · 부분 6 (domain N3 · implementation N1 · security R2-3 · test-strategy R2-1 · test-strategy R2-4(비차단) · usecase N1)

## 수정이 새로 만든 모순

| # | 모순 | 근거 |
|---|---|---|
| C1 | 주문 상태에서 PARTIALLY_REFUNDED 를 뺐는데 E2E 행이 그 상태를 기대한다. 결제 상태를 뜻한다면 그렇게 적어야 한다 | spec.md:80 (부분 취소는 라인 상태 + `refunded_amount`) ↔ test-quality.md:68 「부분 취소 → … → PARTIALLY_REFUNDED」 |
| C2 | 피벗 뒤 보상 규칙이 두 곳에서 다르다. :71 은 PAID(피벗 뒤)에서 확정된 재고 `restock`·혜택 `restore` 로 보상한다. :108 은 「피벗 뒤는 재시도만」이라고 예외 없이 적었다 | spec.md:71 ↔ spec.md:108 |
| C3 | PAID→FAILED 는 「restock 후」에 전이한다. 그런데 inventory 가 order 로 restock 완료를 알리는 이벤트가 없다. `inventory.reservation.*` 에 restocked 가 없고, `inventory.stock.restocked` 는 product 만 받는다. 혜택 쪽은 `promotion.hold.restored` 가 order 로 간다 | spec.md:71 ↔ spec.md:188-189 (대조: :191) |
| C4 | 정산식에서 「환불 상계」를 뺐는데 사용자 스토리에는 남아 있다 | spec.md:16 「정산서(매출·수수료·환불 상계·지급액)」 ↔ spec.md:156·:158 |

OPEN — 부분 해소 6건 (domain N3 배송비 정산 시점·환불 분개 · implementation N1 분개 표 · security R2-3 토스 키 기본값 금지 · test-strategy R2-1 (b) VOID 0회 판정 · test-strategy R2-4 쿠폰 경계·사가 @Version(비차단) · usecase N1 예외 문구), 새 모순 4건 (C1 test-quality:68 PARTIALLY_REFUNDED · C2 spec:71↔:108 피벗 뒤 보상 · C3 restock 완료 이벤트 부재 · C4 spec:16 환불 상계)

## 종결 처리 (2026-09-24)

OPEN 10건을 스펙·테스트 표 문구로 반영했다 — domain N3(배송비 라인 정산 시점·환불 분개) · implementation N1(시점별 분개 표 + 검산 열) ·
security R2-3(토스 키 두 개 기본값 금지) · test R2-1((b) 분기 판정 두 개) · test R2-4(쿠폰 경계·사가 @Version 행) · usecase N1 = C2(보류 만료 = 피벗 뒤 재시도 규칙의 유일한 예외) ·
C1(부분 취소 E2E 기대값 = 결제 PARTIALLY_REFUNDED + 라인 CANCELLED) · C3(`inventory.reservation.restocked`) · C4(사용자 스토리 정산서 항목).

CLOSED
