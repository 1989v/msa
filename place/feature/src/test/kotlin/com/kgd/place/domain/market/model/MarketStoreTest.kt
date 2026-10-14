package com.kgd.place.domain.market.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class MarketStoreTest : BehaviorSpec({
    val source = MarketStore(
        marketId = 1, name = "원천 가게", source = MarketStoreSource.ONNURI, sourceKey = "onnuri:1",
        onnuriKey = "1", onnuriRaw = "{\"점포명\":\"원천 가게\",\"미사용필드\":\"보존\"}",
        sanggaKey = "s1", sanggaRaw = "{\"층정보\":\"1\"}", roadAddress = "종로 1",
        items = "한복", zoneId = 3, latitude = 37.57, longitude = 126.99,
        membership = MarketMembership(MarketMembershipStatus.OUT), id = 10,
    )
    fun override(field: MarketStoreField, value: String?) = MarketStoreOverride(
        storeId = 10, field = field, value = value, reason = "현장 확인", memberId = 7, actorKind = MarketActorKind.ADMIN,
    )

    Given("자동 소속 판정") {
        Then("IN과 UNKNOWN은 기본 노출하고 OUT은 기본 숨김이다") {
            MarketMembership(MarketMembershipStatus.IN).visibleByDefault shouldBe true
            MarketMembership(MarketMembershipStatus.OUT).visibleByDefault shouldBe false
            MarketMembership(MarketMembershipStatus.UNKNOWN).visibleByDefault shouldBe true
        }
    }
    Given("필드 단위 덮어쓰기") {
        Then("표시값만 바꾸고 원천 JSON과 나머지 속성을 그대로 남긴다") {
            val display = MarketStoreDisplay.from(source, listOf(
                override(MarketStoreField.NAME, "상인회 가게명"),
                override(MarketStoreField.MEMBERSHIP, "IN"),
            ))
            display.name shouldBe "상인회 가게명"
            display.membership.status shouldBe MarketMembershipStatus.IN
            display.items shouldBe source.items
            display.zoneId shouldBe source.zoneId
            display.coordinate shouldBe MarketCoordinate(37.57, 126.99)
            source.name shouldBe "원천 가게"
            source.membership.status shouldBe MarketMembershipStatus.OUT
            source.roadAddress shouldBe "종로 1"
            source.onnuriRaw shouldBe "{\"점포명\":\"원천 가게\",\"미사용필드\":\"보존\"}"
            source.sanggaRaw shouldBe "{\"층정보\":\"1\"}"
        }
        Then("NULL은 nullable 필드를 명시적으로 해제하며 override가 없으면 원천을 쓴다") {
            val display = MarketStoreDisplay.from(source, listOf(
                override(MarketStoreField.ITEMS, null), override(MarketStoreField.ZONE_ID, null),
                override(MarketStoreField.LATITUDE, null), override(MarketStoreField.LONGITUDE, null),
            ))
            display.items shouldBe null
            display.zoneId shouldBe null
            display.coordinate shouldBe null
            display.name shouldBe source.name
            source.items shouldBe "한복"
            source.latitude shouldBe 37.57
        }
        Then("이유 없는 편집, 잘못된 enum, ID, 좌표와 빈 이름을 거부한다") {
            shouldThrow<IllegalArgumentException> { override(MarketStoreField.NAME, " ") }
            shouldThrow<IllegalArgumentException> { override(MarketStoreField.MEMBERSHIP, "MAYBE") }
            shouldThrow<IllegalArgumentException> { override(MarketStoreField.PIN_KIND, "GUESS") }
            shouldThrow<IllegalArgumentException> { override(MarketStoreField.ZONE_ID, "0") }
            shouldThrow<IllegalArgumentException> { override(MarketStoreField.LATITUDE, "NaN") }
            shouldThrow<IllegalArgumentException> { override(MarketStoreField.LONGITUDE, "181") }
            shouldThrow<IllegalArgumentException> { override(MarketStoreField.NAME, "가게").copy(reason = " ") }
        }
        Then("다른 점포·중복 필드·불완전 좌표·근거 없는 참고 핀을 거부한다") {
            val name = override(MarketStoreField.NAME, "변경")
            shouldThrow<IllegalArgumentException> { MarketStoreDisplay.from(source, listOf(name.copy(storeId = 11))) }
            shouldThrow<IllegalArgumentException> { MarketStoreDisplay.from(source, listOf(name, name)) }
            shouldThrow<IllegalArgumentException> { MarketStoreDisplay.from(source, listOf(override(MarketStoreField.LATITUDE, null))) }
            shouldThrow<IllegalArgumentException> { MarketStoreDisplay.from(source, listOf(override(MarketStoreField.LATITUDE, "37.6"))) }
            shouldThrow<IllegalArgumentException> { MarketStoreDisplay.from(source, listOf(override(MarketStoreField.PIN_KIND, "REFERENCE"))) }
        }
    }
    Given("원천 재적재") {
        Then("ID와 보강 원천 JSON은 남기고 새 원천 값과 기존 override를 합성한다") {
            val reloaded = source.reloadSource(source.copy(id = null, name = "새 원천명", items = "옷",
                onnuriRaw = "{\"점포명\":\"새 원천명\"}", sanggaRaw = null, sanggaKey = null))
            reloaded.id shouldBe source.id
            reloaded.createdAt shouldBe source.createdAt
            reloaded.sanggaRaw shouldBe source.sanggaRaw
            reloaded.sanggaKey shouldBe "s1"
            reloaded.onnuriRaw shouldBe "{\"점포명\":\"새 원천명\"}"
            val display = MarketStoreDisplay.from(reloaded, listOf(override(MarketStoreField.NAME, "운영자 이름")))
            display.name shouldBe "운영자 이름"
            display.items shouldBe "옷"
        }
        Then("독립적인 온누리 갱신은 좌표·업종·건물·층 보강 컬럼까지 유지한다") {
            val enriched = source.copy(categoryMajor = "소매", categoryMid = "의류", categorySub = "한복",
                buildingManagementNo = "building-1", buildingName = "본관", dong = "A", floor = "1", ho = "101", roadName = "종로")
            val incoming = MarketStore(marketId = 1, name = "새 온누리 상호", source = MarketStoreSource.ONNURI,
                sourceKey = "onnuri:1", onnuriKey = "1", onnuriRaw = "{\"신규필드\":\"전부 보존\"}", items = "의류")
            val reloaded = enriched.reloadSource(incoming)
            reloaded.latitude shouldBe enriched.latitude
            reloaded.longitude shouldBe enriched.longitude
            reloaded.categoryMajor shouldBe "소매"
            reloaded.categoryMid shouldBe "의류"
            reloaded.categorySub shouldBe "한복"
            reloaded.buildingManagementNo shouldBe "building-1"
            reloaded.buildingName shouldBe "본관"
            reloaded.dong shouldBe "A"
            reloaded.floor shouldBe "1"
            reloaded.ho shouldBe "101"
            reloaded.roadName shouldBe "종로"
            reloaded.roadAddress shouldBe enriched.roadAddress
            reloaded.sanggaRaw shouldBe enriched.sanggaRaw
            reloaded.name shouldBe "새 온누리 상호"
            reloaded.items shouldBe "의류"
            reloaded.onnuriRaw shouldBe incoming.onnuriRaw
        }
        Then("MANUAL 행이나 다른 시장·키를 원천 갱신으로 바꿀 수 없다") {
            val manual = MarketStore(marketId = 1, name = "노점", source = MarketStoreSource.MANUAL,
                actorKind = MarketActorKind.STEWARD, createdByMemberId = 7, id = 20)
            shouldThrow<IllegalArgumentException> { manual.reloadSource(source) }
            shouldThrow<IllegalArgumentException> { source.reloadSource(manual) }
            shouldThrow<IllegalArgumentException> { source.reloadSource(source.copy(marketId = 2)) }
            shouldThrow<IllegalArgumentException> { source.reloadSource(source.copy(sourceKey = "다른 키")) }
        }
    }
    Given("시장 담당자 승인 행") {
        Then("승인된 회원의 승인 시장만 편집하며 정지는 즉시 판정에서 제외한다") {
            val active = MarketSteward(marketId = 1, memberId = 7, orgName = "상인회", contact = "전화",
                status = MarketStewardStatus.ACTIVE, approvedByMemberId = 9, approvedAt = source.createdAt)
            active.canEdit(1, 7) shouldBe true
            active.canEdit(2, 7) shouldBe false
            active.canEdit(1, 8) shouldBe false
            active.copy(status = MarketStewardStatus.SUSPENDED).canEdit(1, 7) shouldBe false
            shouldThrow<IllegalArgumentException> { active.copy(approvedAt = null) }
        }
    }
})
