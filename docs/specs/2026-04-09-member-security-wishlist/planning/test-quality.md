# Test Strategy — Member + Security + Wishlist

## 테스트 프레임워크
- Kotest BehaviorSpec + MockK (프로젝트 표준)
- Domain 테스트: 순수 단위 테스트 (Spring 컨텍스트 없음)
- Application 테스트: Outbound Port MockK

---

## Member

### Domain Tests (`member:domain:test`)
| 테스트 | 검증 내용 |
|--------|----------|
| `MemberTest` | create 검증 (email 필수, name 필수), status 전이 (ACTIVE→SUSPENDED→WITHDRAWN), updateName |
| `SsoProviderTest` | SSO 제공자 유형 검증 |

### Application Tests (`member:app:test`)
| 테스트 | 검증 내용 |
|--------|----------|
| `MemberServiceTest` | 회원 생성, 프로필 조회, 이름 수정, 탈퇴 (soft delete) |
| `GetOrCreateMemberUseCaseTest` | SSO 로그인 시 기존 회원 반환 / 신규 생성 |

---

## Auth (RBAC 확장)

### Domain Tests (`auth:domain:test`)
| 테스트 | 검증 내용 |
|--------|----------|
| `RoleTest` | Role 생성, 기본 권한 포함 여부 |
| `PermissionTest` | Permission 생성, 도메인별 접근 권한 검증 |

### Application Tests (`auth:app:test`)
| 테스트 | 검증 내용 |
|--------|----------|
| `AuthServiceTest` | OAuth 로그인 → member API 호출 → 역할 조회 → JWT 발급 |
| `RoleServiceTest` | 역할 할당/조회 |
| `OAuthLoginUseCaseTest` | 리팩토링 후 member 연동 정상 동작 |

---

## Wishlist

### Domain Tests (`wishlist:domain:test`)
| 테스트 | 검증 내용 |
|--------|----------|
| `WishlistItemTest` | create 검증 (memberId/productId 필수) |

### Application Tests (`wishlist:app:test`)
| 테스트 | 검증 내용 |
|--------|----------|
| `WishlistServiceTest` | 추가, 제거, 목록 조회, 중복 추가 방지, 존재 여부 확인 |

---

## 통합 시나리오 (수동 검증)
1. OAuth 로그인 → member 생성 → 역할 할당 → JWT(roles 포함) 발급
2. ROLE_USER로 gifticon 접근 성공, product 쓰기 접근 실패
3. ROLE_SELLER로 product 쓰기 접근 성공
4. 위시리스트 추가/조회/삭제 플로우
