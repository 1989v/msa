package com.kgd.place.domain.region.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class RegionTest : BehaviorSpec({
    given("Region 생성 시") {
        `when`("유효한 도시 좌표가 주어지면") {
            then("CITY 지역이 생성되어야 한다") {
                val seoul = Region.create(
                    level = RegionLevel.CITY,
                    name = "Seoul",
                    nameKo = "서울특별시",
                    countryCode = "kr",
                    latitude = 37.5665,
                    longitude = 126.978,
                )
                seoul.level shouldBe RegionLevel.CITY
                seoul.nameKo shouldBe "서울특별시"
                seoul.countryCode shouldBe "KR"
            }
        }
        `when`("지역명이 비어있으면") {
            then("IllegalArgumentException 이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Region.create(level = RegionLevel.COUNTRY, name = " ")
                }
            }
        }
        `when`("위도가 범위를 벗어나면") {
            then("IllegalArgumentException 이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Region.create(level = RegionLevel.CITY, name = "Bad", latitude = 100.0, longitude = 0.0)
                }
            }
        }
    }
})
