# Order Service

## Overview

주문 도메인을 소유하는 커머스 서비스.
주문 생성, 상태 전이, 외부 결제 연동을 담당한다.

## Module Structure

| Gradle path | Filesystem | Role |
|---|---|---|
| `:order:domain` | `order/domain/` | 순수 도메인 (Spring/JPA 없음) |
| `:order:app` | `order/app/` | Spring Boot 앱 (Application + Infrastructure + Presentation) |

## Base Package

`com.kgd.order`

## Domain Model

- **Order** (Aggregate Root): 주문 생성, 상태 전이 관리
- **OrderItem** (Entity): 주문 항목 (상품 ID, 수량, 가격)
- **Money** (Value Object): 금액 표현
- **OrderStatus** (Enum): 주문 상태 (PENDING, CONFIRMED 등)

## Ports

| Port | Type | Location |
|------|------|----------|
| `OrderRepositoryPort` | Outbound | `application/order/port/` |
| `OrderEventPort` | Outbound | `application/order/port/` |
| `PaymentPort` | Outbound | `application/order/port/` |
| `PlaceOrderUseCase` | Inbound | `application/order/usecase/` |
| `GetOrderUseCase` | Inbound | `application/order/usecase/` |

## Infrastructure Adapters

- **OrderRepositoryAdapter**: JPA 기반 DB 접근 (`persistence/order/adapter/`)
- **OrderEventAdapter**: Kafka Producer (`messaging/`)
- **PaymentAdapter**: WebClient 기반 외부 결제 API (`client/`)

## Data Ownership

- `order_db` (MySQL) 완전 소유
- Master/Replica 구조

## Kafka Events Published

| Topic | Trigger |
|-------|---------|
| `order.order.completed` | 주문 완료 시 |
| `order.order.cancelled` | 주문 취소 시 |

## External Dependencies

- **Payment API**: WebClient + CircuitBreaker (Resilience4j)
- Product 서비스 직접 참조 금지 (API 호출만 허용)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders` | 주문 생성 |
| GET | `/api/orders/{id}` | 주문 단건 조회 |

## Port

- 내부: 8082

## Build

```bash
./gradlew :order:app:build
./gradlew :order:domain:test
./gradlew :order:app:bootJar
```
