package com.kgd.ads.domain.token.model

import java.security.MessageDigest

/**
 * 토큰 서명 키. [id] 는 키 바이트의 SHA-256 앞 4바이트(hex)라 설정 없이 현재·이전 키를 가른다.
 */
class SigningKey private constructor(private val bytes: ByteArray) {
    val id: String = MessageDigest.getInstance("SHA-256").digest(bytes)
        .take(ID_BYTES).joinToString("") { "%02x".format(it) }

    fun bytes(): ByteArray = bytes.copyOf()

    override fun toString(): String = "SigningKey(id=$id)"

    companion object {
        const val MIN_KEY_BYTES = 32
        private const val ID_BYTES = 4

        fun of(bytes: ByteArray): SigningKey {
            require(bytes.size >= MIN_KEY_BYTES) { "서명 키는 ${MIN_KEY_BYTES}바이트 이상이어야 합니다" }
            return SigningKey(bytes.copyOf())
        }
    }
}
