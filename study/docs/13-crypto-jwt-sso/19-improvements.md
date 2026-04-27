---
parent: 13-crypto-jwt-sso
seq: 19
title: msa 코드베이스 적용 제안 종합
type: deep
created: 2026-04-28
---

# 19. msa 코드베이스 적용 제안

## 코드 리팩터링 제안 종합

| # | 제안 | 대상 | 영향도 | 우선순위 | ADR 필요 |
|---|---|---|---|---|---|
| 1 | `AesUtil` SecureRandom companion 재사용 | `common/security` | 낮음 | 중간 | N |
| 2 | `AesUtil` AAD 파라미터 추가 | `common/security` | 낮음 | 중간 | N |
| 3 | `JwtUtil` `kid` + 키 회전 맵 도입 | `common/security` | 중간 | **높음** | Y (마이너) |
| 4 | `JwtUtil` `iss`/`aud`/`jti` 표준 클레임 | `common/security` | 중간 | **높음** | Y (마이너) |
| 5 | Refresh Rotation + reuse detection | gateway / auth | 높음 | **높음** | Y |
| 6 | `KmsEnvelopeAesUtil` 신규 도입 | `common/security` | 중간 | 중간 | Y |
| 7 | External Secrets Operator + AWS Secrets Manager | k8s | 중간 | 중간 | Y |
| 8 | RS256 + JWKS 전환 (외부 IdP 도입 시) | gateway / auth | 높음 | 낮음 (auth 미구현) | **Y (L3)** |
| 9 | etcd at-rest encryption (EncryptionConfiguration) | k8s | 낮음 | 중간 | N |
| 10 | mTLS 도입 (서비스 메시) | k8s | 매우 높음 | 낮음 | **Y (L3)** |

## 우선순위 TOP 3 (즉시 추진 가치)

### 1. JwtUtil `iss`/`aud`/`jti` + `kid` 추가

**현재 상태** — 클레임에 `userId`, `roles`, `type`만 있음. 헤더에 `kid` 없음.

**개선** — 표준 클레임 보강:
```kotlin
.issuer(props.issuer)        // 누가 발급했나
.audience().add(aud).and()   // 어디 가는 토큰인가
.id(UUID.randomUUID().toString())  // jti = 고유 ID
.header().keyId(activeKid).and()   // 키 회전 대비
```

**왜 1순위**:
- backwards-compatible — 옛 토큰도 검증 가능
- 외부 IdP 전환(8번)의 사전 작업
- Refresh Rotation(5번)의 jti 기반

**영향**: common(L3) — gateway 테스트 + 운영 코드. 다른 서비스는 헤더만 받으니 무관.

**ADR**: 마이너 보강 (ADR-0004 갱신)

### 2. Refresh Token Rotation

**현재** — 단순 Refresh, 한 번 탈취되면 만료까지 사용 가능. Redis blacklist만 fail-open.

**개선** — `RefreshRotationService` 도입 ([18-code-refactoring.md](18-code-refactoring.md)).

**왜 2순위**:
- 보안 효과 큼 — 탈취 자동 탐지
- 1번 완료 후 자연스러운 다음 단계

**ADR 필요** — Redis 키 네임스페이스 + 정책 정의

### 3. AesUtil AAD + SecureRandom 재사용

**현재** — `SecureRandom()` 매번 생성, AAD 파라미터 없음.

**개선** —
```kotlin
companion object {
    private val secureRandom = SecureRandom()  // 한 번만 생성
}
fun encrypt(plainText: String, aad: ByteArray? = null): String { ... }
```

**왜 3순위**:
- 위험도 낮지만 베스트 프랙티스
- AAD는 cross-context 사용 방지에 효과적
- 코드 변경 적고 backwards-compatible

**ADR 불필요** — 마이너 개선

## 중기 (ADR 필요)

### 6. KmsEnvelopeAesUtil 신규

**ADR-0027(OCI Vault KEK Envelope)** 이 이미 있음 — 이 ADR과 연계해 AWS KMS 버전도 도입 가능.

[18-code-refactoring.md](18-code-refactoring.md) 참고.

### 7. External Secrets Operator

**현재** — JWT secret, AES key가 K8s Secret(또는 환경변수)로 주입.

**개선** — AWS Secrets Manager에서 동기화. 회전 자동화.

**ADR** — Secret store 표준 결정

## 장기 (L3 변경)

### 8. RS256 + JWKS (OIDC 도입)

`auth` 서비스 미구현. 외부 IdP(Cognito/Keycloak) 도입 시 한꺼번에 진행.
- HS256 → RS256/ES256
- Gateway가 IdP JWKS 캐시
- `iss`, `aud` 검증 강제 (1번에서 사전 작업)

### 10. mTLS (서비스 메시)

**현재** — Gateway가 X-User-Id 헤더로 다운스트림에 전달. 다운스트림은 헤더 신뢰.

**개선** — Istio/Linkerd 도입 → 자동 mTLS, SPIFFE identity, network policy로 Gateway 우회 차단.

**전제** — K8s 운영 성숙도 필요. 11번 학습 주제(K8s 심화)와 함께 진행 권장.

## 관련 다음 학습 제안

- **11번 (K8s 심화 + 배포 전략)** — mTLS/서비스 메시로 자연스러운 연결. SPIFFE/Istio Citadel 학습이 본 주제 Phase 5의 자연스러운 확장.
- 또는 신규 주제: **OAuth2 + 서비스 메시 통합 (token-based authorization in mesh)** — 현 msa의 다음 단계 SSO 도입과 직결.

## 체크리스트 (학습 후 즉시 가능한 것)

- [ ] ADR-0004 보강 — `kid`/`iss`/`aud`/`jti` 추가 결정 기록
- [ ] `JwtProperties`에 `issuer`/`audience`/`kid` 필드 추가 (nullable, backwards-compatible)
- [ ] `JwtUtil` 발급 측 강화 (설정 있을 때만 추가)
- [ ] `JwtUtil` 검증 측 옵션 강화 (issuer/audience 설정 시 require)
- [ ] `JwtUtilTest` 업데이트
- [ ] 빌드 + 테스트 통과 확인
