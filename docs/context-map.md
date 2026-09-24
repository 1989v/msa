# Context Map — Commerce Platform (MSA)

> 본 문서는 멀티 Bounded Context(BC) 프로젝트의 **glossary 위치 인덱스**다.
> 각 BC는 자체 `glossary.md`(유비쿼터스 사전)를 가지며, `/hns:glossary` 등 hns 스킬은 이 매핑을 따른다.
>
> 표준 정의 → `hns` 플러그인 `references/language-reference.md`

## Status

- **Phase**: Bootstrap (auto-scan 1차 draft)
- **Source**: `/hns:glossary --scan` (hns v0.8.0, 자동 추출 시점: 2026-05-11)
- **Next**: 각 BC에서 `/hns:glossary` 새 세션 실행 → grilling → Definition/Avoid/Code 보강

## BC ↔ Glossary 매핑

| BC | Root | Glossary | 핵심 도메인 명사 (auto-extracted) |
|---|---|---|---|
| product | `product/` | `product/glossary.md` | Product, Money |
| order | `order/` | `order/glossary.md` | Order, OrderItem, OrderSaga, Claim, OrderSheet, Allocation |
| search | `search/` | `search/glossary.md` | ProductDocument, BanditState, BanditPosterior |
| member | `member/` | `member/glossary.md` | Member, SsoProvider |
| auth | `auth/` | `auth/glossary.md` | Role, AuthProvider, MemberRole |
| inventory | `inventory/` | `inventory/glossary.md` | Inventory, Reservation, InventoryEvent |
| fulfillment | `fulfillment/` | `fulfillment/glossary.md` | FulfillmentOrder |
| warehouse | `warehouse/` | `warehouse/glossary.md` | Warehouse |
| seller | `seller/` | `seller/glossary.md` | Seller, SellerStatus, SettlementCycle, SellerAdminAction |
| payment | `payment/` | `payment/glossary.md` | Payment, PaymentRefund, OpsIssue, ReconciliationRecord |
| promotion | `promotion/` | `promotion/glossary.md` | CouponDefinition, UserCoupon, PointBalance, PromotionHold |
| settlement | `settlement/` | `settlement/glossary.md` | Journal, JournalEntry, SettlementStatement, SettlementItem |
| gifticon | `gifticon/` | `gifticon/glossary.md` | Gifticon, Brand, ExpiryDate, ShareGroup, ShareMember, ViewMark |
| chatbot | `chatbot/` | `chatbot/glossary.md` | Conversation, Message, AccessDecision |
| analytics | `analytics/` | `analytics/glossary.md` | KeywordScore, ProductScore, ScoreStats |
| experiment | `experiment/` | `experiment/glossary.md` | Experiment, Variant, StatisticalSignificance |
| ads | `ads/` | `ads/glossary.md` | Advertiser, Campaign, Creative, AdPlacement, ContextCategory, LedgerTransaction, LedgerEntry, ServeClaims |
| wishlist | `wishlist/` | `wishlist/glossary.md` | WishlistItem |
| quant | `quant/` | `quant/glossary.md` | Asset, Execution, Fundamentals, KillSwitch, HybridStrategy, OrderCommand, PriceTick, RiskLimit |
| blog | `blog/` | `blog/glossary.md` | BlogProfile, BlogCategory, BlogPost, BlogComment, VoterKey |
| code-dictionary | `code-dictionary/` | `code-dictionary/glossary.md` | Concept, CodeLocation, ConceptIndex |

## Commerce 관계 (ADR-0099)

commerce 호스트의 열 도메인은 같은 JVM 이어도 Kafka 로만 주고받는다. 토픽 표는 `docs/architecture/kafka-convention.md`.

| 상류 → 하류 | 관계 | 무엇이 흐르나 |
|---|---|---|
| order → inventory · promotion · payment · fulfillment | 오케스트레이션 (명령 / 답) | 사가·클레임 명령 `*.command.*` → 답 `inventory.reservation.*` · `promotion.hold.*` · `payment.payment.*` · `fulfillment.order.*` (키 = orderId) |
| product · seller · promotion → order | 게시 이벤트 → 읽기 모델 | 상품·판매자·쿠폰 정의·사용자 쿠폰·포인트 잔액 사본 — 주문서 견적용 |
| order → settlement | 게시 이벤트 | `order.order.confirmed` · `order.claim.refunded` · `order.line.purchase-confirmed` — 라인·안분·수수료를 싣고 온다 |
| payment → settlement | 게시 이벤트 | `payment.reconciliation.settled` — PG 입금 |
| seller → auth · product · settlement | 게시 이벤트 | `seller.seller.*` — auth 는 ROLE_SELLER 만 부여·회수, product 는 쓰기 권한 판정, settlement 는 정산 주기 |
| inventory → product | 게시 이벤트 | `inventory.stock.*` — 재고 사본 |

settlement 는 발행하는 토픽이 없는 하류 끝이고, 어느 도메인도 다른 스키마를 읽지 않는다.

## Cross-Context Shared Terms

여러 BC에서 동일 단어가 등장할 때 의미가 다르면 BC별로 정의를 분리해야 한다.

- **Money** — product, order 양쪽에서 등장 (현재는 동일 의미로 추정) → 정의 일치 여부 확인 필요
- **Order** — order BC의 핵심 도메인, fulfillment의 `FulfillmentOrder`, quant의 `OrderCommand`와 명확히 구분 필요
- **확정** — order 의 결제 확정(`CONFIRMED`)·구매 확정(`COMPLETED`), inventory 예약 확정, promotion 보류 확정, settlement 정산서 확정(`CONFIRMED`)은 서로 다른 것이다. 문장에 주어를 붙인다
- **원장** — settlement 원장(판매자 돈의 복식부기)과 ads 원장(가상 크레딧), promotion 포인트 원장은 다른 원장이다
- **혜택** — promotion(쿠폰·포인트)과 deal(혜택 링크 허브)은 다른 BC다. commerce 주문 흐름의 「혜택」은 promotion 이다
- **Reservation** — inventory BC의 핵심 도메인, mrt-package의 외부 `reservation`과 혼동 주의
- **Placement** — common `Placement`(추천·검색 노출 위치)와 ads 의 **지면**(`AdPlacement`, 광고가 들어가는 자리)은 다른 개념. ads 안에서는 「지면」으로만 부른다
- **Money** 와 **크레딧** — ads 의 크레딧은 가상 단위(정수 마이크로 크레딧)라 product·order 의 `Money` 로 부르지 않는다
- **Role** — auth BC가 권한 모델로 정의. member BC의 `MemberRole`은 auth의 Role을 참조하는 외래 개념

## Excluded
- **agent-viewer** — `api` 모듈만 존재, 자체 도메인 없음 (다른 BC의 viewer)
- **common** — 인프라 공통, 도메인 어휘 없음
- **gateway** — 인프라 (K8s DNS 라우팅; discovery/Eureka 는 ADR-0019 에서 제거됨)

## How to Use

1. 새 피처 작업 시작 시 어느 BC인지 식별
2. 해당 BC의 `{bc}/glossary.md` 로드
3. `/hns:start`는 이 매핑을 PHASE 0에서 자동 참조
4. 용어 충돌·신조어 발견 시 `/hns:glossary --conflict {term}`

## Maintenance

- 새 BC 추가 시 위 표에 한 줄 + `{bc}/glossary.md` 생성
- BC 이름 변경 시 Migration 로그를 ADR로 작성 (`docs/adr/`)
- Cross-Context Shared Terms는 정기적으로 (분기 1회 권장) 점검 — 동의어 충돌 회귀 차단
