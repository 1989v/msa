---
parent: 13-crypto-jwt-sso
seq: 24
title: Post-Quantum Crypto — Kyber / Dilithium / SPHINCS+ / Falcon + Hybrid TLS
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 07-asymmetric-signing.md
  - 16-tls.md
  - 21-aead-nonce-key-derivation.md
  - 23-mtls-mesh-cert-rotation.md
sources:
  - https://csrc.nist.gov/projects/post-quantum-cryptography
  - https://csrc.nist.gov/pubs/fips/203/final
  - https://csrc.nist.gov/pubs/fips/204/final
  - https://csrc.nist.gov/pubs/fips/205/final
  - https://datatracker.ietf.org/doc/html/draft-ietf-tls-hybrid-design
  - https://blog.cloudflare.com/post-quantum-for-all/
  - https://blog.chromium.org/2024/05/advancing-our-amazing-bet-on-asymmetric.html
  - https://www.openssh.com/txt/release-9.0
catalog-row: "§C Post-Quantum (Kyber / Dilithium / SPHINCS+ / Falcon) · Hybrid TLS · Crypto-agility"
---

# 24. Post-Quantum Crypto — Kyber / Dilithium / SPHINCS+ / Falcon + Hybrid TLS

> 카탈로그 매핑: §99 §C — `CRYSTALS-Kyber (ML-KEM)` (★ → ✅), `CRYSTALS-Dilithium (ML-DSA)` (★ → ✅), `SPHINCS+ / Falcon` (★ → ✅), `Hybrid TLS (X25519 + Kyber)` (★ → ✅), `Crypto-agility` (★ → §21 과 cross-link).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B

> RSA 와 ECC (Elliptic Curve Cryptography, 타원 곡선 암호) 는 향후 5~15 년 안에 양자컴퓨터 (CRQC, Cryptographically Relevant Quantum Computer) 에 의해 깨질 가능성이 매우 높다. 더 큰 위협은 **Harvest Now, Decrypt Later** — 지금 암호화된 트래픽을 저장해두면 미래에 해독 가능. 본 deep file 은 (1) 양자 위협의 정확한 의미 (Shor / Grover), (2) NIST 가 2024 년 표준화한 PQC 4 알고리즘 (Kyber / Dilithium / SPHINCS+ / Falcon), (3) 전환기 표준인 Hybrid TLS (X25519 + Kyber), (4) 마이그레이션 전략 — crypto-agility 가 핵심 — 까지 다룬다.

---

## 1. 한 줄 핵심

> **양자 위협은 "Shor 알고리즘이 RSA / ECC 를 다항 시간에 깬다 + 지금 캡처된 트래픽이 미래 해독" 두 축.**
> 답은 **PQC (Post-Quantum Cryptography, 양자내성 암호) 표준화** + **Hybrid 전환** + **crypto-agility**. NIST 가 2024 년 ML-KEM / ML-DSA / SLH-DSA 를 FIPS 표준으로 확정 → Cloudflare / Google / Apple 이 이미 prod 에 hybrid TLS 적용. 우리 시스템도 5 년 내 마이그레이션 시작이 늦어진 시점.

---

## 2. 등장 배경

### 2-1. 양자컴퓨터의 두 알고리즘

#### Shor 알고리즘 (1994, Peter Shor)

- 정수 인수분해 / 이산로그를 **다항 시간** O(n^3) 으로 해결.
- 현재 RSA / ECC / DH (Diffie-Hellman) / DSA 의 안전성 근거가 모두 이 두 문제 → **완전 붕괴**.

| 알고리즘 | 고전 컴퓨터 | 양자 (Shor) |
|---|---|---|
| RSA-2048 | ~10^14 년 | ~수 시간 (충분히 큰 양자컴퓨터로) |
| ECC P-256 | ~10^16 년 | ~수 시간 |

#### Grover 알고리즘 (1996, Lov Grover)

- 정렬되지 않은 N 항목 검색을 O(√N) 으로 (고전 O(N) 대비).
- 대칭 암호 (AES) / 해시 (SHA-2) 에 영향, **하지만 키 길이 2배** 면 회복 가능.

| | 고전 보안 | 양자 (Grover) |
|---|---|---|
| AES-128 | 2^128 | 2^64 (취약) |
| **AES-256** | **2^256** | **2^128** (충분) |
| SHA-256 | 2^128 | 2^85 (preimage; 충돌은 별도) |
| **SHA-384** | **2^192** | **2^128** (충분) |

→ AES-256 / SHA-384 / SHA-512 는 **양자 시대에도 안전** (key/hash size 만 키우면 됨). 문제는 **공개키 알고리즘** 만이다.

### 2-2. CRQC 도래 시점 — 추정

| 출처 | 예상 |
|---|---|
| NIST IR 8413 (2024) | "5~15 년 내 등장 가능성 무시 못 함" |
| Mosca's theorem | "x 년 보호 필요 + y 년 마이그레이션 + z 년 기다림 < CRQC 등장 시점 → 지금 시작" |
| Cloudflare 추정 | 2030~2035 |
| US 정부 (NSM-10, 2022) | 2035 까지 모든 시스템 PQC 전환 |
| China / EU | 비슷한 timeline |

### 2-3. Harvest Now, Decrypt Later (HNDL)

```
2026: 공격자가 TLS 트래픽 (X25519 + AES-GCM) 캡처 + 저장
  ↓
2032: CRQC 등장 → X25519 (DH) 깨짐 → AES 키 복원 → 모든 평문 해독
```

