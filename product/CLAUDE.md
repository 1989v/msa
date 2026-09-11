# Product Service

상품 CRUD, 상태 관리, 재고 관리를 담당하는 커머스 핵심 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:product:domain` | Pure Kotlin 도메인 (Product, Money, ProductStatus) |
| `:product:feature` | 비-bootable 라이브러리. `commerce:app` 에 폴드 (ADR-0093). 전용 datasource(product_db)+Flyway 는 `ProductDataSourceConfig` 가 배선 |

## 구조 상태 (ADR-0083)

표준 준수 (2026-08-26, 플랜 P3 완료) — 디렉토리 == 패키지 (`git mv` 35파일, package 무변경). UseCase 인터페이스 5 · Port 2 · Adapter 3. 멱등 원장은 common 엔티티(`ProductProcessedEventRepository` + `@EntityScan`) — 도메인에 `ProcessedEvent*` 를 다시 만들지 않는다. 부채 없음.

## Commands

```bash
./gradlew :commerce:app:build      # 호스트 앱 (product 포함)
./gradlew :product:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :commerce:app:bootJar    # bootJar 생성
```

## Key Rules

- **운영 프로파일은 코드와 따로 움직인다** — 기본 yml 의 `spring.datasource.product.*` 는
  `${PRODUCT_DB_MASTER:localhost:3316}` 이라, `commerce/app/.../application-kubernetes.yml` 에
  product 블록이 없으면 운영에서 localhost 로 붙어 컨텍스트가 죽는다(2026-09-11 실제 장애).
  폴드는 코드만 옮긴다 — 프로파일은 손으로 따라가야 한다
- Product 는 **카탈로그(이름/가격/카테고리/상태 + 영양·원재료·원산지, ADR-0060) 의 SSOT**. **재고(stock) 는 Inventory 서비스가 SSOT** — 재고 조회/변경은 Inventory 를 통해 (ADR-0013)
- 영양 필드는 100g 기준·nullable — 오픈데이터(#15100066) 품목제조보고번호 조인, 미매칭 null (추정 채움 금지)
- Kafka 발행 토픽: `product.item.created`, `product.item.updated`
- Search 서비스가 위 토픽을 소비하여 ES 인덱싱 — 토픽 스키마 변경 시 Search Consumer 영향 확인 필수

## Docs

- [서비스 상세](docs/service.md) — 도메인 모델, 포트, 인프라 어댑터
