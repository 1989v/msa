package com.kgd.codedictionary.domain.portal

import com.kgd.codedictionary.domain.portal.model.PortalTile
import com.kgd.codedictionary.domain.portal.model.TileStatus
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class PortalTileTest : BehaviorSpec({

    fun tile(
        code: String = "place",
        label: String = "한국 관광 검색",
        href: String? = "/place",
        status: TileStatus = TileStatus.LIVE,
    ) = PortalTile(
        id = null,
        code = code,
        label = label,
        tagline = null,
        href = href,
        status = status,
        orderNo = 10,
    )

    given("타일을 만들 때") {

        `when`("코드가 소문자-하이픈 형식이 아니면") {
            then("거부한다") {
                shouldThrow<BusinessException> { tile(code = "Place") }
                shouldThrow<BusinessException> { tile(code = "place_1") }
                shouldThrow<BusinessException> { tile(code = "-place") }
            }
        }

        `when`("이름이 비어 있으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { tile(label = "  ") }
            }
        }

        `when`("LIVE 인데 href 가 없으면") {
            then("거부한다 — 눌러도 아무 일이 없는 타일이 된다") {
                shouldThrow<BusinessException> { tile(href = null) }
                shouldThrow<BusinessException> { tile(href = "") }
            }
        }

        `when`("준비중이라 href 가 없으면") {
            then("허용한다 — 아직 갈 곳이 없는 게 정상이다") {
                tile(status = TileStatus.SOON, href = null).status shouldBe TileStatus.SOON
            }
        }
    }

    given("노출 여부를 판정할 때") {
        then("HIDDEN 만 감춘다") {
            TileStatus.LIVE.visible shouldBe true
            TileStatus.SOON.visible shouldBe true
            TileStatus.HIDDEN.visible shouldBe false
        }
    }
})