영향 범위:
- 의료 / 정부 / 군사 — 보안 수명 30+ 년.
- 회원 PII (Personally Identifiable Information, 개인 식별 정보) — 평생 가치.
- 일반 commerce — 5 년 후엔 가치 ↓ but 신뢰성 타격.

→ **지금 PQC 로 전환하지 않으면 미래에 깨진다**. 이게 "지금 당장 시작" 의 가장 강한 이유.

### 2-4. 양자 안전 (quantum-safe) 이라고 하면 안 되는 알고리즘

서명 / KEX (Key Exchange) 모두 영향:

| 영역 | 현재 표준 | 양자 위협 |
|---|---|---|
| KEX | RSA, DH, ECDH, X25519 | ❌ Shor 로 모두 깨짐 |
| 서명 | RSA-PSS, ECDSA, EdDSA | ❌ Shor 로 모두 깨짐 |
| 대칭 | AES-128 | ⚠ Grover 로 약화 (AES-256 은 OK) |
| 해시 | SHA-256 | ⚠ Grover 로 약화 (SHA-384 OK) |
| MAC | HMAC | ✅ 영향 적음 |

### 2-5. NIST PQC 표준화 타임라인

```
2016: NIST PQC 공모전 시작
2017: 69 후보 제출
2019: round 2 (26 후보)
2020: round 3 (15 후보)
2022: 1차 선정 발표 — Kyber, Dilithium, Falcon, SPHINCS+
2024-08: FIPS 203 (ML-KEM = Kyber), FIPS 204 (ML-DSA = Dilithium), FIPS 205 (SLH-DSA = SPHINCS+) 표준 확정
TBD:    Falcon 표준 발표 예정 (FIPS 206 후보)
2024+:  Round 4 (HQC, BIKE, McEliece) — 다양성 보강
```

### 2-6. 산업 채택 현황 (2024-2025)

- **Google Chrome 124+** — TLS 1.3 에서 X25519MLKEM768 (hybrid) default.
- **Cloudflare** — 2024 년 prod TLS 의 ~2% 가 PQ hybrid (전체 transit 의 절반 이상이 PQ-ready 백본).
- **Apple iMessage** — PQ3 protocol (2024-02) — Kyber + ECDH hybrid.
- **AWS KMS** — Kyber hybrid TLS option.
- **OpenSSH 9.0+** — `sntrup761x25519-sha512` hybrid KEX default.
- **Signal** — PQXDH protocol (2023).

---

## 3. 동작 원리

### 3-1. 4 PQC 알고리즘 비교

| 알고리즘 | 종류 | 수학 | NIST | 강점 | 약점 |
|---|---|---|---|---|---|
| **ML-KEM** (CRYSTALS-Kyber) | KEM | 격자 (Module-LWE) | FIPS 203 | KEM 표준, 빠름 | 키 / ciphertext 크기 |
| **ML-DSA** (CRYSTALS-Dilithium) | 서명 | 격자 (Module-LWE+SIS) | FIPS 204 | 서명 표준, 빠름 | 서명 크기 ~2.4 KB |
| **SLH-DSA** (SPHINCS+) | 서명 | 해시 기반 (stateless) | FIPS 205 | 가정 단순 (해시 안전성만), 보수적 backup | 서명 크기 7~50 KB, 느림 |
| **Falcon** | 서명 | NTRU lattice | (FIPS 206 예정) | 서명 작음 (~666 bytes), 빠름 | 부동소수점 (timing attack) 구현 어려움 |

### 3-2. 키 / 서명 크기 비교 (vs 기존)

| | 키 / 출력 크기 |
|---|---|
| RSA-2048 public key | 256 bytes |
| ECDH P-256 public key | 32 bytes (compressed) |
| **ML-KEM-768 public key** | **1184 bytes** (~37x ECDH) |
| **ML-KEM-768 ciphertext** | **1088 bytes** |
| ECDSA P-256 signature | 64 bytes |
| EdDSA Ed25519 signature | 64 bytes |
| **ML-DSA-65 signature** | **3293 bytes** (~50x ECDSA) |
| **Falcon-512 signature** | ~666 bytes |
| **SLH-DSA-128f signature** | ~17 KB (!!) |

→ **PQC 의 가장 큰 trade-off 는 크기**. handshake byte 가 늘어나서 모바일 / IoT / TCP fragment 영향.

### 3-3. ML-KEM (Kyber) — KEM 의 동작

KEM (Key Encapsulation Mechanism) = 한 쪽이 공개키 보유, 다른 쪽이 그 공개키로 ephemeral 비밀을 "encapsulate" 해서 보냄.

```
1. KeyGen()    → (pk, sk)               receiver
2. Encaps(pk)  → (ct, ss)               sender
   - ss = shared secret (32 bytes)
   - ct = ciphertext (sender → receiver)
3. Decaps(sk, ct) → ss                  receiver
```

3 보안 레벨:

| | NIST 레벨 (대칭 키 길이 비교) | pk size | ct size | ss size |
|---|---|---|---|---|
| ML-KEM-512 | Level 1 (AES-128) | 800 | 768 | 32 |
| **ML-KEM-768** | **Level 3 (AES-192)** | **1184** | **1088** | **32** |
| ML-KEM-1024 | Level 5 (AES-256) | 1568 | 1568 | 32 |

→ 산업 표준 = ML-KEM-768.

#### 안전 가정 — Module-LWE

