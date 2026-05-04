---
parent: 13-crypto-jwt-sso
seq: 99
title: 암호화 · JWT · SSO · KMS 개념 카탈로그
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://datatracker.ietf.org/doc/html/rfc7519 (JWT)
  - https://datatracker.ietf.org/doc/html/rfc7515 (JWS)
  - https://datatracker.ietf.org/doc/html/rfc7516 (JWE)
  - https://datatracker.ietf.org/doc/html/rfc7517 (JWK)
  - https://datatracker.ietf.org/doc/html/rfc8628 (Device Auth)
  - https://oauth.net/2.1/
  - https://openid.net/specs/openid-connect-core-1_0.html
  - https://docs.aws.amazon.com/kms/
  - https://csrc.nist.gov/publications/sp800
---

# 99. 암호화 · JWT · SSO · KMS 카탈로그

> **목적** — 13-crypto-jwt-sso 의 20+ deep file + RFC + NIST + cloud KMS 공식 기준 빠진 영역 발굴 (PASETO, mTLS rotation, FIPS, HKDF, AEAD nonces, CRYSTALS-Kyber/Dilithium 양자내성, SCRAM, OPAQUE, FIDO2/WebAuthn, OAuth 2.1 변경, Authorization Code + PKCE 등).

---

## 1. 기존 커버 매트릭스 (요약)

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| Symmetric | AES, modes (ECB/CBC/CTR/GCM/CCM/SIV) | ✅ |
| Asymmetric | RSA / ECC / EdDSA | ✅ |
| Hash | SHA-2/3, BLAKE2/3 | ✅ |
| MAC | HMAC, KMAC, GMAC | ✅ |
| KDF | PBKDF2 / Argon2 / scrypt | ✅ |
| TLS | 1.2 vs 1.3, handshake, cipher suite | ✅ |
| JWT | claims, alg, exp, iss/aud, jti | ✅ |
| OAuth 2.0 / OIDC | flows | ✅ |
| KMS | AWS / GCP / Azure / HSM | ✅ |
| msa 적용 | gateway 인증, key rotation | ✅ |
| AEAD / KDF / 안전 난수 | nonce uniqueness, AES-GCM-SIV, HKDF, CSPRNG, Key Wrap, Crypto-agility | ✅ ([21](21-aead-nonce-key-derivation.md)) |
| JWT 함정 / Zero-Trust | alg=none, 0-RTT replay, DPoP, mTLS-bound, refresh token rotation | ✅ ([22](22-jwt-pitfalls-zero-trust.md)) |
| mTLS in mesh / Cert rotation | SPIFFE/SPIRE, Istio/Linkerd auto rotation, OCSP, CT log | ✅ ([23](23-mtls-mesh-cert-rotation.md)) |
| PQC (Post-Quantum Crypto) | CRYSTALS-Kyber/Dilithium, SPHINCS+, Falcon, Hybrid TLS | ✅ ([24](24-post-quantum-crypto.md)) |

### 1-A. 갭 진단

