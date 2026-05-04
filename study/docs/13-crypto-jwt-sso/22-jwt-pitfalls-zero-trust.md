---
parent: 13-crypto-jwt-sso
seq: 22
title: JWT 함정 / 0-RTT / DPoP / mTLS-bound — Bearer 운영의 zero-trust
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 08-jwt-structure.md
  - 09-token-strategy.md
  - 16-tls.md
  - 21-aead-nonce-key-derivation.md
  - 23-mtls-mesh-cert-rotation.md
sources:
  - https://datatracker.ietf.org/doc/html/rfc7519
  - https://datatracker.ietf.org/doc/html/rfc7515
  - https://datatracker.ietf.org/doc/html/rfc7516
  - https://datatracker.ietf.org/doc/html/rfc7517
  - https://datatracker.ietf.org/doc/html/rfc8725
  - https://datatracker.ietf.org/doc/html/rfc8446
  - https://datatracker.ietf.org/doc/html/rfc9449
  - https://datatracker.ietf.org/doc/html/rfc8705
  - https://paseto.io
  - https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2015-9235
catalog-row: "§E JWT 함정 (alg=none / HS-RS confusion / kid injection / signature stripping), §D 0-RTT replay, §F DPoP / mTLS-bound, JWT 대안 (PASETO / Macaroons)"
---

# 22. JWT 함정 / 0-RTT / DPoP / mTLS-bound — Bearer 운영의 zero-trust

