package com.kgd.codedictionary.domain.display

import com.kgd.codedictionary.domain.display.model.DisplayService
import com.kgd.codedictionary.domain.display.model.DisplayStatus
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class DisplayServiceTest : BehaviorSpec({

    fun service(
        code: String = "place",
        label: String = "한국 관광 검색",
        href: String? = "/place",
        status: DisplayStatus = DisplayStatus.OPEN,
    ) = DisplayService(
        id = null,
        code = code,
        label = label,
        tagline = null,
        href = href,
        status = status,
        orderNo = 10,
    )

    given("전시 서비스를 만들 때") {

        `when`("코드가 소문자-하이픈 형식이 아니면") {
            then("거부한다") {
                shouldThrow<BusinessException> { service(code = "Place") }
                shouldThrow<BusinessException> { service(code = "place_1") }
                shouldThrow<BusinessException> { service(code = "-place") }
            }
        }

        `when`("이름이 비어 있으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { service(label = "  ") }
            }
        }

        `when`("OPEN 인데 href 가 없으면") {
            then("거부한다 — 눌러도 아무 일이 없는 진입점이 된다") {
                shouldThrow<BusinessException> { service(href = null) }
                shouldThrow<BusinessException> { service(href = "") }
            }
        }

        `when`("오픈 예정이라 href 가 없으면") {
            then("허용한다 — 아직 갈 곳이 없는 게 정상이다") {
                service(status = DisplayStatus.PREOPEN, href = null).status shouldBe DisplayStatus.PREOPEN
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
