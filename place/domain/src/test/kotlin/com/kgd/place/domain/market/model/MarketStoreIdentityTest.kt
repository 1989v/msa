package com.kgd.place.domain.market.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class MarketStoreIdentityTest : BehaviorSpec({
    fun store(source: MarketStoreSource, name: String = "망원 식당", jibun: String? = "서울 마포구 망원동 414-98") =
        when (source) {
            MarketStoreSource.ONNURI -> MarketStore(1, name, source, sourceKey = "k", onnuriKey = "k", onnuriRaw = "{}", jibunAddress = jibun)
            MarketStoreSource.SANGGA -> MarketStore(1, name, source, sourceKey = "k", sanggaKey = "k", sanggaRaw = "{}", jibunAddress = jibun)
            else -> MarketStore(1, name, source, actorKind = MarketActorKind.ADMIN, createdByMemberId = 1, jibunAddress = jibun)
        }

    Given("두 원천에 같은 가게") {
        Then("공백·전각·대소문자가 달라도 키가 같다") {
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI)) shouldBe
                MarketStoreIdentity.key(store(MarketStoreSource.SANGGA, name = "망원식당", jibun = "서울 마포구 망원동 ４１４-９８"))
        }
        Then("시도를 정식 명칭·「서울시」·약칭으로 달리 써도 키가 같다") {
            val official = MarketStoreIdentity.key(store(MarketStoreSource.SANGGA, jibun = "서울특별시 마포구 망원동 414-98"))
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI, jibun = "서울시 마포구 망원동 414-98")) shouldBe official
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI)) shouldBe official
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI, jibun = "경북 경주시 성건동 339-2")) shouldBe
                MarketStoreIdentity.key(store(MarketStoreSource.SANGGA, jibun = "경상북도 경주시 성건동 339-2"))
        }
        Then("시도가 다르면 키가 다르다") {
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI, jibun = "경남 경주시 성건동 339-2")) shouldNotBe
                MarketStoreIdentity.key(store(MarketStoreSource.SANGGA, jibun = "경상북도 경주시 성건동 339-2"))
        }
        Then("이름이나 지번이 다르면 키가 다르다") {
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI)) shouldNotBe
                MarketStoreIdentity.key(store(MarketStoreSource.SANGGA, name = "망원분식"))
        }
    }
    Given("짝지을 수 없는 행") {
        Then("직접 입력과 지번 없는 행은 키가 없다") {
            MarketStoreIdentity.key(store(MarketStoreSource.MANUAL)) shouldBe null
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI, jibun = "  ")) shouldBe null
            MarketStoreIdentity.key(store(MarketStoreSource.ONNURI, jibun = null)) shouldBe null
        }
    }
})
