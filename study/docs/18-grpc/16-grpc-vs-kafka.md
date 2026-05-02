---
parent: 18-grpc
seq: 16
title: gRPC vs Kafka — 동기 RPC 와 비동기 이벤트의 역할 분리
type: deep
created: 2026-05-01
---

# 16. gRPC vs Kafka

> 면접 단골: "둘 차이가 뭐예요?" — 본질은 **시간 결합 / 위치 결합 / 영속성** 의 차이.

## 1. 본질의 차이

| 축 | gRPC | Kafka |
|---|---|---|
| **시간 결합** | 강함 (요청-응답, 둘 다 살아 있어야) | 약함 (서로 다른 시간에 읽기/쓰기) |
| **위치 결합** | 강함 (호스트/포트 인지) | 약함 (브로커만 알면 됨) |
| **영속성** | 없음 (메시지가 즉시 소비) | 강함 (디스크 보관 + retention) |
| **재처리** | 불가 | 가능 (offset replay) |
| **소비자 모델** | 1:1 (호출자 → 응답자) | 1:N pub/sub + consumer group |
| **Backpressure** | HTTP/2 flow control | partition / consumer lag |
| **메시지 순서** | 단일 stream 순서 | partition 내 순서 |
| **응답** | 동기 응답 가능 | 응답 의미 없음 (별도 메커니즘) |

## 2. 핵심 mental model

```
gRPC = "지금 당장 답을 받아야 하는 함수 호출"
        예: 결제 승인, 재고 검증, 인증 토큰 검증

Kafka = "이 일이 일어났음을 (영구히) 알리고, 누군가 처리할 것이다"
         예: 주문 발생, 사용자 가입, 재고 변동, 검색 인덱스 갱신
```

## 3. 시나리오 매핑

| 시나리오 | 어디로 | 왜 |
|---|---|---|
| 사용자가 주문 버튼 누름 → 결제 결과 즉시 표시 | **gRPC** (또는 REST) | 동기 응답 필요 |
| 주문 발생 → search 색인 갱신 | **Kafka** | 동기 안 해도 됨, 영속성 + 재처리 가치 |
| 회원가입 → 환영 메일 발송 | **Kafka** | 메일 실패 시 retry, 시간 결합 분리 |
| 트래픽 분석 / 메트릭 ingestion | **Kafka** | 영속성 + 일괄 처리 |
| K8s health check | **gRPC** (직접 호출) | 즉시 응답 |
| 재고 예약 (강한 정합성) | **gRPC** + DB Tx | 결과를 기다려야 함 |
| 재고 변동 → 알림 | **Kafka** | 비동기 OK |
| 채팅 메시지 | **gRPC bidi** 또는 **Kafka** + 별도 fanout | 양쪽 다 가능 (시나리오 따라) |
| 결제 완료 → 회계 / 정산 | **Kafka** | 영속성 / 재처리 / 다수 소비자 |

## 4. msa 의 ADR-0003 와 정합

ADR-0003 의 결정:
> 동기: WebClient + Resilience4j (Gateway → 내부 서비스, 외부 API)
> 비동기: Kafka (도메인 이벤트, 검색 인덱스 갱신)
> Kafka 토픽: `{domain}.{entity}.{event}` (예: `product.item.created`, `order.order.placed`)

gRPC 는 **동기 자리** 의 후보. Kafka 자리는 그대로 유지. ADR-0003 의 "WebClient" 가 "WebClient 또는 gRPC" 가 되는 갱신.

## 5. 함정: streaming vs Kafka

gRPC 의 server-streaming / bidi 가 Kafka 와 비슷해 보이는 함정.

| 비교 | gRPC streaming | Kafka |
|---|---|---|
| 영속성 | 메모리만 | 디스크 |
| 재처리 | 불가 (stream 종료 = 손실) | 가능 (offset replay) |
| 다수 소비자 | 1:1 stream | 1:N consumer group |
| 클라 종료 시 | 메시지 영구 손실 | broker 에 남음 |
| 백프레셔 | HTTP/2 flow control | consumer lag |
| 순서 보장 | 단일 stream 내 강함 | partition 내 강함 |

⇒ **streaming = transient real-time push, Kafka = persistent event log**. 같지 않다.

### 잘못된 사용 예

> "주문 이벤트를 server-streaming 으로 search 에 push 하자"

문제:
- search 가 재시작하면 그 사이 이벤트 손실
- 두 search instance 가 같은 이벤트 처리 시도 (중복)
- replay 불가 → 인덱스 재구축 불가

→ Kafka 사용. gRPC streaming 은 **클라가 종료해도 OK 한 임시 데이터** (시세 push, 진행 상황 표시) 에만.

## 6. 함정: gRPC 동기 RPC vs Kafka request-reply

> "Kafka 로도 RPC 흉내 가능 (request topic + reply topic)"

가능하지만 **거의 항상 안티패턴**:
- latency ↑ (broker 경유)
- 응답 매칭 (correlation id) 직접 구현
- timeout / 에러 처리 복잡
- broker 장애 시 hang
- 디버깅 어려움

