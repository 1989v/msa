package com.kgd.seller.infrastructure.crypto

import com.kgd.seller.domain.seller.model.AccountNumber
import com.kgd.seller.domain.seller.model.EncryptedAccount
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.assertions.throwables.shouldThrowAny
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldNotContain
import java.util.Base64

class AesGcmAccountCipherTest : BehaviorSpec({
    val keyHex = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"
    val cipher = AesGcmAccountCipher(keyHex, keyVersion = 1)
    val account = AccountNumber.of("110-123-456789")

    given("계좌 암호화") {
        then("복호화하면 원래 번호, 암호문에는 평문이 없다, 키 버전이 남는다") {
            val sealed = cipher.encrypt(account)
            sealed.keyVersion shouldBe 1
            sealed.cipherText shouldNotContain "110123456789"
            cipher.decrypt(sealed).value shouldBe "110123456789"
        }
        then("같은 번호도 매번 다른 암호문 (IV 무작위)") {
            cipher.encrypt(account).cipherText shouldNotBe cipher.encrypt(account).cipherText
        }
        then("다른 키로는 풀리지 않는다") {
            val other = AesGcmAccountCipher("ff".repeat(32), keyVersion = 1)
            shouldThrowAny { other.decrypt(cipher.encrypt(account)) }
        }
        then("암호문이 한 바이트라도 바뀌면 거부 (GCM 인증 태그)") {
            val sealed = cipher.encrypt(account)
            val bytes = Base64.getDecoder().decode(sealed.cipherText)
            bytes[bytes.size - 1] = (bytes[bytes.size - 1].toInt() xor 1).toByte()
            shouldThrowAny { cipher.decrypt(EncryptedAccount(Base64.getEncoder().encodeToString(bytes), 1)) }
        }
        then("현재 키 버전이 아닌 행은 풀지 않는다 — 조용히 다른 키로 시도하지 않는다") {
            val sealed = cipher.encrypt(account)
            shouldThrow<IllegalStateException> { cipher.decrypt(sealed.copy(keyVersion = 2)) }
        }
    }

    given("키 설정") {
        then("비었거나 32바이트 hex 가 아니면 생성 단계에서 실패 — commerce 가 기동하지 않는다") {
            shouldThrow<IllegalStateException> { AesGcmAccountCipher("", 1) }
            shouldThrow<IllegalStateException> { AesGcmAccountCipher("abcd", 1) }
            shouldThrow<IllegalStateException> { AesGcmAccountCipher("zz".repeat(32), 1) }
        }
    }
})
