package com.kgd.game.infrastructure.persistence.play

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain

class SaveCipherTest : BehaviorSpec({

    val key = "test-aes-key-32bytes-exactly!!!!"
    val cipher = SaveCipher(key)

    Given("세이브 본문을 저장할 때") {
        val plain = """{"medals":42,"up":{"hp":3,"dmg":1},"best":12}"""

        When("암호화하면") {
            val stored = cipher.encrypt(plain)

            Then("봉투 형태라 JSON 컬럼에 그대로 담긴다") {
                stored shouldContain "\"v\":1"
                stored shouldContain "\"c\":"
            }

            Then("본문이 저장소에 드러나지 않는다") {
                stored shouldNotContain "medals"
                stored shouldNotContain "42"
            }

            Then("복호화하면 원본과 같다") {
                cipher.decrypt(stored) shouldBe plain
            }
        }

        When("같은 본문을 두 번 암호화하면") {
            Then("암호문이 서로 다르다 — IV 가 매번 새로 붙는다") {
                (cipher.encrypt(plain) == cipher.encrypt(plain)) shouldBe false
            }
        }
    }

    Given("암호화 이전에 저장된 평문 행") {
        val legacy = """{"medals":7,"up":{}}"""

        When("읽으면") {
            Then("봉투가 없으므로 그대로 돌려준다 — 일괄 변환 없이 호환된다") {
                cipher.decrypt(legacy) shouldBe legacy
            }
        }
    }

    Given("키가 바뀌어 복호화할 수 없을 때") {
        val stored = cipher.encrypt("""{"medals":1}""")
        val other = SaveCipher("another-key-32bytes-exactly!!!!!")

        When("다른 키로 읽으면") {
            Then("예외로 기동을 막지 않고 빈 값을 준다 — 게임은 새 세이브로 시작한다") {
                other.decrypt(stored) shouldBe ""
            }
        }
    }
})
