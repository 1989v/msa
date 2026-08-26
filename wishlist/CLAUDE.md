# Wishlist Service

회원별 찜하기(다형 대상) 서비스 — 상품·게임·관광지·블로그 글 (ADR-0074).
관광지는 **여행 묶음(컬렉션)** 으로 모을 수 있다 (ADR-0080).
commerce:app 에 폴드된 라이브러리 모듈 (ADR-0058 round 2).

## Modules

| Gradle path | 역할 |
|---|---|
| `:wishlist:domain` | Pure Kotlin 도메인 (WishlistItem, WishlistTargetType, WishlistCollection) |
| `:wishlist:feature` | 비-bootable 라이브러리 — commerce:app 이 폴드 (전용 datasource wishlist_db) |

## 구조 상태 (ADR-0083)

표준 준수 — UseCase 인터페이스 5 · `WishlistRepositoryPort` · adapter · 테스트 있음. 부채 없음.
전용 datasource 형 `:feature` 의 `build.gradle.kts` 원본으로 쓴다 (신규 도메인 체크리스트 §1).

## Commands

```bash
./gradlew :wishlist:feature:build    # 빌드
./gradlew :wishlist:domain:test      # 도메인 테스트 (Spring context 없음)
./gradlew :commerce:app:build        # 배포 단위(폴드 앱) 빌드
```

## Key Rules

- `WishlistItem(memberId, targetType, targetKey)` — targetType ∈ {PRODUCT, GAME, ATTRACTION, BLOG_POST}
- targetKey 는 **불투명 문자열** (game·blog=slug, product·attraction=숫자 id 문자열). FK/조인 없음 —
  대상 검증·상세 하이드레이션은 FE 가 각 서비스 공개 API 로 (ADR-0074)
- (member_id, target_type, target_key) unique — 중복 찜 방지. PUT/DELETE 는 멱등
- **묶음은 nullable** (ADR-0080): `collection_id IS NULL` 이 미분류다 — '기본' 묶음 행을 만들지 않는다.
  한 항목은 한 묶음에만 속한다(유니크를 넓히지 않는다 — 넓히면 하트의 '찜됨/아님' 이진 의미가 무너진다).
  묶음 FK 는 `ON DELETE SET NULL` — **묶음을 지워도 찜은 남는다**
- 묶음 API 는 전부 `memberId` 와 함께 조회한다 — id 가 URL 로 들어오므로 남의 묶음을 건드릴 수 있으면 안 된다
- 스키마는 범용이지만 **그룹 선택 UI 는 ATTRACTION 에만** 노출한다 (전 타입에 열면 찜의 가벼움이 사라진다)
- memberId 는 X-User-Id 헤더 (게이트웨이가 ROLE_USER 검증 후 주입 — 찜은 로그인 전용)
- Kafka 소비: `product.deleted` → PRODUCT 타입 찜 삭제 / `member.withdrawn` → 회원 찜 전체 삭제
- 스키마는 `wishlistdb/migration` + ScopedFlywayMigrator (baseline=1, 토글 `wishlist.flyway.enabled`)

## API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| PUT | `/api/v1/wishlist/{targetType}/{targetKey}` | 찜 추가 (멱등) |
| DELETE | `/api/v1/wishlist/{targetType}/{targetKey}` | 찜 해제 (멱등) |
| GET | `/api/v1/wishlist?type=&collectionId=&unclassified=&page=&size=` | 내 찜 목록 (최신순). `collectionId` 생략은 **전체**이지 미분류가 아니다 — 미분류만 보려면 `unclassified=true` |
| GET | `/api/v1/wishlist/keys?type=` | 타입별 내 찜 키만 — 목록 화면 "찜됨" 하이드레이션용 |
| GET | `/api/v1/wishlist/collections` | 내 묶음 목록 (항목 수 포함) |
| POST | `/api/v1/wishlist/collections` | 묶음 생성 |
| PATCH | `/api/v1/wishlist/collections/{id}` | 묶음 이름 변경 |
| DELETE | `/api/v1/wishlist/collections/{id}` | 묶음 삭제 (소속 찜은 미분류로 남음) |
| PATCH | `/api/v1/wishlist/{targetType}/{targetKey}/collection` | 찜을 묶음으로 이동 (`collectionId: null` = 미분류) |
