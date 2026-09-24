package com.kgd.seller.domain.seller.model

import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain

class AccountNumberTest : BehaviorSpec({
    given("계좌번호") {
        then("구분자를 걷어 숫자만 남긴다") {
            AccountNumber.of("110-123-456789").value shouldBe "110123456789"
        }
        then("표시값은 끝 4자리만 드러낸다") {
            val masked = AccountNumber.of("110-123-456789").masked()
            masked shouldBe "********6789"
            masked shouldNotContain "110123"
        }
        then("숫자 6~20자리가 아니면 거부") {
            shouldThrow<BusinessException> { AccountNumber.of("12345") }
            shouldThrow<BusinessException> { AccountNumber.of("1".repeat(21)) }
            shouldThrow<BusinessException> { AccountNumber.of("abc-defg-hij") }
        }
    }
})
