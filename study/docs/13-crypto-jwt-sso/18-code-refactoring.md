---
parent: 13-crypto-jwt-sso
seq: 18
title: 코드 리팩터링 실습 (KmsEnvelope / RotatableJwt / RefreshRotation)
type: deep
created: 2026-04-28
---

# 18. 코드 리팩터링 실습

> 이 파일은 학습한 내용을 실제 코드로 옮기는 실습. 각 클래스를 직접 IDE에 옮겨 작성하면 Phase 1~5 학습이 신체화된다.

## 18.1 `AesUtil` — KMS Envelope Encryption 모드 추가

**목표**: 기존 단순 AES (Advanced Encryption Standard, 고급 암호화 표준) 모드는 유지하면서, KMS (Key Management Service, 키 관리 서비스) 모드를 옵트인으로 추가.

```kotlin
package com.kgd.common.security

import software.amazon.awssdk.services.kms.KmsClient
import software.amazon.awssdk.services.kms.model.DataKeySpec
import software.amazon.awssdk.services.kms.model.DecryptRequest
import software.amazon.awssdk.services.kms.model.GenerateDataKeyRequest
import software.amazon.awssdk.core.SdkBytes
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import java.security.SecureRandom
import java.util.Base64

/**
 * Envelope Encryption 모드 AES.
 * - DEK는 KMS GenerateDataKey로 발급 + 암호화된 DEK를 ciphertext와 함께 저장
 * - Master Key(KEK)는 KMS 밖으로 절대 안 나옴
 *
 * Storage layout (Base64):
 *   [4B: encryptedDekLen][N: encryptedDek][12B: iv][M: ciphertext+tag]
 */
class KmsEnvelopeAesUtil(
    private val kmsClient: KmsClient,
    private val kmsKeyId: String,
) {
    companion object {
        private const val ALGORITHM = "AES/GCM/NoPadding"
        private const val GCM_IV_LEN = 12
        private const val GCM_TAG_BITS = 128
        private val secureRandom = SecureRandom()
    }

    fun encrypt(plainText: String, aad: ByteArray? = null): String {
        val dataKey = kmsClient.generateDataKey(
            GenerateDataKeyRequest.builder()
                .keyId(kmsKeyId)
                .keySpec(DataKeySpec.AES_256)
                .build()
        )
        val plaintextDek = dataKey.plaintext().asByteArray()
        val encryptedDek = dataKey.ciphertextBlob().asByteArray()

        try {
            val iv = ByteArray(GCM_IV_LEN).also { secureRandom.nextBytes(it) }
            val cipher = Cipher.getInstance(ALGORITHM).apply {
                init(Cipher.ENCRYPT_MODE,
                    SecretKeySpec(plaintextDek, "AES"),
                    GCMParameterSpec(GCM_TAG_BITS, iv))
                aad?.let { updateAAD(it) }
            }
            val ct = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
            val payload = pack(encryptedDek, iv, ct)
            return Base64.getEncoder().encodeToString(payload)
        } finally {
            // plaintext DEK 즉시 제거
            plaintextDek.fill(0)
        }
    }

    fun decrypt(encoded: String, aad: ByteArray? = null): String {
        val payload = Base64.getDecoder().decode(encoded)
        val (encryptedDek, iv, ct) = unpack(payload)

        val plaintextDek = kmsClient.decrypt(
            DecryptRequest.builder()
                .ciphertextBlob(SdkBytes.fromByteArray(encryptedDek))
                .build()
        ).plaintext().asByteArray()

        try {
            val cipher = Cipher.getInstance(ALGORITHM).apply {
                init(Cipher.DECRYPT_MODE,
                    SecretKeySpec(plaintextDek, "AES"),
                    GCMParameterSpec(GCM_TAG_BITS, iv))
                aad?.let { updateAAD(it) }
            }
            return String(cipher.doFinal(ct), Charsets.UTF_8)
        } finally {
            plaintextDek.fill(0)
        }
    }

    private fun pack(encDek: ByteArray, iv: ByteArray, ct: ByteArray): ByteArray {
        val out = ByteArray(4 + encDek.size + iv.size + ct.size)
        val len = encDek.size
        out[0] = (len ushr 24).toByte()
        out[1] = (len ushr 16).toByte()
        out[2] = (len ushr 8).toByte()
        out[3] = len.toByte()
        System.arraycopy(encDek, 0, out, 4, encDek.size)
        System.arraycopy(iv, 0, out, 4 + encDek.size, iv.size)
        System.arraycopy(ct, 0, out, 4 + encDek.size + iv.size, ct.size)
        return out
    }

    private fun unpack(payload: ByteArray): Triple<ByteArray, ByteArray, ByteArray> {
        val len = ((payload[0].toInt() and 0xFF) shl 24) or
                  ((payload[1].toInt() and 0xFF) shl 16) or
                  ((payload[2].toInt() and 0xFF) shl 8) or
                  (payload[3].toInt() and 0xFF)
        val encDek = payload.copyOfRange(4, 4 + len)
        val iv = payload.copyOfRange(4 + len, 4 + len + GCM_IV_LEN)
        val ct = payload.copyOfRange(4 + len + GCM_IV_LEN, payload.size)
        return Triple(encDek, iv, ct)
    }
}
```