격자 문제 — Learning With Errors. 랜덤 행렬 A 와 노이즈 e 가 있을 때 b = A·s + e 에서 s 를 찾는 것이 어렵다는 가정. quantum 도 다항 시간 풀이 알려진 게 없음.

### 3-4. ML-DSA (Dilithium) — 서명

```
1. KeyGen()    → (pk, sk)
2. Sign(sk, m) → σ
3. Verify(pk, m, σ) → bool
```

3 보안 레벨:

| | NIST 레벨 | pk size | sig size | sk size |
|---|---|---|---|---|
| ML-DSA-44 | Level 2 | 1312 | 2420 | 2528 |
| **ML-DSA-65** | **Level 3** | **1952** | **3293** | **4032** |
| ML-DSA-87 | Level 5 | 2592 | 4595 | 4896 |

#### 안전 가정 — Module-LWE + Module-SIS

Fiat-Shamir 변환을 격자 위에서 한 것. constant-time 구현이 잘 정의돼 있고 부동소수점 미사용 → Falcon 보다 구현 안전.

### 3-5. SLH-DSA (SPHINCS+) — 해시 기반 서명

격자 가정 없음 — **해시 함수의 안전성만** 가정. 가장 보수적 (lattice 도 깨질 가능성 대비 backup).

| | sig size | sign 시간 | verify 시간 |
|---|---|---|---|
| SLH-DSA-128f (fast) | ~17 KB | ~ms | ~ms |
| SLH-DSA-128s (small) | ~7 KB | ~수십 ms | ~ms |

→ stateless. 단점 = 서명 크기 / 속도. 사용처: 펌웨어 / OS image / SBOM 처럼 한 번 서명하고 오래 검증하는 곳.

### 3-6. Falcon — compact 서명

| | sig size | 속도 |
|---|---|---|
| Falcon-512 | ~666 bytes | 매우 빠름 |
| Falcon-1024 | ~1280 bytes | 매우 빠름 |

장점: 서명 크기가 ML-DSA 의 1/5. 단점: NTRU lattice + 부동소수점 → constant-time 구현 어렵고 timing attack 위험. 표준화 늦어짐.

### 3-7. Hybrid TLS — 전환기 표준

핵심: classical (X25519) + PQ (ML-KEM-768) 둘 다 사용 → **둘 중 하나가 깨져도 안전**.

```
TLS 1.3 ClientHello
  key_share extension:
    - X25519           (32 bytes)
    - X25519MLKEM768   (32 + 1184 = 1216 bytes)   ← hybrid

서버 선택: X25519MLKEM768
  → server key_share = X25519 server pub + ML-KEM ciphertext
  → 양쪽이 X25519 secret + ML-KEM ss 둘 다 도출
  → 두 값을 KDF (HKDF) 로 결합 → 최종 shared secret

Handshake 의 모든 후속 단계는 표준 TLS 1.3 그대로
```

#### IETF 명명 규칙

`X25519MLKEM768` = X25519 (Section 1) || ML-KEM-768 (Section 2).

이 외:
- `SecP256r1MLKEM768` — ECDH P-256 + ML-KEM-768
- `X448MLKEM1024` — X448 + ML-KEM-1024 (Level 5)

#### byte 비용

```
Classical X25519 only:    handshake ~600 bytes
Hybrid X25519MLKEM768:    handshake ~2300 bytes (~3.8x)
```

- 1 RTT 안에 들어가긴 빡빡 (TCP MSS 1460 ~ MTU 1500 의 fragment).
- TCP 한 패킷 분할 → 약간의 latency 증가 (~수 ms).
- HTTP/3 (QUIC) 의 1 RTT 도 비슷.

### 3-8. PQC 서명 도입 — TLS cert / signed token 의 미래

서명은 KEX 보다 더 긴 마이그레이션이 필요:

- TLS handshake 는 ephemeral KEX → 양쪽이 동시에 새 알고리즘 채택 가능.
- 서명은 cert chain 안에 박혀있어서 root CA / intermediate / leaf 모두 새 알고리즘 지원해야.
- root CA cert 는 trust store 에 박혀있어서 globally distribute 비용 큼.

마이그레이션 패턴:

```
2024-2025: TLS KEX hybrid (X25519 + Kyber)
2026-2028: TLS cert hybrid signature 시작 (dual-sig cert)
2028-2030: PQ-only KEX 가능
2030-2035: PQ-only cert chain
```

JWT / JOSE 의 alg:
- 현재 RS256 / ES256 / EdDSA → 미래 ML-DSA-65 (예: alg `ML-DSA-65` 또는 `Dilithium3`).
- §22 의 crypto-agility 가 여기서 핵심 — alg allowlist 에 PQ 추가만 하면 점진 도입 가능.

### 3-9. 마이그레이션 전략 — crypto-agility 가 답

§21 §6 의 패턴을 PQ 에 적용:

1. **알고리즘 식별자 동봉** — 모든 ciphertext / token / cert 가 어떤 알고리즘 사용 명시.
2. **추상 인터페이스** — `Cipher` / `Signer` / `Kex` 추상화.
3. **dual-stack 동작** — old 와 new 둘 다 read 가능, write 는 점진 전환.
4. **inventory** — 우리 시스템의 모든 암호 사용처 (TLS / JWT / KMS / 디스크 / 백업) 카탈로그화.

#### NSM-10 / NIST 의 4 단계 마이그레이션

```
1. Discover — 모든 cryptographic asset 인벤토리
2. Prioritize — HNDL 위험 높은 것부터 (장수명 비밀, 의료 / 정부)
3. Migrate   — hybrid 부터 도입 (compatibility 유지)
4. Replace   — PQ-only (장기, 5~10 년)
```

