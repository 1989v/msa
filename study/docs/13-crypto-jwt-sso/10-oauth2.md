---
parent: 13-crypto-jwt-sso
seq: 10
title: OAuth 2.0 + PKCE
type: deep
created: 2026-04-28
---

# 10. OAuth 2.0 (RFC 6749)

## 인증 vs 인가

- **인증 (Authentication)** — "누구인가" 검증. 비밀번호, 생체, OTP, mTLS 등.
- **인가 (Authorization)** — "무엇을 할 수 있는가" 결정. RBAC, ABAC, 권한 정책.

**자주 헷갈리는 점** — OAuth (Open Authorization) 2.0은 **인가(Authorization) 프로토콜**이지 인증이 아니다. "이 클라이언트가 이 사용자의 자원에 이런 범위로 접근할 권한을 받았다"가 본질. 사용자 인증은 OAuth 위에 OIDC를 얹어야 표준화된다.

## 역할

- **Resource Owner** — 사용자
- **Client** — 자원에 접근하려는 앱 (웹 앱, 모바일 앱, SPA)
- **Authorization Server** — 토큰 발급 (Auth0, Keycloak, Cognito, Okta)
- **Resource Server** — 보호된 API 서버

## Grant Type별 흐름

### 1. Authorization Code Grant (가장 일반적)

```
[Browser] → /authorize?response_type=code&client_id=X&redirect_uri=...&state=S&code_challenge=H(V)
   ↓ (사용자 로그인 + consent)
[Auth Server] → redirect_uri?code=AUTH_CODE&state=S
   ↓
[Client Backend] → POST /token  body: code=AUTH_CODE, code_verifier=V
   ↓
[Auth Server] → access_token, refresh_token, id_token
```

핵심 보안 장치
- **`state`** — CSRF 방어 (요청-응답 매칭)
- **`code` 일회용 + 짧은 TTL** (10분 이하)
- **`redirect_uri` 화이트리스트** — open redirect 방지
- **PKCE** (RFC 7636) — code interception 방어 (아래 설명)

### 2. Client Credentials Grant
- 머신 ↔ 머신, 사용자 없음
- 백엔드 서비스 간 호출 (M2M)

### 3. Resource Owner Password (Deprecated)
- 클라이언트가 사용자 비밀번호를 직접 받음 → 위험 → 사용 금지

### 4. Implicit Flow (Deprecated)
- 토큰을 URL 프래그먼트로 직접 반환 → 브라우저 히스토리/리퍼러 누출
- PKCE+Auth Code로 대체 권장 (RFC 9700)

### 5. Device Authorization Grant (RFC 8628)
- TV, IoT처럼 입력이 어려운 기기 — 별도 폰에서 사용자 코드 입력

## PKCE (Proof Key for Code Exchange, RFC 7636)

**문제** — 모바일/SPA는 client_secret을 안전히 저장 못 함. Authorization Code가 가로채지면 그대로 토큰 교환 가능.

### 해결
1. 클라이언트가 `code_verifier` 랜덤 생성 → `code_challenge = SHA256(code_verifier)` 함께 `/authorize` 요청
2. Auth Server가 challenge 저장
3. `/token` 호출 시 `code_verifier` 원본 첨부
4. Auth Server가 `SHA256(verifier) == challenge` 검증

→ 코드를 가로채도 verifier 모르면 토큰 교환 실패.

**현재 권장**: **모든 OAuth Authorization Code Flow에 PKCE 적용** (public client뿐 아니라 confidential도). RFC 9700.

## Token Endpoint vs Authorization Endpoint

- `/authorize` — 사용자 브라우저가 들르는 곳, redirect 기반, `code` 발급
- `/token` — 클라이언트 백엔드가 호출, `code` ↔ `access_token` 교환

## 핵심 포인트

- 기억할 grant: **Authorization Code (+PKCE)** + **Client Credentials**
- Implicit, ROPC는 deprecated
- PKCE는 모든 시나리오에서 적용
- `state` 파라미터는 CSRF 방어 — 항상 검증

## 다음 학습

- [11-oidc.md](11-oidc.md) — OAuth 2.0 위 인증 레이어
- [12-saml.md](12-saml.md) — 다른 SSO 표준 비교
