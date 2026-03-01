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

## Alternatives Considered
- Session 기반: 수평 확장 시 세션 공유 문제, Sticky Session 필요
- OAuth2/OIDC: 구현 복잡도 높음, 외부 IdP 의존성
- 비대칭키(RS256): 키 관리 복잡, 현 규모에서 HS256으로 충분

## Consequences
- Redis Cluster 장애 시 블랙리스트 검증 불가 → 블랙리스트 조회 실패 시 허용 (Fail-Open) 정책 적용
- Access Token 만료 전 강제 무효화는 블랙리스트로만 가능
- 내부 서비스는 Gateway를 통해서만 접근 (직접 접근 시 인증 없음)
