# ADR-0004: 인증 및 인가 방식

## Status
Accepted

## Context
Gateway에서 중앙 집중식 인증/인가 처리 필요. 상태 없는(Stateless) 설계와 강제 로그아웃 지원 요구.

## Decision
- JWT (HS256 알고리즘)
- Access Token: 만료 30분
- Refresh Token: 만료 7일, Redis에 저장
- JWT 블랙리스트: Redis에 저장 (로그아웃/강제 만료 지원)
- Gateway에서 JWT 검증 후 X-User-Id, X-User-Roles 헤더로 내부 서비스 전달
- JWT 시크릿은 환경변수로 주입 (절대 코드 하드코딩 금지)
- **표준 클레임/헤더 보강** (2026-04-28 추가):
  - `sub` (subject) — userId
  - `jti` (JWT ID) — UUID, Refresh Rotation reuse detection 기반
  - `iss` (issuer) — `JwtProperties.issuer` 설정 시 발급 + 검증
  - `aud` (audience) — `JwtProperties.audience` 설정 시 발급 + 검증
  - `kid` (Key ID, header) — `JwtProperties.kid` 설정 시 발급 (키 회전 사전 작업)
  - 기존 `userId`, `roles`, `type` 커스텀 클레임은 호환을 위해 유지

## Alternatives Considered
- Session 기반: 수평 확장 시 세션 공유 문제, Sticky Session 필요
- OAuth2/OIDC: 구현 복잡도 높음, 외부 IdP 의존성
- 비대칭키(RS256): 키 관리 복잡, 현 규모에서 HS256으로 충분

## Consequences
- Redis Cluster 장애 시 블랙리스트 검증 불가 → Fail-Open 정책 적용 (허용). 단, 완화 방안:
  - Actuator health endpoint로 Redis 장애 즉시 감지
  - 장애 시 운영팀 알림(Alert) 트리거
  - Access Token 만료 시간(30분)을 보안 경계로 활용
  - 블랙리스트 조회 실패는 별도 메트릭으로 추적
- Access Token 만료 전 강제 무효화는 블랙리스트로만 가능
- 내부 서비스는 Gateway를 통해서만 접근 (직접 접근 시 인증 없음)

## Migration (2026-04-28 보강 사항)

### 단계적 도입 전략 — backwards-compatible

**Stage 1 (현재 PR)**: 발급 측 보강 + 검증은 soft 모드
- 새로 발급되는 토큰엔 `sub`, `jti`가 항상 포함됨
- `iss`/`aud`/`kid`는 `JwtProperties`에 설정 시에만 추가
- 검증: 토큰에 `iss`/`aud` 클레임이 **있을 때만** 설정값과 매칭 검사 (없으면 통과)
- 결과: Stage 1 배포 후에도 기존 토큰(만료 7일)은 그대로 유효

**Stage 2 (옵션, 추후)**: hard 모드 전환
- Stage 1 배포 + Refresh 만료(7일) 경과 후 모든 토큰이 신규 포맷
- 그 시점 이후 `iss`/`aud` 누락 토큰을 거부하도록 strict 모드 활성화 가능
- 별도 ADR 또는 본 ADR 갱신으로 결정

### 영향 범위
- `common:security` (L3) — JwtUtil/JwtProperties 변경
- `gateway` — 별도 코드 변경 불필요 (JwtUtil 사용)
- 다른 서비스 — 직접 사용 없음 (헤더로 X-User-Id 받음 → 무관)

### 호환성 검증
- 기존 `JwtUtilTest` 케이스 모두 통과 (issuer/audience nullable 기본값)
- 신규 테스트: kid/iss/aud 설정 시 발급·검증, 옛 토큰 backwards-compat
