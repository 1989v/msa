package com.kgd.place.domain.region.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class AdminRegionTest : BehaviorSpec({

    given("행정구역 생성 시") {
        `when`("시도면") {
            then("코드 2자리이고 상위가 없어야 한다") {
                val sido = AdminRegion.create("11", AdminRegionLevel.SIDO, "서울특별시")
                sido.code shouldBe "11"
                sido.parentCode shouldBe null
            }
        }
        `when`("시군구면") {
            then("코드 5자리이고 상위는 앞 2자리여야 한다") {
                val gu = AdminRegion.create("11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "11")
                gu.parentCode shouldBe "11"
            }
        }
        `when`("시군구의 상위가 앞 2자리와 다르면") {
            then("거부해야 한다 — 계층이 어긋나면 드릴다운이 조용히 빈다") {
                shouldThrow<IllegalArgumentException> {
                    AdminRegion.create("11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "41")
                }
            }
        }
        `when`("코드 자릿수가 레벨과 안 맞으면") {
            then("거부해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    AdminRegion.create("11110", AdminRegionLevel.SIDO, "서울특별시")
                }
            }
        }
        `when`("시도에 상위 코드를 주면") {
            then("거부해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    AdminRegion.create("11", AdminRegionLevel.SIDO, "서울특별시", parentCode = "00")
                }
            }
        }
    }

    given("재적재 동기화 시") {
        `when`("좌표 없는 자료가 들어오면") {
            then("이미 채워둔 좌표를 지우지 않아야 한다 — 지우면 지도가 엉뚱한 곳을 본다") {
                val stored = AdminRegion.create("11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "11")
                stored.locateAt(37.5735, 126.9790)

                stored.syncFrom(
                    AdminRegion.create("11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "11"),
                )

                stored.latitude shouldBe 37.5735
                stored.longitude shouldBe 126.9790
            }
        }
        `when`("좌표가 함께 오면") {
            then("갱신해야 한다") {
                val stored = AdminRegion.create("11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "11")
                stored.syncFrom(
                    AdminRegion.create(
                        "11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "11",
                        latitude = 37.5, longitude = 127.0,
                    ),
                )
                stored.latitude shouldBe 37.5
            }
        }
        `when`("다른 코드로 동기화하면") {
            then("거부해야 한다") {
                val stored = AdminRegion.create("11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "11")
                shouldThrow<IllegalArgumentException> {
                    stored.syncFrom(
                        AdminRegion.create("11140", AdminRegionLevel.SIGUNGU, "중구", parentCode = "11"),
                    )
                }
            }
        }
    }
})
