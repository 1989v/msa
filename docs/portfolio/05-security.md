# 5. Security

> JWT + AES-256-GCM 이중 암호화, OAuth2 소셜 로그인, RBAC, Gateway 레벨 방어

---

## 인증 아키텍처

```
Client
  │ (1) OAuth2 로그인 (Kakao/Google)
  ↓
Auth Service
  │ (2) JWT Access Token (30분) + Refresh Token (7일) 발급
  │     Access Token = AES-256-GCM 암호화 (optional)
  ↓
Gateway
  │ (3) JWT 검증 + 블랙리스트 체크 (Redis)
  │ (4) X-User-Id, X-User-Roles 헤더 주입
  ↓
Backend Services
```

---

## JWT Token 설계

| 항목 | Access Token | Refresh Token |
|------|-------------|---------------|
| 만료 | 30분 (1800s) | 7일 (604800s) |
| 저장 | 클라이언트 메모리 | HttpOnly Cookie / Redis |
| 갱신 | Refresh Token으로 재발급 | 만료 시 재로그인 |
| 폐기 | Redis 블랙리스트 | Redis 세션 삭제 |

**JJWT 라이브러리** (0.12.6):
- HMAC-SHA256 서명
- Claims: userId, roles, exp, iat

**코드 위치**: `common/src/.../security/JwtUtil.kt` · `auth/app/src/.../`

---

## AES-256-GCM 암호화

JWT 토큰 자체를 AES-256-GCM으로 한번 더 암호화하여 토큰 내용물 노출 방지.

```kotlin
// common/src/.../security/AesUtil.kt
fun encrypt(plainText: String, key: SecretKey): String {
    val iv = generateRandomIV(12)  // GCM 권장 12바이트
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
    // IV + ciphertext 결합하여 Base64 반환
}
```

- GCM 모드: 암호화 + 무결성 검증 동시 수행
- 키: 환경변수 `AES_KEY` (32바이트)
- 서비스별 활성화: `kgd.common.security.aes-enabled: true` (auth, gifticon)

---

## OAuth2 소셜 로그인

| Provider | Client ID/Secret | Redirect |
|----------|-----------------|----------|
| **Kakao** | `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | `/api/auth/oauth2/callback/kakao` |
| **Google** | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `/api/auth/oauth2/callback/google` |

**Flow**:
1. 클라이언트 → 소셜 로그인 페이지 리다이렉트
2. 소셜 인증 → Authorization Code 발급
3. Auth Service → Access Token 교환 → 사용자 정보 조회
4. 회원 자동 생성 (최초) 또는 기존 회원 매칭
5. JWT 발급 (자체 토큰)

**코드 위치**: `auth/app/src/.../infrastructure/client/` · `auth/app/src/.../presentation/`

---

## RBAC (Role-Based Access Control)

3단계 역할 기반 접근 제어.

| Role | 권한 범위 | 예시 |
|------|---------|------|
| `ROLE_USER` | 일반 기능 | 상품 조회, 주문, 위시리스트 |
| `ROLE_SELLER` | 판매자 기능 | 재고 관리, 풀필먼트, 창고 |
| `ROLE_ADMIN` | 관리자 기능 | 역할 변경, 전체 관리 |

**Gateway 라우트별 역할 요구**:

```kotlin
// gateway/src/.../config/GatewayRouteConfig.kt
routeLocator.routes()
    .route("inventory-service") {
        it.path("/api/inventory/**")
          .filters { f -> f.filter(authFilter.apply { roles = listOf("ROLE_SELLER") }) }
          .uri("http://inventory:8085")
    }
    .route("auth-admin") {
        it.path("/api/auth/roles/**")
          .filters { f -> f.filter(authFilter.apply { roles = listOf("ROLE_ADMIN") }) }
          .uri("http://auth:8087")
    }
```

**근거**: `docs/adr/ADR-0018-member-rbac.md`

---

## Gateway 인증 필터

```kotlin
// gateway/src/.../filter/AuthenticationGatewayFilter.kt
override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
    val token = extractToken(exchange.request)
    
    // 1. JWT 검증
    val claims = jwtUtil.validateToken(token)
    
    // 2. Redis 블랙리스트 체크 (Fail-Open: Redis 장애 시 허용)
    if (isBlacklisted(token)) throw UnauthorizedException()
    
    // 3. 역할 검증
    val roles = claims.get("roles", List::class.java)
    if (!hasRequiredRole(roles, requiredRoles)) throw ForbiddenException()
    
    // 4. 하위 서비스로 헤더 전파
    val mutated = exchange.request.mutate()
        .header("X-User-Id", claims.subject)
        .header("X-User-Roles", roles.joinToString(","))
        .build()
    
    return chain.filter(exchange.mutate().request(mutated).build())
}
```

**Fail-Open 정책**: Redis 장애 시 블랙리스트 체크 skip → 서비스 가용성 우선

---

## Rate Limiting (DDoS 방어)

Gateway에서 Redis 기반 Token Bucket 알고리즘.

```kotlin
// gateway/src/.../config/RateLimiterConfig.kt
@Bean
fun rateLimiter(): RedisRateLimiter {
    return RedisRateLimiter(
        replenishRate = 100,    // 초당 100 토큰
        burstCapacity = 200,    // 최대 200 동시 요청
        requestedTokens = 1
    )
}
```

**키 식별**: User ID (인증된 사용자) 또는 IP (미인증)

**근거**: `docs/adr/ADR-0015-resilience-strategy.md`

---

## 시크릿 관리

| 환경 | 방식 |
|------|------|
| 로컬 (k3s-lite) | `SPRING_APPLICATION_JSON` 환경변수 주입 |
| 운영 (prod-k8s) | **Sealed Secrets** (Git-safe 암호화) |

민감 정보: `JWT_SECRET`, `AES_KEY`, `MYSQL_PASSWORD`, `REDIS_PASSWORD`, `KAKAO_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`

**코드 위치**: `k8s/infra/prod/sealed-secrets/` · `docker/.env.example`

---

*Code references: `common/src/.../security/` · `auth/` · `gateway/src/.../filter/` · `docs/adr/ADR-0004` · `ADR-0018`*
