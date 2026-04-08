# Wishlist Service

회원별 상품 위시리스트 관리 서비스.

## Modules

| Gradle path | 역할 |
|---|---|
| `:wishlist:domain` | Pure Kotlin 도메인 (WishlistItem) |
| `:wishlist:app` | Spring Boot 앱 (port 8095) |

## Commands

```bash
./gradlew :wishlist:app:build       # 빌드
./gradlew :wishlist:domain:test     # 도메인 테스트 (Spring context 없음)
./gradlew :wishlist:app:bootJar     # bootJar 생성
```

## Key Rules

- memberId + productId unique 제약 (중복 추가 방지)
- memberId는 JWT에서 추출 (X-User-Id 헤더)
- Kafka 소비: `product.deleted` → 해당 상품 위시리스트 항목 삭제
- Kafka 소비: `member.withdrawn` → 해당 회원 위시리스트 전체 삭제
- Wishlist DB 독립

## API Endpoints

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/wishlist/{productId}` | 위시리스트에 상품 추가 |
| DELETE | `/api/wishlist/{productId}` | 위시리스트에서 상품 제거 |
| GET | `/api/wishlist` | 내 위시리스트 목록 (페이징) |
| GET | `/api/wishlist/{productId}/exists` | 위시리스트 존재 여부 |
| DELETE | `/api/wishlist` | 위시리스트 전체 삭제 |
