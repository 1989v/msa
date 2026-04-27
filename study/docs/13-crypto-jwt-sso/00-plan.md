---
id: 13
title: 암호화 · JWT · SSO · 클라우드 KMS
status: completed
created: 2026-04-27
updated: 2026-04-28
completed: 2026-04-28
tags: [security, cryptography, aes, jwt, sso, oauth2, oidc, kms, tls, mtls, hsm]
difficulty: advanced
estimated-hours: 34
codebase-relevant: true
goal: 면접 대비 + 실무 코드 리뷰/리팩터링 (C)
depth-package: P3-full
output-format: A (notes + Q&A cards + 실습 코드)
interview-scenario: G (일반 백엔드 시니어)
learning-order: X (Top-down, Phase 1→5 직진)
self-assessment:
  aes: 3
  jwt: 3
  sso: 3
  kms: 3
---

# 암호화 · JWT · SSO · 클라우드 KMS

## 1. 개요

서비스 인증/인가, 민감 정보 보호, 외부 IdP 연동에 필요한 보안 기초를 한 번에 정리한다.
대칭키(AES) / 해시(SHA) / 메시지 인증(HMAC) → 토큰(JWT) → 사용자 인증 흐름(SSO/OAuth2/OIDC) → 키 보관(KMS) 순서로 추상화 레이어를 따라 올라간다.

현재 msa 프로젝트는 `common/security`에 AES-GCM 암호화기와 JWT(HS256) 발급기를 가지고 있고, gateway에서 JWT 검증 필터로 인증을 처리한다. 다만 SSO/OAuth2 IdP 연동, 키 회전(rotation), 외부 KMS 연동은 아직 구현되어 있지 않다. 이번 학습은 "왜 이렇게 구현했는지 / 운영 환경에서 무엇이 부족한지"를 설명할 수 있는 수준이 목표다.

## 2. 학습 목표

- AES 동작을 IV/패딩/모드(GCM vs CBC) 관점에서 설명할 수 있다.
- 해시(SHA-256/512) vs HMAC vs 비대칭 서명(RSA/ECDSA)의 용도 차이를 구분한다.
- JWT 구조(Header.Payload.Signature)와 알고리즘별(HS256/RS256/ES256) 트레이드오프를 안다.
- Access/Refresh 토큰 전략, refresh rotation, replay/token theft 방어를 설명할 수 있다.
- SSO 표준(OAuth2 / OIDC / SAML 2.0) 흐름과 차이점을 그릴 수 있다.
- AWS KMS의 Envelope Encryption, key rotation, IAM 정책 모델을 설명할 수 있다.
- 현재 msa 프로젝트의 `JwtUtil`/`AesUtil` 구현이 가진 한계와 개선 포인트를 지적할 수 있다.

## 3. 선수 지식

- 비트/바이트, Base64 인코딩
- HTTP 기본 (헤더, 쿠키, 리다이렉트)
- 공개키 암호 개념 수준의 이해 (자물쇠 비유 정도면 충분)
- Spring Security 구조 개략 (필터 체인, AuthenticationManager) — 깊이는 필요 없음

## 4. 학습 로드맵

### Phase 1: 암호 기본 빌딩 블록

- 대칭키 vs 비대칭키 구분, 각각의 사용처 (속도 vs 키 분배 문제)
- AES 핵심 개념 (사용자 관점)
  - 블록 암호 vs 스트림 암호
  - 모드: ECB / CBC / CTR / GCM — 왜 ECB는 쓰면 안 되는가
  - **IV(Initialization Vector)**: 역할, 길이, 재사용 시 무엇이 깨지는가
  - **Padding**: PKCS#7 / NoPadding — GCM이 padding이 필요 없는 이유
  - 인증 암호(AEAD)와 GCM 태그의 의미
  - 키 길이 (128 / 192 / 256-bit)
- AES 내부 구조 (P3 풀팩)
  - SPN(Substitution-Permutation Network) 구조
  - 라운드 함수: SubBytes / ShiftRows / MixColumns / AddRoundKey
  - **S-box** — Galois Field GF(2^8) 기반 비선형 치환의 의미
  - **MixColumns** — 확산(diffusion) 역할
  - **Key Schedule (Key Expansion)** — 라운드 키 생성
  - 라운드 수: AES-128(10) / AES-192(12) / AES-256(14)
  - 알려진 공격 (related-key, biclique) — 실용적 위협 수준
