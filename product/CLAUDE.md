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
- **상품은 판매자 소유다** (`products.seller_id`, ADR-0099 §8). 쓰기는 어드민 또는 **ACTIVE 판매자 행**(`product_seller`,
  `seller.seller.*` 이벤트로 채우는 읽기 모델, memberId == `X-User-Id`) + 토큰의 ROLE_SELLER. 판매자는 자기 상품만 고친다.
  등록 시 `seller_id` 는 본문이 아니라 `ProductWriteAuthorizer.authorizeCreate` 가 돌려준 값이다 — 판매자 행이 없는 어드민과
  `/internal` 일괄 적재는 플랫폼 기본 판매자(1). 기존 상품도 1 로 백필했다
- Kafka 발행 토픽(**아웃박스**, 키 = productId): `product.item.created`, `product.item.updated` (페이로드에 `sellerId`, 원 단위 정수 `price`, `occurredAt`).
  수신: order 읽기 모델(`order-read-model`) · search.
- Kafka 소비: `inventory.stock.{reserved,released,confirmed,received,restocked}`(그룹 `product-stock-sync`, 재고 사본) ·
  `seller.seller.*`(그룹 `product-seller-sync`, `product_seller` 읽기 모델). DLT 는 `<원 토픽>.DLT` → `product-dlt-ops` 가
  운영 이슈로 적재, `/api/v1/admin/products/ops-issues` 재시도 = 원 토픽 재발행
  새 가격은 원 단위 정수만 받는다(`Money.isWholeWon`) — 컬럼 DECIMAL 은 확장-축소로 옮길 때까지 둔다.
  전 상품 재발행은 어드민 `POST /api/v1/admin/products/republish` (order 읽기 모델 채우기, 배포 뒤 1회)
- Search 서비스가 위 토픽을 소비하여 ES 인덱싱 — 토픽 스키마 변경 시 Search Consumer 영향 확인 필수

## Docs

- [서비스 상세](docs/service.md) — 도메인 모델, 포트, 인프라 어댑터
