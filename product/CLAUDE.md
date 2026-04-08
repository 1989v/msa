# Product Service

상품 CRUD, 상태 관리, 재고 관리를 담당하는 커머스 핵심 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:product:domain` | Pure Kotlin 도메인 (Product, Money, ProductStatus) |
| `:product:app` | Spring Boot 앱 (port 8081) |

## Commands

```bash
./gradlew :product:app:build       # 빌드
./gradlew :product:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :product:app:bootJar     # bootJar 생성
```

## Key Rules

- Product는 **Inventory의 SSOT** — 재고 변경은 반드시 Product를 통해 (ADR-0013)
- Kafka 발행 토픽: `product.item.created`, `product.item.updated`
- Search 서비스가 위 토픽을 소비하여 ES 인덱싱 — 토픽 스키마 변경 시 Search Consumer 영향 확인 필수

## Docs

- [서비스 상세](docs/service.md) — 도메인 모델, 포트, 인프라 어댑터
