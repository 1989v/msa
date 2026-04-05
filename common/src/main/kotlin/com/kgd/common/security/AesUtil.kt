package com.kgd.common.security

import org.springframework.beans.factory.annotation.Value
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class AesUtil(
    private val aesKey: String
) {
    companion object {
        private const val ALGORITHM = "AES/GCM/NoPadding"
        private const val GCM_IV_LENGTH = 12
        private const val GCM_TAG_LENGTH = 128
        private const val KEY_SIZE = 32 // 256-bit
    }

    private val secretKey: SecretKeySpec by lazy {
        val keyBytes = aesKey.toByteArray(Charsets.UTF_8)
        require(keyBytes.size >= KEY_SIZE) {
            "AES key must be at least $KEY_SIZE bytes (got ${keyBytes.size}). Configure 'encryption.aes-key' with a 32-byte key."
        }
        SecretKeySpec(keyBytes.copyOf(KEY_SIZE), "AES")
    }

    fun encrypt(plainText: String): String {
        val iv = ByteArray(GCM_IV_LENGTH).also { SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance(ALGORITHM).apply {
            init(Cipher.ENCRYPT_MODE, secretKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        }
        val encrypted = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        return Base64.getEncoder().encodeToString(iv + encrypted)
    }

    fun decrypt(encryptedText: String): String {
        val decoded = Base64.getDecoder().decode(encryptedText)
        val iv = decoded.copyOf(GCM_IV_LENGTH)
        val cipherText = decoded.copyOfRange(GCM_IV_LENGTH, decoded.size)
        val cipher = Cipher.getInstance(ALGORITHM).apply {
            init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))
        }
        return String(cipher.doFinal(cipherText), Charsets.UTF_8)
    }
}