### 핵심 포인트
- DEK 캐싱은 일부러 생략 (운영 시 `aws-encryption-sdk` 사용 권장 — 캐싱 + 암호 자료 검증 내장)
- `aad`로 컨텍스트 바인딩 (예: 사용자 ID를 AAD에 넣어 ciphertext의 다른 사용자 도용 방지)
- 평문 DEK 사용 직후 0으로 fill — JVM이 GC하기 전 메모리 덤프 방어

---

## 18.2 `JwtUtil` — `kid` 헤더 + 키 회전 지원

```kotlin
package com.kgd.common.security

import io.jsonwebtoken.Jwts
import io.jsonwebtoken.JwsHeader
import io.jsonwebtoken.LocatorAdapter
import javax.crypto.SecretKey
import java.util.Date

class RotatableJwtUtil(
    private val activeKeyId: String,
    private val keys: Map<String, SecretKey>,  // kid → key
    private val issuer: String,
    private val audience: String,
    private val accessExpirySec: Long,
    private val refreshExpirySec: Long,
) {
    init {
        require(keys.containsKey(activeKeyId)) { "Active kid not found in keys" }
    }

    fun generateAccessToken(userId: String, roles: List<String>): String =
        Jwts.builder()
            .header().keyId(activeKeyId).and()
            .issuer(issuer)
            .audience().add(audience).and()
            .subject(userId)
            .id(java.util.UUID.randomUUID().toString())  // jti
            .claim("roles", roles)
            .claim("type", "access")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + accessExpirySec * 1000))
            .signWith(keys[activeKeyId])
            .compact()

    fun parse(token: String): io.jsonwebtoken.Claims =
        Jwts.parser()
            .keyLocator(object : LocatorAdapter<SecretKey>() {
                override fun locate(header: JwsHeader): SecretKey {
                    val kid = header.keyId ?: error("kid required")
                    return keys[kid] ?: error("Unknown kid: $kid")
                }
            })
            .requireIssuer(issuer)
            .requireAudience(audience)
            .build()
            .parseSignedClaims(token)
            .payload
}
```

### 핵심 포인트
- `kid` 헤더 필수 → 검증자가 어떤 키로 만들었는지 알아 매핑
- 새 키 도입: `keys` 맵에 새 kid 추가 → activeKeyId 갱신. **옛 토큰은 여전히 옛 kid로 검증 가능** (자연스러운 회전)
- 옛 키 폐기: 만료 + grace period 후 맵에서 제거
- `iss`, `aud`, `jti` 표준화 → audience binding + reuse detection 기반

---

## 18.3 Refresh Token Rotation (의사코드)

```kotlin
class RefreshRotationService(
    private val jwtUtil: RotatableJwtUtil,
    private val redis: ReactiveRedisTemplate<String, String>,
) {
    suspend fun rotate(oldRefreshToken: String): TokenPair {
        val claims = jwtUtil.parse(oldRefreshToken)
        val userId = claims.subject
        val oldJti = claims.id

        // 1. 사용된 jti가 이미 사용된 적 있는가?
        val usedKey = "refresh:used:$oldJti"
        val wasUsed = redis.opsForValue().setIfAbsent(usedKey, "1", Duration.ofDays(8))
            .awaitSingle()
        if (wasUsed == false) {
            // reuse detected — 모든 세션 강제 종료
            redis.delete(redis.keys("refresh:active:$userId:*").asFlow().toList())
                .awaitSingle()
            throw SecurityException("Refresh token reuse detected for user $userId")
        }

        // 2. 활성 jti 검증
        val activeKey = "refresh:active:$userId:$oldJti"
        val active = redis.opsForValue().get(activeKey).awaitSingleOrNull()
            ?: throw SecurityException("Refresh token not active")

        // 3. 새 토큰 발급
        val newAccess = jwtUtil.generateAccessToken(userId, /* roles */ listOf())
        val newRefresh = jwtUtil.generateRefreshToken(userId)
        val newJti = jwtUtil.parse(newRefresh).id

        // 4. 옛 active 제거 + 새 active 등록
        redis.delete(activeKey).awaitSingle()
        redis.opsForValue().set("refresh:active:$userId:$newJti", "1", Duration.ofDays(7))
            .awaitSingle()

        return TokenPair(newAccess, newRefresh)
    }
}
```

### 핵심
- `setIfAbsent`로 jti 단일 사용 보장 — 두 번째 호출은 false 반환
- reuse 감지 시 **그 사용자의 모든 활성 세션 종료** (공격자/피해자 어느 쪽이 진짜인지 알 수 없으니 안전한 쪽)
- TTL은 refresh 만료보다 약간 길게 (clock skew 고려)

---

## 학습 효과

이 3개 클래스를 직접 작성하면 다음이 신체화된다:
- AES-GCM + IV + AAD + KMS Envelope (Phase 1, 4)
- JWT kid 헤더 + 표준 클레임 (Phase 2)
- Refresh Rotation + reuse detection (Phase 2)

운영 적용은 [19-improvements.md](19-improvements.md)의 우선순위 표 참조.