- 해시 함수
  - SHA-2 (SHA-256, SHA-512), SHA-3(Keccak) 차이
  - Merkle-Damgård 구조 vs Sponge 구조
  - 충돌 저항성, 사전 이미지 저항성, 2차 사전 이미지 저항성
  - **Length extension attack** 메커니즘
- 비밀번호 해싱 (P3 풀팩)
  - SHA를 그대로 쓰면 안 되는 이유 (속도 = 약점)
  - **PBKDF2** — 반복 해시 + salt
  - **bcrypt** — Blowfish 기반, work factor
  - **scrypt** — 메모리-하드 함수
  - **argon2** (id/i/d) — 현재 권장, 메모리/시간/병렬도 비용 모델
  - **salt vs pepper** 차이, salt 길이 권고
  - work factor 튜닝 — 100ms 룰
- HMAC: 왜 `H(key || msg)`가 아니라 HMAC인가 (length extension 방어)
- 비대칭 암호 / 서명
  - RSA vs ECDSA vs EdDSA(Ed25519)
  - 키 길이 권고 (RSA-2048+ vs ECC-256)
  - RSA padding (PKCS#1 v1.5 vs OAEP / PSS)

### Phase 2: 심화 — JWT와 토큰 전략

- JWT 구조: Header / Payload / Signature, Base64URL 인코딩
- 서명 알고리즘 비교
  - HS256 (HMAC-SHA256) — 공유 비밀키, 마이크로서비스 내부 적합
  - RS256 (RSA) — 공개키 검증, 외부 발급자(IdP) 시나리오
  - ES256 (ECDSA) — RS256 대안, 키 크기 작음
  - **`alg: none` 취약점**과 라이브러리 보호 장치
- JWT vs Opaque Token (서버 측 세션 조회) — 트레이드오프
- 토큰 만료 / 재발급 전략
  - Access Token 짧게 + Refresh Token 길게
  - Refresh Token Rotation (재사용 탐지)
  - Token revocation: blacklist, jti 기반, 짧은 TTL 전략
- JWE (암호화된 JWT): 왜 보통 JWS만 쓰고 JWE는 잘 안 쓰는가
- 보관 위치: `localStorage` vs `httpOnly Cookie` (XSS / CSRF 트레이드오프)

### Phase 3: SSO와 인증 표준

- 인증(Authentication) vs 인가(Authorization) 명확히 구분
- OAuth 2.0 — 인가 프레임워크
  - Authorization Code Grant (+ PKCE)
  - Client Credentials, Resource Owner Password (deprecated 이유)
  - Implicit Flow가 deprecated된 이유
  - Token Endpoint vs Authorization Endpoint
- OpenID Connect (OIDC) — OAuth2 위 인증 레이어
  - `id_token` (JWT) vs `access_token`
  - UserInfo Endpoint, Discovery (`.well-known/openid-configuration`)
- SAML 2.0 — 기업 SSO 표준 (P3 풀팩)
  - SP-initiated vs IdP-initiated
  - Bindings: HTTP-Redirect / HTTP-POST / Artifact
  - Assertion 구조 (XML 스키마)
  - **XML Digital Signature (XML-DSig)** 구조 — `<SignedInfo>`, `<SignatureValue>`, `<KeyInfo>`
  - **Canonicalization (C14N)** — 왜 필요한가, exclusive vs inclusive
  - **XML Signature Wrapping Attack** — 알려진 취약점 패턴
  - **XML Encryption (XML-Enc)** 개략
  - SAML이 OIDC로 대체되어가는 이유 (JSON vs XML, 모바일 친화도)
- SSO 운영 토픽
  - Single Logout (SLO) 의 어려움 — Front-channel vs Back-channel
  - 세션 vs Token (Cookie 기반 SSO vs Bearer Token)
  - **mTLS와 클라이언트 인증서** (P3 풀팩, Phase 5에서 상세)

### Phase 4: 클라우드 키 관리 (KMS)

- "키를 어디에 둘 것인가" 문제
  - 환경변수 / 설정 파일에 두면 안 되는 이유
  - HSM (Hardware Security Module) 개념
- AWS KMS
  - **CMK (Customer Master Key)** = KMS Key
  - Symmetric vs Asymmetric KMS Key
  - **Envelope Encryption**: 데이터 키(DEK)를 마스터 키(KEK)로 감싸는 패턴
    - `GenerateDataKey` API 흐름 (plaintext DEK + ciphertext DEK 동시 반환)
    - 왜 큰 데이터를 KMS로 직접 암호화하지 않는가 (4KB 제한 + 비용)
  - Key Rotation
    - AWS-managed automatic rotation (1년)
    - Manual rotation + key alias 활용
  - IAM + Key Policy 이중 권한 모델
  - KMS Grants — 위임형 권한
  - Multi-Region Keys
- 멀티 클라우드 비교 (P3 풀팩)
  - **GCP Cloud KMS** — KEK/DEK 패턴, Cloud HSM, External Key Manager (EKM)
  - **Azure Key Vault** — Standard vs Premium(HSM-backed), Managed HSM
  - **HashiCorp Vault** — Transit 시크릿 엔진, dynamic secrets, key rotation
  - 3사 비교: 키 관리 모델 / 가격 / 성능 / 컴플라이언스 인증
- HSM (Hardware Security Module) (P3 풀팩)
  - HSM 동작 원리 — 키가 디바이스 밖으로 나오지 않는 보장
  - **AWS CloudHSM** vs KMS — 단일 테넌트 vs 멀티 테넌트
  - **FIPS 140-2/3 Level 1~4** 인증 의미
  - PKCS#11 인터페이스 개략
- Secrets vs Keys 구분
  - Secrets Manager / Parameter Store vs KMS
  - K8s Secret + 외부 KMS 연동 (sealed-secrets, External Secrets Operator, AWS Secrets Manager CSI)

### Phase 5: TLS / mTLS + 실전 적용 + 면접 대비

- TLS handshake (P3 풀팩)
  - **TLS 1.2 핸드셰이크** 단계별 메시지: ClientHello / ServerHello / Certificate / KeyExchange / Finished
  - Cipher Suite 구성 (Kx_Au_Enc_Mac)
  - **TLS 1.3 변경점** — 1-RTT, Pre-shared Key, 0-RTT (replay 위험), HelloRetryRequest
  - Forward Secrecy (PFS) — DHE/ECDHE
  - 인증서 체인 검증, Root CA, Intermediate CA, OCSP/CRL
  - SNI, ALPN
- **mTLS** (P3 풀팩)
  - 클라이언트 인증서 검증
  - 서비스 메시(Istio/Linkerd)에서의 mTLS — SPIFFE/SPIRE
  - 인증서 회전, short-lived cert
- 현 msa 코드 리뷰 + 리팩터링 (아래 5번 섹션 참조)
  - `AesUtil` → KMS Envelope Encryption 연동 가능 구조로
  - `JwtUtil` → `kid` 헤더 + 키 회전 지원
  - Refresh Token Rotation 도입 설계
- 자주 나오는 면접 질문
  - "AES-GCM vs CBC, 왜 GCM을 쓰는가"
  - "IV는 비밀이어야 하는가? 왜 한 번만 써야 하는가"
  - "비밀번호 해싱에 SHA-256을 쓰면 안 되는 이유"
  - "bcrypt vs argon2, 왜 argon2가 권장되는가"
  - "JWT vs Session — stateless의 진짜 비용은?"
  - "Refresh Token을 탈취당했을 때 어떻게 막을 수 있는가"
  - "OAuth2 Authorization Code Flow에서 PKCE가 왜 필요한가"
  - "OIDC와 OAuth2의 차이는?"
  - "SAML vs OIDC, 어떤 경우에 SAML을 쓰나"
  - "Envelope Encryption이 왜 필요한가, KMS가 직접 암호화하면 안 되나"
  - "Key rotation을 했는데 기존 데이터는 어떻게 복호화하는가"
  - "TLS 1.3에서 0-RTT의 위험성"
  - "mTLS는 왜 일반 TLS만으로 부족한 시나리오에서 필요한가"
  - "HSM과 KMS의 차이, 언제 HSM을 써야 하나"

## 5. 코드베이스 연관성

`codebase-relevant: true` — common/security 모듈에 직접 구현된 컴포넌트가 있다.

| 위치 | 무엇을 보는가 | 분석 포인트 |
|------|--------------|------------|
| `common/src/main/kotlin/com/kgd/common/security/AesUtil.kt` | AES-256-GCM 암복호화 | IV 생성, GCM 태그, key 길이 검증, 평문 키를 메모리에 두는 한계 |
| `common/src/main/kotlin/com/kgd/common/security/JwtUtil.kt` | JJWT 기반 HS256 토큰 발급/검증 | access/refresh 분리, 키 회전 부재, claim 구조 |
| `common/src/main/kotlin/com/kgd/common/security/JwtProperties.kt` | 비밀키/만료시간 설정 | secret을 어떻게 주입하는가 (env? K8s Secret? KMS?) |
| `common/src/main/kotlin/com/kgd/common/security/CommonSecurityAutoConfiguration.kt` | Auto-Configuration 활성화 | `kgd.common.security.enabled` 토글 패턴 |
| `gateway/src/main/kotlin/com/kgd/gateway/security/JwtTokenValidator.kt` | gateway 측 토큰 검증 | 만료 처리, 변조 검출 |
| `gateway/src/main/kotlin/com/kgd/gateway/filter/AuthenticationGatewayFilter.kt` | Spring Cloud Gateway 인증 필터 | 헤더 추출, 다운스트림 propagation |
| `common/src/test/kotlin/com/kgd/common/security/AesUtilTest.kt`, `JwtUtilTest.kt` | 테스트 케이스 | 어떤 보안 속성을 검증하는가 |

미구현/개선 포인트 (학습 후 평가):

- 키 회전 메커니즘이 없다 (`kid` 헤더 미사용)
- AES key를 32바이트로 자르는 단순 처리 → KMS 연동/derive 필요
- Refresh Token Rotation 미구현 (탈취 탐지 불가)
- SSO/외부 IdP 연동 부재 (auth 서비스 미생성)

## 6. 참고 자료

- RFC 7519 — JSON Web Token
- RFC 7515 / 7516 / 7518 — JWS / JWE / JWA
- RFC 6749 — OAuth 2.0
- RFC 7636 — PKCE
- OpenID Connect Core 1.0 spec
- NIST SP 800-38D — GCM 권고
- AWS KMS Developer Guide — Envelope Encryption 챕터
- OWASP Cryptographic Storage Cheat Sheet
- OWASP JWT Cheat Sheet

## 7. 미결 사항

브레인스토밍 결과 (2026-04-28):

- ✅ 목표: 면접 대비 + 실무 코드 리뷰/리팩터링 (C)
- ✅ 깊이 패키지: **P3 풀팩** 선택
- ✅ AES 내부 (라운드/S-box/MixColumns/Key Schedule) 포함
- ✅ SAML XML 서명/암호화 구조 포함 (XML-DSig, C14N, Wrapping Attack)
- ✅ KMS 멀티 클라우드 (AWS/GCP/Azure/Vault) + HSM/CloudHSM 포함
- ✅ 비밀번호 해싱 (bcrypt/scrypt/argon2/PBKDF2) 포함
- ✅ TLS handshake (1.2/1.3) + mTLS 포함
- ✅ `AesUtil`/`JwtUtil` KMS 연동 리팩터링 실습 포함

- ✅ 출력 형태: **A** — 노트(개념 설명) + Q&A 카드(빈출 30~50개) + 실습 코드(`AesUtil`/`JwtUtil` 리팩터링)
- ✅ 면접 시나리오: **G** — 일반 백엔드 시니어 면접 (보안 직군 깊이는 아님, 빈출 위주)
  - 꼬리질문 깊이: AES 라운드 함수까지는 학습하되 면접 답변은 "GCM이 왜 표준인가" 수준에서 멈춤
  - SAML XML-DSig는 학습은 하되 면접 답변은 "OIDC와의 차이/언제 쓰는가"에 집중
  - HSM/CloudHSM/FIPS는 학습은 하되 면접 답변은 "KMS와 차이/언제 필요한가" 수준

- ✅ 학습 순서: **X** — Top-down, Phase 1→5 직진
  - 각 Phase 종료 시점에 해당 코드 파일과 연결 (예: Phase 1 끝 → `AesUtil.kt` 리뷰, Phase 2 끝 → `JwtUtil.kt` 리뷰)
  - 최종 실습(Phase 5)에서 `AesUtil`/`JwtUtil` 리팩터링 한꺼번에

브레인스토밍 종료 (2026-04-28). 모든 항목 합의 → `ready`.

## 8. 원본 메모

> 13. encrypt, jwt, aes, sha 등등

추가 합의 사항 (사용자 요청, 2026-04-27):

- AES 학습 시 encrypt / IV / padding 등 동작 원리 개념 포함
- SSO 관련 내용 포함 (OAuth2 / OIDC / SAML)
- 클라우드 키 관리(KMS) 포함
