# Requirements — Member + Security(Auth RBAC) + Wishlist

## 배경

현재 `auth` 서비스에 User 도메인과 인증 로직이 혼재되어 있다.
MSA 원칙에 맞게 **사용자 식별(Member)**과 **인증·인가(Auth/Security)**를 분리하고,
**위시리스트** 서비스를 신규 추가한다.

## 현재 상태 분석

### auth 서비스
- User 모델: email, name, provider, providerId, profileImageUrl
- OAuth 로그인 (Kakao, Google)
- JWT 토큰 발급/갱신/블랙리스트 (자체 TokenAdapter — common JwtUtil 미사용)
- SecurityConfig: 전부 permitAll

### common 모듈
- `JwtUtil`: `generateAccessToken(userId, roles)` — 이미 roles 지원
- `JwtProperties`, `CommonSecurityAutoConfiguration`

### gateway
- `AuthenticationGatewayFilter`: JWT 검증 → `X-User-Id`, `X-User-Roles` 헤더 전파
- `JwtTokenValidator`: common의 JwtUtil 사용

### 불일치
- auth의 TokenAdapter는 `subject(userId)` 방식, common JwtUtil은 `claim("userId")` 방식 → 통합 필요

---

## 도메인 1: Member (신규 서비스)

### 목적
사용자(회원) 식별 및 프로필 관리. 최소 개인정보 원칙.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| M-1 | 회원 도메인 모델: id, email, name, ssoProvider, ssoProviderId, status, createdAt | P0 |
| M-2 | SSO 제공자 유형 관리 (KAKAO, GOOGLE, 향후 확장 가능) | P0 |
| M-3 | 회원 상태 관리 (ACTIVE, SUSPENDED, WITHDRAWN) | P0 |
| M-4 | 회원 프로필 조회 API (자신의 프로필) | P0 |
| M-5 | 회원 프로필 수정 API (이름 변경) | P1 |
| M-6 | 회원 탈퇴 (소프트 삭제 — status WITHDRAWN) | P1 |
| M-7 | auth 서비스의 User 모델/테이블을 member로 이전 | P0 |
| M-8 | auth → member API 호출로 사용자 조회/생성 | P0 |

### 제약사항
- 개인정보 최소화: profileImageUrl 미저장 (SSO 제공자에서 직접 조회 가능)
- member DB는 독립 (auth DB와 분리)
- 다른 서비스는 member에 직접 DB 접근 금지, API 호출만

---

## 도메인 2: Security — Auth RBAC 강화 (기존 auth 리팩토링)

### 목적
역할(Role) 기반 접근 제어. 도메인별 권한 분리.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| S-1 | Role 도메인 모델: ROLE_USER, ROLE_SELLER, ROLE_ADMIN | P0 |
| S-2 | Permission 도메인 모델: 도메인별 세분화 (PRODUCT_READ, ORDER_WRITE 등) | P1 |
| S-3 | Role ↔ Permission 매핑 관리 | P1 |
| S-4 | 회원-역할 매핑 (member_id ↔ role) | P0 |
| S-5 | JWT 토큰에 roles 포함하여 발급 (common JwtUtil 활용) | P0 |
| S-6 | auth의 TokenAdapter를 common JwtUtil로 통합 | P0 |
| S-7 | gateway에서 역할 기반 라우트 접근 제어 | P0 |
| S-8 | 기본 사용자(ROLE_USER)도 접근 가능한 공개 도메인 정의 (gifticon 등) | P0 |
| S-9 | 관리자 전용 엔드포인트 보호 (백오피스) | P1 |

### 권한 구조

```
ROLE_USER       → gifticon(R), wishlist(RW), product(R), order(R)
ROLE_SELLER     → product(RW), order(RW), inventory(RW), fulfillment(RW)
ROLE_ADMIN      → 전체 도메인 (RW) + 백오피스
```

### 제약사항
- auth의 User 모델 → member 서비스로 이전 후, auth는 인증·인가만 담당
- OAuth 로그인 시 member 서비스에서 회원 조회/생성 → auth에서 역할 조회 → JWT 발급
- 기존 TokenAdapter 제거, common JwtUtil 사용으로 통합

---

## 도메인 3: Wishlist (신규 서비스)

### 목적
회원이 관심 상품을 저장하고 관리하는 위시리스트.

### 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| W-1 | 위시리스트 아이템 도메인 모델: id, memberId, productId, createdAt | P0 |
| W-2 | 위시리스트에 상품 추가 API | P0 |
| W-3 | 위시리스트에서 상품 제거 API | P0 |
| W-4 | 내 위시리스트 목록 조회 API (페이징) | P0 |
| W-5 | 위시리스트 상품 존재 여부 확인 API (상품 상세에서 하트 표시용) | P0 |
| W-6 | 동일 상품 중복 추가 방지 (memberId + productId unique) | P0 |
| W-7 | 위시리스트 전체 삭제 API | P1 |
| W-8 | 상품 삭제 시 위시리스트에서도 제거 (Kafka 이벤트 소비) | P1 |

### 제약사항
- wishlist DB 독립
- product 서비스 직접 DB 접근 금지 (상품명 등은 API 호출 또는 CQRS)
- 인증 필수 (ROLE_USER 이상)

---

## 서비스 간 통신

```
[Client] → [Gateway] → [Auth] → [Member]   (OAuth 로그인 시)
                     → [Wishlist] → [Product] (상품 정보 조회)
```

### 이벤트 기반 통신 (Kafka)
- `product.deleted` → wishlist 소비 (해당 상품 위시리스트 항목 삭제)
- `member.withdrawn` → wishlist 소비 (해당 회원 위시리스트 전체 삭제)

---

## 마이그레이션 계획

1. member 서비스 생성 + DB 스키마
2. auth의 users 테이블 데이터를 member DB로 이전
3. auth에서 User 모델 제거, member API 호출로 전환
4. auth에 Role/Permission 모델 추가
5. auth TokenAdapter → common JwtUtil 통합
6. gateway 라우트에 역할 기반 필터 추가
7. wishlist 서비스 생성
