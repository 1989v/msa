package com.kgd.ads.domain.placement.model

import com.kgd.ads.domain.placement.exception.InvalidPlacementException
import com.kgd.ads.domain.support.AdsDomainFixtures
import com.kgd.ads.domain.support.AdsDomainFixtures.STRIP
import com.kgd.ads.domain.support.AdsDomainFixtures.WIDE
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

class AdPlacementTest : BehaviorSpec({
    given("두 형태를 받는 지면 (카드 1.91:1 0.10 · 띠배너 6.4:1 0.05)") {
        val dual = AdsDomainFixtures.dualPlacement()

        `when`("형태마다 규격을 물으면") {
            then("비율·최저가는 그 형태의 규격 값이다") {
                dual.spec(PlacementFormat.CARD)?.floorMicros shouldBe 100_000L
                dual.spec(PlacementFormat.BANNER)?.floorMicros shouldBe 50_000L
                dual.accepts(PlacementFormat.CARD, WIDE) shouldBe true
                dual.accepts(PlacementFormat.CARD, STRIP) shouldBe false
                dual.accepts(PlacementFormat.BANNER, STRIP) shouldBe true
                dual.fitsImage(PlacementFormat.BANNER, 1280, 200) shouldBe true
                dual.fitsImage(PlacementFormat.BANNER, 1200, 628) shouldBe false
            }
        }
        `when`("대표 규격을 물으면") {
            then("카드가 있으면 카드, 없으면 첫 규격") {
                dual.representative().format shouldBe PlacementFormat.CARD
                AdsDomainFixtures.bannerOnlyPlacement().representative().format shouldBe PlacementFormat.BANNER
            }
        }
        `when`("규격이 없는 형태를 물으면") {
            then("규격 없음 — 비율 판정도 맞지 않는다") {
                val cardOnly = AdsDomainFixtures.placement()
                cardOnly.spec(PlacementFormat.BANNER).shouldBeNull()
                cardOnly.fitsImage(PlacementFormat.BANNER, 1280, 200) shouldBe false
            }
        }
    }

    given("형태 규격 불변식") {
        `when`("같은 형태 규격을 둘 두면") {
            then("만들 때도 추가할 때도 거절한다") {
                shouldThrow<InvalidPlacementException> {
                    AdsDomainFixtures.placement(formats = listOf(AdsDomainFixtures.card(), AdsDomainFixtures.card(floorMicros = 200_000)))
                }
                val placement = AdsDomainFixtures.placement()
                shouldThrow<InvalidPlacementException> { placement.addFormat(AdsDomainFixtures.card(floorMicros = 200_000)) }
            }
        }
        `when`("규격이 하나도 없으면") {
            then("만들 수 없다") {
                shouldThrow<InvalidPlacementException> { AdsDomainFixtures.placement(formats = emptyList()) }
            }
        }
        `when`("마지막 규격을 지우면") {
            then("거절하고, 둘 중 하나는 지울 수 있다") {
                val dual = AdsDomainFixtures.dualPlacement()
                dual.removeFormat(PlacementFormat.BANNER)
                dual.spec(PlacementFormat.BANNER).shouldBeNull()
                shouldThrow<InvalidPlacementException> { dual.removeFormat(PlacementFormat.CARD) }
                dual.formats.map { it.format } shouldBe listOf(PlacementFormat.CARD)
            }
        }
        `when`("최저가가 1,000 마이크로 미만이면") {
            then("규격을 만들 수도, 바꿀 수도 없다 — 1,000 은 된다") {
                shouldThrow<InvalidPlacementException> { AdsDomainFixtures.banner(floorMicros = 999) }
                val dual = AdsDomainFixtures.dualPlacement()
                shouldThrow<InvalidPlacementException> { dual.changeFloor(PlacementFormat.BANNER, 999) }
                dual.changeFloor(PlacementFormat.BANNER, 1_000)
                dual.spec(PlacementFormat.BANNER)?.floorMicros shouldBe 1_000L
                dual.spec(PlacementFormat.CARD)?.floorMicros shouldBe 100_000L
            }
        }
        `when`("없는 형태의 최저가를 바꾸거나 지우면") {
            then("거절한다") {
                val cardOnly = AdsDomainFixtures.placement()
                shouldThrow<InvalidPlacementException> { cardOnly.changeFloor(PlacementFormat.BANNER, 50_000) }
                shouldThrow<InvalidPlacementException> { cardOnly.removeFormat(PlacementFormat.BANNER) }
            }
        }
    }
})
