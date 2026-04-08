# Tasks — Member + Security(Auth RBAC) + Wishlist

## Group 1: Infrastructure Setup (선행 작업)

### Task 1.1: settings.gradle.kts에 새 모듈 추가
- `member:domain`, `member:app`, `wishlist:domain`, `wishlist:app` include
- member, wishlist 디렉토리 + build.gradle.kts 생성

### Task 1.2: Docker Compose 인프라 업데이트
- member_db, wishlist_db 추가 (docker-compose.infra.yml)
- init SQL 스크립트: members, wishlist_items, member_roles 테이블
- member, wishlist 서비스 추가 (docker-compose.yml)
- gateway 라우트에 member, wishlist 추가

---

## Group 2: Member Service (신규)

### Task 2.1: Member Domain 모듈
- `Member` 도메인 모델 (create/restore, updateName, withdraw, status 전이)
- `MemberStatus` enum (ACTIVE, SUSPENDED, WITHDRAWN)
- `SsoProvider` enum (KAKAO, GOOGLE)
- `MemberException`
- Domain 단위 테스트

### Task 2.2: Member App 모듈
- `MemberApplication.kt`
- UseCase: `GetOrCreateMemberUseCase`, `GetMemberProfileUseCase`, `UpdateMemberNameUseCase`, `WithdrawMemberUseCase`
- `MemberService` (UseCase 구현)
- `MemberRepositoryPort` + `MemberRepositoryAdapter`
- `MemberJpaEntity` + `MemberJpaRepository`
- `MemberController`
- Config: DataSourceConfig, OpenApiConfig
- application.yml (Eureka, DB 설정)
- Application 테스트

---

## Group 3: Auth RBAC 리팩토링

### Task 3.1: Auth Domain — Role 모델 추가
- `Role` enum (ROLE_USER, ROLE_SELLER, ROLE_ADMIN)
- `MemberRole` 도메인 모델 (memberId ↔ Role 매핑)
- `RoleException`
- 기존 User 도메인 모델 제거
- Domain 테스트

### Task 3.2: Auth App — Member API 연동 + JWT 통합
- `MemberApiPort` (member 서비스 호출 인터페이스)
- `MemberApiAdapter` (WebClient 구현 + CircuitBreaker)
- `AuthService` 리팩토링: member API 호출 → 역할 조회 → common JwtUtil로 JWT 발급
- 기존 `TokenAdapter` 제거
- 기존 User 관련 persistence (JpaEntity, Repository, Adapter) 제거
- OAuthLoginUseCase 리팩토링
- GetUserProfileUseCase 제거 (member 서비스로 이전)
- Application 테스트 업데이트

### Task 3.3: Auth App — Role 관리 기능
- `AssignRoleUseCase`, `GetMemberRolesUseCase`
- `RoleService`
- `RoleRepositoryPort` + `RoleRepositoryAdapter`
- `MemberRoleJpaEntity` + `MemberRoleJpaRepository`
- `RoleController` (ADMIN 전용)
- Application 테스트

---

## Group 4: Gateway RBAC 필터

### Task 4.1: Gateway 역할 기반 접근 제어
- `AuthenticationGatewayFilter`에 역할 검증 로직 추가
- 라우트 설정에 requiredRoles 메타데이터 추가
- 공개/USER/SELLER/ADMIN 라우트 정책 적용
- application.yml 라우트 설정 업데이트

---

## Group 5: Wishlist Service (신규)

### Task 5.1: Wishlist Domain 모듈
- `WishlistItem` 도메인 모델 (create/restore)
- `WishlistException`
- Domain 단위 테스트

### Task 5.2: Wishlist App 모듈
- `WishlistApplication.kt`
- UseCase: `AddWishlistItemUseCase`, `RemoveWishlistItemUseCase`, `GetWishlistUseCase`, `CheckWishlistItemUseCase`, `ClearWishlistUseCase`
- `WishlistService`
- `WishlistRepositoryPort` + `WishlistRepositoryAdapter`
- `WishlistItemJpaEntity` + `WishlistItemJpaRepository`
- `WishlistController`
- Config: DataSourceConfig, KafkaConfig, OpenApiConfig
- application.yml
- Application 테스트

### Task 5.3: Wishlist Kafka Consumers
- `ProductEventConsumer` (product.deleted → 위시리스트 항목 삭제)
- `MemberEventConsumer` (member.withdrawn → 위시리스트 전체 삭제)
- 멱등성 보장 (ADR-0012)

---

## Group 6: Documentation & Validation

### Task 6.1: 문서 업데이트
- CLAUDE.md 서비스 테이블에 member, wishlist 추가
- member/CLAUDE.md, wishlist/CLAUDE.md 생성
- ADR-0018 status: Proposed → Accepted
- docker-compose 서비스 목록 업데이트

---

## 의존 관계

```
Group 1 (인프라) → Group 2 (member) → Group 3 (auth 리팩토링) → Group 4 (gateway)
                                    ↘ Group 5 (wishlist)
Group 2 + 3 + 4 + 5 → Group 6 (문서)
```

- Group 3은 Group 2에 의존 (auth가 member를 호출하므로)
- Group 5는 Group 2 이후 병렬 가능 (Group 3과 독립)
- Group 4는 Group 3 이후 (역할 정보가 JWT에 포함되어야 함)