---

## 4. 사용 예제

### 4-1. OpenSSH hybrid KEX

```bash
# OpenSSH 9.0+ default 가 hybrid
ssh -Q kex
# curve25519-sha256
# diffie-hellman-group14-sha256
# sntrup761x25519-sha512   ← hybrid (sntrup761 = Streamlined NTRU Prime, X25519 와 결합)
# mlkem768x25519-sha256    ← OpenSSH 9.9+ (ML-KEM hybrid)

# 명시적 선택
ssh -o KexAlgorithms=mlkem768x25519-sha256 user@host

# 서버 측 sshd_config
KexAlgorithms mlkem768x25519-sha256,sntrup761x25519-sha512,curve25519-sha256
```

### 4-2. Cloudflare / Boring SSL — TLS 1.3 PQ KEX

```yaml
# Cloudflare 측 (자동 적용, 옵트인 불필요)
- ClientHello 의 key_share 에 X25519MLKEM768 있으면 그쪽으로 협상
- Chrome 124+, Firefox 124+ default
```

```bash
# Go (boringssl-fips) 또는 OpenSSL 3.5 (예정)
openssl s_client -connect cloudflare.com:443 \
  -groups X25519MLKEM768:X25519 \
  -tls1_3
```

### 4-3. Java / Bouncy Castle PQC — ML-KEM KEM

```kotlin
import org.bouncycastle.pqc.crypto.crystals.kyber.*
import java.security.SecureRandom

// 1. 키 생성
val random = SecureRandom()
val kpg = KyberKeyPairGenerator()
kpg.init(KyberKeyGenerationParameters(random, KyberParameters.kyber768))
val kp = kpg.generateKeyPair()
val pub = kp.public as KyberPublicKeyParameters
val priv = kp.private as KyberPrivateKeyParameters

// 2. 발신자: encapsulate
val gen = KyberKEMGenerator(random)
val secretWithEncapsulation = gen.generateEncapsulated(pub)
val sharedSecretSender = secretWithEncapsulation.secret    // 32 bytes
val ciphertext = secretWithEncapsulation.encapsulation     // 1088 bytes

// 3. 수신자: decapsulate
val ext = KyberKEMExtractor(priv)
val sharedSecretReceiver = ext.extractSecrets(ciphertext)

assert(sharedSecretSender.contentEquals(sharedSecretReceiver))

// 4. 이 shared secret 을 HKDF 로 expand → AES-256-GCM 키
```

### 4-4. ML-DSA (Dilithium) 서명 — Bouncy Castle

```kotlin
import org.bouncycastle.pqc.crypto.crystals.dilithium.*

val kpg = DilithiumKeyPairGenerator()
kpg.init(DilithiumKeyGenerationParameters(SecureRandom(), DilithiumParameters.dilithium3))
val kp = kpg.generateKeyPair()

val signer = DilithiumSigner()
signer.init(true, kp.private)
val sig = signer.generateSignature("hello".toByteArray())   // ~3293 bytes

val verifier = DilithiumSigner()
verifier.init(false, kp.public)
val ok = verifier.verifySignature("hello".toByteArray(), sig)
```

### 4-5. Hybrid 서명 (classical + PQ)

```kotlin
data class HybridSignature(
    val ed25519Sig: ByteArray,    // 64 bytes
    val mldsaSig:   ByteArray,    // 3293 bytes
    val message:    ByteArray,
)

fun signHybrid(msg: ByteArray, edKey: PrivateKey, mldsaKey: DilithiumPrivateKeyParameters): HybridSignature {
    val edSig    = ed25519Sign(msg, edKey)
    val mldsaSig = dilithiumSign(msg, mldsaKey)
    return HybridSignature(edSig, mldsaSig, msg)
}

fun verifyHybrid(sig: HybridSignature, edPub: PublicKey, mldsaPub: DilithiumPublicKeyParameters): Boolean {
    // 둘 다 검증 통과해야 valid (AND)
    return ed25519Verify(sig.message, sig.ed25519Sig, edPub) &&
           dilithiumVerify(sig.message, sig.mldsaSig, mldsaPub)
}
```

→ Ed25519 가 깨져도 Dilithium 으로 보호, Dilithium 이 깨져도 Ed25519 로 보호. AND 조합.

### 4-6. JWT 의 PQ alg 도입 (실험)

```kotlin
// header.alg = "ML-DSA-65"
// (IETF draft-ietf-cose-dilithium / draft-ietf-jose-pqc-jws 에서 표준화 진행 중)

// JWS 검증 측에서 allowlist 에 추가
val alg = jws.header.algorithm
if (alg != "ML-DSA-65" && alg != "RS256") {
    throw JwtException("alg not allowed")
}
when (alg) {
    "RS256"     -> verifyWithRsa(jws)
    "ML-DSA-65" -> verifyWithDilithium(jws)
}
```

→ §22 의 alg allowlist + §21 의 algId 동봉이 PQ 마이그레이션의 backbone.

### 4-7. AWS KMS — 양자 hybrid TLS

```bash
# AWS SDK (Java v2) — KMS endpoint 호출 시 PQ hybrid 사용
import software.amazon.awssdk.crt.io.TlsContext
val tlsContext = TlsContext.builder()
    .withCipherPreference(TlsCipherPreference.PQ_TLSv1_2_2024_10)
    .build()
```

→ KMS 와의 통신이 양자 hybrid 로 보호. 데이터 자체 암호화 알고리즘 (AES-256) 은 그대로 (Grover 영향 적음).