1. **AEAD 표준 (GCM, ChaCha20-Poly1305, AES-SIV, AES-OCB)** + nonce uniqueness 함정
2. **Key Wrap (RFC 5649, RFC 3394)** + envelope encryption
3. **HKDF (RFC 5869)** — extract + expand 표준 KDF
4. **CSPRNG / DRBG** — 안전 난수
5. **AES-NI / VAES / hardware accel**
6. **PASETO** — JWT 대안 (versioned, no alg confusion)
7. **OAuth 2.1 (draft → 채택)** — implicit flow 제거 + PKCE 의무화
8. **PKCE (Proof Key for Code Exchange)** 필수성 — public client
9. **Device Authorization Grant (RFC 8628)** — TV/CLI
10. **Token Binding / DPoP (Demonstrating Proof of Possession)** — bearer token 의 보강
11. **PAR (Pushed Authorization Requests, RFC 9126)** — request 객체 사전 전송
12. **JAR (JWT-Secured Authorization Request, RFC 9101)**
13. **mTLS Client Authentication (RFC 8705)**
14. **JWE 의 alg vs enc** — key management vs content encryption
15. **JWK / JWKS** + key id (kid) + rotation
16. **alg=none 함정** (CVE-2015-9235)
17. **JWT 알고리즘 confusion (HS vs RS)** — public key 를 HS secret 로 오해 — CVE
18. **Refresh Token rotation + reuse detection**
19. **Token introspection (RFC 7662)** vs JWT self-contained
20. **Token revocation (RFC 7009)** vs JWT 의 어려움
21. **JTI + denylist** — JWT 취소 패턴
22. **Sliding session vs sliding refresh token**
23. **Logout (Front-channel, Back-channel, Session Management)** — OIDC
24. **OAuth 2.0 Mutual TLS — sender-constrained tokens**
25. **OIDC ID Token vs Access Token vs Refresh Token** 의 의미
26. **OIDC scopes (openid, profile, email, ...)**
27. **OIDC discovery (.well-known/openid-configuration)**
28. **JWKS rotation 표준 — old + new 동시 게시**
29. **AuthN vs AuthZ — RBAC / ABAC / ReBAC / PBAC**
30. **OPA (Open Policy Agent) / Cedar / Casbin** — 정책 엔진
31. **FIDO2 / WebAuthn** — passwordless
32. **TOTP (RFC 6238) / HOTP (RFC 4226)** — 2FA
33. **SCIM** (System for Cross-domain Identity Management)
34. **SAML 2.0** — enterprise SSO
35. **OAuth flows summary**: Authorization Code (+ PKCE), Client Credentials, Resource Owner Password (deprecated), Implicit (deprecated), Device Code, JWT Bearer (RFC 7523)
36. **mTLS in mesh (Istio / Linkerd)** — auto rotation
37. **Vault / Cloud KMS DEK + KEK 분리**
38. **Envelope Encryption pattern**
39. **Key rotation policy** — period, grace, dual-control
40. **Key Compromise Recovery** — incident response
41. **Cryptographic Suite Negotiation 함정** — downgrade
42. **Post-Quantum (NIST 표준 2024)** — CRYSTALS-Kyber (KEM), CRYSTALS-Dilithium (signature), SPHINCS+ (signature), Falcon
43. **Hybrid (classical + PQ) — TLS 1.3 X25519+Kyber**
44. **Hardware Security Module (HSM) — FIPS 140-2/140-3 levels**
45. **CMK rotation in AWS KMS** (자동 yearly)
46. **AWS KMS multi-Region keys / GCP Cloud HSM / Azure Managed HSM**
47. **Secret 관리 — Vault / AWS Secrets Manager / GCP Secret Manager / SOPS**
48. **PII (Personally Identifiable Information, 개인 식별 정보) tokenization vs encryption**
49. **Format-preserving encryption (FF1 / FF3)**
50. **TLS Session Resumption** + 0-RTT 함정 (replay)
51. **Certificate Transparency** (CT log)
52. **CRL / OCSP / OCSP Stapling**

---

## 2. 카테고리별 개념 트리

### A. Symmetric Cipher / AEAD

| 개념 | 정의 | 상태 |
|---|---|---|
| AES (128/192/256) | 대칭 표준 | ✅ |
| Modes — ECB / CBC / CTR / GCM / CCM / SIV / OCB | mode 5종 + AEAD 변형 | ✅ |
| ChaCha20-Poly1305 | mobile 친화 AEAD | ✅ |
| **AEAD nonce uniqueness 함정** | nonce 재사용 = key 노출 (GCM 치명) | ✅ 커버 ([21](21-aead-nonce-key-derivation.md)) |
| AES-SIV / AES-GCM-SIV | nonce-misuse-resistant | ✅ 커버 ([21](21-aead-nonce-key-derivation.md)) |
| Key Wrap (RFC 3394 / 5649) | KEK 로 DEK 보호 | ✅ 커버 ([21](21-aead-nonce-key-derivation.md)) |

### B. Asymmetric / Hash / MAC / KDF

| 개념 | 정의 | 상태 |
|---|---|---|
| RSA (2048/3072/4096) | factor-based | ✅ |
| ECC (P-256/P-384) / EdDSA (Ed25519) | curve | ✅ |
| ECDH / X25519 | key agreement | ✅ |
| RSA-PSS (signature) | OAEP encryption | 🟡 |
| SHA-2 / SHA-3 / BLAKE2/3 | hash | ✅ |
| HMAC / KMAC / GMAC | MAC | ✅ |
| **HKDF (RFC 5869)** — extract + expand | 표준 KDF | ✅ 커버 ([21](21-aead-nonce-key-derivation.md)) |
| PBKDF2 / Argon2 / scrypt / bcrypt | password hash | ✅ |
| **CSPRNG / DRBG** | 안전 난수 | ✅ 커버 ([21](21-aead-nonce-key-derivation.md)) |

