package com.kgd.codedictionary.domain.display

import com.kgd.codedictionary.domain.display.model.DisplayOpenSource
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class DisplayOpenSourceTest : BehaviorSpec({

    fun item(
        slug: String = "muxbar",
        name: String = "muxbar",
        repoUrl: String = "https://github.com/1989v/muxbar",
        active: Boolean = true,
    ) = DisplayOpenSource(
        id = null,
        slug = slug,
        name = name,
        tagline = "macOS 메뉴바 tmux 세션 관리",
        description = null,
        repoUrl = repoUrl,
        language = "Swift",
        orderNo = 10,
        active = active,
    )

    given("전시 오픈소스를 만들 때") {

        `when`("슬러그가 소문자-하이픈 형식이 아니면") {
            then("거부한다") {
                shouldThrow<BusinessException> { item(slug = "Muxbar") }
                shouldThrow<BusinessException> { item(slug = "mux_bar") }
                shouldThrow<BusinessException> { item(slug = "-muxbar") }
            }
        }

        `when`("이름이 비어 있으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { item(name = "  ") }
            }
        }

        `when`("저장소 주소가 https 가 아니면") {
            then("거부한다 — 카드 전체가 저장소로 가는 링크다") {
                shouldThrow<BusinessException> { item(repoUrl = "") }
                shouldThrow<BusinessException> { item(repoUrl = "http://github.com/1989v/muxbar") }
                shouldThrow<BusinessException> { item(repoUrl = "github.com/1989v/muxbar") }
            }
        }

        `when`("전시를 내린 항목이면") {
            then("행 자체는 유효하다 — 삭제가 아니라 비노출이다") {
                item(active = false).active shouldBe false
            }
        }
    }
})