### 4-8. 인벤토리 스크립트 (조감)

```bash
#!/bin/bash
# 우리 인프라의 cryptographic asset 발견

# 1. TLS endpoint 의 cipher / KEX
nmap --script ssl-enum-ciphers -p 443 api.msa.local

# 2. JWT alg 사용
grep -r "RS256\|HS256\|ES256\|EdDSA" --include="*.kt" --include="*.yml"

# 3. 디스크 / DB 암호화
aws kms list-keys
aws kms describe-key --key-id <id>   # KeySpec / KeyUsage

# 4. ssh keys
ssh-keygen -lf ~/.ssh/id_rsa.pub     # → ssh-rsa = 양자 위협
```

---

## 5. 트레이드오프 / 안티패턴

### 5-1. PQ-only 점프 (hybrid 건너뛰기)

- PQ 알고리즘 자체가 비교적 새 → 구현 버그 가능성.
- hybrid = "둘 중 하나 깨져도 안전" 보험.
- 권장: 2030 까지는 hybrid, 2030+ 부터 PQ-only 고려.

### 5-2. PQC 도입 = AES 도 즉시 256 으로 강제

- AES-128 도 Grover 후 2^64 — quantum 시점에서도 short-term safe.
- AES-256 권장은 long-term safety 마진. 지금 즉시 모든 AES-128 → AES-256 강제는 성능 비용.

### 5-3. SLH-DSA (SPHINCS+) 를 일반 TLS / JWT 에 사용

- 서명 7~17 KB → handshake / token 폭증.
- 사용처: 펌웨어 / OS image / SBOM 같은 한 번 서명 + 오래 검증 환경.
- 일반 TLS / JWT 는 ML-DSA 또는 Falcon.

### 5-4. PQC 라이브러리 자체 구현

- 격자 / NTRU 의 constant-time + 부동소수점 처리 매우 어려움.
- 검증된 라이브러리 (Bouncy Castle, OpenSSL 3.5+, BoringSSL, liboqs) 만 사용.

### 5-5. 양자 위협을 "20 년 후 일" 로 미루기

- HNDL 때문에 지금 캡처된 트래픽이 미래 해독.
- 의료 / 정부 / 금융 / 식별 정보는 지금 즉시 hybrid 시작.

### 5-6. cert chain 의 한 단계만 PQ 로 전환

- root → intermediate → leaf 중 한 단계만 PQ 면 다른 단계의 RSA 가 약점.
- chain 전체 PQ 또는 hybrid.

### 5-7. handshake size 증가 무시

- ML-KEM-768 hybrid → handshake 약 2.3 KB.
- 모바일 / IoT 의 MTU / 패킷 분할 영향. 대규모 ingress 의 handshake throughput 영향.
- 측정 후 도입.

### 5-8. crypto-agility 추상 없는 직접 코딩

```
val key = generateKyberKey()                                 ❌ (5 년 뒤 Kyber 도 구식 가능)
val key = keyManager.generate(Algorithm.PQ_KEM_LEVEL_3)     ✅ (level 만 명시, 알고리즘은 추상)
```

### 5-9. 일부 도메인만 PQ 적용 + 게이트웨이 plain

- 게이트웨이가 plain TLS 면 internal 만 PQ 도입의 의미 ↓.
- 외부 → 내부 모든 hop 가 hybrid 이상.

### 5-10. 라이브러리 / OS 업데이트 미반영

- OpenSSL 3.5+ / BoringSSL / Java 21+ / OpenSSH 9.0+ 가 PQ 지원 시작.
- 구버전 컨테이너 base image 면 PQ 협상 불가.
- 정기 update 가 PQ 대응의 첫 단계.

---

## 6. msa 적용

### 6-1. 우리 시스템의 cryptographic asset 인벤토리 (msa)

| 위치 | 현재 알고리즘 | 양자 위협 | 우선순위 |
|---|---|---|---|
| ingress-nginx (api.msa.local) | TLS 1.3 X25519 + AES-128-GCM | KEX 위협 (HNDL) | **높음** |
| service mesh (계획) | mTLS X25519 (sidecar) | KEX 위협 | 중 |
| JWT 서명 (gateway) | HS256 / RS256 (계획) | RS256 → 위협 | 중 |
| KMS 통신 (AWS KMS) | TLS X25519 | KEX 위협 | 낮음 (KMS 가 hybrid 옵션 제공) |
| 데이터 암호화 (AES-256-GCM) | 대칭 | Grover 약화 미미 (AES-256) | 낮음 |
| Kafka in-transit | TLS X25519 | KEX 위협 | 중 |
| MySQL TLS | TLS X25519 | KEX 위협 | 중 |
| password hash (bcrypt/argon2) | 해시 | 거의 없음 | 낮음 |
| SSH (운영) | RSA-4096 / ed25519 | RSA 위협 | 중 |

### 6-2. 마이그레이션 단계 (Phase plan)