⇒ 동기 응답이 필요하면 **gRPC (또는 REST)** 직접. Kafka request-reply 는 *특수 시나리오* (대용량 비동기 작업 결과 가져오기) 에만.

## 7. 같이 쓰는 표준 패턴

### 7-1. CQRS + Event Sourcing

```
Write side: Client → gRPC → CommandService → DB → Kafka (event)
Read side:  Kafka → Projector → ReadModel DB → gRPC ← Client
```

- 명령 = 동기 (gRPC)
- 이벤트 = 비동기 (Kafka)
- 조회 = 동기 (gRPC, read model)

### 7-2. Outbox 패턴 (msa 의 ADR-0011)

```
gRPC CreateOrder
   ↓
DB Tx { INSERT order, INSERT outbox_event }
   ↓ commit
Kafka Connect (Debezium) → Kafka topic
   ↓
다수 consumer (search, fulfillment, analytics)
```

- 동기 응답 = gRPC (주문 ID 반환)
- 후속 처리 = Kafka

→ msa 의 outbox 패턴은 그대로, 동기 진입점만 gRPC 화 가능.

### 7-3. Saga choreography

```
order-service: gRPC CreateOrder → Kafka order.placed
inventory: subscribe order.placed → 예약 → Kafka inventory.reserved
fulfillment: subscribe inventory.reserved → 출고 시작
```

- 동기 진입 = gRPC (또는 REST)
- 서비스 간 상태 전파 = Kafka (영속성 + 재처리)

→ ADR-0011 의 패턴 그대로.

## 8. 비교 표 — "어느 도구로 할까"

| 요구사항 | 답 |
|---|---|
| "지금 결과를 받아야 한다" | gRPC (동기) |
| "이 일이 일어났음을 모두 알아야 한다" | Kafka (이벤트) |
| "재처리가 필요하다" | Kafka |
| "다수 소비자가 같은 이벤트 처리" | Kafka |
| "단일 클라가 단일 서버에 호출" | gRPC |
| "low latency 동기 응답" | gRPC |
| "느슨한 결합 (서비스 간 시간/위치)" | Kafka |
| "schema 강제 (동기)" | gRPC |
| "schema 강제 (비동기)" | Kafka + Schema Registry |
| "외부 API 호출" | REST (gRPC, Kafka 둘 다 거의 안 받음) |
| "브라우저 직접" | REST / WebSocket / gRPC-Web |

## 9. msa 의 통합 그림 (gRPC 도입 후 가상)

```
       ┌─────────┐
User → │ gateway │ (외부 REST + JWT)
       └────┬────┘
            │ gRPC (mTLS, 동기)
   ┌────────┼─────────┬──────────┐
   ▼        ▼         ▼          ▼
 auth    member    product    order
   │                    ↑        │
   │                    │ gRPC   │ gRPC
   │             search-batch    │
   │                             ▼
   │                        inventory
   │
   │   비동기 이벤트 (Kafka)
   ▼
 ┌──────────────────────────────┐
 │  Kafka                       │
 │  - product.item.created      │
 │  - order.order.placed        │
 │  - inventory.reserved        │
 │  - member.created            │
 └──┬────────┬──────────┬───────┘
    ▼        ▼          ▼
  search  fulfillment  analytics
```

- gRPC = 핫패스 동기
- Kafka = 도메인 이벤트
- 외부 (gateway → 사용자) = REST 유지

## 10. 면접 핵심

> Q: gRPC 와 Kafka 의 차이는?

A: gRPC = 동기 RPC, 시간/위치 결합 강함, 영속성 없음, 1:1 호출. Kafka = 비동기 이벤트 로그, 시간/위치 결합 약함, 영속 + 재처리, 1:N pub/sub. 본질적으로 다른 도구이며 **둘 다 함께 사용** 이 표준 (CQRS, Outbox, Saga).

> Q: gRPC streaming 으로 Kafka 를 대체할 수 있나?

A: 안 된다. Streaming 은 transient real-time push. 클라 종료 = 메시지 영구 손실, 다수 소비자 / 재처리 불가. Kafka 는 영속 event log. 같은 모양처럼 보여도 의미가 다름.

> Q: msa 에 gRPC 도입하면 Kafka 위치는?

A: 그대로 유지. 도메인 이벤트 (`order.placed`, `inventory.reserved`, `member.created`) 는 Kafka, 동기 핫패스 (검증 / 조회 / 명령 진입) 가 gRPC 후보. ADR-0003 의 "WebClient" 자리만 "gRPC 또는 WebClient" 로 갱신.

> Q: Kafka 로 RPC 흉내내면?

A: 가능하나 거의 항상 안티패턴. latency ↑, correlation id 매칭 / timeout / 에러 처리가 복잡. 동기 응답이 필요하면 gRPC (또는 REST) 가 답. Kafka request-reply 는 *대용량 비동기 작업 결과 가져오기* 같은 특수 시나리오에만.

## 다음 학습

- [17-proto-monorepo-strategy.md](17-proto-monorepo-strategy.md) — proto 공유 전략
- [19-improvements.md](19-improvements.md) — 도입 ADR 초안
