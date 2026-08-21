# ADR-0074 — 찜하기: wishlist 를 다형 대상(polymorphic target)으로 재설계

- 상태: 채택 (2026-08-22)
- 관련: ADR-0058(commerce 폴드 — wishlist round 2), ADR-0059(게임), ADR-0065(place), ADR-0072(블로그)

## 맥락

게임·관광지·블로그 글(+상품)에 찜하기 버튼을 달고, 로그인 사용자가 내 찜만 모아보는
화면을 만든다. 백엔드에는 wishlist 서비스가 이미 있지만 **회원×상품 전용**이고,
확인 결과 FE 소비자가 하나도 없다 — portal-fe 어디에서도 `/api/wishlist` 를 부르지 않는다.

소비자가 없으므로 구 API 와의 호환 브리지를 만들 이유가 없다(레포 원칙: 최신 컨벤션 우선,
레거시 브리지 금지). 상품 전용 모델을 대상 불문 모델로 바꾸는 재설계가 정답이다.

## 결정

### 1) 도메인 — `WishlistItem(memberId, targetType, targetKey)`

- `targetType ∈ {PRODUCT, GAME, ATTRACTION, BLOG_POST}` — enum STRING (jpa-persistence §2).
- `targetKey VARCHAR(120)` — 도메인마다 키 모양이 다르다(game·blog=slug 문자열,
  attraction·product=숫자 id). 전부 문자열 opaque key 로 통일한다.
- unique `(member_id, target_type, target_key)` — 같은 대상 중복 찜 방지.
- **키는 불투명 값이다.** wishlist 는 대상 서비스의 DB 를 참조하지 않고 FK/조인도 없다
  (서비스 간 DB 공유 금지). 대상의 존재 검증·상세 하이드레이션은 FE 가 각 서비스의
  공개 API 로 한다. 대상이 사라진 찜은 목록 화면이 건너뛴다.

### 2) API — `/api/v1/wishlist` 로 현대화

| Method | Path | 무엇 |
|---|---|---|
| PUT | `/api/v1/wishlist/{targetType}/{targetKey}` | 찜 추가 — **멱등**. 이미 있으면 그 행을 돌려준다 (더블탭이 에러가 되지 않는다) |
| DELETE | `/api/v1/wishlist/{targetType}/{targetKey}` | 찜 해제 — 없어도 성공 (멱등) |
| GET | `/api/v1/wishlist?type=&page=&size=` | 내 찜 목록, 최신순 |
| GET | `/api/v1/wishlist/keys?type=` | 해당 타입의 내 찜 키만 — 목록 화면의 "찜됨" 하이드레이션용 (상세 조인 없이 싸게) |

- 전부 `X-User-Id` 필수. 인증 경계는 게이트웨이다 — `/api/v1/wishlist/**` 는 ROLE_USER
  필터를 거치므로 비로그인은 게이트웨이가 401 로 끊고, 헤더는 신뢰한다 (member 와 동일).
- 구 API(POST/exists/clear-all)는 소비자가 없어 그대로 제거. 중복 추가 예외
  (`WishlistItemDuplicateException`)도 PUT 멱등화로 함께 없앤다.

### 3) 스키마 — 뒤늦은 Flyway 배선 + ALTER 마이그레이션

wishlist 는 지금까지 마이그레이션이 없었다(운영 스키마는 Hibernate 산물). 폴드된 앱이므로
`ScopedFlywayMigrator` 로 배선한다 (`classpath:wishlistdb/migration`,
토글 `wishlist.flyway.enabled`, order/game 과 동일 패턴).

- `V1__baseline.sql` — Hibernate 가 만들어 둔 기존 형태 그대로 (baseline-version=1 로
  기존 운영 DB 에선 skip, 빈 DB 에선 생성).
- `V2__polymorphic_target.sql` — **테이블 신설이 아니라 ALTER**: `target_type`/`target_key`
  추가 → 기존 행을 `PRODUCT`/`CAST(product_id AS CHAR)` 로 백필 → unique 교체 →
  `product_id` 제거. 소비자 제로라 사실상 빈 테이블이지만, 만에 하나 있을 행도 보존되고
  create-new-and-copy 보다 단순하다. `ddl-auto=validate` 는 엔티티와 V2 결과가 일치해 green.

### 4) Kafka 소비자

- `member.withdrawn` → 회원 찜 전체 삭제. 모델 변경과 무관하게 유지.
- `product.deleted` → 기존 동작(해당 상품 찜 삭제)을 **PRODUCT 타입으로 스코프**해서 유지:
  `deleteAllByTarget(PRODUCT, productId)`. 다른 타입의 대상 삭제 이벤트는 구독하지 않는다 —
  게임/관광지/글 삭제는 드물고, 죽은 찜은 조회 화면이 건너뛰므로 실질 피해가 없다 (YAGNI).
  필요해지면 같은 포트로 소비자만 추가하면 된다.

### 5) FE

- 찜은 **로그인 전용** (게임 평점·블로그 좋아요의 기기/방문자 경로와 다르다 — 모아보기가
  본질이라 회원 귀속이어야 한다). 게스트에게도 하트는 보이고, 누르면 로그인으로 보낸다
  (`next` 로 복귀).
- `FavoriteButton` 은 낙관적 토글 + 실패 시 롤백. `useFavorites(type)` 이 `/keys` 를
  React Query 로 캐시해 목록 화면 전체가 쿼리 한 번으로 하이드레이션된다.
- `/favorites` 는 호스트 인식 — game 호스트는 GAME, blog 는 BLOG_POST, place 는
  ATTRACTION 만, apex 는 타입 탭. 카드 상세는 각 서비스 공개 API 로 키별 조회한다.

## 결과

- 새 전시면(예: deal)이 찜을 원하면 enum 값 하나 + FE 통합만 추가하면 된다.
- 대상 서비스와의 결합은 FE 하이드레이션 지점 하나로 좁혀진다 — wishlist 백엔드는
  어떤 대상 서비스도 모른다.
- 구 `/api/wishlist` 경로는 게이트웨이 라우트와 함께 제거됐다 (소비자 제로 확인 후).
