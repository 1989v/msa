package com.kgd.seller.infrastructure.crypto

import com.kgd.seller.application.seller.port.AccountCipherPort
import com.kgd.seller.domain.seller.model.AccountNumber
import com.kgd.seller.domain.seller.model.EncryptedAccount
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.security.SecureRandom
import java.util.Base64
import java.util.HexFormat
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * 정산 계좌 AES-256-GCM. 저장 형식은 base64(IV 12바이트 ‖ 암호문+태그), 키 버전은 별도 컬럼.
 *
 * 키(`SELLER_ACCOUNT_ENC_KEY`, hex 64자)는 설정 파일에 기본값이 없다 — 없으면 플레이스홀더 해석에서,
 * 형식이 틀리면 이 생성자에서 실패해 commerce 가 기동하지 않는다. 평문 저장으로 되돌아가는 길을
 * 두지 않는다. 키를 잃으면 저장된 계좌를 다시 풀 수 없으므로 `AUTH_SUBJECT_HASH_KEY` 와 같은 백업 대상이다.
 */
@Component
class AesGcmAccountCipher(
    @Value("\${seller.account.enc-key}") keyHex: String,
    @Value("\${seller.account.key-version:1}") private val keyVersion: Int,
) : AccountCipherPort {

    private val key: SecretKeySpec = SecretKeySpec(parseKey(keyHex), "AES")
    private val random = SecureRandom()

    override fun encrypt(accountNumber: AccountNumber): EncryptedAccount {
        val iv = ByteArray(IV_BYTES).also(random::nextBytes)
        val sealed = cipher(Cipher.ENCRYPT_MODE, iv).doFinal(accountNumber.value.toByteArray(Charsets.UTF_8))
        return EncryptedAccount(Base64.getEncoder().encodeToString(iv + sealed), keyVersion)
    }

    override fun decrypt(encrypted: EncryptedAccount): AccountNumber {
        check(encrypted.keyVersion == keyVersion) {
            "계좌 키 버전 불일치: 행=${encrypted.keyVersion}, 현재=$keyVersion — 키 교체 절차(seller/CLAUDE.md)를 따를 것"
        }
        val bytes = Base64.getDecoder().decode(encrypted.cipherText)
        val plain = cipher(Cipher.DECRYPT_MODE, bytes.copyOfRange(0, IV_BYTES))
            .doFinal(bytes, IV_BYTES, bytes.size - IV_BYTES)
        return AccountNumber.of(String(plain, Charsets.UTF_8))
    }

    private fun cipher(mode: Int, iv: ByteArray): Cipher = Cipher.getInstance(TRANSFORMATION).apply {
        init(mode, key, GCMParameterSpec(TAG_BITS, iv))
        // 키 버전을 인증 데이터로 묶어 버전 컬럼만 바꿔치기한 행이 풀리지 않게 한다
        updateAAD("seller-account:v$keyVersion".toByteArray(Charsets.UTF_8))
    }

    private companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
        const val TAG_BITS = 128
        const val KEY_BYTES = 32

        fun parseKey(hex: String): ByteArray {
            val bytes = runCatching { HexFormat.of().parseHex(hex.trim()) }.getOrNull()
            check(bytes != null && bytes.size == KEY_BYTES) {
                "SELLER_ACCOUNT_ENC_KEY 는 32바이트 hex(64자)여야 한다 — openssl rand -hex 32"
            }
            return bytes
        }
    }
}
