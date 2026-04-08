# Spec — Member + Security(Auth RBAC) + Wishlist

**Date**: 2026-04-09
**Status**: Draft
**Related ADR**: TBD (새 서비스 모듈 추가 + auth 리팩토링)

---

## 1. Overview

3개 도메인을 구현/리팩토링한다:

1. **member**: 회원 식별 서비스 (신규) — 최소 개인정보
2. **auth RBAC**: 기존 auth에서 User 제거 + 역할/권한 기반 접근 제어 추가
3. **wishlist**: 상품 위시리스트 서비스 (신규)

---

## 2. Member Service

### 2.1 모듈 구조

```
member/
├── domain/
│   └── src/main/kotlin/com/kgd/member/domain/
│       ├── model/
│       │   ├── Member.kt          # Aggregate Root
│       │   ├── MemberStatus.kt    # ACTIVE, SUSPENDED, WITHDRAWN
│       │   └── SsoProvider.kt     # KAKAO, GOOGLE
│       └── exception/
│           └── MemberException.kt
├── app/
│   └── src/main/kotlin/com/kgd/member/
│       ├── MemberApplication.kt
│       ├── member/
│       │   ├── usecase/
│       │   │   ├── GetOrCreateMemberUseCase.kt    # SSO 로그인 시 회원 조회/생성
│       │   │   ├── GetMemberProfileUseCase.kt     # 프로필 조회
│       │   │   ├── UpdateMemberNameUseCase.kt     # 이름 수정
│       │   │   └── WithdrawMemberUseCase.kt       # 탈퇴
│       │   ├── service/
│       │   │   └── MemberService.kt
│       │   ├── port/
│       │   │   └── MemberRepositoryPort.kt
│       │   └── controller/
│       │       └── MemberController.kt
│       ├── persistence/
│       │   ├── entity/MemberJpaEntity.kt
│       │   ├── repository/MemberJpaRepository.kt
│       │   └── adapter/MemberRepositoryAdapter.kt
│       └── config/
│           ├── DataSourceConfig.kt
│           └── OpenApiConfig.kt
```

### 2.2 Domain Model

```kotlin
class Member private constructor(
    val id: Long?,
    val email: String,
    val name: String,              // private set + updateName()
    val ssoProvider: SsoProvider,
    val ssoProviderId: String,
    val status: MemberStatus,      // private set
    val createdAt: LocalDateTime
) {
    companion object {
        fun create(email: String, name: String, ssoProvider: SsoProvider, ssoProviderId: String): Member
        fun restore(...): Member
    }
    fun updateName(name: String)
    fun withdraw()                 // status → WITHDRAWN
    fun suspend()                  // status → SUSPENDED
    fun activate()                 // status → ACTIVE
}
```

### 2.3 DB Schema

```sql
CREATE TABLE members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    sso_provider VARCHAR(20) NOT NULL,
    sso_provider_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sso (sso_provider, sso_provider_id)
);
```

### 2.4 API Endpoints

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/members/sso` | SSO 기반 회원 조회/생성 (auth 내부 호출) | 서비스 간 |
| GET | `/api/members/me` | 내 프로필 조회 | ROLE_USER+ |
| PATCH | `/api/members/me/name` | 이름 수정 | ROLE_USER+ |
| DELETE | `/api/members/me` | 회원 탈퇴 | ROLE_USER+ |

> `/api/members/sso`는 auth 서비스만 호출. gateway에서 내부 전용 라우트로 보호.

### 2.5 Kafka Events

- **발행**: `member.withdrawn` — 탈퇴 시 다른 서비스에 알림

---

## 3. Auth Service — RBAC 리팩토링

### 3.1 변경 사항 요약

| 항목 | Before | After |
|------|--------|-------|
| User 모델 | auth 내부 | member 서비스로 이전 |
| JWT 발급 | 자체 TokenAdapter | common JwtUtil 사용 |
| Role | 없음 | ROLE_USER, ROLE_SELLER, ROLE_ADMIN |
| Permission | 없음 | 도메인별 READ/WRITE (Phase 2) |

### 3.2 모듈 구조 변경

```
auth/
├── domain/
│   └── src/main/kotlin/com/kgd/auth/domain/
│       ├── role/
│       │   ├── model/
│       │   │   ├── Role.kt            # ROLE_USER, ROLE_SELLER, ROLE_ADMIN
│       │   │   └── MemberRole.kt      # memberId ↔ Role 매핑
│       │   └── exception/
│       │       └── RoleException.kt
│       └── user/ (삭제 예정)
│           └── model/User.kt → 제거
├── app/
│   └── src/main/kotlin/com/kgd/auth/
│       ├── AuthApplication.kt
│       ├── role/
│       │   ├── usecase/
│       │   │   ├── AssignRoleUseCase.kt
│       │   │   └── GetMemberRolesUseCase.kt
│       │   ├── service/RoleService.kt
│       │   ├── port/RoleRepositoryPort.kt
│       │   └── controller/RoleController.kt
│       ├── user/  (리팩토링)
│       │   ├── usecase/OAuthLoginUseCase.kt   # member API 호출로 변경
│       │   ├── service/AuthService.kt          # 리팩토링
│       │   ├── port/MemberApiPort.kt           # member 서비스 호출 포트
│       │   └── controller/AuthController.kt
│       ├── client/
│       │   ├── MemberApiAdapter.kt             # member 서비스 WebClient
│       │   ├── KakaoOAuthClient.kt
│       │   └── GoogleOAuthClient.kt
│       ├── persistence/
│       │   ├── role/
│       │   │   ├── entity/MemberRoleJpaEntity.kt
│       │   │   ├── repository/MemberRoleJpaRepository.kt
│       │   │   └── adapter/RoleRepositoryAdapter.kt
│       │   └── user/ (삭제)
│       ├── security/
│       │   └── TokenAdapter.kt → 제거 (common JwtUtil 사용)
│       └── config/
│           └── SecurityConfig.kt
```

### 3.3 Domain Model

```kotlin
// Role은 코드 기반 enum으로 관리 (DB 테이블 불필요)
enum class Role {
    ROLE_USER, ROLE_SELLER, ROLE_ADMIN
}