### C. Post-Quantum (NIST 2024)

| 개념 | 정의 | 상태 |
|---|---|---|
| **CRYSTALS-Kyber (ML-KEM)** | KEM 표준 | ✅ 커버 ([24](24-post-quantum-crypto.md)) |
| **CRYSTALS-Dilithium (ML-DSA)** | signature 표준 | ✅ 커버 ([24](24-post-quantum-crypto.md)) |
| SPHINCS+ / Falcon | 추가 signature | ✅ 커버 ([24](24-post-quantum-crypto.md)) |
| **Hybrid TLS (X25519 + Kyber)** | 전환기 표준 | ✅ 커버 ([24](24-post-quantum-crypto.md)) |
| Crypto-agility | 알고리즘 교체 가능성 | ✅ 커버 ([21](21-aead-nonce-key-derivation.md)) |

### D. TLS / mTLS

| 개념 | 정의 | 상태 |
|---|---|---|
| TLS 1.3 vs 1.2 | 1-RTT, removed weak ciphers | ✅ |
| Cipher suites (TLS_AES_*) | 5 표준 | 🟡 |
| Session resumption (PSK + 0-RTT) | 가속 | 🟡 |
| **0-RTT 함정 (replay)** | idempotent only | ✅ 커버 ([22](22-jwt-pitfalls-zero-trust.md)) |
| mTLS (client cert) | 양방향 | ✅ |
| **mTLS in mesh (Istio/Linkerd auto rotation)** | 자동 rotation | ✅ 커버 ([23](23-mtls-mesh-cert-rotation.md)) |
| Certificate Transparency (CT log) | misissue 감지 | ✅ 커버 ([23](23-mtls-mesh-cert-rotation.md)) |
| OCSP / OCSP Stapling / CRL | revocation | ✅ 커버 ([23](23-mtls-mesh-cert-rotation.md)) |

### E. JWT / JOSE 패밀리

| 개념 | 정의 | 상태 |
|---|---|---|
| JWT (RFC 7519) | claims | ✅ |
| JWS / JWE / JWK / JWA / JWT | 5 RFC | ✅ |
| alg (HS256 / RS256 / ES256 / EdDSA / PS256) | 서명 | ✅ |
| **alg=none 함정** | CVE | ✅ 커버 ([22](22-jwt-pitfalls-zero-trust.md)) |
| **HS vs RS confusion** | public key → HS secret | ✅ 커버 ([22](22-jwt-pitfalls-zero-trust.md)) |
| JWE alg vs enc | key mgmt vs content enc | ★ 신규 |
| JWK / JWKS rotation (kid + old/new) | 표준 | ★ 신규 |
| jti + denylist (revocation 패턴) | 취소 | ★ 신규 |
| **Refresh Token rotation + reuse detection** | 보안 표준 | ✅ 커버 ([22](22-jwt-pitfalls-zero-trust.md)) |
| **PASETO** (v3/v4) | JWT 대안 | ★ 신규 |

### F. OAuth 2 / 2.1 / OIDC

| 개념 | 정의 | 상태 |
|---|---|---|
| Authorization Code Flow + PKCE | 표준 (public client 필수) | ✅ |
| Client Credentials | M2M | ✅ |
| Device Authorization Grant (RFC 8628) | TV/CLI | ★ 신규 |
| JWT Bearer (RFC 7523) | assertion | ★ 신규 |
| Implicit / ROPC | deprecated (2.1 제거) | ★ 신규 (제거 사유) |
| **OAuth 2.1** | implicit 제거 + PKCE 의무화 | ★ 신규 |
| **PAR (RFC 9126)** | request push | ★ 신규 |
| **JAR (RFC 9101)** | request 객체 JWT | ★ 신규 |
| **mTLS client auth (RFC 8705)** | sender-constrained | ✅ 커버 ([22](22-jwt-pitfalls-zero-trust.md)) |
| **DPoP** | proof-of-possession | ✅ 커버 ([22](22-jwt-pitfalls-zero-trust.md)) |
| Token introspection (RFC 7662) | 서버 조회 | ★ 신규 |
| Token revocation (RFC 7009) | 취소 | ★ 신규 |
| OIDC ID Token + UserInfo + Discovery (.well-known) | OIDC 표준 | ✅ |
| OIDC Logout (Front / Back / Session Management) | logout 3종 | ★ 신규 |
| Scopes / Claims / Consent | 정책 | 🟡 |

