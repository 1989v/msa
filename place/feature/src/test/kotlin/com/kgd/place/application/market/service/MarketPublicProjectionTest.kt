package com.kgd.place.application.market.service

import com.kgd.place.domain.market.model.MarketCoordinate
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe

class MarketPublicProjectionTest : BehaviorSpec({
    Given("공개 상세의 영문 보강") {
        Then("국문 원본은 보존하고 영문 품목 업종과 로마자 이름을 추가한다") {
            val source = com.kgd.place.domain.market.model.MarketStore(1, "순희네빈대떡",
                com.kgd.place.domain.market.model.MarketStoreSource.ONNURI, sourceKey = "s", onnuriKey = "s", onnuriRaw = "{}",
                items = "농축수산품", categorySub = "전/부침개", id = 1)
            val row = MarketPublicProjection.stores(listOf(source), emptyMap()).single()
            row.nameEn shouldBe "Sunhuine Bindaetteok"
            row.categoryEn shouldBe "Korean pancakes"
            row.itemsEn shouldBe "Agricultural livestock and seafood products"
            val result = com.kgd.place.application.market.usecase.QueryMarketUseCase.MarketResult(
                com.kgd.place.domain.market.model.Market("m", "시장", com.kgd.place.domain.market.model.MarketType.STREET),
                emptyList(), listOf(row))
            val response = com.kgd.place.presentation.market.dto.MarketResponse.from(result).stores.single()
            response.name shouldBe source.name
            response.nameEn shouldBe row.nameEn
            response.categoryEn shouldBe row.categoryEn
            response.itemsEn shouldBe row.itemsEn
            val unknown = MarketPublicProjection.stores(listOf(source.copy(name = "Manual Shop", items = "미등록", categorySub = "미등록")), emptyMap()).single()
            unknown.nameEn shouldBe "Manual Shop"
            unknown.itemsEn shouldBe null
            unknown.categoryEn shouldBe null
        }
    }
    Given("시장 규모의 등거리 근사") {
        Then("동서 거리는 두 좌표의 평균 위도로 보정하며 방향에 무관하다") {
            val a = MarketCoordinate(30.0, 127.0)
            val b = MarketCoordinate(60.0, 127.001)
            // Mean latitude is 45 degrees: the longitude component is 78.715m.
            val expected = kotlin.math.hypot(30 * 111320.0, 0.001 * 111320.0 / kotlin.math.sqrt(2.0))
            MarketPublicProjection.distanceMetres(a, b) shouldBe (expected plusOrMinus 0.000001)
            MarketPublicProjection.distanceMetres(b, a) shouldBe (expected plusOrMinus 0.000001)
        }
        Then("같은 점은 0m이고 위도 1천분의 1도는 111.32m이다") {
            val point = MarketCoordinate(37.0, 127.0)
            MarketPublicProjection.distanceMetres(point, point) shouldBe 0.0
            MarketPublicProjection.distanceMetres(point, MarketCoordinate(37.001, 127.0)) shouldBe
                (111.32 plusOrMinus 0.000001)
        }
    }
})
