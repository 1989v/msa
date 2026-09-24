# 상품 · 전시 · 재고 — 커버리지 체크리스트

원천:
- 볼트 `1989v/claude/artifact/commerce-order-payment-map.md` §03 · §05 · §07 (금액 타입 · TCC · 재고 동시성)
- 레포 `docs/specs/2026-09-24-commerce-enterprise/spec.md` (SR-0 · SR-6 · SR-7 · SR-12)
- 레포 `docs/specs/2026-04-07-inventory-fulfillment/spec.md` (재고 · 예약 · 창고)
- 레포 `docs/specs/2026-06-11-shop-ux/spec.md` (목록 · 상세 · 장바구니)
- ADR-0011 · ADR-0013 · ADR-0060 · ADR-0099
- 코드 `product/` · `inventory/` · `warehouse/` · `promotion/` · `seller/` · `order/…/cart` · `portal-fe/src/pages/Shop*`
- 분야 표준 — 상품 모델(SPU · SKU · 옵션 · 속성 · 번들 · GTIN) · 카테고리 계층 저장 · 가격 규칙 · 전시 · 장바구니 · 재고(ATP · 안전 재고 · 예약 판매 · 다창고 라우팅 · 실사) · 프로모션(중첩 · 예산 · 남용)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| commerce-catalog | 상품 · 전시 · 재고 | 분야 표준 · commerce-enterprise SR-6~7 | placed |
| cat-product-domain | 상품 | 분야 표준 | placed |
| cat-product-modeling | 상품 모델링 | 분야 표준 | placed |
| cat-spu-sku-model | SPU · SKU 2층 상품 모델 | 분야 표준 | placed |
| cat-option-combination | 옵션 조합 · SKU 생성 | 분야 표준 | placed |
| cat-attribute-model | 속성 모델 (고정 컬럼 · EAV · JSON) | 분야 표준 · ADR-0060 · 코드 | placed |
| cat-product-bundle | 묶음 · 세트 상품 | 분야 표준 | placed |
| cat-product-type | 상품 유형 (배송 · 디지털 · 예약 · 서비스) | 분야 표준 | placed |
| cat-product-lifecycle | 상품 상태 · 판매 상태 | 분야 표준 · 코드 | placed |
| cat-product-versioning | 상품 변경 이력 · 버전 | 분야 표준 | placed |
| cat-product-media | 상품 이미지 · 미디어 | 주문·결제·정산 지도 §부록 day4-2 (Presigned URL · CDN) | placed |
| cat-product-compliance | 상품 고시 정보 | ADR-0060 · 코드 | placed |
| cat-product-event-publishing | 상품 이벤트 발행 | commerce-enterprise SR-0 · SR-3 · ADR-0013 | placed |
| cat-sku-explosion | 옵션 조합 폭발 | 분야 표준 | placed |
| cat-category-taxonomy | 카테고리 · 분류 체계 | 분야 표준 | placed |
| cat-category-tree | 카테고리 트리 | 분야 표준 | placed |
| cat-hierarchy-storage | 계층 저장 (인접 목록 · 경로 열거 · 클로저 테이블) | 분야 표준 | placed |
| cat-display-category-mapping | 전시 카테고리 매핑 | 분야 표준 | placed |
| cat-brand-master | 브랜드 · 제조사 마스터 | 분야 표준 | placed |
| cat-pricing | 가격 정책 | 주문·결제·정산 지도 §03 | placed |
| cat-list-sale-price | 정가 · 판매가 · 할인가 | 주문·결제·정산 지도 §03 (정가 · 판매가) | placed |
| cat-price-rule | 가격 규칙 (기간가 · 회원가 · 채널가 · 수량 할인) | 분야 표준 | placed |
| cat-price-priority | 가격 결정 우선순위 (가격 엔진) | 분야 표준 | placed |
| cat-money-type | 금액 타입 (정수 최소 단위 · BigDecimal + 통화) | 주문·결제·정산 지도 §03 (통화 · 금액 타입) · commerce-enterprise SR-7 | placed |
| cat-currency | 통화 · 다통화 가격 | 주문·결제·정산 지도 §03 | placed |
| cat-rounding-rule | 반올림 · 절사 규칙 | commerce-enterprise SR-7 | placed |
| cat-shipping-fee-policy | 배송비 정책 | commerce-enterprise SR-6 · SR-7 | placed |
| cat-price-history | 가격 이력 · 할인 전 가격 표시 | 분야 표준 | placed |
| cat-dynamic-pricing | 동적 가격 | 분야 표준 | placed |
| cat-float-money-error | 부동소수점 금액 오차 | 주문·결제·정산 지도 §03 (부동소수점 금지) | placed |
| cat-price-mismatch | 노출 가격과 결제 가격 불일치 | 주문·결제·정산 지도 §03 | placed |
| cat-seller-onboarding | 판매자 · 입점 (마켓플레이스) | commerce-enterprise SR-6 · ADR-0099 | placed |
| cat-seller-application | 입점 신청 · 심사 | commerce-enterprise SR-6 | placed |
| cat-seller-state-machine | 판매자 상태 (신청 · 활성 · 정지 · 반려) | commerce-enterprise SR-2 · SR-6 | placed |
| cat-product-ownership | 상품 소유 판정 | commerce-enterprise SR-0 | placed |
| cat-marketplace-model | 마켓플레이스 · 직매입 (3P · 1P) | 분야 표준 | placed |
| cat-seller-pii-purge | 반려 신청 개인정보 파기 | commerce-enterprise SR-6 | placed |
| cat-display-domain | 전시 · 탐색 | shop-ux spec · 분야 표준 | placed |
| cat-merchandising | 전시 · 머천다이징 | 분야 표준 | placed |
| cat-display-slot | 전시 영역 · 기획전 편성 | 분야 표준 | placed |
| cat-display-schedule | 전시 기간 · 예약 노출 | 분야 표준 | placed |
| cat-best-seller-ranking | 베스트 · 인기 순위 | 분야 표준 | placed |
| cat-product-detail-page | 상품 상세 (PDP) | shop-ux spec · 코드 | placed |
| cat-stock-display | 품절 · 재고 표시 | ADR-0013 · 코드 | placed |
| cat-display-cache | 전시 캐시 | 분야 표준 | placed |
| cat-product-discovery | 상품 목록 · 탐색 | shop-ux spec | placed |
| cat-product-listing | 상품 목록 · 정렬 · 페이징 | shop-ux spec · 코드 | placed |
| cat-faceted-filter | 패싯 필터 | 분야 표준 | placed |
| cat-catalog-search-sync | 상품 → 검색 색인 동기화 | commerce-enterprise SR-12 · shop-ux spec | placed |
| cat-product-republish | 상품 재발행 (사본 재구축) | 코드 | placed |
| cat-conversion-rate | 구매 전환율 | 분야 표준 | placed |
| cat-inventory-domain | 재고 | inventory-fulfillment spec · ADR-0011 · ADR-0013 | placed |
| cat-stock-model | 재고 모델 | inventory-fulfillment spec §3 | placed |
| cat-available-reserved | 가용 · 예약 수량 분리 | inventory-fulfillment spec §3.1 · 코드 | placed |
| cat-stock-ssot | 재고 SSOT · 상품 재고 사본 | ADR-0013 · 코드 | placed |
| cat-stock-ledger | 재고 수불 (입고 · 출고 · 조정) | inventory-fulfillment spec (입고) · 분야 표준 | placed |
| cat-safety-stock | 안전 재고 · 판매 버퍼 | 분야 표준 | placed |
| cat-preorder-backorder | 예약 판매 · 백오더 | 분야 표준 | placed |
| cat-limited-quantity | 한정 수량 · 날짜별 재고 | 분야 표준 | placed |
| cat-stock-reservation | 재고 예약 · 차감 | 주문·결제·정산 지도 §05 · inventory-fulfillment spec | placed |
| cat-reservation-hold | 재고 예약 (보류 기한) | inventory-fulfillment spec §3.2 · commerce-enterprise SR-4 | placed |
| cat-reservation-confirm | 예약 확정 (차감) | inventory-fulfillment spec · commerce-enterprise SR-4 | placed |
| cat-reservation-release | 예약 해제 · 만료 | inventory-fulfillment spec · commerce-enterprise SR-4 | placed |
| cat-restock | 재입고 (클레임 되돌림) | commerce-enterprise SR-1 · SR-8 | placed |
| cat-deduction-timing | 차감 시점 (주문 · 결제 · 출고) | 분야 표준 | placed |
| cat-all-or-nothing-reservation | 주문 단위 전부 아니면 전무 예약 | commerce-enterprise SR-0 | placed |
| cat-inventory-command-idempotency | 재고 명령 멱등 (주문 · 명령 키) | commerce-enterprise SR-4 · 코드 | placed |
| cat-oversell | 초과 판매 (oversell) | 주문·결제·정산 지도 §07 · 분야 표준 | placed |
| cat-stock-hoarding | 재고 묶임 (미결제 예약) | commerce-enterprise SR-4 | placed |
| cat-reservation-expiry-count | 예약 만료 수 | 코드 | placed |
| cat-stock-concurrency | 재고 동시성 | 주문·결제·정산 지도 §07 (재고 동시성) | placed |
| cat-stock-optimistic-lock | 재고 행 낙관적 락 | 주문·결제·정산 지도 §07 (낙관적 락) · ADR-0013 | placed |
| cat-stock-pessimistic-lock | 재고 행 비관적 락 (정렬된 FOR UPDATE) | 주문·결제·정산 지도 §07 (비관적 락) · commerce-enterprise SR-0 | placed |
| cat-conditional-update | 원자적 조건부 갱신 | 주문·결제·정산 지도 §07 (원자적 조건부 갱신) · commerce-enterprise SR-7 | placed |
| cat-redis-prededuction | Redis 선차감 (Lua 원자 차감) | 주문·결제·정산 지도 §07 (Redis 선차감) | placed |
| cat-cache-db-reconciliation | 캐시 · DB 재고 대사 | 주문·결제·정산 지도 §07 (DB 와 대사) · 코드 | placed |
| cat-admission-control | 입장 제어 · 대기열 | 주문·결제·정산 지도 §07 (입장 제어 · 대기열) · 코드 | placed |
| cat-stock-bucketing | 재고 분할 (버킷) | 분야 표준 | placed |
| cat-hot-sku-contention | 인기 상품 경합 (hot SKU) | 주문·결제·정산 지도 §07 | placed |
| cat-warehouse-allocation | 창고 · 할당 | inventory-fulfillment spec · ADR-0011 | placed |
| cat-warehouse-master | 창고 마스터 | inventory-fulfillment spec · 코드 | placed |
| cat-warehouse-selection | 창고 선택 규칙 | 주문·결제·정산 지도 §부록 (창고 선택) · 코드 | placed |
| cat-multi-warehouse-split | 다창고 분할 할당 | 분야 표준 | placed |
| cat-order-routing | 주문 라우팅 (거리 · 비용 · 재고) | 분야 표준 | placed |
| cat-cycle-count | 실사 · 재고 조정 | 분야 표준 | placed |
| cat-promotion-domain | 혜택 (프로모션 · 쿠폰 · 포인트) | commerce-enterprise SR-7 · ADR-0099 | placed |
| cat-promotion-design | 프로모션 설계 | commerce-enterprise SR-7 | placed |
| cat-instant-discount | 즉시 할인 | 분야 표준 | placed |
| cat-coupon-definition | 쿠폰 정의 (정액 · 정률 · 최대 할인 · 최소 주문 금액) | commerce-enterprise SR-7 · 코드 | placed |
| cat-coupon-issuance | 쿠폰 발급 · 발행 상한 | commerce-enterprise SR-7 | placed |
| cat-coupon-types | 쿠폰 종류 (상품 · 장바구니 · 배송비 · 중복) | 분야 표준 | placed |
| cat-discount-stacking | 할인 중첩 · 적용 순서 | 주문·결제·정산 지도 §03 (혜택 계산) · 분야 표준 | placed |
| cat-cost-bearer | 할인 부담 주체 (플랫폼 · 판매자 · 분담) | 주문·결제·정산 지도 §03 (부담 주체) · 주문·결제·정산 지도 §09 · commerce-enterprise SR-7 | placed |
| cat-promotion-budget | 프로모션 예산 · 소진 | 분야 표준 | placed |
| cat-abuse-prevention | 혜택 남용 방지 | 분야 표준 | placed |
| cat-promotion-abuse | 혜택 남용 | 분야 표준 | placed |
| cat-points | 포인트 · 적립금 | commerce-enterprise SR-7 | placed |
| cat-point-ledger | 포인트 원장 | commerce-enterprise SR-7 · 코드 | placed |
| cat-point-expiry | 포인트 소멸 (유효기간 · 선입선출) | 분야 표준 | placed |
| cat-point-accrual | 구매 적립 | 분야 표준 | placed |
| cat-benefit-hold | 혜택 예약 · 확정 | 주문·결제·정산 지도 §05 (TCC) · commerce-enterprise SR-7 | placed |
| cat-benefit-tcc-hold | 혜택 예약 (TCC — Try · Confirm · Cancel) | 주문·결제·정산 지도 §05 (TCC) · commerce-enterprise SR-7 | placed |
| cat-coupon-state | 사용자 쿠폰 상태 | commerce-enterprise SR-7 · SR-8 · 코드 | placed |
| cat-hold-expiry | 혜택 보류 만료 | commerce-enterprise SR-4 | placed |
| cat-benefit-restore | 혜택 원복 | 주문·결제·정산 지도 §부록 day3 (혜택 원복) · commerce-enterprise SR-8 | placed |
| cat-cart | 장바구니 | 주문·결제·정산 지도 §03 · commerce-enterprise SR-7 · shop-ux spec | placed |
| cat-cart-model | 장바구니 모델 | commerce-enterprise SR-7 · 코드 | placed |
| cat-guest-cart-merge | 비회원 장바구니 병합 | 분야 표준 | placed |
| cat-cart-revalidation | 장바구니 재검증 | 분야 표준 | placed |
| cat-cart-seller-grouping | 판매자별 묶음 · 배송비 그룹 | commerce-enterprise SR-7 | placed |
| cat-wishlist | 찜 (위시리스트) | 분야 표준 (레포 wishlist 서비스) | placed |
| cat-cart-abandonment-rate | 장바구니 이탈률 | 분야 표준 | placed |
| cat-glossary | 상품 · 재고 · 혜택 용어 | 구조 노드 | placed |
| cat-glossary-product | 상품 용어 | 구조 노드 | placed |
| cat-term-spu | SPU (Standard Product Unit) | 분야 표준 | placed |
| cat-term-sku | SKU (Stock Keeping Unit) | 분야 표준 | placed |
| cat-term-option | 옵션 (Option) | 분야 표준 | placed |
| cat-term-attribute | 속성 (Attribute) | 분야 표준 | placed |
| cat-term-variant | 변형 상품 (Variant) | 분야 표준 | placed |
| cat-term-gtin | GTIN · 바코드 (EAN · UPC) | 분야 표준 | placed |
| cat-term-category | 카테고리 | 분야 표준 | placed |
| cat-glossary-inventory | 재고 용어 | 구조 노드 | placed |
| cat-term-on-hand | 실재고 (On-hand) | 분야 표준 | placed |
| cat-term-available-qty | 가용 재고 | inventory-fulfillment spec | placed |
| cat-term-reserved-qty | 예약 재고 | inventory-fulfillment spec | placed |
| cat-term-atp | ATP (Available to Promise) | 분야 표준 | placed |
| cat-glossary-price-promotion | 가격 · 혜택 용어 | 구조 노드 | placed |
| cat-term-supply-price | 공급가 · 매입가 | 분야 표준 | placed |
| cat-term-margin | 마진 | 분야 표준 | placed |
| cat-term-coupon | 쿠폰 | commerce-enterprise SR-7 | placed |
| cat-term-point | 포인트 · 적립금 | commerce-enterprise SR-7 | placed |
| cat-term-min-order-amount | 최소 주문 금액 | commerce-enterprise SR-7 | placed |

