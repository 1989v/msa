# Kafka Topic Convention

## 형식

`{domain}.{entity}.{event}`

## 토픽 목록

### commerce 주문 흐름 (ADR-0099)

사가·클레임이 주고받는 명령·답의 키는 전부 **orderId** — 한 주문의 명령과 답이 한 파티션에서 순서대로 온다.
읽기 모델·동기화 이벤트의 키는 그 엔티티 id(상품·판매자·쿠폰 정의·회원). 모든 발행은 도메인별 아웃박스를 거친다
(릴레이가 `partition_key`, 없으면 `aggregate_id` 를 키로 쓴다).

| 토픽 | 발행 | 수신 (컨슈머 그룹) |
|------|------|------|
| `inventory.command.{reserve,confirm,release,restock}` | order (사가·클레임) | inventory (`inventory-service`) |
| `inventory.reservation.{reserved,failed,confirmed,released,restocked,expired}` | inventory | order (`order-saga`; `restocked`·`failed` 는 `order-claim` 도) |
| `inventory.stock.{reserved,released,confirmed,received,restocked}` | inventory | product (`product-stock-sync`) |
| `promotion.command.{reserve,confirm,cancel,restore}` | order (사가·클레임) | promotion (`promotion-service`) |
| `promotion.hold.{reserved,failed,confirmed,cancelled,expired,restored}` | promotion | order (`order-saga` · `order-read-model`; `restored`·`failed` 는 `order-claim` 도) |
| `promotion.coupon.{defined,issued}` · `promotion.point.changed` | promotion | order (`order-read-model`) |
| `payment.command.{authorize,capture,void,refund}` | order (사가·클레임) | payment (`payment-service`) |
| `payment.payment.{authorized,failed,unknown,captured,voided}` | payment | order (`order-saga`) |
| `payment.payment.refunded` | payment | order (`order-claim`) |
| `payment.reconciliation.settled` | payment | settlement (`settlement-ledger`) |
| `fulfillment.command.{create,cancel}` | order (사가·클레임) | fulfillment (`fulfillment-service`) |
| `fulfillment.order.created` | fulfillment | order (`order-saga` · `order-claim`) |
| `fulfillment.order.{cancelled,cancel-rejected,shipped,delivered}` | fulfillment | order (`order-claim`) |
| `fulfillment.order.status-changed` | fulfillment (REST 수동 전이) | — |
| `order.order.confirmed` · `order.claim.refunded` · `order.line.purchase-confirmed` | order | settlement (`settlement-ledger`) |
| `seller.seller.{applied,approved,suspended,reactivated,updated}` | seller | order (`order-read-model`) · product (`product-seller-sync`) · settlement (`settlement-ledger`) · auth (`auth-seller-role`, approved·suspended·reactivated 만) |
| `product.item.created` · `product.item.updated` | product (아웃박스) | order (`order-read-model`) · search (`search-indexer`) |

**은퇴한 토픽 — 다시 쓰지 않는다.** `order.order.completed` · `order.order.cancelled` 는 옛 코레오그래피(ADR-0032)의 토픽이다.
`COMPLETED` 가 구매 확정으로 재정의돼 이름을 되살리면 옛 의미의 이벤트가 새 의미로 읽힌다. 이것들을 받던 inventory·fulfillment
구독(`inventory.stock.reserved` → 이행 생성, `fulfillment.order.shipped`·`cancelled` → 재고 확정·해제 포함)도 명령 토픽으로 대체됐다.

### 그 밖

| 토픽 | 발행 서비스 | 수신 서비스 |
|------|------------|------------|
| `search.impression.logged` | search | analytics | <!-- ADR-0043 -->
| `search.click.logged` | search | analytics | <!-- ADR-0043 -->
| `analytics.bandit.state.snapshot` | analytics | (선택) monitoring | <!-- ADR-0043 -->
| `analytics.score.updated` | analytics | search | <!-- ADR-0017 -->
| `analytics.event.collected` | (multi) — ads(engagement:app 폴드)는 수락한 광고 노출·클릭 사본을 Outbox 없이 발행 | analytics | <!-- ADR-0017 · ADR-0098 -->
| `game.session.started` | game (code-dictionary:app 폴드) | analytics | <!-- ADR-0059 -->
| `game.session.ended` | game (code-dictionary:app 폴드) | analytics | <!-- ADR-0059 -->
| `game.ad.logged` | game — ads 페이즈에서 발행 예정 | analytics (예정) | <!-- ADR-0059 -->

Consumer groups (ADR-0043):
- `analytics-bandit-impression` (`search.impression.logged` 수신)
- `analytics-bandit-click` (`search.click.logged` 수신)

## Consumer Group ID

형식: `{service}-{purpose}` (예: `search-indexer`, `inventory-service`, `fulfillment-service`, `product-stock-sync`, `order-saga`, `settlement-ledger`, `payment-dlt-ops`)

## Dead Letter Queue (DLQ)

처리 실패 메시지는 원래 토픽에 **`.DLT`** 접미사가 붙은 토픽의 같은 파티션으로 간다 (`<원 토픽>.DLT`).
Spring Kafka 4 의 `DeadLetterPublishingRecoverer` 기본값은 `-dlt` 라 규약과 다르다 — commerce 도메인은 common
`DltKafka.deadLetterRecoverer` 로 이름을 명시한다. 새 컨슈머도 이 함수를 쓴다.

- 재시도: 1초 간격(`FixedBackOff(1000, 3)`), 최대 3회 → DLT. 원 헤더와 예외·원 위치 헤더(`kafka_dlt-*`)가 붙는다
- commerce: 도메인마다 `{domain}-dlt-ops` 그룹이 `.*\.DLT` 를 패턴 구독하고, **원 컨슈머 그룹 헤더가 자기 도메인 것인 레코드만**
  그 도메인 `ops_issue` 에 `DLT` 이슈로 적재한다. 어드민 재시도 = 원 토픽으로 재발행. DLT 리스너에는 DLT 발행기를 붙이지 않는다(`x.DLT.DLT` 순환 방지)
- search-consumer·analytics 는 지금 DLT 발행기를 두지 않는다(예전 표에 있던 `search.*.DLT` 는 배선된 적이 없다)
- 업무상 실패(재고 부족·만료·거절)는 DLT 가 아니라 `…failed{reason}` 답 이벤트다. DLT 는 계약 위반(필드 누락·금액 불일치)과 인프라 오류만

DLT 토픽은 원 토픽 이름에서 기계적으로 나온다 — 원 토픽 하나마다 하나. 운영 클러스터가 토픽 자동 생성을 끈 환경이면
`k8s/infra/prod/strimzi/kafka-topics.yaml` 에 원 토픽과 함께 선언한다.

### AckMode

모든 서비스의 `kafkaListenerContainerFactory`는 `AckMode.RECORD`를 사용한다.
성공 시 Spring Kafka가 자동으로 offset을 커밋하고, 실패 시 `DefaultErrorHandler`가 재시도 후 DLQ로 전송한다.