// memberId ↔ Role 매핑
class MemberRole private constructor(
    val id: Long?,
    val memberId: Long,
    val role: Role,
    val assignedAt: LocalDateTime
) {
    companion object {
        fun assign(memberId: Long, role: Role): MemberRole
        fun restore(...): MemberRole
    }
}
```

### 3.4 DB Schema

```sql
-- 기존 users 테이블 → member로 이전 후 삭제

CREATE TABLE member_roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    role VARCHAR(30) NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_member_role (member_id, role)
);
```

### 3.5 OAuth 로그인 플로우 (리팩토링 후)

```
1. Client → Auth: POST /api/auth/oauth/{provider}
2. Auth → OAuth Provider: 인가 코드 교환 → 사용자 정보 획득
3. Auth → Member: POST /api/members/sso (회원 조회/생성)
4. Auth: member_roles 테이블에서 역할 조회 (없으면 ROLE_USER 자동 할당)
5. Auth → common JwtUtil: generateAccessToken(memberId, roles)
6. Auth → Client: JWT 응답
```

### 3.6 API Endpoints

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/auth/oauth/{provider}` | OAuth 로그인 (기존) | 공개 |
| POST | `/api/auth/refresh` | 토큰 갱신 (기존) | 공개 |
| POST | `/api/auth/logout` | 로그아웃 (기존) | ROLE_USER+ |
| GET | `/api/auth/roles/{memberId}` | 회원 역할 조회 | ROLE_ADMIN |
| POST | `/api/auth/roles/{memberId}` | 역할 할당 | ROLE_ADMIN |
| DELETE | `/api/auth/roles/{memberId}/{role}` | 역할 제거 | ROLE_ADMIN |

---

## 4. Gateway — 역할 기반 라우트 필터

### 4.1 접근 제어 정책

```yaml
# 공개 (인증 불필요)
- /api/auth/**
- /api/products (GET)
- /api/gifticons (GET)

# ROLE_USER 이상
- /api/members/me/**
- /api/wishlist/**
- /api/orders (GET, 자기 주문만)
- /api/gifticons/** (POST — 구매)

# ROLE_SELLER 이상
- /api/products/** (POST, PUT, DELETE)
- /api/orders/** (관리)
- /api/inventory/**
- /api/fulfillment/**
- /api/warehouse/**

# ROLE_ADMIN 전용
- /api/auth/roles/**
- /api/admin/**
```

### 4.2 Gateway 필터 변경

`AuthenticationGatewayFilter`에 역할 검증 로직 추가:

```kotlin
// 기존: JWT 검증 → X-User-Id, X-User-Roles 헤더 전파
// 추가: 라우트별 필요 역할 확인
if (!hasRequiredRole(roles, routeConfig.requiredRoles)) {
    exchange.response.statusCode = HttpStatus.FORBIDDEN
    return exchange.response.setComplete()
}
```

라우트 설정에 `requiredRoles` 메타데이터를 추가하는 방식.

---

## 5. Wishlist Service

### 5.1 모듈 구조

```
wishlist/
├── domain/
│   └── src/main/kotlin/com/kgd/wishlist/domain/
│       ├── model/
│       │   └── WishlistItem.kt
│       └── exception/
│           └── WishlistException.kt
├── app/
│   └── src/main/kotlin/com/kgd/wishlist/
│       ├── WishlistApplication.kt
│       ├── wishlist/
│       │   ├── usecase/
│       │   │   ├── AddWishlistItemUseCase.kt
│       │   │   ├── RemoveWishlistItemUseCase.kt
│       │   │   ├── GetWishlistUseCase.kt
│       │   │   ├── CheckWishlistItemUseCase.kt
│       │   │   └── ClearWishlistUseCase.kt
│       │   ├── service/WishlistService.kt
│       │   ├── port/
│       │   │   └── WishlistRepositoryPort.kt
│       │   └── controller/WishlistController.kt
│       ├── persistence/
│       │   ├── entity/WishlistItemJpaEntity.kt
│       │   ├── repository/WishlistItemJpaRepository.kt
│       │   └── adapter/WishlistRepositoryAdapter.kt
│       ├── consumer/
│       │   ├── ProductEventConsumer.kt     # product.deleted 소비
│       │   └── MemberEventConsumer.kt      # member.withdrawn 소비
│       └── config/
│           ├── DataSourceConfig.kt
│           ├── KafkaConfig.kt
│           └── OpenApiConfig.kt
```

