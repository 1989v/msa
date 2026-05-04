---
parent: 13-crypto-jwt-sso
seq: 21
title: AEAD nonce / Key Wrap / HKDF / CSPRNG — 대칭암호 운영 함정
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 02-aes-modes.md
  - 06-hmac.md
  - 13-aws-kms.md
  - 22-jwt-pitfalls-zero-trust.md
sources:
  - https://datatracker.ietf.org/doc/html/rfc5116
  - https://datatracker.ietf.org/doc/html/rfc5869
  - https://datatracker.ietf.org/doc/html/rfc3394
  - https://datatracker.ietf.org/doc/html/rfc5649
  - https://datatracker.ietf.org/doc/html/rfc8452
  - https://datatracker.ietf.org/doc/html/rfc5297
  - https://csrc.nist.gov/publications/detail/sp/800-38d/final
  - https://csrc.nist.gov/publications/detail/sp/800-90a/rev-1/final
catalog-row: "§A AEAD nonce / Key Wrap, §B HKDF / CSPRNG · DRBG, §C Crypto-agility"
---

# 21. AEAD nonce / Key Wrap / HKDF / CSPRNG — 대칭 암호 운영 함정

> 카탈로그 매핑: §99 §A — `AEAD nonce uniqueness 함정` (★ → ✅), `AES-SIV / AES-GCM-SIV` (★ → ✅), `Key Wrap (RFC 3394 / 5649)` (★ → ✅) · §B — `HKDF (RFC 5869)` (★ → ✅), `CSPRNG / DRBG` (★ → ✅) · §C — `Crypto-agility` (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B

> "AES-GCM 쓰면 안전" 은 절반만 맞다. AEAD (Authenticated Encryption with Associated Data, 인증된 암호화 + 부가 데이터) 의 안전성은 **nonce 가 유일** 하다는 전제 위에 서 있고, nonce 가 단 한 번이라도 같은 키 아래 재사용되면 GCM 은 메시지 기밀성과 인증 키 자체를 동시에 잃는다. 본 deep file 은 (1) AEAD nonce 함정과 misuse-resistant 변종 (AES-SIV / AES-GCM-SIV), (2) DEK (Data Encryption Key, 데이터 암호화 키) 를 KEK (Key Encryption Key, 키 암호화 키) 로 감싸는 Key Wrap 표준, (3) 대칭 키를 안전하게 파생하는 HKDF (HMAC-based Key Derivation Function, HMAC 기반 키 파생 함수), (4) 암호 안전 난수 CSPRNG (Cryptographically Secure Pseudo-Random Number Generator, 암호학적으로 안전한 의사 난수 생성기) / DRBG (Deterministic Random Bit Generator, 결정론적 난수 비트 생성기), (5) 알고리즘 교체를 전제로 설계하는 crypto-agility 까지 다룬다.

---

## 1. 한 줄 핵심

> **AEAD 는 "nonce 유일 + 안전한 KDF + 안전한 RNG + 키 분리" 4 축이 동시에 무너지지 않을 때만 안전.**
> GCM 의 nonce 재사용은 키 공개 수준의 사고 → misuse-resistant (SIV) 가 그래서 등장. KEK/DEK 를 분리하고 Key Wrap 으로 감싸 envelope 를 만들고, HKDF 로 키를 파생하며, CSPRNG 로 난수를 뽑는다. 알고리즘은 언젠가 깨진다 → 교체 가능성 (crypto-agility) 을 코드 구조에 내장한다.

---

## 2. 등장 배경 — 왜 이게 문제인가

### 2-1. AES-CTR + HMAC 수동 조합의 위험

2010 년대 초까지 흔한 패턴은 "AES-CBC 로 암호화 + HMAC-SHA256 로 인증" 의 수동 조합 (encrypt-then-MAC). 문제는:

- 두 단계가 같은 키를 쓰면 위험, 다른 키면 KDF 가 또 필요.
- IV (Initialization Vector, 초기화 벡터) 무작위성, padding oracle, MAC 비교 timing attack — 함정 4중첩.
- 표준화 부재 → 라이브러리마다 다른 결과.

→ AEAD (RFC 5116) 가 "암호화 + 인증 + 부가 데이터 (associated data) 검증" 을 한 인터페이스로 묶음. AES-GCM (NIST SP 800-38D) 이 사실상 표준.

### 2-2. nonce 재사용 사고들 — GCM 의 치명타

GCM 의 인증 키 H 는 message 와 무관하게 키 K 의 함수. 같은 (K, nonce) 로 두 메시지를 암호화하면:

- **기밀성 붕괴**: keystream 동일 → XOR 로 평문 차분이 나옴 (CTR 모드의 고전적 함정).
- **인증 키 노출**: GHASH 의 H 가 두 tag 의 차분으로 풀려나와 forgery 가능.

실제 사례:

- **Microsoft .NET (CVE-2018-8261 류)** — RNG 잔재 / counter 충돌로 GCM nonce 가 통계적으로 충돌. 패치 + nonce 길이 늘림.
- **Bleichenbacher / Joux 발표 (2006)** — nonce reuse → GCM forgery 데모.
- **Hanno Böck "Nonce-Disrespecting Adversaries" (2016)** — 인터넷 스캔 결과 184개 사이트가 TLS 의 GCM nonce 를 재사용 (구현 버그) → 일부 사이트 평문 추출 가능.
- **WireGuard, AWS Encryption SDK** 등은 대응으로 **counter-based nonce + 카운터 over flow 시 새 키** 정책을 명시.

### 2-3. KEK/DEK 분리가 아닌 단일 키 운영의 문제

- 단일 키로 모든 데이터를 암호화 → 키 회전 = 모든 데이터 재암호화 (terabytes 재암호화 비용).
- 키 노출 시 blast radius (영향 반경) = 전체 데이터.

→ KMS (Key Management Service, 키 관리 서비스) 시대의 표준은 **envelope encryption** (DEK 가 데이터 암호화, KEK 는 DEK 만 감쌈, KEK 는 HSM (Hardware Security Module, 하드웨어 보안 모듈) 안에서만 쓰임).

### 2-4. 자체 KDF 의 위험 — "SHA256(secret)" 안티패턴

- 라이브러리/블로그 코드: `key = sha256(password + salt)` — entropy 부족, 길이 고정 안 됨, context binding 없음.
- HKDF (RFC 5869) 가 "extract (entropy 추출) + expand (키 자료 확장 + context 바인딩)" 두 단계를 표준화.

### 2-5. 잘못된 RNG — Debian OpenSSL 사고 (2008)

`/dev/urandom` 의 entropy 시드 코드를 잘못 패치 → 2 년간 Debian 이 만든 SSH/SSL 키 약 32K 종류뿐. 모든 키가 사실상 예측 가능. 전 세계 키 회전 사태.

→ "직접 난수를 만들지 말라, OS 의 CSPRNG 를 써라" 는 철칙은 이 사고의 산물.

### 2-6. 알고리즘은 깨진다 — crypto-agility 가 필요한 이유

- MD5 (1996 weakness → 2004 deprecated → 2009 collision)
- SHA-1 (2005 weakness → 2017 SHAttered → 2020 deprecated)
- 3DES (Sweet32, 2016 → 2024 사실상 disallowed)
- RSA-1024 (2010 deprecated)
- 양자컴퓨터 → RSA / ECC 전체가 위협 (§24)

→ 알고리즘을 코드에 하드코딩하면 5~10 년 뒤 마이그레이션이 지옥. **crypto-agility** = 알고리즘 식별자를 데이터에 함께 저장 + 추상화 계층 통과.

---

## 3. 동작 원리

### 3-1. AEAD 의 인터페이스 (RFC 5116 추상)

```
Seal(K, N, A, P) -> C
  K: 키 (예: AES-256 = 32 bytes)
  N: nonce (예: GCM = 12 bytes 권장)
  A: associated data (헤더 등 인증만 받고 암호화 안 됨)
  P: plaintext
  C: ciphertext || tag (tag 보통 16 bytes)

Open(K, N, A, C) -> P 또는 ⊥(인증 실패)
```

핵심 보장:

- **기밀성**: P 는 K, N 없이 복원 불가.
- **무결성**: C 가 1 bit 라도 바뀌면 Open 이 ⊥.
- **부가 데이터 인증**: A 가 바뀌어도 ⊥. → 메타데이터 (예: tenant_id, version) 를 A 로 묶어 컨텍스트 바인딩.
- **전제**: 같은 (K, N) 은 두 번 사용하지 않는다.

### 3-2. AES-GCM 의 nonce 와 카운터

```
GCM nonce N (96 bits 권장)
  ↓
J0 = N || 0x00000001         (초기 counter block)
  ↓
keystream block_i = AES_K(J0 + i)
ciphertext = plaintext XOR keystream
  ↓
GHASH (H = AES_K(0^128)) 로 ciphertext + A 를 인증 → tag
```

같은 (K, N) → 같은 J0 → 같은 keystream → 두 평문이 XOR 누출. 그래서 nonce 유일성이 키와 동급으로 중요.

#### nonce 생성 전략

| 전략 | 설명 | 장단 |
|---|---|---|
| **Counter** (recommended) | 96-bit counter 를 1씩 증가 | 안전 (소스 보장 시), 단 분산 환경에선 동기화 필요. 한 키로 2^96 메시지까지 안전 |
| **Random** | CSPRNG 로 96 bits 뽑음 | 분산에 자연스러움, 단 birthday bound = 2^48 메시지 후 충돌 가능성 (NIST SP 800-38D 권고: 한 키당 2^32 메시지 이하) |
| **Hybrid** (4 bytes random + 8 bytes counter) | AWS Encryption SDK 패턴 | 분산 + 충돌 안전 |
| **Misuse-resistant (SIV)** | nonce 재사용 시에도 부분 안전 | nonce 관리 부담 ↓ (아래 3-3) |

### 3-3. AES-SIV / AES-GCM-SIV — nonce-misuse-resistant

**SIV (Synthetic Initialization Vector)** = nonce + plaintext + AAD 를 PRF (HMAC 또는 PMAC) 로 압축해서 IV 를 합성. nonce 가 같아도 plaintext 가 다르면 IV 가 달라져서 keystream 이 달라짐.

```
Synthesize(K1, N, A, P) -> SIV (16 bytes)
Encrypt(K2, SIV, P) -> C       (CTR with counter = SIV)
Tag = SIV
```

| 알고리즘 | 사양 | 장점 | 단점 |
|---|---|---|---|
| **AES-SIV** (RFC 5297) | CMAC + AES-CTR | nonce 없어도 결정론적 (deduplication 에 유용) | 1-pass 불가 (CMAC 한 번 + CTR 한 번) |
| **AES-GCM-SIV** (RFC 8452) | POLYVAL + AES-CTR + KDF per nonce | GCM 호환 + nonce-misuse-resistant + 빠름 | 라이브러리 지원 적음 (BoringSSL, Tink) |

→ 권장: nonce 관리 불확실 (멀티 인스턴스, 키 공유, dedup 필요) 한 곳은 **AES-GCM-SIV** 또는 **AES-SIV**. 그렇지 않으면 GCM + counter nonce.

> 함정: SIV 가 "nonce 재사용해도 OK" 라는 뜻은 아니다. 같은 (K, nonce, plaintext) 라면 같은 ciphertext 가 나옴 → 평문 동일 여부 누출. nonce 는 여전히 가능한 한 유일하게.

### 3-4. Key Wrap (RFC 3394 / RFC 5649)

DEK 를 KEK 로 안전하게 감싸는 표준. AEAD 와 비슷하지만:

- **결정론적** — 같은 (KEK, DEK) 는 같은 wrap 결과 → audit / dedup 가능.
- **integrity 내장** — unwrap 실패 시 에러.
- **nonce 불필요** — KEK 가 long-term, DEK 는 random 이라 IV 역할.

| RFC | 입력 길이 |
|---|---|
| RFC 3394 (AES-Key-Wrap) | 8 byte 배수만 |
| RFC 5649 (AES-Key-Wrap with padding) | 임의 길이 (8 byte aligned 가 아니어도 OK) |

**AWS KMS / GCP KMS / Azure Key Vault 의 envelope encryption 이 내부적으로 이걸 씀**:

```
1. KMS.GenerateDataKey(KeyId=KEK)
   → DEK_plaintext (32 bytes), DEK_wrapped (KMS 가 KEK 로 wrap)
2. App: ciphertext = AES-GCM(DEK_plaintext, nonce, plaintext, AAD)
3. App: store (ciphertext, nonce, AAD, DEK_wrapped)
4. 메모리에서 DEK_plaintext 즉시 zero out.
5. 복호 시: KMS.Decrypt(DEK_wrapped) → DEK_plaintext → AES-GCM Open.
```

장점: KEK 는 KMS/HSM 안에만 있고, DEK 는 메시지 단위로 분리 → blast radius 축소. KEK 회전 시 DEK 만 다시 wrap (ciphertext 재암호화 불필요).

### 3-5. HKDF (RFC 5869) — 표준 KDF

```
HKDF-Extract(salt, IKM) -> PRK (pseudo-random key)
  PRK = HMAC(salt, IKM)

HKDF-Expand(PRK, info, L) -> OKM (output key material, L bytes)
  T(0) = empty
  T(i) = HMAC(PRK, T(i-1) || info || i)
  OKM = T(1) || T(2) || ...   (앞 L bytes)
```

| 입력 | 의미 | 권장 |
|---|---|---|
| `IKM` | 입력 키 자료 (예: ECDH shared secret, master key) | high-entropy 면 그대로, password 면 PBKDF2/Argon2 거친 후 |
| `salt` | 무작위 (선택, but **권장**) | hash 길이 (SHA-256 = 32 bytes), random 또는 컨텍스트 |
| `info` | 컨텍스트 / 용도 식별 | "msa:gateway:jwt-signing-key:v3" 같은 도메인 분리 문자열 |
| `L` | 출력 길이 | hash output × 255 까지 (SHA-256 = 8160 bytes max) |

**핵심 패턴**: 한 master key 로 여러 용도 키 분리.

```
master_key  --HKDF(info="auth-token-hmac")-->  K_auth
master_key  --HKDF(info="cookie-encrypt")-->   K_cookie
master_key  --HKDF(info="cache-payload")-->    K_cache
```

→ 한 키 노출이 다른 컨텍스트로 번지지 않게 분리.

### 3-6. CSPRNG / DRBG

| 종류 | 정의 |
|---|---|
| **PRNG** | seed 로부터 deterministic sequence 생성. 암호용 ❌ (Linear Congruential, Mersenne Twister 등) |
| **CSPRNG** | 출력에서 seed 역산 / 미래 출력 예측이 계산상 불가능. 암호용 ✅ |
| **DRBG** (NIST SP 800-90A) | CSPRNG 의 NIST 표준 family — Hash_DRBG, HMAC_DRBG, CTR_DRBG |
| **TRNG** | 하드웨어 잡음 기반 진정 난수 (Intel RDSEED, HSM, /dev/random 의 entropy pool 일부) |

#### OS 의 CSPRNG (실용 정리)

| OS | API | 비고 |
|---|---|---|
| Linux | `getrandom(2)` (since 3.17) / `/dev/urandom` | early boot 전엔 `getrandom` 가 block — 부팅 후엔 동등 안전 |
| macOS | `arc4random_buf` / `/dev/urandom` | 부팅 후 항상 안전 |
| Windows | `BCryptGenRandom` (CNG) | |
| JVM | `SecureRandom` (default → `NativePRNG` 또는 `Windows-PRNG`) | `SHA1PRNG` 는 **사용 금지** (legacy, FIPS 비호환) |
| Kotlin/Java | `java.security.SecureRandom.getInstanceStrong()` | `/dev/random` 사용 → block 가능. 일반 `SecureRandom()` 가 보통 적합 |

#### 함정

- **`/dev/random` 은 entropy pool 부족 시 block** → 컨테이너 / VM 부팅 직후엔 hang 가능. 현대 Linux (5.6+) 는 `getrandom` 권장.
- **Java `SecureRandom.getInstanceStrong()`** 가 `/dev/random` 으로 떨어져서 production 컨테이너 부팅 지연 (수십 초) — 잘 알려진 함정.
- **Math.random / Random / ThreadLocalRandom** 은 CSPRNG ❌. 키 / nonce / token 에 절대 쓰지 말 것.
- **fork() 후 RNG 상태 공유** — Python 의 multiprocessing 등에서 같은 시드로 분기하면 CSPRNG 재시드 필요.

### 3-7. Crypto-agility — 알고리즘 교체 전제 설계

원칙:

1. **알고리즘 식별자를 데이터에 동봉** — `version || alg_id || ciphertext` 형식.
2. **추상화 인터페이스** — `Cipher`, `Signer` 인터페이스 + 구현 swap.
3. **여러 알고리즘 동시 지원** — old 알고리즘 read 가능 + new 알고리즘 write.
4. **migration runbook** — old 데이터 점진 재암호화.

JWT 의 `alg` header / JOSE 의 `kid` / JWE 의 `enc` 필드가 이미 이 패턴. KMS 의 ciphertext blob 도 KeyId + version + algorithm 을 동봉.

---

## 4. 사용 예제

### 4-1. AES-GCM with counter nonce (Kotlin / JCA)

```kotlin
import java.nio.ByteBuffer
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import java.util.concurrent.atomic.AtomicLong

class GcmEncryptor(keyBytes: ByteArray) {
    private val key: SecretKey = SecretKeySpec(keyBytes, "AES")
    private val nonceCounter = AtomicLong(SecureRandom().nextLong())  // random base
    private val nonceFixed: ByteArray = ByteArray(4).also { SecureRandom().nextBytes(it) }
    // 12-byte nonce = 4 fixed + 8 counter (AWS Encryption SDK 패턴)

    fun seal(plaintext: ByteArray, aad: ByteArray): ByteArray {
        val ctr = nonceCounter.incrementAndGet()
        val nonce = ByteBuffer.allocate(12).put(nonceFixed).putLong(ctr).array()

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, nonce))
        cipher.updateAAD(aad)
        val ct = cipher.doFinal(plaintext)
        return nonce + ct   // 12-byte nonce prefix
    }

    fun open(blob: ByteArray, aad: ByteArray): ByteArray {
        val nonce = blob.copyOfRange(0, 12)
        val ct = blob.copyOfRange(12, blob.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, nonce))
        cipher.updateAAD(aad)
        return cipher.doFinal(ct)
    }
}
```

핵심:
- `GCMParameterSpec(128, nonce)` — tag 길이 명시 (default 96 위험).
- nonce 12 bytes, counter 단조 증가 → 한 키로 2^64 메시지까지 안전.
- 카운터 overflow 임박 시 키 회전 트리거 (예: 2^48 도달 시 alarm).
- AAD 에 `tenant_id || version` 같은 컨텍스트 포함 → cross-context 재생 공격 방어.

### 4-2. AES-GCM-SIV (Tink)

```kotlin
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.aead.AesGcmSivKeyManager
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.KeysetHandle

fun setupGcmSiv(): KeysetHandle {
    AeadConfig.register()
    return KeysetHandle.generateNew(KeyTemplates.get("AES256_GCM_SIV"))
}

fun encrypt(handle: KeysetHandle, plaintext: ByteArray, aad: ByteArray): ByteArray {
    val aead = handle.getPrimitive(com.google.crypto.tink.Aead::class.java)
    return aead.encrypt(plaintext, aad)   // nonce 자동 생성, misuse-resistant
}
```

→ Tink 가 nonce 관리 / 회전 / KMS 통합까지 다 처리. crypto-agility 친화 (`KeysetHandle` 안에 알고리즘 + 키 + 버전 함께).

### 4-3. KMS Envelope Encryption (AWS SDK)

```kotlin
import software.amazon.awssdk.services.kms.KmsClient
import software.amazon.awssdk.services.kms.model.GenerateDataKeyRequest
import software.amazon.awssdk.services.kms.model.DataKeySpec
import software.amazon.awssdk.services.kms.model.DecryptRequest
import software.amazon.awssdk.core.SdkBytes

class EnvelopeEncryptor(private val kms: KmsClient, private val kekId: String) {
    data class Envelope(val ciphertext: ByteArray, val wrappedDek: ByteArray, val nonce: ByteArray, val aad: ByteArray)

    fun seal(plaintext: ByteArray, aad: ByteArray): Envelope {
        // 1) DEK 발급 — KMS 가 KEK 로 wrap 한 결과까지 함께 반환
        val resp = kms.generateDataKey(GenerateDataKeyRequest.builder()
            .keyId(kekId).keySpec(DataKeySpec.AES_256).build())
        val dekPlaintext = resp.plaintext().asByteArray()     // 32 bytes
        val wrappedDek = resp.ciphertextBlob().asByteArray()

        try {
            // 2) DEK 로 평문 암호화
            val nonce = ByteArray(12).also { java.security.SecureRandom().nextBytes(it) }
            val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(javax.crypto.Cipher.ENCRYPT_MODE,
                javax.crypto.spec.SecretKeySpec(dekPlaintext, "AES"),
                javax.crypto.spec.GCMParameterSpec(128, nonce))
            cipher.updateAAD(aad)
            val ct = cipher.doFinal(plaintext)
            return Envelope(ct, wrappedDek, nonce, aad)
        } finally {
            // 3) DEK 메모리 즉시 zero out — 핵심 위생
            java.util.Arrays.fill(dekPlaintext, 0)
        }
    }

    fun open(env: Envelope): ByteArray {
        val resp = kms.decrypt(DecryptRequest.builder()
            .ciphertextBlob(SdkBytes.fromByteArray(env.wrappedDek)).build())
        val dek = resp.plaintext().asByteArray()
        try {
            val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE,
                javax.crypto.spec.SecretKeySpec(dek, "AES"),
                javax.crypto.spec.GCMParameterSpec(128, env.nonce))
            cipher.updateAAD(env.aad)
            return cipher.doFinal(env.ciphertext)
        } finally {
            java.util.Arrays.fill(dek, 0)
        }
    }
}
```

### 4-4. HKDF 로 master key → 용도별 키 파생 (BouncyCastle)

```kotlin
import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.params.HKDFParameters

fun deriveKey(masterKey: ByteArray, salt: ByteArray, info: String, lengthBytes: Int): ByteArray {
    val hkdf = HKDFBytesGenerator(SHA256Digest())
    hkdf.init(HKDFParameters(masterKey, salt, info.toByteArray(Charsets.UTF_8)))
    val out = ByteArray(lengthBytes)
    hkdf.generateBytes(out, 0, lengthBytes)
    return out
}

// 용도별 분리
val kAuth   = deriveKey(master, salt, "msa:gateway:jwt-hs256:v3", 32)
val kCookie = deriveKey(master, salt, "msa:gateway:cookie-aead:v3", 32)
val kCache  = deriveKey(master, salt, "msa:product:cache-aead:v3", 32)
```

`info` 에 **서비스 + 용도 + 알고리즘 + 버전** 4 요소를 묶는 게 표준. 알고리즘 교체 시 `v3 → v4` 만 바꿔도 자연스럽게 새 키 파생.

### 4-5. SecureRandom 사용 패턴 (JVM)

```kotlin
import java.security.SecureRandom

object Rng {
    // production 권장: 기본 SecureRandom() 이 NativePRNG (Linux: /dev/urandom) 로 떨어짐
    private val sr = SecureRandom()

    fun nonce(size: Int = 12): ByteArray = ByteArray(size).also { sr.nextBytes(it) }
    fun token(size: Int = 32): ByteArray = ByteArray(size).also { sr.nextBytes(it) }
}

// ❌ 절대 쓰지 말 것
// Math.random()
// java.util.Random()
// ThreadLocalRandom.current().nextBytes(...)
// new SecureRandom("seed".getBytes())   // 결정론적 (테스트 외 금지)
// SecureRandom.getInstance("SHA1PRNG")  // legacy, FIPS 비호환
```

함정 회피:
- `getInstanceStrong()` 은 컨테이너에서 hang 가능 → 일반 `SecureRandom()` 권장.
- `-Djava.security.egd=file:/dev/./urandom` 옵션은 옛 JVM 부트 hang 회피 trick (요즘 JVM 은 default 안전).

### 4-6. Crypto-agility — 데이터에 알고리즘 동봉

```kotlin
data class CryptoBlob(
    val version: Byte,                    // 1 byte
    val algId:   Byte,                    // 0x01 = AES-256-GCM, 0x02 = AES-256-GCM-SIV, 0x03 = ChaCha20-Poly1305, 0x04 = Kyber+AES-GCM (PQ hybrid)
    val keyId:   String,                  // KMS / JWKS kid
    val nonce:   ByteArray,
    val ct:      ByteArray,
    val aad:     ByteArray,
)

interface AeadCodec {
    fun seal(plaintext: ByteArray, aad: ByteArray): CryptoBlob
    fun open(blob: CryptoBlob): ByteArray
}

class CryptoRegistry(private val codecs: Map<Byte, AeadCodec>) {
    fun open(blob: CryptoBlob): ByteArray =
        (codecs[blob.algId] ?: error("unknown alg ${blob.algId}")).open(blob)
}
```

- 새 알고리즘 추가는 `algId` 1 byte 등록만.
- old 데이터는 자기 algId 로 계속 decrypt, 새 데이터만 새 algId 로 encrypt.
- 점진 마이그레이션: 읽기 시 old → 즉시 new 로 재암호화 (lazy migration).

---

## 5. 트레이드오프 / 안티패턴

### 5-1. AES-GCM nonce 를 random 으로 뽑고 키 회전 안 함

- birthday bound: 한 키로 ~2^48 메시지 후 nonce 충돌 확률 의미 있음 (NIST 권고는 2^32).
- 대안: counter nonce + 회전 정책, 또는 GCM-SIV.

### 5-2. AAD 에 핵심 컨텍스트 안 넣기

```
seal(K, N, A=null, P)  ❌
seal(K, N, A=tenant_id||version||resource_type, P)  ✅
```

- AAD 가 비어있으면 동일 (K, N) 로 만든 ciphertext 가 다른 컨텍스트로 재생 (replay) 될 수 있음.
- AAD 는 무결성만 체크 — 평문 노출 우려 없음.

### 5-3. KEK 를 직접 데이터 암호화에 쓰기

- KEK 는 KMS/HSM 안에서만 사용 + DEK 만 wrap. 직접 데이터 암호화하면 **KMS API 호출 폭증** + **memory 노출 면적 ↑**.
- envelope encryption 강제.

### 5-4. HKDF 의 salt / info 누락

```
HKDF.expand(prk, info=null, 32)  ❌  (context 분리 X)
HKDF.expand(prk, info="msa:gateway:jwt-hs256:v3", 32)  ✅
```

- info 없으면 같은 PRK 에서 같은 출력 → 용도 분리 실패.
- salt 는 high-entropy IKM 면 생략 가능, 그렇지 않으면 random 권장.

### 5-5. PBKDF2 대신 HKDF 를 password 에 쓰기

- HKDF 는 high-entropy 입력 가정 (extract 단계는 그저 HMAC 1번).
- password 는 low-entropy → **Argon2id / scrypt / bcrypt** 같은 password hashing 함수 필요.
- 패턴: `password --Argon2--> intermediate_key --HKDF--> 용도별 키`.

### 5-6. SecureRandom.setSeed 로 시드 고정

```
new SecureRandom().setSeed("test".getBytes())  ❌
```

- JVM 의 `setSeed` 는 supplement (entropy 추가) 지만 일부 provider (`SHA1PRNG`) 는 deterministic 으로 동작.
- 결정론 시드는 테스트 외 절대 금지.

### 5-7. 알고리즘 식별자를 ciphertext 에 안 넣기

- "지금 GCM 쓰니까 나중에도 GCM" — 5 년 뒤 ChaCha20 / PQ 로 가야 할 때 모든 데이터 알고리즘 추측 + 수동 마이그레이션.
- 1 byte 로 평생 비용 줄임.

### 5-8. fork / 멀티 프로세스에서 RNG 공유

- Python multiprocessing, 일부 Go child process — 부모의 PRNG 상태 그대로 복제 → 같은 출력.
- post-fork hook 으로 `os.urandom` 재시드.

### 5-9. timing-attack 가능한 tag 비교

```
if (computedTag == receivedTag) { ... }   ❌ (early-exit)
if (MessageDigest.isEqual(computedTag, receivedTag)) { ... }  ✅ (constant-time)
```

- AEAD 라이브러리는 내부에서 constant-time 비교를 보장 — 직접 구현하지 말 것.

### 5-10. 알고리즘 downgrade 미방어

- TLS 의 ciphersuite negotiation, JWT 의 alg 협상 — 공격자가 **약한 알고리즘으로 강제** 시도.
- 방어: 허용 목록 (allowlist) 강제, downgrade 감지 (예: TLS 1.3 의 finished MAC).

---

## 6. msa 적용

### 6-1. 현재 msa 의 대칭 암호 사용처 (조감)

| 위치 | 현재 | 함정 / 개선 |
|---|---|---|
| `gateway` JWT 서명 | `JwtUtil.kt` (HS256, secret 환경변수) | 키 회전 / kid 없음 → §22 와 결합 |
| Redis 캐시 / 세션 | TLS 만 적용, payload 평문 | tenant 정보 → AEAD 적용 후보 |
| Kafka 메시지 | TLS in transit, payload 평문 | PII (Personally Identifiable Information, 개인 식별 정보) 포함 시 envelope encryption 후보 |
| MySQL 컬럼 암호화 | (없음 / TDE 미사용) | KMS envelope encryption 후보 |
| 비밀 (DB 비번, KMS key id) | k8s Secret + SOPS | KMS 직접 + Vault transit 후보 |

### 6-2. gateway 의 JWT 서명 키 — HKDF + crypto-agility

현재 `gateway/.../JwtUtil.kt` 는 환경변수의 secret 를 그대로 HS256 키로 사용 추정 (§22 에서 상세). 개선:

```kotlin
// KMS 의 master_secret → HKDF 로 alg 별 키 파생
val masterSecret = secretsManager.get("msa.jwt.master")  // 64 bytes
val kHs256 = hkdf(masterSecret, salt, "msa:gateway:jwt-hs256:v3", 32)
val kHs512 = hkdf(masterSecret, salt, "msa:gateway:jwt-hs512:v3", 64)
```

회전: master_secret 회전 시 v3 → v4 + JWKS 에 두 kid 동시 게시 → 만료 후 v3 제거.

### 6-3. PII 컬럼 암호화 — envelope encryption (member 서비스)

`member` (미생성) 가 휴대폰 / 이메일 저장 시:

```kotlin
// 저장 시
val (dekWrapped, dekPlain) = kms.generateDataKey(memberKekId)
val cipher = aesGcmSeal(dekPlain, nonce, plaintext = email,
                       aad = "member:email:v1:${memberId}")
db.insert(memberId, dekWrapped, cipher.nonce, cipher.ct)
zeroOut(dekPlain)
```

- AAD 에 `column:version:memberId` 묶음 → 다른 컬럼 / 다른 회원의 ciphertext 와 swap 시도 차단.
- KEK 회전 → DEK_wrapped 만 KMS.ReEncrypt — 데이터 재암호화 불필요.

### 6-4. cache payload 암호화 — Redis (gateway / product)

`product` 의 캐시 payload 가 가격 / 재고 등을 담을 때 멀티테넌트 환경에선 cross-tenant 노출 위험. AES-GCM-SIV (Tink) + AAD = `tenant_id` 권장:

```kotlin
val handle = KeysetHandle.read(...)   // KMS-encrypted Tink keyset
val aead = handle.getPrimitive(Aead::class.java)
val blob = aead.encrypt(payload, "tenant=${tenantId}|cache=product".toByteArray())
redis.setex("product:$id", 60, blob)
```

Tink keyset 은 KMS envelope 로 자동 wrap → 키 회전 / 다중 알고리즘 자동 처리 (crypto-agility 내장).

### 6-5. nonce 관리 정책 (단일 키 한도)

| 사용처 | nonce 전략 | 회전 트리거 |
|---|---|---|
| JWT 서명 키 (HMAC) | nonce 없음 | 90 일 또는 사고 시 |
| 세션 쿠키 (AEAD) | counter (per-instance prefix + counter) | 2^48 메시지 또는 1년 |
| cache payload (Redis) | random 12 bytes (저빈도) | 1년 |
| PII column (DB) | random 12 bytes (low rate) | 5년 (KEK 만 회전) |

### 6-6. 알고리즘 레지스트리 (msa-common)

```kotlin
// common/src/main/kotlin/.../crypto/AeadRegistry.kt (제안)
enum class AeadAlg(val id: Byte) {
    AES_256_GCM(0x01),
    AES_256_GCM_SIV(0x02),
    CHACHA20_POLY1305(0x03),
    HYBRID_KYBER_AES_GCM(0x04),  // §24
}

interface AeadCodec { fun seal(...); fun open(...) }

@Component
class AeadRegistry(codecs: List<AeadCodec>) { ... }
```

→ 모든 서비스가 같은 인터페이스 사용. 알고리즘 추가는 등록만. 데이터에 algId 1 byte 동봉 → 5 년 뒤 마이그레이션 비용 ↓.

### 6-7. SecureRandom / RNG 위생

- 모든 서비스: `SecureRandom()` 만 사용 (`getInstanceStrong()` 금지 — 컨테이너 부팅 hang 위험).
- JVM args: `-Djava.security.egd=file:/dev/./urandom` (구버전 JVM 호환).
- Kafka producer client.id, request id, idempotency key 도 모두 CSPRNG.

---

## 7. ADR 후보

> **ADR-XXXX-13a: 대칭 암호 운영 표준 — AEAD + envelope encryption + crypto-agility**
>
> **Context**: msa 가 PII / 토큰 / 캐시 / Kafka payload 등 다양한 곳에서 대칭 암호를 사용하지만 (1) AEAD nonce 관리 표준 부재, (2) DEK/KEK 분리 미적용, (3) HKDF 표준 KDF 미사용 (자체 SHA256 (secret+salt) 패턴), (4) 알고리즘 식별자 동봉 부재로 향후 마이그레이션 비용 폭발 위험, (5) `SecureRandom.getInstanceStrong()` 사용처가 컨테이너 부팅 hang 유발 가능.
>
> **Decision**:
> 1. **AEAD 표준** — AES-256-GCM (counter nonce, AAD 필수) 또는 AES-256-GCM-SIV (Tink). nonce 12 bytes, tag 128 bits 명시.
> 2. **Envelope encryption** — KMS (AWS KMS / Vault Transit) 의 `GenerateDataKey` 로 DEK 발급, KEK 는 KMS 에서만 사용. 메모리 zero out 의무화.
> 3. **HKDF** — master key 는 1개, 용도별 키는 HKDF (RFC 5869) 로 파생. info = `msa:<service>:<purpose>:v<n>`.
> 4. **CSPRNG** — `SecureRandom()` 만 사용. `getInstanceStrong()` / `SHA1PRNG` 금지.
> 5. **Crypto-agility** — 1 byte algId 를 ciphertext 헤더에 동봉. `common` 모듈에 `AeadRegistry` 추상화.
> 6. **Tink 채택** (선택) — keyset 관리 / 회전 / KMS 통합을 자동화하고 싶은 도메인 (cache, session) 우선.
>
> **Consequences**:
> - (+) nonce 함정 회피, blast radius 축소, 알고리즘 마이그레이션 비용 평탄화.
> - (+) 검증된 라이브러리 (Tink, BouncyCastle) 사용 → 버그 면적 ↓.
> - (-) KMS API 호출 비용 증가 (DEK 발급 / decrypt 마다 호출). DEK 캐시 정책 별도 필요.
> - (-) 학습 곡선 (HKDF info 컨벤션, AAD 설계).
>
> **Alternatives 검토**:
> - 자체 KDF / nonce 구현 — 사고 위험 ↑ ❌
> - JCE 직접 + 라이브러리 추상화 없음 — crypto-agility 부재 ❌
> - 모든 도메인 Tink 강제 — 학습 비용 + 외부 의존 부담 큼 → 도메인별 선택

> **ADR-XXXX-13b: SecureRandom 사용 표준**
>
> **Decision**: 모든 JVM 서비스에서 `java.security.SecureRandom()` (default constructor) 만 허용. `getInstanceStrong()`, `SHA1PRNG`, `Math.random`, `java.util.Random`, `ThreadLocalRandom` 의 보안 컨텍스트 사용을 lint 로 차단. `Dockerfile` 에 `-Djava.security.egd=file:/dev/./urandom` 명시.
>
> **Consequences**: 컨테이너 부팅 hang 회피 + entropy 충분.

---

## 8. 면접 한 줄 답변

### Q. AES-GCM 의 nonce 를 재사용하면 어떤 일이 일어나나요?

> "같은 키 K 와 같은 nonce N 으로 두 메시지를 암호화하면 keystream 이 동일해서 두 평문의 XOR 차이가 그대로 누출되고, GHASH 의 인증 키 H 가 두 tag 의 차분에서 풀려나와 위조도 가능합니다. 즉 기밀성과 인증 키를 동시에 잃습니다. 그래서 GCM 은 nonce 유일성이 키와 동급으로 중요하고, 분산 환경에서 nonce 관리가 어려우면 AES-GCM-SIV (RFC 8452) 같은 misuse-resistant 변종을 쓰는 게 안전합니다."

### Q. AES-GCM 과 AES-GCM-SIV 의 차이는?

> "GCM 은 (K, nonce) 가 유일하다는 전제 위에서만 안전하고 nonce 가 한 번이라도 충돌하면 치명적입니다. GCM-SIV 는 SIV 구조 — nonce + plaintext + AAD 를 PRF 로 합성한 IV 를 쓰기 때문에 nonce 가 같아도 평문이 다르면 keystream 이 달라져서 misuse-resistant 합니다. 단점은 1-pass 가 아니라 약간 느리고 라이브러리 지원이 적다는 점입니다. 분산 / 멀티 인스턴스 / nonce 동기화 어려운 환경에선 GCM-SIV 권장입니다."

### Q. KMS envelope encryption 이 왜 필요한가요?

> "KEK 를 직접 데이터 암호화에 쓰면 (1) KMS API 호출이 메시지마다 발생해 비용 폭증, (2) KEK 가 메모리에 노출, (3) 키 회전 시 모든 데이터 재암호화. 그래서 KMS 가 발급한 DEK 로 데이터를 암호화하고 DEK 자체는 KEK 로 wrap 해서 함께 저장합니다. KEK 는 KMS/HSM 밖으로 나오지 않고, KEK 회전 시 ReEncrypt 로 DEK_wrapped 만 갱신하면 끝 — 데이터 재암호화 불필요. blast radius 도 한 메시지로 한정됩니다."

### Q. HKDF 가 SHA256 (key + info) 보다 나은 이유는?

> "HKDF 는 RFC 5869 표준이고 (1) extract 단계에서 입력의 entropy 를 안전하게 추출, (2) expand 단계에서 임의 길이의 키 자료를 생성, (3) info 파라미터로 컨텍스트 분리를 지원합니다. SHA256 (key + info) 는 길이 확장 공격 면역이 보장 안 되고 (HMAC 이 아니라 plain SHA256 이면), 출력 길이가 32 bytes 로 고정되며, 표준이 아니라 라이브러리 호환성도 떨어집니다. master key 에서 용도별 키를 파생할 때는 HKDF 가 표준입니다."

### Q. SecureRandom 과 Random 의 차이, getInstanceStrong 은 왜 위험한가요?

> "java.util.Random 은 LCG 기반 PRNG 라 출력에서 시드 역산이 쉽고 암호용으로 쓰면 안 됩니다. SecureRandom 은 NativePRNG 로 떨어져 OS 의 /dev/urandom 을 쓰는 CSPRNG 입니다. getInstanceStrong() 은 /dev/random 으로 떨어져서 entropy pool 이 부족하면 block 되는데, 컨테이너 / VM 부팅 직후엔 entropy 가 부족해서 수 초 ~ 수십 초 hang 되는 사고가 흔합니다. 그래서 production 에선 default SecureRandom() 만 쓰고, 부팅 시 -Djava.security.egd=file:/dev/./urandom 을 명시하는 게 표준 패턴입니다."

### Q. crypto-agility 는 무엇이고 왜 중요한가요?

> "알고리즘은 언젠가 깨집니다 — MD5, SHA-1, 3DES 가 그랬고 양자컴퓨터 등장 후 RSA / ECC 도 같은 길을 갈 겁니다. 알고리즘 식별자를 ciphertext / token 에 함께 동봉하고 (1 byte 면 충분), 추상화 인터페이스로 구현을 swap 가능하게 만들고, old 와 new 알고리즘을 동시에 지원하는 마이그레이션 기간을 둬서 점진 전환하는 설계 원칙입니다. JWT 의 alg, JOSE 의 kid, KMS 의 ciphertext blob 이 모두 이 패턴을 따릅니다."

### Q. AAD (Associated Data) 는 무엇이고 어떤 컨텍스트를 묶어야 하나요?

> "AAD 는 AEAD 가 인증은 하지만 암호화는 하지 않는 부가 데이터입니다. 평문은 노출되지만 무결성은 보장됩니다. 핵심은 컨텍스트 바인딩 — tenant_id, version, resource_type 같은 식별자를 AAD 에 묶어서 (K, nonce) 가 같은 ciphertext 가 다른 컨텍스트로 재생되는 것을 차단합니다. 예를 들어 회원 A 의 이메일 ciphertext 를 회원 B 로 swap 하려는 시도는 AAD = `member:email:${memberId}` 가 다르기 때문에 복호화가 실패합니다."

---

## 9. 흔한 오해 정정

> **"AES-GCM 은 안전한 알고리즘이니 nonce 관리는 그렇게 신경 안 써도 된다"**

- ❌ GCM 의 안전성은 "nonce 유일" 이라는 강한 전제 위에 있다. 한 번이라도 재사용되면 키 노출 수준의 사고. 분산에서 nonce 관리가 어려우면 GCM-SIV.

> **"random nonce 면 무한히 안전하다"**

- ❌ birthday bound 로 ~2^48 메시지 후 충돌 확률 의미 있음 (NIST 권고 2^32 이하). 한 키당 메시지 수 한도 + 회전 정책 필요.

> **"HKDF 를 password 에서 키 파생할 때 써도 된다"**

- ❌ HKDF 는 high-entropy 입력을 가정. password 는 low-entropy → Argon2id / scrypt / bcrypt 같은 password hash 가 먼저. 그 결과를 IKM 으로 HKDF 가 가능.

> **"KEK 와 DEK 는 둘 다 KMS 가 관리해야 한다"**

- ❌ KEK 만 KMS 에서 관리, DEK 는 KMS 가 발급하지만 application 메모리에서 사용 후 즉시 zero out. KMS 가 DEK 를 보관하면 envelope 의 의미가 없어짐.

> **"SecureRandom.getInstanceStrong() 이 더 안전하니 production 에서 써야 한다"**

- ❌ 부팅 시 entropy 부족으로 hang 가능. 일반 `SecureRandom()` 가 production 권장. "strong" 은 이름과 달리 운영상 위험.

> **"알고리즘 식별자는 한 번 정해지면 바뀔 일 없다"**

- ❌ MD5 → SHA-1 → SHA-2 의 역사가 증명. 양자컴퓨터 → PQC 전환이 향후 5~10 년 안에 시작. crypto-agility 는 선택이 아니라 의무.

> **"AEAD 는 AAD 가 비어있어도 안전하다"**

- ⚠ 기밀성/무결성은 보장되지만 **컨텍스트 바인딩** 이 빠지면 cross-context 재생 공격 가능. AAD 에 식별자 묶기는 필수 위생.

> **"Tink 같은 추상 라이브러리는 무겁다, JCA 직접이 낫다"**

- ⚠ JCA 직접은 nonce / tag 길이 / KDF / 회전을 다 직접 관리. Tink / BouncyCastle 의 high-level API 가 함정 회피 측면에서 거의 항상 더 안전.

> **"AES-NI 가 있으면 GCM 이 ChaCha20 보다 항상 빠르다"**

- ⚠ 서버급 CPU (AES-NI + CLMUL) 에선 GCM 이 빠르지만, 모바일 / ARM (구형) / SIMD 부재 환경에선 ChaCha20-Poly1305 가 빠름. TLS 1.3 의 두 알고리즘 병기 이유.

---

## 10. 회독 체크리스트

> §21 회독 체크리스트:
> - [ ] AEAD 의 4 입력 (K, N, A, P) 과 보장 (기밀 / 무결 / AAD 인증 / nonce 유일 전제)
> - [ ] GCM nonce 재사용의 두 결과 (keystream XOR 누출 + 인증 키 H 노출)
> - [ ] nonce 생성 4 전략 (counter / random / hybrid / SIV) 의 trade-off
> - [ ] AES-GCM-SIV (RFC 8452) 의 SIV 구조 + 1-pass 불가 + 라이브러리 지원 (Tink) 차이
> - [ ] Key Wrap (RFC 3394 / 5649) 의 결정론 + integrity 내장 + nonce 불필요 특성
> - [ ] envelope encryption 4 단계 (DEK 발급 / 데이터 암호화 / 메타 저장 / DEK zero out)
> - [ ] HKDF 의 extract + expand 두 단계와 각 입력 (IKM / salt / info / L)
> - [ ] HKDF info 표준 형식 — `msa:<service>:<purpose>:v<n>`
> - [ ] HKDF 가 password 에 부적합한 이유 (high-entropy 입력 가정)
> - [ ] CSPRNG vs PRNG vs DRBG vs TRNG 정의
> - [ ] JVM SecureRandom 함정 (`getInstanceStrong()` hang, `SHA1PRNG` legacy)
> - [ ] crypto-agility 4 원칙 (algId 동봉 / 추상 인터페이스 / 동시 지원 / 마이그레이션 runbook)
> - [ ] AAD 에 묶어야 할 컨텍스트 (tenant / version / resource_type)
> - [ ] timing-attack 방어 (`MessageDigest.isEqual` 또는 라이브러리 위임)
> - [ ] msa 적용 위치 (gateway JWT / Redis cache / PII column / Kafka payload)

---

## 11. 연결 학습

- §02 AES modes — ECB / CBC / CTR / GCM / CCM / SIV 비교 (이 파일은 GCM nonce 함정 + SIV 변종 심화)
- §06 HMAC — HKDF 의 내부 구성 요소 (이 파일은 KDF 패턴)
- §13 AWS KMS — envelope encryption 실무 (이 파일은 DEK/KEK 분리 표준)
- §15 HSM — KEK 가 살아있는 보호 경계 (이 파일은 KEK/DEK 추상)
- §22 JWT 함정 (다음 파일) — alg=none, key confusion 등 JWT 운영 함정
- §23 mTLS / cert rotation (다음 파일) — service identity 회전과 동일한 crypto-agility 원리
- §24 Post-Quantum (다음 파일) — crypto-agility 의 가장 큰 시험대