> 카탈로그 매핑: §99 §E — `alg=none 함정` (★ → ✅), `HS vs RS confusion` (★ → ✅), `JWE alg vs enc` (★ → ✅), `JWK / JWKS rotation` (★ → ✅), `Refresh Token rotation + reuse detection` (★ → ✅), `PASETO` (★ → ✅) · §D — `0-RTT 함정 (replay)` (★ → ✅) · §F — `DPoP` (★ → ✅), `mTLS client auth (RFC 8705)` (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B+

> "JWT 검증 통과 = 인증 성공" 은 절반만 맞다. JWT 의 구조적 함정은 알고리즘 협상 / 키 출처 / 서명 형식 / replay / theft 4 면에서 끊임없이 사고를 만들었다 (alg=none, HS/RS confusion, kid injection, 0-RTT replay). 본 deep file 은 (1) JWT 의 대표 함정 4 종 + 방어 코드 패턴, (2) JWE 와 JWS 의 분리 (alg vs enc), (3) Bearer token 의 운영 함정 (refresh rotation / reuse detection / blacklist), (4) Bearer 보강 — DPoP / mTLS-bound / Token Binding, (5) JWT 대안 — PASETO / Macaroons 까지 다룬다.

---

## 1. 한 줄 핵심

> **JWT 보안 = "alg/kid 신뢰 → 서명 검증 → claims 검증 → 토큰 소유 증명" 4 게이트.**
> 구현이 단 하나라도 헐거우면 (alg=none / HS-RS confusion / kid injection / Bearer 탈취) 토큰이 통째로 위조 / 재사용 가능. 운영 함정 — refresh rotation, JWKS rotation, denylist, 0-RTT replay 도 같이 풀어야 한다. 진짜 zero-trust 는 Bearer 가 아니라 **소유 증명 (DPoP / mTLS-bound)** 이다.

---

## 2. 등장 배경 — 어떤 사고들이 있었나

### 2-1. CVE-2015-9235 — alg=none 함정

JWT 의 header 에 `alg: "none"` 을 넣고 signature 부분을 비워서 보내면, 일부 라이브러리 (Auth0 node-jsonwebtoken, jjwt 일부 버전 등) 가 "서명이 없으니 검증 통과" 로 처리. 모든 토큰 위조 가능. 산업 전체가 이 패턴을 알고리즘 allowlist 로 막는 계기.

### 2-2. JWT alg confusion — HS vs RS

서버가 `RS256` (비대칭) 로 서명하고, 검증 측이 `verify(token, public_key)` 를 키 객체 + 알고리즘 자동 협상으로 하면:

```
공격자: header.alg = "HS256" 으로 변조
서버: HS256 으로 검증 → public_key 를 HMAC secret 으로 사용
공격자가 public_key 를 알면 (대부분 공개) HMAC 을 직접 만들어서 서명 위조 가능
```

→ 알고리즘을 토큰 header 가 결정하면 안 됨. **검증 측이 알고리즘을 강제** 해야 함. 2016 년 Auth0 보고서로 산업화.

### 2-3. kid header injection / key confusion

`kid` (key id) 를 신뢰해서 그대로 SQL / 파일 / URL 로 사용:

```
header.kid = "../../etc/passwd"      → path traversal
header.kid = "1' OR 1=1; --"         → SQL injection
header.kid = "https://attacker.com/jwks.json"  → SSRF + 공격자 키로 검증
```

→ kid 는 untrusted input. allowlist 또는 strict regex 통과 후만 키 lookup.

### 2-4. signature stripping — JWS unsecured

일부 라이브러리는 signature 가 비어있으면 검증을 건너뜀 (alg=none 의 변종). 또는 `parser.parseClaimsJws` vs `parseClaimsJwt` 같은 API 차이로 검증 누락.

### 2-5. 0-RTT replay — TLS 1.3 의 trade-off

TLS 1.3 의 0-RTT (early data) 는 첫 패킷에 application data 동봉 → 1 RTT 절약. 단점: replay 방어 없음. 공격자가 0-RTT 패킷을 가로채 여러 번 재전송 가능 → POST /transfer 같은 비멱등 API 가 여러 번 실행될 수 있음.

→ 0-RTT 는 **GET 등 멱등 요청에만** 사용 권장. CDN (Cloudflare, Fastly) 도 default 로 GET 만 허용.

### 2-6. Bearer token 탈취의 흔한 경로

- XSS (Cross-Site Scripting, 사이트 간 스크립팅) 로 localStorage 의 access token 추출.
- 로그 / referrer header / 캐시에 토큰 노출.
- proxy / WAF / OTel exporter 에 토큰 누출.
- 클라이언트 디바이스 도난 + secure storage 미사용.

→ Bearer 의 본질적 한계: 토큰을 가진 누구든 그 사용자처럼 행세 가능. 토큰을 **client identity 에 묶는** 보강 (DPoP / mTLS-bound) 가 표준.

### 2-7. Refresh token rotation 미적용 사고

- 단일 refresh token + 영구 사용 → 한 번 탈취되면 영구 권한.
- rotation 만 + reuse detection 없음 → 공격자가 먼저 사용 → 정상 사용자가 old refresh 시도 → 그냥 재발급되어 둘 다 사용 가능.

→ rotation + reuse detection 결합이 OAuth 2.1 표준.

---

## 3. 동작 원리

### 3-1. JWT 의 3 부분

```
header.payload.signature
└─ Base64URL(JSON) ──┘ └ Base64URL(bytes) ┘

header  = { "alg":"RS256", "typ":"JWT", "kid":"2026-05" }
payload = { "iss":"msa-auth", "sub":"u-123", "aud":["product","order"],
            "exp":1714800000, "iat":1714799700, "jti":"abc-xyz",
            "scope":"read:product write:order" }
signature = sign(header || "." || payload, key)
```

| 검증 게이트 | 점검 |
|---|---|
| 1. alg 신뢰 | 검증 측 allowlist 와 일치하는가 (`RS256` 만 허용 등) |
| 2. kid 신뢰 | 우리가 발급한 키 id 인가 (allowlist) |
| 3. 서명 검증 | kid 의 키로 RS256 검증 통과 |
| 4. claims 검증 | exp/nbf/iat 시간, iss/aud 일치, jti 미사용 (denylist) |

이 4 게이트 중 하나라도 자동 협상에 맡기면 함정.

### 3-2. alg=none 방어 — allowlist 강제

#### Java (jjwt) 안전 패턴

```java
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

// ❌ 위험
Jws<Claims> jws = Jwts.parser()
    .setSigningKey(publicKey)            // 알고리즘 자동 추정
    .parseClaimsJws(token);

// ✅ 안전 — 알고리즘 강제
Jws<Claims> jws = Jwts.parserBuilder()
    .setSigningKey(publicKey)
    .require("alg", "RS256")             // alg 강제
    .build()
    .parseClaimsJws(token);
```

또는 라이브러리 수준에서 `SignatureAlgorithm.NONE` 비활성:

```kotlin
// jose4j / nimbus-jose-jwt 도 default 가 none 거부 — 단 명시 필요
val jwtConsumer = JwtConsumerBuilder()
    .setVerificationKey(publicKey)
    .setJwsAlgorithmConstraints(
        AlgorithmConstraints(WHITELIST, "RS256", "ES256", "EdDSA"))
    .setRequireExpirationTime()
    .setRequireIssuedAt()
    .setExpectedIssuer("msa-auth")
    .setExpectedAudience("product")
    .build()
val claims = jwtConsumer.processToClaims(token)
```

### 3-3. HS/RS confusion 방어

원리: **검증 측이 알고리즘을 알고 있다면 그것만 허용**. 공개키를 HMAC 키로 못 쓰게 차단.

```java
// ❌ 위험 — 라이브러리가 토큰 header.alg 따라 검증 분기
parser.setSigningKey(publicKey).parse(token);

// ✅ 안전
parser.setSigningKeyResolver(new SigningKeyResolverAdapter() {
    @Override public Key resolveSigningKey(JwsHeader header, Claims claims) {
        if (!"RS256".equals(header.getAlgorithm())) {
            throw new JwtException("alg not allowed: " + header.getAlgorithm());
        }
        return getPublicKey(header.getKeyId());
    }
}).parseClaimsJws(token);
```

OAuth 2.0 Best Current Practice (RFC 8725) §2.1 가 이 방어를 명시: "a JWT verifier MUST reject any JWT that uses a different algorithm than what it expects".

### 3-4. kid injection 방어

```kotlin
// ❌ 위험 — kid 그대로 사용
val key = jwksClient.getKey(jws.header.kid)   // kid 가 URL/path 면 SSRF

// ✅ 안전 — allowlist + 형식 검증
private val KID_PATTERN = Regex("^[a-zA-Z0-9-]{8,64}$")
fun resolveKey(kid: String): PublicKey {
    require(KID_PATTERN.matches(kid)) { "invalid kid format" }
    return jwksCache[kid] ?: throw JwtException("unknown kid: $kid")
}
```

JWKS (JSON Web Key Set) 자체는 **자기 IdP (Identity Provider)** 의 endpoint 에서만 fetch — JWT header 의 jku/x5u 같은 URL 헤더는 무시 또는 strict allowlist.

### 3-5. JWE vs JWS — alg / enc 분리

JWS (서명) 는 무결성만 보장, payload 가 평문. claims 에 PII (Personally Identifiable Information, 개인 식별 정보) 가 들어가면 노출.

JWE (암호화) 는 payload 까지 암호화:

```
JWE header = { "alg":"RSA-OAEP-256", "enc":"A256GCM", "kid":"..." }
   alg = key management — content encryption key (CEK) 를 어떻게 암호화하나
   enc = content encryption — payload 를 어떻게 암호화하나 (AES-GCM 등)
```

| 필드 | 역할 | 예시 값 |
|---|---|---|
| `alg` | CEK wrapping 알고리즘 | `RSA-OAEP-256`, `ECDH-ES`, `dir` (직접) |
| `enc` | content encryption (AEAD) | `A256GCM`, `A128CBC-HS256` |

→ payload 에 민감 정보가 있으면 JWE 강제. 일반적인 access token (식별자만) 은 JWS 면 충분.

### 3-6. JWKS rotation — kid 와 dual publish

```http
GET /.well-known/jwks.json
{
  "keys": [
    { "kid": "2026-04", "kty":"RSA", "use":"sig", "alg":"RS256", ... },   ← 직전 키
    { "kid": "2026-05", "kty":"RSA", "use":"sig", "alg":"RS256", ... }    ← 현재 키
  ]
}
```

- 회전 절차: 새 키 추가 → 새 토큰부터 새 kid 로 서명 → 직전 토큰 만료 후 (예: 1 시간) old 키 제거.
- **JWKS cache** 의 TTL 관리 필요 — 새 kid 가 fetch 안 되면 검증 실패. fetch on miss + 5 분 TTL + negative cache.
- 사고 시 (키 노출) 즉시 회전 + denylist 로 유효 토큰 차단.

### 3-7. Refresh token rotation + reuse detection

```
Login:
  AT (access token, 15 min) + RT (refresh token, 30 days, rt_id=R1)

Refresh:
  POST /token (RT=R1)
  → AT' + RT' (rt_id=R2)
  → 서버: R1 invalidate, R2 active, R1.rotated_to=R2 기록

Reuse detection:
  POST /token (RT=R1)  — 이미 R2 가 발급된 R1 을 재사용
  → 서버: family 의 모든 RT (R1, R2, ...) 즉시 revoke + alert
  → 사용자에게 "다른 기기에서 사용됨" 알림 → 강제 재로그인
```

핵심:
- **rotation** 자체로는 부족 (탈취자가 먼저 쓰면 정상 사용자가 invalid 됨).
- **family 추적 + reuse 감지 시 family 전체 revoke** 가 OAuth 2.1 권장.
- AT 는 짧게 (5~15 분), RT 는 길게 (30 일) + sliding expiration.

### 3-8. JWT denylist (jti + revocation)

JWT 는 self-contained 라 만료 전 무효화가 어려움. 패턴:

| 방법 | 비용 | 즉각성 |
|---|---|---|
| 단순 만료 대기 | 0 | 분~시 |
| jti denylist (Redis) | 검증마다 1 round-trip | 즉시 |
| token introspection (RFC 7662) | 모든 검증마다 IdP 호출 | 즉시 (JWT self-contained 의 장점 상실) |
| 짧은 만료 (5 min) + RT rotation | 검증 비용 0 | 5 분 |
| user_id revocation epoch | 검증 시 user_id 의 epoch 비교 | 즉시 (권장) |

**user epoch 패턴**:
```
user u-123 의 토큰 모두 무효화 → users.epoch[u-123] = now()
JWT 검증 시: claim.iat < users.epoch[u-123] 이면 거부
```

→ Redis 1 lookup 으로 즉시 revoke + jti 별 저장 불필요. 큰 batch revoke 에 강함.

### 3-9. DPoP (RFC 9449) — proof-of-possession

Bearer 토큰의 한계: 가진 자가 사용자. DPoP 는 토큰 발급 시 client 의 공개키를 토큰에 묶고, 매 요청마다 그 공개키로 서명한 proof 를 동봉.

```
1. 토큰 발급
   POST /token   header: DPoP: <signed_proof>
   → IdP: AT 의 cnf.jkt = SHA-256(public_key)  (claim 으로 묶음)

2. API 호출
   GET /api/order
     Authorization: DPoP <AT>
     DPoP: <jwt signed by client_private_key,
            claims: { htm:"GET", htu:"https://api/order", iat, jti }>

3. 서버 검증
   - AT 의 cnf.jkt ?= SHA-256(DPoP header.jwk)
   - DPoP signature 검증
   - htm, htu 일치, iat 가 최근 (예: ±60s), jti 미사용
```

→ 토큰 탈취만으론 사용 불가. client 의 private key 도 함께 탈취해야 (브라우저면 IndexedDB 의 non-extractable key).

### 3-10. mTLS-bound tokens (RFC 8705)

DPoP 의 X.509 버전. client cert 를 mTLS 핸드셰이크에 사용 + AT 의 `cnf.x5t#S256` 에 cert thumbprint 묶음.

```
AT.cnf = { "x5t#S256": "SHA-256(client_cert_DER)" }

API 서버:
  - mTLS 로 받은 client cert 의 thumbprint
  - == AT.cnf.x5t#S256 ?
```

DPoP vs mTLS-bound:

| | DPoP | mTLS-bound |
|---|---|---|
| 적용 환경 | 브라우저 / SPA | server-to-server, 모바일 native |
| 키 관리 | 브라우저 IndexedDB / WebCrypto | OS keychain / HSM |
| infra | TLS 그대로 | 게이트웨이 / 메시 mTLS 필요 |
| 표준 | RFC 9449 | RFC 8705 |

### 3-11. Token Binding (RFC 8471/8472) — 역사적 메모

- Token Binding = TLS exporter 로 만든 key 에 토큰 묶기.
- 브라우저 / 표준 추진력 부족으로 사실상 사장 (2018 이후 표준화 흐름 정지).
- DPoP 가 그 자리를 대체.

### 3-12. PASETO — JWT 대안

PASETO (Platform-Agnostic SEcurity TOkens) 는 JWT 의 함정을 구조적으로 제거한 v3/v4 표준:

| 특징 | JWT | PASETO |
|---|---|---|
| 알고리즘 협상 | header.alg | **버전이 알고리즘 고정** (v4.public = Ed25519, v4.local = XChaCha20-Poly1305) |
| alg=none | 가능 (구현 의존) | 표준에서 **불가능** |
| HS/RS confusion | 가능 | 불가능 (버전이 키 타입 고정) |
| 형식 | JSON | JSON payload 동일하나 versioned token format |
| 라이브러리 | 풍부 | 점차 증가 (Go, Rust, Java, Node) |

```
v4.public.eyJzdWIiOiJ1LTEyMyJ9.signature        ← Ed25519 서명
v4.local.encrypted_payload.tag                  ← XChaCha20-Poly1305 AEAD
```

→ 새 시스템이고 IdP 가 PASETO 지원 라이브러리만 쓰면 좋은 선택. JWT 호환이 필요하면 (OAuth 표준 흐름) JWT + RFC 8725 권장 사항 강제.

### 3-13. Macaroons — capability token

PASETO 와 다른 결의 대안. caveat (조건) 을 token 에 누적 추가 가능 — 권한 축소 (attenuation) 만 클라이언트 측에서 가능.

```
M0 = mint(secret, "user=alice")
M1 = M0.with_caveat("op=read")
M2 = M1.with_caveat("ip=10.0.0.0/8")
M3 = M2.with_caveat("exp=2026-05-04T15:00:00Z")
```

→ Google Cloud, Tarsnap 등 일부 시스템에서 사용. mainstream JWT 대체는 아님.

### 3-14. 0-RTT 함정 정리

| TLS 1.3 모드 | RTT | replay 방어 |
|---|---|---|
| Full handshake | 1-RTT | 안전 |
| Resumption (PSK) | 1-RTT | 안전 |
| **0-RTT (early data)** | **0-RTT** | **❌ replay 가능** |

방어 (0-RTT 를 쓸 때):
- application 이 멱등 (idempotent) 요청만 허용 (GET / HEAD).
- early_data 의 `ticket_age` 검사 + 짧은 window (Cloudflare 10s).
- replay cache (서버 측 nonce) — 분산이라 어려움.

CDN 정책: GET 만 0-RTT 허용 + early_data nonce → 사실상 안전.

---

## 4. 사용 예제

### 4-1. Spring Security + Nimbus JWT (안전 패턴)

```kotlin
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.proc.JWSAlgorithmFamilyJWSKeySelector
import com.nimbusds.jose.jwk.source.RemoteJWKSet
import com.nimbusds.jwt.proc.DefaultJWTProcessor
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier
import java.net.URL

@Configuration
class JwtConfig {

    @Bean
    fun jwtProcessor(): DefaultJWTProcessor<SecurityContext> {
        val jwks = RemoteJWKSet<SecurityContext>(URL("https://auth.msa.local/.well-known/jwks.json"))
        val keySelector = JWSAlgorithmFamilyJWSKeySelector(JWSAlgorithm.Family.RSA, jwks)
            // ✅ RS family 만 허용 → HS confusion 차단

        val processor = DefaultJWTProcessor<SecurityContext>()
        processor.jwsKeySelector = keySelector
        processor.jwtClaimsSetVerifier = DefaultJWTClaimsVerifier(
            /* exactMatchClaims */ JWTClaimsSet.Builder().issuer("msa-auth").build(),
            /* requiredClaims */   setOf("sub", "exp", "iat", "jti"),
            /* prohibitedClaims */ emptySet(),
        )
        return processor
    }
}
```

### 4-2. JWKS rotation client (cache + dual key)

```kotlin
class JwksCache(private val url: String, private val ttl: Duration = Duration.ofMinutes(5)) {
    @Volatile private var keys: Map<String, PublicKey> = emptyMap()
    @Volatile private var fetchedAt: Instant = Instant.EPOCH

    fun resolve(kid: String): PublicKey {
        // 1) cache 확인
        keys[kid]?.let { return it }
        // 2) cache miss → refresh (rate-limit, 동시성 제어 생략)
        if (Duration.between(fetchedAt, Instant.now()) > Duration.ofSeconds(30)) {
            refresh()
            keys[kid]?.let { return it }
        }
        throw JwtException("unknown kid: $kid")
    }

    private fun refresh() {
        val jwks = JWKSet.load(URL(url))
        keys = jwks.keys.associate { it.keyID to it.toRSAKey().toPublicKey() }
        fetchedAt = Instant.now()
    }
}
```

회전 시 IdP 가 두 kid 동시 게시 → resource server cache 가 다음 refresh 에서 새 kid 도 picks up → 전환 매끄러움.

### 4-3. Refresh token rotation + reuse detection (Redis)

```kotlin
class RefreshTokenService(private val redis: StringRedisTemplate) {
    private val FAMILY_TTL = Duration.ofDays(30)

    data class RtRecord(val rtId: String, val familyId: String, val userId: String,
                        val rotatedTo: String? = null, val revoked: Boolean = false)

    fun issue(userId: String, familyId: String = UUID.randomUUID().toString()): String {
        val rtId = randomToken()
        redis.opsForValue().set("rt:$rtId", json(RtRecord(rtId, familyId, userId)),
            FAMILY_TTL.toSeconds(), TimeUnit.SECONDS)
        redis.opsForSet().add("rt:family:$familyId", rtId)
        redis.expire("rt:family:$familyId", FAMILY_TTL.toSeconds(), TimeUnit.SECONDS)
        return rtId
    }

    fun rotate(oldRt: String, userId: String): String {
        val rec = redis.opsForValue().get("rt:$oldRt")?.let { fromJson(it) }
            ?: throw AuthException("invalid rt")

        // ✅ reuse detection
        if (rec.revoked || rec.rotatedTo != null) {
            // family 전체 revoke
            redis.opsForSet().members("rt:family:${rec.familyId}")?.forEach {
                redis.opsForValue().set("rt:$it",
                    json(rec.copy(rtId = it, revoked = true)),
                    FAMILY_TTL.toSeconds(), TimeUnit.SECONDS)
            }
            alert("RT reuse detected — family ${rec.familyId} revoked")
            throw AuthException("rt reuse — please re-login")
        }

        // 정상 회전
        val newRt = issue(userId, rec.familyId)
        redis.opsForValue().set("rt:$oldRt",
            json(rec.copy(rotatedTo = newRt)),
            FAMILY_TTL.toSeconds(), TimeUnit.SECONDS)
        return newRt
    }
}
```

### 4-4. user epoch 기반 instant revocation

```kotlin
@Component
class UserEpochCheck(private val redis: StringRedisTemplate) {
    fun check(claims: Claims) {
        val userId = claims.subject
        val iat = claims["iat"] as Long
        val epoch = redis.opsForValue().get("user:epoch:$userId")?.toLong() ?: 0L
        if (iat < epoch) throw JwtException("token revoked (user epoch)")
    }

    fun revokeUser(userId: String) {
        redis.opsForValue().set("user:epoch:$userId", Instant.now().epochSecond.toString())
    }
}
```

→ 한 사용자의 모든 활성 토큰을 한 줄로 무효화. 검증 비용은 Redis 1 lookup.

### 4-5. DPoP 검증 (resource server)

```kotlin
class DpopVerifier {
    fun verify(authHeader: String, dpopHeader: String, httpMethod: String, httpUrl: String) {
        val (scheme, atToken) = authHeader.split(" ", limit = 2)
        require(scheme == "DPoP") { "expected DPoP scheme" }

        // 1. AT 검증 (위 §4-1) → claims 추출
        val atClaims = jwtProcessor.process(atToken, null)
        val atJkt = atClaims.getStringClaim("cnf").let { /* jkt 추출 */ }

        // 2. DPoP proof 파싱 (header 에 jwk 포함)
        val dpop = SignedJWT.parse(dpopHeader)
        val jwk = dpop.header.jwk ?: throw JwtException("DPoP missing jwk")
        val proofThumbprint = jwk.computeThumbprint().toString()

        // 3. cnf.jkt vs proof thumbprint
        require(atJkt == proofThumbprint) { "DPoP key binding mismatch" }

        // 4. proof 서명 검증
        require(dpop.verify(jwk.toRSAKey().toPublicKey().let { RSASSAVerifier(it as RSAPublicKey) }))

        // 5. claims
        val proof = dpop.jwtClaimsSet
        require(proof.getStringClaim("htm") == httpMethod)
        require(proof.getStringClaim("htu") == httpUrl)
        require(proof.issueTime.toInstant().isAfter(Instant.now().minusSeconds(60)))
        // 6. jti 미사용
        require(redis.opsForValue().setIfAbsent(
            "dpop:jti:${proof.jwtid}", "1", Duration.ofMinutes(2)) == true)
    }
}
```

### 4-6. mTLS-bound (RFC 8705) — gateway 검증

```kotlin
@Component
class MtlsBoundCheck {
    fun check(claims: JWTClaimsSet, request: HttpServletRequest) {
        val cnf = claims.getJSONObjectClaim("cnf") ?: return  // bearer 모드
        val expectedThumbprint = cnf["x5t#S256"] as String

        val cert = request.getAttribute("javax.servlet.request.X509Certificate")
            as Array<X509Certificate>?
        val clientCert = cert?.firstOrNull() ?: throw AuthException("client cert required")

        val actualThumbprint = sha256(clientCert.encoded).toBase64UrlNoPad()
        require(actualThumbprint == expectedThumbprint) { "x5t#S256 mismatch" }
    }
}
```

### 4-7. PASETO 사용 (Java)

```kotlin
import dev.paseto.jpaseto.Pasetos
import dev.paseto.jpaseto.lang.Keys

val keyPair = Keys.keyPairFor(Version.V4)
val token = Pasetos.V4.PUBLIC.builder()
    .setPrivateKey(keyPair.private)
    .setIssuer("msa-auth")
    .setSubject("u-123")
    .setAudience("product")
    .setExpiration(Instant.now().plusSeconds(900))
    .compact()

val parsed = Pasetos.parserBuilder()
    .setPublicKey(keyPair.public)
    .requireIssuer("msa-auth")
    .build()
    .parse(token)
```

→ alg confusion 자체가 불가능 (V4.PUBLIC 이 알고리즘 고정).

### 4-8. 0-RTT 안전 사용 (Nginx + Spring)

```nginx
ssl_early_data on;
proxy_set_header Early-Data $ssl_early_data;
```

```kotlin
@Component
class EarlyDataFilter : OncePerRequestFilter() {
    override fun doFilterInternal(req: HttpServletRequest, resp: HttpServletResponse, chain: FilterChain) {
        if (req.getHeader("Early-Data") == "1") {
            // 0-RTT 요청 — 멱등 method 만 허용
            if (req.method !in setOf("GET", "HEAD", "OPTIONS")) {
                resp.status = 425  // Too Early
                resp.writer.write("0-RTT not allowed for non-idempotent methods")
                return
            }
        }
        chain.doFilter(req, resp)
    }
}
```

---

## 5. 트레이드오프 / 안티패턴

### 5-1. 라이브러리에 알고리즘 자동 협상 위임

- `parseClaimsJws(token)` 만 부르고 알고리즘 명시 안 함 → HS/RS confusion 의 표면.
- 항상 `require("alg", "RS256")` 또는 `JWSAlgorithmFamilyJWSKeySelector(RSA, ...)` 명시.

### 5-2. localStorage 에 access token 저장 + XSS

- localStorage 는 모든 JS 가 접근 → XSS 시 즉시 탈취.
- 개선: `httpOnly + Secure + SameSite=Strict` 쿠키 + CSRF token 또는 DPoP/mTLS-bound.

### 5-3. JWT payload 에 PII 평문

- JWT 는 base64 → 누구나 디코드. payload 평문 노출.
- 개선: PII 는 backend 에 저장 + token 에는 식별자만. 굳이 담아야 하면 JWE.

### 5-4. exp 만 검증, nbf/iat 무시

```
{ "exp": 9999999999 }  ← 100 년 후 (실수 / 공격)
```

- iat 가 미래거나 너무 오래된 토큰은 의심해야 함.
- exp - iat > 24h 같은 sanity check 추가.

### 5-5. Refresh token 을 그냥 long-lived AT 처럼 씀

- AT 만료 → RT 로 바로 새 AT 발급, RT rotation 없음.
- 한 번 탈취되면 영구 권한.

### 5-6. JWKS endpoint 를 매 검증마다 fetch

- IdP 부하 폭증 / latency.
- 개선: 5 분 cache + miss 시 lazy fetch + rate limit.

### 5-7. JWT denylist 로 모든 토큰 추적

- self-contained 의 장점 상실 (검증마다 DB).
- 개선: short-lived AT + RT rotation + user epoch 패턴.

### 5-8. 0-RTT 를 모든 method 에 허용

- POST / PUT / DELETE 가 replay 되면 결제 / 송금 중복.
- 개선: GET 만 허용 + early_data nonce.

### 5-9. ID token 을 access token 으로 사용

- OIDC 의 ID token (`aud=client_id`) 을 API 호출에 사용 → audience 불일치, 보안 모델 혼동.
- 분리: ID token = 사용자 식별 (브라우저), Access token = API 호출.

### 5-10. signature 검증 후 만료 검증 누락

- 일부 라이브러리는 검증 함수가 분리됨 (verify signature vs verify claims).
- 한 번에: `parser.requireExpiration().build().parseClaimsJws(token)` 강제.

### 5-11. mTLS-bound 인데 gateway 가 client cert 를 detach 후 forward

- gateway 만 mTLS 검증, backend 는 그냥 `X-Client-Cert` header 신뢰 → header injection 가능.
- 개선: gateway → backend 도 mTLS, 또는 cert thumbprint 만 signed header 로.

---

## 6. msa 적용

### 6-1. 현재 gateway 의 JWT 검증 (추정)

`gateway/.../JwtAuthenticationFilter.kt` 가 HS256 + secret 환경변수로 검증한다고 가정. 함정:

| 함정 | 영향 | 대안 |
|---|---|---|
| HS256 (대칭) | secret 가 모든 서비스에 배포 → 한 서비스 침해 = 토큰 위조 | RS256/ES256 (비대칭) — gateway 는 public key 만 |
| alg 자동 협상 | alg=none / HS-RS confusion | alg allowlist 강제 |
| kid / JWKS 부재 | rotation 불가 | JWKS endpoint + dual publish |
| denylist 부재 | 즉시 revocation 불가 | user epoch (Redis) |
| Bearer only | 토큰 탈취 = 사용자 행세 | DPoP (브라우저) + mTLS-bound (서버 간) |

### 6-2. 권장 마이그레이션 (Phase plan)

```
Phase 1: HS256 → RS256 + JWKS  (1주)
  - auth 서비스 (미생성) 가 RSA key pair 생성, JWKS endpoint 노출
  - gateway 가 JWKS cache + alg=RS256 강제
  - HS256 토큰은 grace 기간 동안 둘 다 검증

Phase 2: Refresh rotation + reuse detection  (1주)
  - Redis family 기반
  - reuse 감지 시 family revoke + Slack alert

Phase 3: user epoch denylist  (3일)
  - Redis 1 key per user
  - 패스워드 변경 / 강제 로그아웃 시 epoch 갱신

Phase 4: DPoP (브라우저)  (2주)
  - 프론트엔드: WebCrypto 로 ECDSA P-256 key (non-extractable)
  - gateway: DPoP filter + jti replay cache (Redis)
  - 점진 — 새 클라이언트부터 DPoP, 구 클라이언트는 Bearer 유지

Phase 5: mTLS-bound (서버 간)  (3주, §23 와 함께)
  - service mesh (Istio) 가 sidecar mTLS
  - 서비스 간 호출 시 cert thumbprint 가 AT.cnf.x5t#S256 와 매칭

Phase 6: 0-RTT 정책  (1일)
  - Nginx ssl_early_data on
  - Spring filter: GET/HEAD/OPTIONS 외 425 거부
```

### 6-3. JWT claim 표준화 (msa)

```json
{
  "iss": "https://auth.msa.local",
  "sub": "u-123",
  "aud": ["product", "order", "search"],     // 서비스 audience
  "exp": 1714800000,
  "iat": 1714799700,
  "jti": "01JEXC...",                        // ULID
  "scope": "read:product write:order",
  "tenant": "msa-default",
  "cnf": { "jkt": "..." },                   // DPoP 시
  "azp": "web-spa-v1"                        // authorized party
}
```

각 서비스는 자기 audience 만 검증 + scope 매칭.

### 6-4. JWKS endpoint 운영 (auth 서비스)

```kotlin
@RestController
@RequestMapping("/.well-known")
class JwksController(private val keyProvider: KeyProvider) {
    @GetMapping("/jwks.json")
    fun jwks(): Map<String, Any> {
        val keys = keyProvider.activeKids().map { kid ->
            mapOf(
                "kty" to "RSA", "use" to "sig", "alg" to "RS256",
                "kid" to kid,
                "n" to keyProvider.getN(kid).toBase64UrlNoPad(),
                "e" to keyProvider.getE(kid).toBase64UrlNoPad(),
            )
        }
        return mapOf("keys" to keys)
    }
}
```

- HTTP cache header `Cache-Control: max-age=300` → resource server cache 와 호흡.
- 회전 시 새 kid 게시 → 24h 후 grace period 끝나면 old 제거.

### 6-5. Bearer → DPoP 점진 전환

gateway 의 인증 filter:

```kotlin
@Component
class AuthFilter : OncePerRequestFilter() {
    override fun doFilterInternal(req: ..., resp: ..., chain: ...) {
        val auth = req.getHeader("Authorization") ?: return chain.doFilter(req, resp)
        val (scheme, token) = auth.split(" ", limit = 2)
        val claims = jwtProcessor.process(token, null)

        when (scheme) {
            "Bearer" -> {  /* 기존 검증 */ }
            "DPoP"   -> dpopVerifier.verify(req.getHeader("DPoP"), claims, req.method, req.requestURL.toString())
            else     -> { resp.status = 401; return }
        }
        chain.doFilter(req, resp)
    }
}
```

같은 filter 가 두 모드 지원 → 클라이언트 단계적 전환.

### 6-6. mTLS-bound 와 service mesh

- §23 에서 풀 다룸. 요점: gateway 가 외부 (Bearer / DPoP) 인증 → 내부 서비스 호출은 mesh mTLS + AT.cnf.x5t#S256 검증.
- internal call 의 cert 는 SPIFFE ID (예: `spiffe://msa.local/sa/product`) → 서비스 identity 가 cert 안에.

### 6-7. PASETO 도입 검토

- 새 internal service (admin / batch) 가 IdP 없이 자체 토큰을 쓴다면 PASETO v4.local (대칭) 권장 — alg=none / confusion 자체가 불가능.
- 외부 / OAuth 호환은 JWT + RFC 8725 권장 사항 강제.

---

## 7. ADR 후보

> **ADR-XXXX-13c: JWT 검증 강화 — alg allowlist + JWKS rotation + reuse detection**
>
> **Context**: gateway 의 HS256 + 단일 secret 검증은 (1) 한 서비스 침해 시 토큰 위조 가능, (2) alg 자동 협상으로 HS-RS confusion 노출, (3) kid / JWKS 부재로 회전 불가, (4) RT rotation 부재, (5) instant revocation 부재.
>
> **Decision**:
> 1. **RS256 + JWKS** — auth 서비스가 RSA key pair 보유, `/.well-known/jwks.json` 게시. gateway 는 public key 만.
> 2. **alg allowlist** — Nimbus `JWSAlgorithmFamilyJWSKeySelector(RSA, ...)` 로 RS family 강제.
> 3. **JWKS rotation** — old + new 동시 게시 (24h grace), resource server cache TTL 5 min.
> 4. **RT rotation + reuse detection** — Redis family + 재사용 감지 시 family revoke + alert.
> 5. **user epoch denylist** — `user:epoch:<id>` Redis key, 검증 시 `iat < epoch` 거부.
> 6. **claim 표준** — `iss/sub/aud/exp/iat/jti/scope/tenant/cnf/azp`.
>
> **Consequences**:
> - (+) 함정 5 종 차단, 회전 가능, 즉시 revocation, 비대칭으로 blast radius 축소.
> - (-) auth 서비스 추가 도입 (ADR 별도), Redis 의존.

> **ADR-XXXX-13d: Token sender constraint — DPoP (외부) + mTLS-bound (내부)**
>
> **Decision**:
> 1. 브라우저 / SPA — DPoP (RFC 9449) 점진 도입. 기존 Bearer 와 동시 지원 후 deprecate.
> 2. 서비스 간 internal call — mTLS + AT.cnf.x5t#S256 (RFC 8705). service mesh (Istio/Linkerd) 가 sidecar 자동 회전.
> 3. 0-RTT (TLS 1.3 early_data) — GET/HEAD/OPTIONS 만 허용 (Spring filter 강제).
>
> **Consequences**:
> - (+) Bearer 탈취 단독으론 사용 불가, replay 불가.
> - (-) 인프라 의존성 (Istio mesh, WebCrypto), 클라이언트 학습 곡선.

> **ADR-XXXX-13e: Internal token 으로 PASETO 도입 검토**
>
> **Decision**: 외부 OAuth 흐름은 JWT 유지, IdP 가 발급하지 않는 internal 자체 토큰 (batch job, admin tool) 은 PASETO v4 사용. JWT 함정 차단 + 학습 곡선 최소화.

---

## 8. 면접 한 줄 답변

### Q. JWT alg=none 함정이 무엇이고 어떻게 막나요?

> "header.alg 를 \"none\" 으로 설정하고 signature 부분을 비워서 보내면, 일부 라이브러리가 \"서명 없음 → 검증 통과\" 로 처리하는 함정입니다. CVE-2015-9235 가 대표적이고 산업 전체가 이걸 계기로 알고리즘 allowlist 를 표준화했습니다. 방어는 단순합니다 — 검증 측이 토큰의 alg 를 신뢰하지 말고 자기가 받아들일 알고리즘을 명시 (`require(\"alg\", \"RS256\")`) 하면 됩니다. RFC 8725 가 이걸 BCP 로 명시합니다."

### Q. HS256 과 RS256 confusion attack 은 무엇인가요?

> "서버가 RS256 으로 서명하고 검증 측이 알고리즘을 자동 협상하면, 공격자가 header.alg 를 HS256 으로 변조했을 때 검증 측이 RSA public key 를 HMAC secret 으로 사용해서 검증합니다. public key 는 공개 정보라 공격자도 알 수 있고, 그걸 HMAC 키로 새 서명을 만들면 위조 가능합니다. 방어는 alg 를 토큰이 아니라 검증 측이 결정하도록 강제하는 것입니다. Nimbus 의 `JWSAlgorithmFamilyJWSKeySelector(RSA, ...)` 같은 패턴이 표준입니다."

### Q. JWT 의 즉시 revocation 은 어떻게 구현하나요?

> "JWT 는 self-contained 라 만료 전 무효화가 본질적으로 어렵습니다. 4 가지 패턴이 있는데, jti denylist 는 검증마다 Redis 1 round-trip 비용이 들고 큰 batch revoke 에 약합니다. token introspection 은 self-contained 의 장점을 잃고요. 가장 실용적인 건 user epoch 패턴 — 사용자별로 epoch timestamp 를 Redis 에 저장하고, 검증 시 `claim.iat < epoch` 이면 거부합니다. 패스워드 변경 / 강제 로그아웃 시 epoch 만 갱신하면 그 사용자의 모든 활성 토큰이 한 줄로 무효화됩니다. 보조로 짧은 access token 만료 (5~15 분) + refresh rotation 결합이 표준입니다."

### Q. Refresh token rotation 만으론 부족한 이유는?

> "rotation 만 적용하면 공격자가 RT 를 탈취해서 먼저 새 RT 를 받아갔을 때, 정상 사용자가 old RT 를 들고 오면 그냥 invalidated 되고 끝납니다 — 공격자는 계속 사용. 그래서 reuse detection 이 필요합니다. 한 family 안에서 이미 rotated 된 RT 가 다시 들어오면 그 family 전체를 즉시 revoke 하고 사용자에게 alert. OAuth 2.1 도 이걸 SHOULD 로 명시합니다."

### Q. DPoP 와 mTLS-bound token 은 무엇이고 언제 쓰나요?

> "둘 다 Bearer 의 한계 — 토큰 가진 누구든 사용자처럼 행세 가능 — 를 해결하는 sender constraint 표준입니다. DPoP (RFC 9449) 는 client 가 매 요청마다 자기 private key 로 서명한 proof 를 동봉하고, 토큰의 cnf.jkt 가 그 public key 의 thumbprint 와 일치해야 합니다. 브라우저 SPA / 모바일 native 에 적합합니다. mTLS-bound (RFC 8705) 는 같은 발상을 X.509 cert 로 한 것 — TLS 핸드셰이크의 client cert thumbprint 가 AT.cnf.x5t#S256 와 일치해야 합니다. 서버 간 / service mesh 환경에 자연스럽습니다. 토큰이 탈취돼도 keypair / cert 가 함께 탈취되지 않으면 사용 불가입니다."

### Q. TLS 1.3 의 0-RTT 가 왜 위험하고 어떻게 다루나요?

> "0-RTT 는 첫 패킷에 application data 를 동봉해서 1 RTT 를 절약하는데, replay 방어가 본질적으로 어렵습니다 — 공격자가 0-RTT 패킷을 가로채 여러 번 재전송하면 서버 입장에선 정상 요청과 구별 불가. POST /transfer 같은 비멱등 요청이 여러 번 실행될 수 있습니다. 그래서 0-RTT 는 GET/HEAD 같은 멱등 method 에만 사용하고, CDN 도 default 로 GET 만 허용합니다. 보강으로 early_data nonce + ticket_age 짧게 (10s 등) 적용합니다."

### Q. PASETO 가 JWT 보다 안전하다는 주장의 근거는?

> "PASETO 는 버전이 알고리즘을 고정합니다 — v4.public 은 Ed25519 만, v4.local 은 XChaCha20-Poly1305 만. alg=none 자체가 표준에 존재하지 않고, alg confusion 은 버전이 키 타입을 고정하니 불가능합니다. 즉 JWT 의 가장 흔한 함정 두 가지를 구조적으로 제거합니다. 단점은 OAuth / OIDC 같은 표준 흐름이 JWT 기반이라 호환성이 떨어진다는 점 — 자체 internal 토큰엔 PASETO, 외부 OAuth 흐름은 JWT + RFC 8725 강제 가 실용적 절충입니다."

---

## 9. 흔한 오해 정정

> **"JWT 가 base64 인코딩이라 어느 정도 비밀이 보장된다"**

- ❌ base64 는 인코딩일 뿐 암호화 아님. 누구나 디코드. PII 평문 금지. 비밀이 필요하면 JWE.

> **"HS256 이 RS256 보다 빠르니까 안전하면 HS256 이 낫다"**

- ⚠ HS256 은 secret 가 모든 검증 노드에 배포돼야 함 → 한 서비스 침해 = 토큰 위조. 분산 환경은 RS256/ES256 권장.

> **"refresh token 이 있으면 access token 이 길어도 OK"**

- ❌ AT 가 길면 즉시 revocation 이 어렵고 탈취 시 영향 시간 길어짐. AT 5~15 분 + RT 30 일 + rotation 이 표준.

> **"Bearer 토큰을 HTTPS 로 보내면 안전하다"**

- ❌ HTTPS 는 in-transit 만 보호. 클라이언트 측 XSS / 로그 / referrer / 디바이스 도난 등 탈취 경로 다수. DPoP/mTLS-bound 로 보강.

> **"JWT 가 self-contained 면 검증이 빨라서 introspection 보다 항상 낫다"**

- ⚠ 검증 자체는 빠르지만 즉시 revocation 이 어려움. 워크로드에 따라 introspection 이 적합 (예: 금융, 매우 빈번한 권한 변경).

> **"JWT 의 jti 만 있으면 replay 방어 끝"**

- ❌ jti 는 단순 식별자. denylist 와 결합해야 의미. 운영적 인프라 (Redis) 가 필요.

> **"alg=none 은 옛날 라이브러리 얘기, 요즘은 신경 안 써도 된다"**

- ⚠ 옛 라이브러리 호환 모드, custom JWT parser, side service 등에서 여전히 출현. allowlist 강제는 의무.

> **"DPoP 는 브라우저에서만 가능하다"**

- ❌ 모바일 native (iOS Keychain, Android Keystore), 백엔드 (HSM-backed key) 모두 가능. 적용 범위가 mTLS 보다 가벼움.

> **"0-RTT 는 TLS 1.3 표준이니 그냥 켜도 된다"**

- ❌ replay 방어가 application 책임. 멱등 method 강제 + early_data nonce 없으면 결제 / 송금 사고 가능.

> **"PASETO 는 표준이 아니라 안 쓰면 그만"**

- ⚠ JWT 가 표준이긴 하지만 함정이 많아서 PASETO 가 IETF draft / 실무 채택 증가. internal 토큰엔 PASETO, 외부 호환엔 JWT 라는 절충이 점차 현실적.

---

## 10. 회독 체크리스트

> §22 회독 체크리스트:
> - [ ] JWT 검증 4 게이트 (alg / kid / signature / claims)
> - [ ] alg=none 함정 + 방어 (`require("alg", "RS256")`)
> - [ ] HS/RS confusion 원리 + 방어 (`JWSAlgorithmFamilyJWSKeySelector`)
> - [ ] kid injection 함정 + 방어 (allowlist + regex + JWKS strict source)
> - [ ] JWS vs JWE 의 alg / enc 분리 + payload 평문 / 암호 차이
> - [ ] JWKS rotation 패턴 (dual publish + kid + cache TTL 5 min)
> - [ ] Refresh token rotation + reuse detection (family revoke)
> - [ ] user epoch denylist 패턴 (Redis 1 key 로 batch revoke)
> - [ ] 0-RTT replay 위험 + 방어 (멱등 method 강제 + nonce)
> - [ ] DPoP 의 cnf.jkt + proof JWT 검증 5 단계
> - [ ] mTLS-bound 의 cnf.x5t#S256 + client cert thumbprint
> - [ ] PASETO 가 alg=none / confusion 을 구조적으로 차단하는 방식 (버전 = 알고리즘 고정)
> - [ ] localStorage 저장 + XSS 위험 + httpOnly 쿠키 / DPoP 대안
> - [ ] AT 짧게 (5~15 min) + RT 길게 (30 day) + rotation 결합
> - [ ] msa 마이그레이션 6 phase (HS→RS / rotation / epoch / DPoP / mTLS-bound / 0-RTT)

---

## 11. 연결 학습

- §08 JWT 구조 — 기본 (이 파일은 함정 + 운영 심화)
- §09 token strategy — AT/RT 기본 (이 파일은 rotation + reuse detection 표준)
- §16 TLS — 기본 (이 파일은 0-RTT 함정 심화)
- §21 AEAD / KDF — 대칭 암호 함정 (JWE 의 enc 가 이걸 사용)
- §23 mTLS / cert rotation (다음 파일) — mTLS-bound 의 인프라
- §24 Post-Quantum (다음 파일) — JWT alg 의 다음 세대 (Dilithium, Falcon)
