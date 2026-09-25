# 보류 마이그레이션 — 금액 축소 단계 (SR-13)

확장 단계(`V20260925_001__add_products_price_won` · `V20260924_002__add_order_items_unit_price_won`)는 배포됐고,
코드는 새 컬럼(`price_won` · `unit_price_won`)을 읽고 옛 컬럼(`price` · `unit_price`)에도 같은 값을 쓴다.
여기 파일은 **마이그레이션 디렉터리 밖**에 둔 다음 단계 초안이다 — 디렉터리에 넣는 순간 다음 기동에서 돈다.

## 선행 조건 (이번 배포에서 끝남)

- search:batch `ProductDbReindexJobConfig` 가 `price_won` 을 읽는다 — 옛 `price` 를 SQL 로 부르던 유일한 외부 리더였다.
  레포 전체(kt·py·sql·sh·yaml)를 `products.price`·`order_items.unit_price` 로 다시 찾아 다른 리더가 없음을 확인했다.
- 운영에서 search 배치 이미지가 이 판으로 바뀐 것을 확인한 뒤 1단계로 간다(옛 배치 이미지가 남아 있으면 2단계 뒤 재색인이 깨진다).

## 1단계 배포 — `*-01-*.sql` + 코드

1. 두 파일을 각 모듈 마이그레이션 디렉터리에 `V<배포일>_001__…` 이름으로 옮긴다(버전은 그 시점의 마지막 버전 뒤로).
2. 같은 커밋에서 엔티티가 옛 컬럼을 더 이상 쓰지 않게 한다 —
   `ProductJpaEntity.price`(BigDecimal) 와 `OrderItemJpaEntity.unitPrice` 매핑을 지우고, 새 컬럼을 non-null 로(`priceWon: Long`).
3. 옛 컬럼을 지우지 않고 NULL 만 허용하는 이유: 롤링 배포 동안 옛 파드가 옛 컬럼을 계속 쓰고, 새 파드는 안 쓴다.
   NOT NULL 인 채로 두면 새 파드의 INSERT 가 깨지고, 지우면 옛 파드의 INSERT 가 깨진다.
4. 가드: 백필 뒤에도 비어 있거나 소수부가 있는 행이 있으면 임시 테이블 CHECK 로 마이그레이션이 DDL 전에 실패한다
   (서비스가 뜨지 않는다 — 데이터를 고치고 다시 기동). 확장 단계 가드와 같은 방식이다.

배포 전 운영 확인(읽기 전용):

```bash
oci-mysql product_db "SELECT COUNT(*) AS null_won FROM products WHERE price_won IS NULL"
oci-mysql order_db   "SELECT COUNT(*) AS null_won FROM order_items WHERE unit_price_won IS NULL"
```

## 2단계 배포 — `*-02-*.sql`

1단계 배포의 옛 파드가 모두 내려가고(`kubectl rollout status`) 롤백할 일이 없어진 다음 배포에서 옮긴다.
이 뒤로는 확장 단계 이전 코드로 롤백할 수 없다.

## 검증

- 1단계: `OrderSheetIntegrationSpec` 이 확장 마이그레이션을 버전 지정으로 돌리는 것처럼, 1단계 파일도 Testcontainers 에서
  NULL 행 하나를 넣고 돌려 가드가 실패하는지(빨간불)와 백필 뒤 NOT NULL 이 되는지를 본다.
- 2단계: 컨텍스트 로드(ddl validate) — 엔티티에 옛 컬럼 매핑이 남아 있으면 기동에서 걸린다.
