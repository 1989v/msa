package com.kgd.common.security

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class AesUtilTest : BehaviorSpec({

    // AesUtil은 @Value를 직접 주입하므로 직접 설정 필요
    val aesUtil = AesUtil("test-aes-key-32bytes-exactly!!!!")

    given("암호화 시") {
        `when`("평문 문자열이 주어지면") {
            then("암호화된 문자열이 반환되어야 한다") {
                val plainText = "Hello, World!"
                val encrypted = aesUtil.encrypt(plainText)
                encrypted shouldNotBe plainText
                encrypted shouldNotBe ""
            }
        }
        `when`("동일한 평문을 두 번 암호화하면") {
            then("IV가 달라 서로 다른 암호문이 생성되어야 한다") {
                val plainText = "same-text"
                val encrypted1 = aesUtil.encrypt(plainText)
                val encrypted2 = aesUtil.encrypt(plainText)
                encrypted1 shouldNotBe encrypted2
            }
        }
    }

    given("복호화 시") {
        `when`("암호화된 문자열을 복호화하면") {
            then("원본 평문이 반환되어야 한다") {
                val plainText = "테스트 평문 데이터"
                val encrypted = aesUtil.encrypt(plainText)
                val decrypted = aesUtil.decrypt(encrypted)
                decrypted shouldBe plainText
            }
        }
        `when`("특수문자와 한글이 포함된 평문이면") {
            then("복호화 후 동일한 문자열이 반환되어야 한다") {
                val plainText = "Hello! 안녕하세요 #$%@"
                val decrypted = aesUtil.decrypt(aesUtil.encrypt(plainText))
                decrypted shouldBe plainText
            }
        }
    }
})
