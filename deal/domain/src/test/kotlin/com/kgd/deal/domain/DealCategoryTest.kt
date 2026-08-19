package com.kgd.deal.domain

import com.kgd.common.exception.BusinessException
import com.kgd.deal.domain.model.DealCategory
import com.kgd.deal.domain.model.DisplayStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class DealCategoryTest : BehaviorSpec({

    fun category(
        code: String = "travel",
        label: String = "여행",
        status: DisplayStatus = DisplayStatus.OPEN,
    ) = DealCategory(
        id = null,
        code = code,
        label = label,
        tagline = null,
        status = status,
        orderNo = 10,
    )

    given("카테고리를 만들 때") {

        `when`("코드가 소문자-하이픈 형식이 아니면") {
            then("거부한다") {
                shouldThrow<BusinessException> { category(code = "Travel") }
                shouldThrow<BusinessException> { category(code = "travel_1") }
                shouldThrow<BusinessException> { category(code = "-travel") }
            }
        }

        `when`("이름이 비어 있으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { category(label = "  ") }
            }
        }
    }

    given("전시 여부를 판정할 때") {
        then("HOLD 만 전시에서 빠진다") {
            DisplayStatus.OPEN.displayed shouldBe true
            DisplayStatus.PREOPEN.displayed shouldBe true
            DisplayStatus.HOLD.displayed shouldBe false
        }
    }
})