### G. AuthZ / Policy

| 개념 | 정의 | 상태 |
|---|---|---|
| RBAC / ABAC / ReBAC / PBAC | 4 모델 | 🟡 |
| **OPA (Open Policy Agent) + Rego** | 정책 엔진 | ★ 신규 |
| **AWS Cedar** | policy lang | ★ 신규 |
| Casbin | ACL/RBAC/ABAC | ★ 신규 |

### H. 추가 인증

| 개념 | 정의 | 상태 |
|---|---|---|
| **FIDO2 / WebAuthn** | passwordless | ★ 신규 |
| **TOTP (RFC 6238)** / HOTP | 2FA | ★ 신규 |
| SCIM | identity provisioning | ★ 신규 |
| SAML 2.0 | enterprise SSO | 🟡 |
| Magic link / OTP | passwordless | 🟡 |

### I. KMS / Secret 관리

| 개념 | 정의 | 상태 |
|---|---|---|
| AWS KMS / GCP KMS / Azure Key Vault / Vault | cloud KMS | ✅ |
| Envelope encryption (DEK + KEK) | 표준 | ✅ |
| AWS KMS auto-rotation (yearly) | rotation | ★ 신규 |
| AWS KMS multi-Region keys | DR | ★ 신규 |
| HSM (FIPS 140-2/3) | hardware | 🟡 |
| Vault / AWS Secrets Manager / GCP Secret Manager / SOPS | secret store | ✅ |
| Format-preserving encryption (FF1/FF3) | 형식 유지 | ★ 신규 |
| Tokenization | replace with token | ★ 신규 |

### J. msa 적용

| 위치 | 사용 | 상태 |
|---|---|---|
| gateway | JWT 검증 | ✅ |
| auth (미생성) | OIDC + RBAC | ✅ (계획) |
| 모든 서비스 | TLS / mTLS in mesh | 🟡 |
| KMS rotation | ADR 후보 | 🟡 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **OAuth 2.1 + PKCE 의무화 + Device Code** | spec 변경 반영 |
| 2 | **DPoP / mTLS client auth** | Bearer token 대체 보강 |
| 3 | **Refresh Token rotation + reuse detection** | 보안 표준 |
| 4 | **JWT alg=none + HS/RS confusion 방어 코드 패턴** | 흔한 사고 |
| 5 | **AEAD nonce uniqueness + AES-SIV / GCM-SIV** | 치명적 함정 회피 |
| 6 | **HKDF 표준 KDF 사용 패턴** | 자체 KDF 회피 |
| 7 | **WebAuthn / FIDO2** | passwordless 트렌드 |
| 8 | **OPA / Cedar / Casbin** | 정책 외부화 |
| 9 | **Envelope encryption + KMS auto-rotation 표준** | 데이터 암호화 표준 |
| 10 | **Post-Quantum (Kyber/Dilithium) + Hybrid TLS** | 향후 5-10년 전환 준비 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. Crypto 특화:
- §3 → "RFC / NIST SP 번호" 표
- §6 → "Symmetric vs Asymmetric vs Hash" 비교
- §7 → "키 라이프사이클 + 사고 대응" 표

---

## 5. 참고 자료

- IETF RFCs (linked in frontmatter)
- NIST SP 800 series: https://csrc.nist.gov/publications/sp800
- OAuth 2.1: https://oauth.net/2.1/
- OIDC: https://openid.net/specs/openid-connect-core-1_0.html
- AWS KMS: https://docs.aws.amazon.com/kms/
- "Serious Cryptography" (Jean-Philippe Aumasson)
- "Real-World Cryptography" (David Wong)
- WebAuthn: https://www.w3.org/TR/webauthn-2/