### 5.2 Domain Model

```kotlin
class WishlistItem private constructor(
    val id: Long?,
    val memberId: Long,
    val productId: Long,
    val createdAt: LocalDateTime
) {
    companion object {
        fun create(memberId: Long, productId: Long): WishlistItem
        fun restore(...): WishlistItem
    }
}
```

### 5.3 DB Schema

```sql
CREATE TABLE wishlist_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_member_product (member_id, product_id),
    INDEX idx_member_id (member_id)
);
```

### 5.4 API Endpoints

| Method | Path | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/wishlist/{productId}` | 위시리스트에 상품 추가 | ROLE_USER+ |
| DELETE | `/api/wishlist/{productId}` | 위시리스트에서 상품 제거 | ROLE_USER+ |
| GET | `/api/wishlist` | 내 위시리스트 목록 (페이징) | ROLE_USER+ |
| GET | `/api/wishlist/{productId}/exists` | 위시리스트 존재 여부 | ROLE_USER+ |
| DELETE | `/api/wishlist` | 위시리스트 전체 삭제 | ROLE_USER+ |

> memberId는 JWT에서 추출 (X-User-Id 헤더)

### 5.5 Kafka Consumers

| 토픽 | 액션 |
|------|------|
| `product.deleted` | 해당 productId의 모든 위시리스트 항목 삭제 |
| `member.withdrawn` | 해당 memberId의 모든 위시리스트 항목 삭제 |

---

## 6. 인프라 변경

### 6.1 새 DB 스키마

```yaml
# docker/docker-compose.infra.yml 또는 init script
member_db:
  - members 테이블

wishlist_db:
  - wishlist_items 테이블

auth_db (기존):
  - users 테이블 → 삭제 (member로 이전)
  - member_roles 테이블 (신규)
```

### 6.2 settings.gradle.kts

```kotlin
include(
    // 기존...
    "member:domain",
    "member:app",
    "wishlist:domain",
    "wishlist:app"
)
```

### 6.3 docker-compose.yml

member, wishlist 서비스 추가. gateway 라우트 설정에 새 서비스 포함.

---

## 7. 데이터 마이그레이션 계획

### 7.1 auth.users → member.members 이전

학습 프로젝트이므로 단순 오프라인 마이그레이션 전략 채택:

1. **member 서비스 + DB 먼저 배포** (빈 테이블)
2. **마이그레이션 스크립트 실행**: auth_db.users → member_db.members
   ```sql
   INSERT INTO member_db.members (email, name, sso_provider, sso_provider_id, status, created_at)
   SELECT email, name, provider, provider_id, 'ACTIVE', created_at
   FROM auth_db.users;
   ```
3. **auth 서비스 리팩토링 배포**: User 모델 제거, member API 호출로 전환
4. **auth_db.users 테이블 보관** (즉시 삭제하지 않음, 롤백 대비)

### 7.2 기존 JWT 토큰 호환

- 전환 시 기존 JWT(subject 방식)는 무효화됨
- 사용자는 재로그인 필요 (Access Token 만료 30분이므로 자연 만료 대기 또는 강제 로그아웃)

---

## 8. Resilience

### 8.1 auth → member 동기 호출

OAuth 로그인 시 auth가 member 서비스를 동기 호출하므로 Circuit Breaker 적용 (ADR-0015):

```kotlin
// MemberApiAdapter에 CircuitBreaker 적용
@CircuitBreaker(name = "memberApi", fallbackMethod = "memberApiFallback")
fun getOrCreateMember(request: SsoMemberRequest): MemberResponse
```

- **Closed**: 정상 동작
- **Open**: member 장애 시 로그인 실패 응답 (503 Service Unavailable)
- **Half-Open**: 일정 시간 후 재시도

> member 서비스 장애 시 로그인 불가는 의도된 동작 (회원 식별 없이 JWT 발급 불가).
> Fallback으로 캐싱된 회원 정보 반환은 보안 리스크가 있으므로 채택하지 않음.

### 8.2 wishlist → product/member 이벤트

Kafka 기반 비동기이므로 별도 resilience 불필요. 컨슈머 실패 시 재시도 + DLQ (ADR-0012 멱등성 패턴 적용).

---

## 9. 제외 사항 (향후)

- Permission 세분화 (Phase 2): 초기엔 Role 기반만, Permission 매핑은 하드코딩
- 위시리스트 폴더/카테고리 관리
- 상품 정보 비정규화 (CQRS)
- Redis 기반 토큰 블랙리스트 (현재 인메모리)
