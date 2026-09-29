package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeInRange
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import io.kotest.matchers.maps.shouldNotContainKey
import io.kotest.matchers.shouldBe

class RegionAggregatorTest : BehaviorSpec({

    fun doc(
        id: String,
        regn: String? = "11",
        signgu: String? = "110",
        type: String? = "12",
        cat: String? = "NA010100",
        lat: Double = 37.5,
        lon: Double = 127.0,
        lang: String = "ko",
    ) = RegionProjection(
        id = id, lang = lang, ldongRegnCd = regn, ldongSignguCd = signgu,
        contentTypeId = type, lclsSystm3 = cat, latitude = lat, longitude = lon, title = "t$id",
    )

    given("다른 시도에 같은 3자리 시군구 코드가 있을 때") {
        // 법정동 시군구 코드는 시도 안에서만 유일하다 — 서울 110(종로구)과 부산 110(중구)은 다른 곳이다
        val docs = listOf(
            doc("s1", regn = "11", signgu = "110"),
            doc("s2", regn = "11", signgu = "110", lat = 37.501),
            doc("b1", regn = "26", signgu = "110", lat = 35.1, lon = 129.03),
        )
        `when`("집계하면") {
            val result = RegionAggregator.aggregate(docs)
            then("두 시도가 섞이지 않는다") {
                result.getValue("s1").typeCount shouldBe 2
                result.getValue("b1").typeCount shouldBe 1
                result.getValue("s1").nearest.map { it.id } shouldContainExactly listOf("s2")
                result.getValue("b1").nearest shouldHaveSize 0
            }
        }
    }

    given("같은 시군구에 같은 유형·여러 분류가 섞여 있을 때") {
        val docs = listOf(
            doc("a", cat = "NA010100"),
            doc("b", cat = "NA010100", lat = 37.51),
            doc("c", cat = "VE010100", lat = 37.52),
            doc("d", cat = null, lat = 37.53),
            doc("e", type = "39", cat = "NA010100"),
        )
        `when`("집계하면") {
            val result = RegionAggregator.aggregate(docs)
            then("N 은 같은 유형 수, M 은 같은 유형·분류 수이고 M ≤ N 이다") {
                result.getValue("a").typeCount shouldBe 4
                result.getValue("a").categoryCount shouldBe 2
                result.getValue("c").categoryCount shouldBe 1
                result.getValue("e").typeCount shouldBe 1
                result.values.forEach { placement ->
                    placement.categoryCount?.let { it shouldBeLessThanOrEqual placement.typeCount }
                }
            }
            then("분류가 없는 문서는 M 과 가까운 곳이 비고 N 에는 센다") {
                result.getValue("d").typeCount shouldBe 4
                result.getValue("d").categoryCount shouldBe null
                result.getValue("d").nearest shouldHaveSize 0
            }
        }
    }

    given("같은 시군구·유형·분류에 7곳이 있을 때") {
        val docs = (0 until 7).map { i -> doc("p$i", lat = 37.5 + i * 0.001) }
        `when`("집계하면") {
            val result = RegionAggregator.aggregate(docs)
            then("자기를 빼고 가까운 순 최대 5곳이고 거리는 미터다") {
                val nearest = result.getValue("p0").nearest
                nearest.map { it.id } shouldContainExactly listOf("p1", "p2", "p3", "p4", "p5")
                // 위도 0.001도 ≈ 111m
                nearest.first().distanceMeters shouldBeInRange 105..117
                nearest.first().title shouldBe "tp1"
            }
            then("가운데 문서도 자기를 포함하지 않는다") {
                result.getValue("p3").nearest.map { it.id } shouldContainExactly listOf("p2", "p4", "p1", "p5", "p0")
            }
        }
    }

    given("같은 분류 이웃이 5곳보다 적을 때") {
        val docs = listOf(doc("x1"), doc("x2", lat = 37.502), doc("x3", lat = 37.501))
        `when`("집계하면") {
            then("있는 만큼만 가까운 순으로 싣는다") {
                RegionAggregator.aggregate(docs).getValue("x1").nearest.map { it.id } shouldContainExactly listOf("x3", "x2")
            }
        }
    }

    given("시도나 시군구 코드가 빠진 문서가 있을 때") {
        val docs = listOf(
            doc("ok1"),
            doc("ok2", lat = 37.501),
            doc("noRegn", regn = null),
            doc("noSigngu", signgu = " "),
        )
        `when`("집계하면") {
            val result = RegionAggregator.aggregate(docs)
            then("빠진 문서는 결과에 없고 남의 수·이웃에도 들어가지 않는다") {
                result shouldNotContainKey "noRegn"
                result shouldNotContainKey "noSigngu"
                result.getValue("ok1").typeCount shouldBe 2
                result.getValue("ok1").nearest.map { it.id } shouldContainExactly listOf("ok2")
            }
        }
    }

    given("같은 곳의 국문·영문 문서가 한 목록에 섞여 있을 때") {
        val docs = listOf(
            doc("k1", lang = "ko"),
            doc("k2", lang = "ko", lat = 37.501),
            doc("e1", lang = "en"),
        )
        `when`("집계하면") {
            val result = RegionAggregator.aggregate(docs)
            then("언어별로 따로 센다") {
                result.getValue("k1").typeCount shouldBe 2
                result.getValue("e1").typeCount shouldBe 1
                result.getValue("e1").nearest shouldHaveSize 0
                result.getValue("k1").nearest.map { it.id } shouldContainExactly listOf("k2")
            }
        }
    }
})
