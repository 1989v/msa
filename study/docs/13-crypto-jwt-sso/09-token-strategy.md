---
parent: 13-crypto-jwt-sso
seq: 09
title: JWT 운영 (Stateless / Access·Refresh / Rotation / 보관)
type: deep
created: 2026-04-28
---

# 09. JWT 운영 전략

## 9.1 JWT vs Opaque Token (Stateful Session)

| 측면 | JWT (Stateless) | Opaque Token (Stateful) |
|---|---|---|
| 검증 | 서명만 검증, DB 조회 없음 | 매번 토큰 → 세션 store 조회 |
| 확장성 | 수평 확장 쉬움 | 세션 store가 SPOF |
| 즉시 무효화 | **어려움** (만료 전엔 살아있음) | 쉬움 (세션 삭제) |
| 토큰 크기 | 큼 (1~2KB) | 작음 (32~64B) |
| 페이로드 | 클레임 그대로 사용 | 매번 lookup |

### Stateless의 진짜 비용

세션 무효화의 어려움 → 대안:
1. **짧은 TTL (Time To Live, 생존 시간)** (15분 내외) + Refresh Token으로 재발급
2. **Blacklist** (Redis): 무효화 시 jti/토큰 자체를 블랙리스트
3. **Token versioning** — 사용자 객체에 `tokenVersion` 필드, 클레임에도 포함, mismatch 시 거부

> **현 msa 코드** — `AuthenticationGatewayFilter.kt` 36-44줄에서 Redis `blacklist:{token}` 키로 즉시 무효화 구현. **Fail-Open 정책** (Redis 장애 시 허용)은 가용성 우선이지만, 보안 민감도에 따라 Fail-Closed로 바꾸는 옵션도 검토 가치.

## 9.2 Access Token / Refresh Token

### 왜 분리하는가
- Access Token이 자주 쓰이므로 노출 위험 ↑ → 짧게 (15~30분)
- Refresh Token은 토큰 발급에만 쓰므로 노출 위험 ↓ → 길게 (7~30일)
- 노출되면 Access만 만료까지 버티고, Refresh로 재발급은 차단 가능

### 저장 위치 권장
- Access Token: 메모리 (또는 짧은 수명의 안전한 저장소)
- Refresh Token: **httpOnly + Secure + SameSite=Strict 쿠키** (XSS 방지)

> **현 msa 코드** — `JwtProperties`: access 30분(1800s), refresh 7일(604800s). 표준 권장치.

## 9.3 Refresh Token Rotation

**문제** — 단순 Refresh 토큰은 한 번 탈취되면 만료까지 계속 쓸 수 있음.

### Rotation 패턴
1. Access 만료 → 클라이언트가 Refresh로 재발급 요청
2. 서버는 **새 Access + 새 Refresh** 발급, 이전 Refresh를 사용 불가 처리
3. 같은 Refresh가 다시 들어오면 → **이미 사용된 토큰 = 탈취 신호** → 해당 사용자의 모든 세션 강제 종료

### 구현 키
- `jti` (JWT ID)를 매 Refresh마다 새로 발급
- 서버가 사용자별 "현재 유효한 jti" 목록 관리 (Redis SET)
- 또는 reuse detection 위해 사용된 jti도 별도 기록 (짧은 TTL)

**핵심** — 정상 사용자는 토큰 1개만 사용. 동시에 같은 Refresh가 두 번 검증되면 둘 중 하나는 공격자.

코드 예시: [18-code-refactoring.md](18-code-refactoring.md)의 `RefreshRotationService`

## 9.4 보관 위치: localStorage vs httpOnly Cookie

| 측면 | `localStorage` | `httpOnly` Cookie |
|---|---|---|
| XSS | **취약** (JS로 읽힘) | **안전** (JS 접근 불가) |
| CSRF | 안전 (자동 첨부 X) | 취약 → SameSite + CSRF 토큰 필요 |
| 모바일 앱 | 호환 OK | 쿠키 처리 별도 필요 |
| 도메인 분리 | CORS 처리 필요 | 도메인 자동 |

**현대적 권장 (web)** — `httpOnly + Secure + SameSite=Lax/Strict` 쿠키 + 필요 시 CSRF 토큰. 또는 `__Host-` prefix 쿠키 (도메인/path 잠금).

## 9.5 추가 보안 클레임 / 운영 패턴

- `aud` 강제 — 토큰이 의도한 서비스에서만 통하게 (audience binding)
- `iss` 강제 — IdP 신원 검증
- **Token Binding** (RFC 8471) — TLS 채널과 토큰 결합. 거의 미채택.
- **DPoP (Demonstrating Proof of Possession, RFC 9449)** — 클라이언트 키쌍 기반, 토큰 탈취 시에도 다른 클라이언트가 못 씀. OAuth2 신규 권장.
- **Sender-Constrained Tokens** — mTLS Token Binding (RFC 8705)

## 9.6 코드 연결 — `JwtUtil.kt` + Gateway 리뷰

`common/.../JwtUtil.kt`

| 라인 | 내용 | 평가 |
|---|---|---|
| 14-15 | `Keys.hmacShaKeyFor(secret.bytes)` HS256 | ✅ 마이크로서비스 내부 적합 |
| 18-26 | access/refresh 분리, 30분/7일 | ✅ 표준 |
| 22 | `userId`, `roles`, `type` 클레임 | ⚠️ `iss`, `aud`, `jti` 미사용 → 보강 권장 |
| 25 | `signWith(key)` | ✅ 알고리즘 명시 (JJWT가 키 타입 추론) |
| 39 | `verifyWith(key)` | ✅ alg: none 방어 |

`gateway/.../JwtTokenValidator.kt`, `AuthenticationGatewayFilter.kt`

| 위치 | 내용 | 평가 |
|---|---|---|
| validator:10-11 | `runCatching { parseToken }` | ✅ 변조/만료 일괄 거부 |
| filter:36-43 | Redis blacklist 체크 (Fail-Open) | ✅ 즉시 무효화 가능, ⚠️ Fail-Open은 정책 결정 |
| filter:65-68 | `X-User-Id`, `X-User-Roles` 헤더 주입 | ⚠️ 다운스트림이 헤더 신뢰. **Gateway가 유일 진입점이라는 가정** 필요 |

**개선 후보** → [18-code-refactoring.md](18-code-refactoring.md), [19-improvements.md](19-improvements.md)

## 다음 학습

- [10-oauth2.md](10-oauth2.md) — OAuth 2.0 + PKCE
- [18-code-refactoring.md](18-code-refactoring.md) — RotatableJwtUtil + RefreshRotationService 코드
