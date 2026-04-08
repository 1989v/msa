# ADR-0018: Member 서비스 분리, RBAC 도입, Wishlist 서비스 추가

## Status
Accepted

## Context

현재 `auth` 서비스에 사용자 식별(User 도메인)과 인증/인가 로직이 혼재되어 있다.
MSA의 Bounded Context 원칙에 따라 **사용자 식별**과 **인증·인가**를 분리하고,
역할 기반 접근 제어(RBAC)를 도입하여 도메인별 권한을 관리한다.
또한 상품 위시리스트 서비스를 신규 추가한다.

**기존 문제:**
- auth의 User 모델이 회원 프로필(이메일, 이름)과 인증(SSO)을 동시에 담당
- auth의 TokenAdapter가 common JwtUtil과 다른 JWT 구조 사용 (subject vs claim)
- 역할/권한 개념 부재 — 모든 인증된 사용자가 동일한 접근 권한

**관련 ADR:** ADR-0004 (인증 방식) — 이 ADR로 확장. ADR-0004의 JWT/블랙리스트 정책은 유지.

## Decision

### 1. Member 서비스 신규 생성

- 모듈: `member:domain`, `member:app` (Nested Submodule 패턴)
- 책임: 회원 식별, 프로필 관리, 상태 관리
- DB: member_db (독립)
- 최소 개인정보 원칙: email, name, ssoProvider, ssoProviderId만 저장

### 2. Auth 서비스에서 User 모델 제거 + RBAC 추가

- auth의 User 도메인 → member 서비스로 이전
- auth에 Role/MemberRole 도메인 추가
- 역할: ROLE_USER, ROLE_SELLER, ROLE_ADMIN
- OAuth 로그인 시: auth → member API 호출(회원 조회/생성) → 역할 조회 → JWT 발급
- auth의 TokenAdapter 제거, common JwtUtil 사용으로 통합

### 3. Gateway 역할 기반 라우트 필터

- 기존 AuthenticationGatewayFilter에 역할 검증 추가
- 라우트별 requiredRoles 메타데이터로 접근 제어
- 공개 엔드포인트는 인증 필터 바이패스 (기존 동작 유지)

### 4. Wishlist 서비스 신규 생성

- 모듈: `wishlist:domain`, `wishlist:app`
- 책임: 회원별 상품 위시리스트 관리
- DB: wishlist_db (독립)
- Kafka 소비: `product.deleted`, `member.withdrawn`

### 5. JWT 구조 통합

| 항목 | Before (auth TokenAdapter) | After (common JwtUtil) |
|------|---------------------------|----------------------|
| 사용자 ID | `subject(userId)` | `claim("userId", memberId)` |
| 역할 | 없음 | `claim("roles", [ROLE_USER])` |
| 토큰 유형 | `claim("type", "access")` | `claim("type", "access")` |

## Alternatives Considered

1. **auth에 member 기능 유지**: Bounded Context 위반. 프로필 변경이 인증 서비스에 영향.
2. **별도 authorization 서비스**: 현 규모에서 과도. auth에 RBAC 추가로 충분.
3. **Permission 테이블 분리**: 초기엔 Role enum 기반 하드코딩으로 단순화. 향후 확장 시 테이블 분리.

## Consequences

**긍정적:**
- auth는 인증·인가만 담당, member는 회원 식별만 담당 (단일 책임)
- RBAC으로 도메인별 접근 제어 가능
- common JwtUtil 통합으로 JWT 구조 일원화

**부정적:**
- OAuth 로그인 시 auth → member 서비스 간 API 호출 추가 (네트워크 비용)
- 기존 auth 발급 JWT와 호환 불가 → 전환 시 기존 토큰 무효화 필요
- member 서비스 장애 시 로그인 불가 (Circuit Breaker 적용 필요)

## References

- ADR-0004: 인증 및 인가 방식
- ADR-0006: 데이터베이스 전략
- ADR-0014: 코드 컨벤션
- Spec: `docs/specs/2026-04-09-member-security-wishlist/spec.md`