```
Phase 0: 인벤토리 + 인지 (1주)
  - 위 표 작성, 각 endpoint 의 cipher/KEX/alg 캡처
  - HNDL 위험 평가 (장수명 비밀 식별)

Phase 1: 라이브러리 / OS update (1주)
  - JVM 21+
  - Bouncy Castle 1.78+ (PQC 지원)
  - OpenSSL 3.5+ (예정 stable)
  - container base image 업그레이드

Phase 2: ingress hybrid TLS (2주)
  - nginx-ingress + boringssl-fips 또는 cloudflare-quiche
  - X25519MLKEM768 enable
  - 클라이언트 (Chrome 124+) 와 협상 자동

Phase 3: SSH 운영 (1일)
  - sshd_config: KexAlgorithms 에 mlkem768x25519-sha256 추가

Phase 4: KMS / 외부 의존 hybrid 옵트인 (1주)
  - AWS KMS PQ hybrid endpoint
  - GCP KMS / Azure 도 동시 검토

Phase 5: JWT crypto-agility (3주)
  - alg allowlist 에 ML-DSA-65 추가 (실험)
  - 자체 internal 토큰부터 시범 (PASETO + ML-DSA 변종)
  - JWKS 에 PQ kid 동시 게시

Phase 6: 서비스 mesh hybrid (2주)
  - Linkerd / Istio 의 PQ KEX 옵션 (2025+ 예정)
  - cert 자체는 ECDSA 유지 (PQ cert 표준 늦음)

Phase 7: long-term — PQ cert chain (2028+)
  - ACME PQ-cert 표준 등장 시
  - root CA → intermediate → leaf 점진 전환

Phase 8: PQ-only (2030+)
  - hybrid 제거, classical 비활성
```

### 6-3. crypto-agility 추상 (msa-common 제안)

```kotlin
// common/src/main/kotlin/.../crypto/AlgRegistry.kt
enum class KexAlg(val id: Byte, val isPq: Boolean) {
    X25519(0x01, false),
    X25519_MLKEM_768(0x02, true),     // hybrid
    MLKEM_768_ONLY(0x03, true),
}

enum class SigAlg(val id: Byte, val isPq: Boolean) {
    ED25519(0x01, false),
    ECDSA_P256(0x02, false),
    ML_DSA_65(0x03, true),
    HYBRID_ED25519_MLDSA(0x04, true), // hybrid
}

interface Signer {
    fun sign(msg: ByteArray): ByteArray
    fun alg(): SigAlg
}

@Component
class SignerRegistry(signers: List<Signer>) {
    fun get(alg: SigAlg): Signer = ...
}
```

### 6-4. JWKS 에 PQ kid 추가 (auth 서비스)

```http
GET /.well-known/jwks.json
{
  "keys": [
    { "kid":"2026-05-rs", "kty":"RSA",  "alg":"RS256",   ... },
    { "kid":"2026-05-pq", "kty":"AKP",  "alg":"ML-DSA-65", ... }   ← 실험
  ]
}
```

→ 클라이언트가 PQ 검증 가능하면 PQ alg 토큰 발급, 그 외엔 RS256 fallback.

### 6-5. internal token (admin / batch) 부터 시범

- 외부 OAuth 호환은 JWT + RS256 유지.
- 자체 internal 토큰은 PASETO + ML-DSA (또는 Ed25519 + ML-DSA hybrid) 시범.
- 학습 + 라이브러리 검증 + 운영 부담 측정 후 점진 확대.

### 6-6. cert chain 운영 (장기)

- 현재 Let's Encrypt + ECDSA P-256 → 2027~2028 hybrid cert 등장 시 마이그레이션.
- internal CA (Vault PKI / SPIRE) 는 좀 더 빨리 hybrid 전환 가능 — 자체 클라이언트만 호환 보장하면 됨.

### 6-7. monitoring

- TLS handshake fingerprint metric (Prometheus) — PQ KEX 채택률 추적.
- cert / JWKS endpoint 의 alg 분포 dashboard.
- HNDL 위험 자산 (장수명 비밀) 의 hybrid 적용률 KPI.

---

## 7. ADR 후보

> **ADR-XXXX-13h: Post-Quantum Crypto 마이그레이션 전략 — Hybrid 부터 점진 도입**
>
> **Context**: Shor 알고리즘이 양자컴퓨터에서 RSA / ECC / DH 를 다항 시간에 깨고, NIST 가 2024 년 ML-KEM / ML-DSA / SLH-DSA 를 FIPS 표준으로 확정함. CRQC 도래는 2030~2035 추정이지만 HNDL (Harvest Now, Decrypt Later) 때문에 지금 캡처된 트래픽이 미래에 해독될 위험. 의료 / 금융 / 신원 데이터는 5+ 년 보안 수명 필요. msa 의 모든 TLS / JWT / mesh 가 classical (X25519, ECDSA) 의존.
>
> **Decision**:
> 1. **인벤토리 우선** — 모든 cryptographic asset (TLS endpoint, JWT, KMS, SSH) 카탈로그화. HNDL 위험 평가.
> 2. **Hybrid 우선 도입** — 2030 까지는 PQ-only 가 아닌 classical+PQ hybrid. 둘 중 하나 깨져도 안전 보장.
> 3. **외부 ingress 부터** — nginx-ingress 의 X25519MLKEM768 활성화 (Chrome 124+ 와 자동 협상).
> 4. **SSH 즉시 적용** — OpenSSH 9.x 의 mlkem768x25519-sha256 enable.
> 5. **JWT crypto-agility** — alg allowlist 에 ML-DSA-65 추가 가능한 추상화. internal 토큰부터 시범.
> 6. **mesh / KMS 는 라이브러리 성숙도 추적** — Linkerd / Istio 의 PQ KEX 옵션 출시 시 도입.
> 7. **검증된 라이브러리만** — Bouncy Castle, OpenSSL 3.5+, BoringSSL, liboqs.
> 8. **AES-128 → AES-256 점진 전환** — 신규 데이터부터 AES-256 강제, 기존 lazy migration.
>
> **Consequences**:
> - (+) HNDL 위험 차단, 5~10 년 후 마이그레이션 비용 평탄화.
> - (+) crypto-agility 추상화로 알고리즘 교체 비용 ↓.
> - (-) handshake byte 약 4x (~2.3 KB), 모바일 / 패킷 분할 영향 — 측정 필요.
> - (-) 라이브러리 / runtime 업그레이드 필요 (JVM 21+, OpenSSL 3.5+).
> - (-) 학습 곡선 (격자 암호 / Kyber / Dilithium 의 운영 특성).
>
> **Alternatives 검토**:
> - PQ-only 즉시 — 라이브러리 미성숙, 하나만 깨지면 무방어 ❌
> - 마이그레이션 연기 (2028~) — HNDL 위험 ❌
> - classical 만 유지 — CRQC 도래 시 갑작스런 전환 비용 폭발 ❌

