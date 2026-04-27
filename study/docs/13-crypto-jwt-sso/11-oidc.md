---
parent: 13-crypto-jwt-sso
seq: 11
title: OpenID Connect (OIDC)
type: deep
created: 2026-04-28
---

# 11. OpenID Connect (OIDC)

## 핵심

OAuth 2.0 위에 **인증** 레이어를 얹은 표준.

## 추가 요소

- **`id_token`** (JWT) — 사용자 인증 정보 (`sub`, `email`, `name`, `iat`, `exp`, `iss`, `aud`, `nonce`)
- **UserInfo Endpoint** — 추가 사용자 정보 조회
- **Discovery** — `/.well-known/openid-configuration`에서 모든 엔드포인트 + 공개키(JWKS) URL 자동 노출
- **JWKS (JSON Web Key Set)** — `/jwks.json`에서 RS256/ES256 공개키 배포

## `id_token` vs `access_token`

- `id_token` — **사용자 인증** 증거. 클라이언트가 검증하고 사용자 신원 확인
- `access_token` — **API 인가** 토큰. Resource Server가 검증하고 사용자 권한 결정
- 둘은 다른 용도 → 한쪽을 다른 쪽으로 쓰면 안 됨

## Discovery 예

```
GET https://example.com/.well-known/openid-configuration
→ {
  "issuer": "https://example.com",
  "authorization_endpoint": "...",
  "token_endpoint": "...",
  "userinfo_endpoint": "...",
  "jwks_uri": "https://example.com/.well-known/jwks.json",
  "id_token_signing_alg_values_supported": ["RS256", "ES256"]
}
```

검증자(Resource Server, gateway)는 Discovery 응답 + JWKS만 캐싱하면 IdP 키 회전을 자동 따라간다.

## nonce

- `/authorize` 요청 시 클라이언트가 발급, `id_token`에도 포함
- replay 공격 방어 — id_token이 이번 인증 흐름에 발급된 것임을 증명

## Scopes (인가 범위)

- `openid` — OIDC 진입 (필수)
- `profile`, `email`, `address`, `phone` — 표준 클레임 그룹
- 커스텀 scope — `read:orders`, `write:orders` 등

## Authorization Code Flow + OIDC

OAuth Authorization Code Flow에 `scope=openid` 추가만 하면 OIDC가 된다. `/token` 응답에 `id_token`이 추가됨.

## 핵심 포인트

- 사용자 로그인이 필요하면 **OIDC**, 자원 접근만이면 OAuth
- Discovery + JWKS 패턴으로 **IdP 변경/키 회전 자동 적응** 가능
- `id_token` 검증 시 `iss`, `aud`, `exp`, `nonce` 모두 확인

## 코드 연결

현재 msa는 자체 HS256 발급/검증 → OIDC 도입 시:
1. Gateway가 외부 IdP (Cognito/Keycloak)의 JWKS를 캐시
2. RS256/ES256 검증으로 전환
3. `iss`, `aud` 클레임 검증 강제
4. 별도 `auth` 서비스가 IdP wrapper 또는 자체 IdP 역할

ADR 필요 (L3 변경) — [19-improvements.md](19-improvements.md)

## 다음 학습

- [12-saml.md](12-saml.md) — 비교 학습
- [16-tls.md](16-tls.md) — JWKS 전송도 TLS 필수
