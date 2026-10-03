package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.maps.shouldNotContainKey
import io.kotest.matchers.shouldBe

/** 같은 언어 · 시군구 · 제목이면서 1km 안인 다른 등록끼리만 묶는지 본다. 부산타워 좌표는 운영 행 값, 한국민속촌·영진항은 운영 실측 거리(754m · 2.6km)를 재현한 좌표다. */
class SamePlaceGrouperTest : BehaviorSpec({

    fun doc(id: String, title: String, type: String?, lat: Double, lon: Double, lang: String = "ko", signgu: String = "110") =
        RegionProjection(
            id = id, contentId = "c$id", lang = lang, ldongRegnCd = "26", ldongSignguCd = signgu,
            contentTypeId = type, lclsSystm3 = null, latitude = lat, longitude = lon, title = title, eventPeriod = null,
        )

    given("부산타워 — 관광지(12)와 쇼핑(38)이 같은 자리에 따로 올라왔다") {
        val sight = doc("2558", "부산타워", "12", 35.10120, 129.03230)
        val shop = doc("29692", "부산타워", "38", 35.10121, 129.03231)
        then("서로를 같은 장소의 다른 등록으로 갖는다") {
            val groups = SamePlaceGrouper.group(listOf(sight, shop))
            groups["2558"] shouldBe listOf(SamePlace("29692", "38"))
            groups["29692"] shouldBe listOf(SamePlace("2558", "12"))
        }
    }

    given("한 단지 안의 다른 등록(754m)과 동명의 다른 곳(2.6km)") {
        val village = doc("1", "한국민속촌", "12", 37.25890, 127.11840)
        val villageShop = doc("2", "한국민속촌", "38", 37.25890 + 0.00678, 127.11840) // 약 754m 북쪽
        val port = doc("3", "영진항", "12", 37.7400, 128.8300)
        val portRestaurant = doc("4", "영진항", "39", 37.7400 + 0.02375, 128.8300) // 약 2.6km 북쪽
        then("1km 안만 묶는다") {
            val groups = SamePlaceGrouper.group(listOf(village, villageShop, port, portRestaurant))
            groups["1"] shouldBe listOf(SamePlace("2", "38"))
            groups shouldNotContainKey "3"
            groups shouldNotContainKey "4"
        }
    }

    given("이름은 같아도 언어나 시군구가 다르면") {
        val ko = doc("1", "남산", "12", 37.55, 126.99)
        val en = doc("2", "남산", "76", 37.55, 126.99, lang = "en")
        val otherGu = doc("3", "남산", "12", 37.55, 126.99, signgu = "140")
        then("묶지 않는다") {
            SamePlaceGrouper.group(listOf(ko, en, otherGu)).shouldBeEmpty()
        }
    }
})