---

## 8. 면접 한 줄 답변

### Q. 양자컴퓨터가 현대 암호에 미치는 영향은?

> "Shor 알고리즘이 양자컴퓨터에서 정수 인수분해와 이산로그를 다항 시간에 풀기 때문에 RSA / ECC / DH / DSA 같은 공개키 암호 전체가 무너집니다. Grover 알고리즘은 대칭 / 해시에 영향이 있지만 키 길이를 2배 (AES-128 → 256, SHA-256 → 384) 로 만들면 회복 가능합니다. 그래서 양자 위협의 본질은 \"공개키 알고리즘\" 만 입니다. 더 큰 문제는 Harvest Now Decrypt Later — 지금 캡처된 트래픽이 5~15 년 뒤 양자컴퓨터로 해독될 수 있어서, 장수명 비밀을 다루는 시스템은 지금 즉시 PQC 전환을 시작해야 합니다."

### Q. NIST 가 표준화한 PQC 알고리즘은?

> "2024 년 8 월에 3 개가 FIPS 표준으로 확정됐습니다. ML-KEM (Kyber, FIPS 203) 은 KEM 표준 — 격자 기반이고 768 레벨이 산업 표준입니다. ML-DSA (Dilithium, FIPS 204) 는 서명 표준 — 마찬가지 격자 기반. SLH-DSA (SPHINCS+, FIPS 205) 는 해시 기반 서명 — 가정이 가장 단순하지만 서명 크기가 7~17 KB 라 펌웨어 / OS image 같은 한 번 서명 + 오래 검증 환경에 적합합니다. Falcon 은 NTRU 격자 기반의 compact 서명 (~666 bytes) 으로 곧 FIPS 206 으로 표준화 예정입니다."

### Q. Hybrid TLS 가 무엇이고 왜 PQ-only 가 아닌가요?

> "Hybrid 는 classical (X25519) 과 PQ (ML-KEM-768) 를 둘 다 사용해서 두 shared secret 을 KDF 로 결합하는 방식입니다. 둘 중 하나만 깨져도 안전이 유지된다는 보험 — PQ 알고리즘 자체가 비교적 새고 구현 버그 / 알려지지 않은 공격 가능성이 있어서 2030 까지는 hybrid 권장이 표준입니다. Chrome 124+, Cloudflare, AWS KMS 가 이미 X25519MLKEM768 hybrid 를 prod 에 적용했고 OpenSSH 9.x 도 mlkem768x25519-sha256 가 default 입니다. handshake 가 약 2.3 KB 로 4x 늘어나는 trade-off 는 있지만 실측 latency 영향은 ms 단위입니다."

### Q. PQC 마이그레이션의 핵심은 무엇인가요?

> "crypto-agility 입니다. 알고리즘 식별자를 데이터 / 토큰 / cert 에 함께 동봉하고 (1 byte 면 충분), 추상화 인터페이스로 구현을 swap 가능하게 만들고, old 와 new 를 동시에 지원하는 마이그레이션 기간을 두는 설계 원칙입니다. NIST / NSM-10 의 4 단계 — Discover (인벤토리) → Prioritize (HNDL 위험 우선) → Migrate (hybrid) → Replace (PQ-only) — 가 표준 프레임워크입니다. msa 도 ingress, JWT, KMS, mesh, SSH 를 다 카탈로그화하고 외부 ingress 부터 hybrid 적용을 시작하는 게 실용적 첫 단계입니다."

### Q. SLH-DSA (SPHINCS+) 는 왜 backup 알고리즘인가요?

> "ML-KEM, ML-DSA, Falcon 모두 격자 (lattice) / NTRU 가정에 의존합니다. 만약 격자 기반 가정이 깨지면 세 개가 동시에 위험해질 수 있습니다. SLH-DSA 는 해시 함수의 안전성만 가정 — 가장 보수적이고 다른 backup 입니다. 단점은 서명 크기 7~17 KB 와 상대적으로 느린 속도라 일반 TLS / JWT 에는 부적합하지만, 펌웨어 서명 / OS image / SBOM 처럼 한 번 서명하고 오래 검증하는 환경에 이상적입니다."

### Q. AES-256 은 양자 시대에도 안전한가요?

> "Grover 알고리즘이 대칭 키 검색을 O(√N) 으로 가속해서 AES-128 의 보안 강도가 2^128 → 2^64 로 약화됩니다. 하지만 AES-256 은 2^256 → 2^128 로, 이 정도면 양자 시대에도 충분한 안전 마진입니다. 그래서 PQC 전환의 핵심은 공개키 알고리즘 (RSA / ECC / DH) 이고, 대칭은 AES-128 을 AES-256 으로 점진 업그레이드하면 됩니다. 해시도 마찬가지 — SHA-384 / SHA-512 가 양자 시대에도 안전합니다."

