---
parent: 13-crypto-jwt-sso
type: preview
created: 2026-04-28
---

# 암호화 · JWT · SSO · 클라우드 KMS — Preview

> 학습자 수준: 중급(intermediate, 4영역 자가평가 3) · 전체 예상 시간: 34h · 목표: 면접 대비 + 실무 코드 리뷰/리팩터링
> 계획서: [00-plan.md](00-plan.md) · BS 결정: 00-plan.md 7번 미결사항 · 깊이 패키지: P3 풀팩 · 학습 순서: X (Top-down)

---

## 멘탈 모델: "추상화 사다리"

암호 빌딩 블록부터 운영 인프라까지 **5층 사다리**로 구성한다. 아래 층이 위 층을 지탱한다.

```
  ┌────────────────────────────────────┐
  │  Layer 5: 운영 (TLS / mTLS / 키 회전)
  │  - TLS 1.3 핸드셰이크
  │  - mTLS + SPIFFE/SPIRE
  └─────────────────┬──────────────────┘
                    │ "키를 어디에 두나"
  ┌─────────────────┴──────────────────┐
  │  Layer 4: 키 관리 (KMS / HSM)
  │  - Envelope Encryption
  │  - 멀티 클라우드 (AWS/GCP/Azure/Vault)
  │  - HSM, FIPS 140-2 Levels
  └─────────────────┬──────────────────┘
                    │ "사용자 인증 표준"
  ┌─────────────────┴──────────────────┐
  │  Layer 3: SSO (OAuth2 / OIDC / SAML)
  │  - 인증 vs 인가
  │  - PKCE, state, nonce
  └─────────────────┬──────────────────┘
                    │ "토큰 형식과 운영"
  ┌─────────────────┴──────────────────┐
  │  Layer 2: JWT (구조 / 알고리즘 / 운영)
  │  - HS256/RS256/ES256, kid
  │  - Refresh Rotation, alg:none
  └─────────────────┬──────────────────┘
                    │ "토큰을 만드는 재료"
  ┌─────────────────┴──────────────────┐
  │  Layer 1: 암호 빌딩 블록
  │  - AES-GCM, IV, AEAD
  │  - SHA, HMAC, argon2id
  │  - RSA-PSS, ECDSA, Ed25519
  └────────────────────────────────────┘
```

**핵심 5문장만 외운다**:
1. **AES-256-GCM**이 새 시스템 대칭 암호 기본 (AEAD = 암호화 + 무결성).
2. **비밀번호는 argon2id**, 일반 해시(SHA)는 빠르므로 금지.
3. **JWT 검증은 알고리즘 화이트리스트** 강제 (alg:none 방어).
4. **KMS는 Envelope Encryption** 패턴 — 마스터 키는 절대 KMS 밖으로 안 나옴.
5. **TLS 1.3은 PFS 강제** — 0-RTT는 idempotent 요청에만.

---

## 소주제 지도

> 22개 파일로 분할. 각 파일 평균 ~1.5h.

### Phase 1: 암호 빌딩 블록 (7개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 대칭 vs 비대칭 + Hybrid 패턴 | [01-symmetric-vs-asymmetric.md](01-symmetric-vs-asymmetric.md) | 속도/키분배 트레이드오프, TLS/KMS Envelope 모두 Hybrid |
| 02 | AES 모드 / IV / 패딩 / AEAD | [02-aes-modes.md](02-aes-modes.md) | ECB 금지, GCM 표준, IV 재사용 = 치명적 |
| 03 | AES 내부 (SPN / S-box / MixColumns) | [03-aes-internals.md](03-aes-internals.md) | 라운드 함수 4단계, Key Schedule, AES 자체는 안 깨짐 |
| 04 | 해시 함수 (SHA-2/3, MD vs Sponge) | [04-hash-functions.md](04-hash-functions.md) | length extension, 생일 역설 |
| 05 | 비밀번호 해싱 (argon2id) | [05-password-hashing.md](05-password-hashing.md) | salt vs pepper, work factor 100ms 룰 |
| 06 | HMAC | [06-hmac.md](06-hmac.md) | 이중 해시 구조로 length-ext 차단 |
| 07 | 비대칭 서명 (RSA/ECDSA/EdDSA) | [07-asymmetric-signing.md](07-asymmetric-signing.md) | Ed25519 트렌드, ECDSA nonce 위험, OAEP/PSS |

### Phase 2: JWT 심화 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 08 | JWT 구조 + 알고리즘 + alg:none | [08-jwt-structure.md](08-jwt-structure.md) | header/payload/sig, HS/RS/ES, kid 필요성 |
| 09 | 토큰 운영 (Stateless / Refresh Rotation / 보관) | [09-token-strategy.md](09-token-strategy.md) | Stateless 비용, jti 기반 reuse detection, httpOnly Cookie |

