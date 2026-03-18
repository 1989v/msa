# Product Service

## Overview

상품 도메인을 소유하는 핵심 커머스 서비스.
상품 CRUD, 상태 관리, 재고 관리를 담당한다.

## Module Structure

| Gradle path | Filesystem | Role |
|---|---|---|
| `:product:domain` | `product/domain/` | 순수 도메인 (Spring/JPA 없음) |
| `:product:app` | `product/app/` | Spring Boot 앱 (Application + Infrastructure + Presentation) |

## Base Package

`com.kgd.product`

## Domain Model

- **Product** (Aggregate Root): 상품 생성, 상태 전이, 가격/재고 관리
- **Money** (Value Object): 금액 표현
- **ProductStatus** (Enum): ACTIVE, INACTIVE 등 상품 상태

## Ports

| Port | Type | Location |
|------|------|----------|
| `ProductRepositoryPort` | Outbound | `application/product/port/` |
| `ProductEventPort` | Outbound | `application/product/port/` |
| `CreateProductUseCase` | Inbound | `application/product/usecase/` |
| `GetProductUseCase` | Inbound | `application/product/usecase/` |
| `UpdateProductUseCase` | Inbound | `application/product/usecase/` |
| `GetAllProductsUseCase` | Inbound | `application/product/usecase/` |

## Infrastructure Adapters

- **ProductRepositoryAdapter**: JPA 기반 DB 접근 (`persistence/product/adapter/`)
- **ProductEventAdapter**: Kafka Producer (`messaging/`)
- **ProductJpaRepository**: Spring Data JPA (`persistence/product/repository/`)
- **ProductQueryRepository**: QueryDSL 기반 복잡 조회 (`persistence/product/repository/`)

## Data Ownership

- `product_db` (MySQL) 완전 소유
- Master/Replica 구조 (Read/Write 분리)

## Kafka Events Published

| Topic | Trigger |
|-------|---------|
| `product.item.created` | 상품 생성 시 |
| `product.item.updated` | 상품 수정 시 |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/products` | 상품 생성 |
| GET | `/api/products/{id}` | 상품 단건 조회 |
| GET | `/api/products` | 상품 목록 조회 |
| PUT | `/api/products/{id}` | 상품 수정 |

## Port

- 내부: 8081

## Build

```bash
./gradlew :product:app:build
./gradlew :product:domain:test    # 도메인 단위 테스트 (Spring context 불필요)
./gradlew :product:app:bootJar
```
