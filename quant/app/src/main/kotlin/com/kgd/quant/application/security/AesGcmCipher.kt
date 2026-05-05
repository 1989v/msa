package com.kgd.quant.application.security

import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * AesGcmCipher — AES-256-GCM 단순 wrapper (TG-P3-09).
 *
 * 출력 형식: IV(12B) || ciphertext+tag(16B 부착).
 *
 * AES-GCM 표준 — random IV, 인증 태그 16 bytes, AAD 없음 (필요 시 변경).
 * 키는 32 bytes (256-bit) — KMS 가 wrap/unwrap 한 DEK 를 그대로 사용.
 */
internal object AesGcmCipher {

    private const val ALGO = "AES/GCM/NoPadding"
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128

    private val random = SecureRandom()

    fun encrypt(plaintext: ByteArray, key: ByteArray): ByteArray {
        require(key.size == 32) { "AES-256 key must be 32 bytes (got ${key.size})" }
        val iv = ByteArray(IV_BYTES).also(random::nextBytes)
        val cipher = Cipher.getInstance(ALGO).apply {
            init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, iv))
        }
        val ct = cipher.doFinal(plaintext)
        return iv + ct
    }

    fun decrypt(blob: ByteArray, key: ByteArray): ByteArray {
        require(key.size == 32) { "AES-256 key must be 32 bytes (got ${key.size})" }
        require(blob.size > IV_BYTES + (TAG_BITS / 8)) {
            "blob too small (${blob.size}) — must contain IV(12) + ciphertext + tag(16)"
        }
        val iv = blob.copyOfRange(0, IV_BYTES)
        val ct = blob.copyOfRange(IV_BYTES, blob.size)
        val cipher = Cipher.getInstance(ALGO).apply {
            init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, iv))
        }
        return cipher.doFinal(ct)
    }
}