다른 도메인이 소유하는 일반 개념 — 이 파일은 USES · MITIGATES 로 잇는다.

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| optimistic-lock | 낙관적 락 (일반형) | 주문·결제·정산 지도 §07 | excluded — owned by data |
| pessimistic-lock | 비관적 락 (일반형) | 주문·결제·정산 지도 §07 | excluded — owned by data |
| data-lock-ordering | 잠금 순서 고정 | 주문·결제·정산 지도 §07 | excluded — owned by data |
| deadlock | 데드락 | 주문·결제·정산 지도 §07 | excluded — owned by concurrency |
| atomic-operation | 원자 연산 | 주문·결제·정산 지도 §07 | excluded — owned by concurrency |
| rate-limiting | 레이트 리미팅 | 주문·결제·정산 지도 §07 | excluded — owned by security |
| redis | Redis | 주문·결제·정산 지도 §07 | excluded — owned by data |
| sharding | 샤딩 | 분야 표준 | excluded — owned by distributed |
| dist-semantic-lock | 시맨틱 락 (예약 = 논리 잠금) | 분야 표준 | excluded — owned by distributed |
| cloud-cdn | CDN | 주문·결제·정산 지도 §부록 day4-2 | excluded — owned by cloud |
| caching | 캐싱 | 분야 표준 | excluded — owned by data |
| taxonomy-tagging | 분류 코드 · 태깅 | 분야 표준 | excluded — owned by search |
| inverse-index | 상품 검색 색인 · 질의 | shop-ux spec | excluded — owned by search |
| rec-personalized-slot | 개인화 추천 슬롯 | 분야 표준 | excluded — owned by recommendation |
| ctr | 클릭률 (CTR) | 분야 표준 | excluded — owned by ads |