---

## 9. 흔한 오해 정정

> **"양자컴퓨터는 모든 암호를 깬다"**

- ❌ 공개키 (RSA / ECC / DH) 만 본질적 위협. 대칭 (AES-256) / 해시 (SHA-384) 는 키/출력 길이 조정만으로 안전.

> **"양자 위협은 20 년 뒤 일이라 지금 신경 안 써도 된다"**

- ❌ HNDL 때문에 지금 캡처된 트래픽이 미래에 해독. 장수명 비밀 (의료 / 금융 / 신원) 은 지금 시작.

> **"PQC 알고리즘은 너무 새고 검증 안 됐다"**

- ⚠ NIST 가 8 년 (2016~2024) 공모전 + 산업 검증으로 표준화. Cloudflare / Chrome / AWS / Apple 이 prod 적용 중. 검증 단계 통과.

> **"Hybrid 는 비효율적, PQ-only 가 깔끔하다"**

- ❌ PQ 알고리즘이 미지의 공격에 취약할 가능성. hybrid 가 2030 까지 표준 — 보험 가치가 비용 압도.

> **"ML-KEM 의 키가 1184 bytes 라 모바일에서 못 쓴다"**

- ⚠ handshake 가 ~2.3 KB 로 늘어나지만 실측 latency 는 ms 수준. Cloudflare / Apple iMessage 이미 모바일 prod 적용.

> **"NIST 가 표준화했으니 IETF / TLS 표준도 자동 적용"**

- ⚠ TLS 1.3 의 X25519MLKEM768 명세는 IETF draft 단계 (2024 말 RFC 8446-bis 또는 별도 RFC). 실제 표준 ID 와 명명은 변동 가능. 라이브러리 버전 추적 필수.

> **"PQ cert 가 등장하면 Let's Encrypt 가 자동 발급해줄 것"**

- ⚠ ACME PQ-cert 표준은 2025+ 진행 중. cert chain 전환은 KEX 보다 5~10 년 더 걸림.

> **"Falcon 이 ML-DSA 보다 작으니까 Falcon 쓰자"**

- ⚠ Falcon 은 부동소수점 + NTRU 격자라 constant-time 구현 어려움 → side-channel 위험. ML-DSA 가 구현 안전성 측면에서 표준 추천.

> **"AWS KMS 만 쓰면 PQ 신경 안 써도 된다"**

- ⚠ KMS 와의 통신만 보호. KMS 가 발급한 DEK 가 외부 TLS 로 흘러가면 그 TLS 가 classical 이면 HNDL 노출.

> **"SLH-DSA 가 가장 안전하니까 어디에나 쓰자"**

- ❌ 서명 크기 7~17 KB → 일반 TLS / JWT 에 부적합. 펌웨어 / SBOM 등 특수 도메인.

---

## 10. 회독 체크리스트

> §24 회독 체크리스트:
> - [ ] Shor (공개키 위협) vs Grover (대칭 / 해시 약화) 의 본질 차이
> - [ ] HNDL (Harvest Now, Decrypt Later) 의 의미와 장수명 비밀 우선순위
> - [ ] Mosca theorem 으로 마이그레이션 시점 산정
> - [ ] NIST 4 PQC 알고리즘 (ML-KEM / ML-DSA / SLH-DSA / Falcon) 의 종류 / 가정 / 크기
> - [ ] ML-KEM 의 KeyGen / Encaps / Decaps 3 단계
> - [ ] 키 / 서명 크기 비교 (ECDH 32B vs ML-KEM 1184B / ECDSA 64B vs ML-DSA 3293B)
> - [ ] Hybrid TLS 의 X25519MLKEM768 동작 (두 shared secret 을 KDF 로 결합)
> - [ ] handshake byte 영향 (~600B → ~2300B, 4x)
> - [ ] AES-128 vs AES-256 의 양자 시대 안전 마진
> - [ ] SHA-256 vs SHA-384 의 양자 시대 안전 마진
> - [ ] SLH-DSA 가 backup 인 이유 (해시 가정, 격자 깨질 경우 대비)
> - [ ] Falcon 의 NTRU + 부동소수점 → constant-time 구현 어려움
> - [ ] cert chain 마이그레이션이 KEX 보다 늦은 이유
> - [ ] crypto-agility 4 원칙 (algId 동봉 / 추상 인터페이스 / 동시 지원 / 인벤토리)
> - [ ] msa 마이그레이션 8 phase (인벤토리 → 라이브러리 → ingress → SSH → KMS → JWT → mesh → cert)
> - [ ] 산업 채택 사례 (Chrome 124+, Cloudflare, AWS KMS, OpenSSH 9, Apple PQ3)

---

## 11. 연결 학습

- §07 asymmetric signing — 현재 RSA / ECC / EdDSA (이 파일은 미래 PQC 대체)
- §16 TLS — TLS 1.3 (이 파일은 hybrid TLS 확장)
- §21 AEAD / KDF — crypto-agility (이 파일은 PQ 마이그레이션의 가장 큰 시험대)
- §22 JWT 함정 — alg allowlist (이 파일은 alg 에 ML-DSA-65 추가 패턴)
- §23 mTLS / cert rotation — service identity (이 파일은 PQ cert chain 의 미래)
- §15 HSM — root CA 보호 (이 파일은 HSM 도 PQ 알고리즘 지원 필요)
