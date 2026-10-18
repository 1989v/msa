package com.kgd.place.domain.market.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class MarketStoreNumberTest : BehaviorSpec({
    Given("온누리 가맹점 주소 끝에 상인이 적은 가게 번호") {
        Then("지번·도로명 번호 뒤의 동·층·호를 그대로 읽는다") {
            MarketStoreNumber.parse("경북경주시성건동339-2번지중앙시장5-21호", "경주 중앙시장") shouldBe "5-21호"
            MarketStoreNumber.parse("경북경주시성건동339-2.중앙시장5동27호", "경주 중앙시장") shouldBe "5동 27호"
            MarketStoreNumber.parse("경북경주시성건동중앙시장A-7호", "경주 중앙시장") shouldBe "A-7호"
            MarketStoreNumber.parse("경기광명시광명5동290-51번지A동101호", "광명시장") shouldBe "A동 101호"
            MarketStoreNumber.parse("전라남도 여수시 여객선터미널길 24, 1층 36호", "여수수산시장") shouldBe "1층 36호"
            MarketStoreNumber.parse("경북 경주시 금성로 295 1동 104호", "경주 중앙시장") shouldBe "1동 104호"
            MarketStoreNumber.parse("서울특별시 중구 을지로32길 24, 197호 (오장동 44-1)", "중부시장") shouldBe "197호"
            MarketStoreNumber.parse("부산광역시 남구 동명로152번길 93, 80호", "못골시장") shouldBe "80호"
            MarketStoreNumber.parse("전북군산시신영동18-1번지공설시장나-45호", "군산공설시장") shouldBe "나-45호"
            MarketStoreNumber.parse("서울 동대문구 제기동 1036, 73~74호", "경동시장") shouldBe "73~74호"
        }
        Then("한글 낱말 끝 글자는 동 이름으로 붙이지 않는다") {
            MarketStoreNumber.parse("경남통영시중앙동68-5번지중앙상가49호", "통영중앙시장") shouldBe "49호"
            MarketStoreNumber.parse("대구달서구도원동1432-2번지대곡프라자108호", "대곡시장") shouldBe "108호"
        }
        Then("상가정보와 맞춘 필지 번호가 있으면 붙어 쓴 번호의 경계를 그것으로 정한다") {
            MarketStoreNumber.parse("경북경주시성건동339-24동-8", "경주 중앙시장", "339-2") shouldBe "4동 8"
        }
        Then("번호로 읽히지 않으면 null 이다") {
            MarketStoreNumber.parse("경북경주시성건동339-2", "경주 중앙시장") shouldBe null
            MarketStoreNumber.parse("경북경주시성건동중앙시장72", "경주 중앙시장") shouldBe null
            MarketStoreNumber.parse("경북 경주시 금성로 295", "경주 중앙시장") shouldBe null
            MarketStoreNumber.parse(null, "경주 중앙시장") shouldBe null
        }
    }
})