### Phase 3: SSO 표준 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 10 | OAuth 2.0 + PKCE | [10-oauth2.md](10-oauth2.md) | Authorization Code Flow, PKCE 필수화, state |
| 11 | OIDC | [11-oidc.md](11-oidc.md) | id_token vs access_token, Discovery, JWKS |
| 12 | SAML 2.0 + SLO | [12-saml.md](12-saml.md) | XML-DSig, C14N, Wrapping Attack, OIDC로 대체 흐름 |

### Phase 4: KMS + 멀티 클라우드 + HSM (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 13 | AWS KMS + Envelope Encryption | [13-aws-kms.md](13-aws-kms.md) | GenerateDataKey, IAM+Key Policy, Multi-Region |
| 14 | 멀티 클라우드 KMS (GCP/Azure/Vault) | [14-multi-cloud-kms.md](14-multi-cloud-kms.md) | EKM, Managed HSM, Vault Transit, 비교 |
| 15 | HSM + Secrets vs Keys + K8s 연동 | [15-hsm.md](15-hsm.md) | FIPS 140-2/3 Level, PKCS#11, External Secrets Operator |

### Phase 5: TLS / mTLS + 실무 코드 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 16 | TLS 1.2/1.3 + 인증서 + SNI/ALPN | [16-tls.md](16-tls.md) | 핸드셰이크 단계, 1.3 1-RTT/0-RTT, OCSP Stapling |
| 17 | mTLS + SPIFFE/SPIRE | [17-mtls.md](17-mtls.md) | 서비스 메시, short-lived cert, B2B/IoT 시나리오 |

### 산출물 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 18 | 코드 리팩터링 실습 | [18-code-refactoring.md](18-code-refactoring.md) | KmsEnvelopeAesUtil, RotatableJwtUtil, RefreshRotationService 코드 |
| 19 | 코드베이스 적용 제안 종합 | [19-improvements.md](19-improvements.md) | 10개 제안 + 우선순위 + ADR 필요 여부 |
| 20 | 면접 Q&A 카드 + 50문항 인덱스 | [20-interview-qa.md](20-interview-qa.md) | 5 Phase × 8개 = 40 카드 + 50문항 인덱스 |

---

## 개념 관계도

```
                ┌─────────────────────────────┐
                │  Layer 1: 빌딩 블록         │
                │  AES-GCM / SHA / argon2id   │
                │  HMAC / RSA-PSS / Ed25519   │
                └──────────────┬──────────────┘
                               │ "토큰을 만든다"
                               ▼
                ┌─────────────────────────────┐
                │  Layer 2: JWT               │
                │  HS/RS/ES + kid + jti       │
                │  Refresh Rotation           │
                └──────────────┬──────────────┘
                               │ "사용자를 인증한다"
                               ▼
                ┌─────────────────────────────┐
                │  Layer 3: SSO               │
                │  OAuth2+PKCE → OIDC         │
                │  (SAML은 호환만)             │
                └──────────────┬──────────────┘
                               │ "키를 어디에 두나"
                               ▼
                ┌─────────────────────────────┐
                │  Layer 4: KMS / HSM          │
                │  Envelope Encryption        │
                │  멀티 클라우드 + FIPS        │
                └──────────────┬──────────────┘
                               │ "통신을 보호한다"
                               ▼
                ┌─────────────────────────────┐
                │  Layer 5: TLS / mTLS        │
                │  1.3 + PFS + SPIFFE         │
                └─────────────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 권장 알고리즘 (2026 기준)

| 용도 | 1순위 | 비고 |
|---|---|---|
| 대칭 암호 | **AES-256-GCM** | AEAD, IV 12B, tag 128b |
| 해시 | SHA-256 / SHA-3 | 비밀번호 외 |
| 비밀번호 해싱 | **argon2id** | m=19MiB, t=2, p=1 (OWASP) |
| MAC | **HMAC-SHA256** | 키 32B+ |
| 서명 | **Ed25519** > ECDSA P-256 > RSA-PSS 3072 | 새 시스템은 Ed25519 |
| 키 교환 | ECDHE | TLS 1.3에서 의무 |

### 절대 하지 말 것

- AES ECB 모드
- IV/nonce 재사용 (특히 GCM)
- `alg: none` JWT 허용
- 비밀번호에 SHA-256 직접
- raw RSA (패딩 없이)
- Refresh 단순 검증 (Rotation 없이)
- 환경변수에 키 평문

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 17** (Top-down 직진), 코드/면접/제안(18-20)은 마지막
- Phase 1(01-07)은 의존성 있음 → 순서대로
- Phase 4(13-15) 학습 시점에 AWS KMS 콘솔 한 번 둘러보면 머리에 잘 남음
- Phase 5(16-17)는 K8s/서비스 메시 배경 지식 도움 (없어도 진행 가능)
- **18-code-refactoring.md**는 코드 직접 따라 작성 권장 (실무 자산화)
- **20-interview-qa.md**는 회독용 — 학습 종료 후 1주일 간격으로 2-3회 회독

각 파일 호출:
```
/study:start 13           # 다음 deep file 자동 선택
/study:start 13 03        # 03-aes-internals.md 직접 지정
```
