---
parent: 13-crypto-jwt-sso
seq: 08
title: JWT 구조 + 서명 알고리즘 + alg:none 취약점
type: deep
created: 2026-04-28
---

# 08. JWT 구조 + 알고리즘

## JWT 구조

**JWT (JSON Web Token, RFC 7519)** = `Header.Payload.Signature` (Base64URL 인코딩, `.` 구분).

```
eyJhbGciOiJIUzI1NiJ9 . eyJzdWIiOiIxMjMiLCJleHAiOjE3MDB9 . xLk8u...
└── Header ────────┘   └── Payload ──────────────────┘   └─ Signature ─┘
```

### Header
```json
{ "alg": "HS256", "typ": "JWT", "kid": "key-id-2026-04" }
```
- `alg` — 서명 알고리즘
- `typ` — `JWT` 또는 `at+jwt` (RFC 9068)
- `kid` — 키 식별자 (키 회전 시 필수)

### Payload (Claims)
- 표준 클레임 (RFC 7519)
  - `iss` issuer / `sub` subject / `aud` audience
  - `exp` expiration / `nbf` not before / `iat` issued at
  - `jti` JWT ID — 단일 사용 검증, blacklist 키
- 커스텀 클레임 — `userId`, `roles` 등

### Signature
- `HMAC_SHA256( base64url(header) + "." + base64url(payload), secret )`
- 또는 `RSA_SHA256(...)`, `ECDSA_SHA256(...)`

## ⚠️ 중요

Payload는 **서명만 되어 있고 암호화는 안 됨**. 누구나 디코드해서 읽을 수 있다. **비밀 정보 절대 금지**.

## JWS vs JWE

- **JWS (Signed)** — 무결성+인증, 평문 가시. 99%의 JWT가 이것.
- **JWE (Encrypted)** — 암호화까지. 표준은 있지만 거의 안 씀 (TLS가 전송 암호화 담당, 페이로드는 본질적으로 비공개일 필요 없음). 모바일 앱 토큰처럼 클라이언트가 페이로드를 못 읽게 막아야 할 때만.

## 서명 알고리즘 비교

| 알고리즘 | 키 모델 | 사용 시나리오 | 특징 |
|---|---|---|---|
| **HS256** (HMAC-SHA256) | 대칭 (공유 비밀) | 단일 발급자=검증자 (모놀리스, 마이크로서비스 내부) | 빠름, 키 분배 필요 |
| **RS256** (RSA-SHA256) | 비대칭 (RSA 2048+) | 외부 IdP가 발급, 다수 서비스가 검증 | 공개키만 배포, 검증 느림 |
| **ES256** (ECDSA P-256) | 비대칭 (ECC) | RS256 대안, 키/서명 작음 | nonce 위험 주의 |
| **EdDSA** (Ed25519) | 비대칭 | 최신 권장 | 결정론적 nonce, 빠름 |
| **none** | 없음 | **금지** | 역사적 취약점 |

### 선택 기준

- **Single issuer + 내부 신뢰**: HS256 (현 msa 패턴)
- **Multi-tenant / external IdP**: RS256 또는 ES256 — 검증자가 공개키만 보유
- **신규**: EdDSA가 가장 빠르고 안전, JOSE 라이브러리 호환성 확인

## `alg: none` 취약점

### 역사적 사건 (2015)
- 일부 라이브러리가 `Header.alg == "none"`이면 서명 검증을 통째로 건너뜀
- 공격자가 `alg`를 `none`으로 바꾸고 서명을 빈 문자열로 두면 통과

### 보호 패턴
- 검증 시 **허용 알고리즘을 명시적 화이트리스트로 강제** (`Jwts.parser().verifyWith(key)`로 알고리즘 고정)
- `alg: none`을 절대 허용하지 않는 라이브러리 사용
- `alg: HS256` ↔ `alg: RS256` 혼동 공격: HS256으로 RSA 공개키를 비밀 키로 쓰면 통과 → 검증 시 알고리즘과 키 타입을 함께 검증

> **현 msa 코드 연결** — `JwtUtil.kt`의 `Jwts.parser().verifyWith(key).build().parseSignedClaims(...)`가 안전한 패턴. JJWT 0.12+는 `alg: none` 거부가 기본.

## kid (Key ID) 헤더의 역할

- 어떤 키로 서명했는지 식별 → 검증자가 맞는 키를 골라 검증
- **키 회전(rotation) 시 필수** — 새 키 도입 시 옛 토큰은 옛 kid로 검증, 새 토큰은 새 kid로
- IdP가 JWKS 엔드포인트로 다수 공개키를 노출할 때 매핑 키
- 현 `JwtUtil.kt`에는 부재 → 보강 1순위

## 다음 학습

- [09-token-strategy.md](09-token-strategy.md) — JWT 운영 전략 (Stateless, Refresh Rotation)
- [11-oidc.md](11-oidc.md) — id_token vs access_token
- [18-code-refactoring.md](18-code-refactoring.md) — RotatableJwtUtil 코드
