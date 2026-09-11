package com.kgd.place.application.region.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.region.port.AdminRegionRepositoryPort
import com.kgd.place.domain.region.model.AdminRegion
import com.kgd.place.domain.region.model.AdminRegionLevel
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify

class AdminRegionServiceTest : BehaviorSpec({
    val adminRegionRepository = mockk<AdminRegionRepositoryPort>()
    val attractionRepository = mockk<AttractionRepositoryPort>()
    val service = AdminRegionService(adminRegionRepository, attractionRepository)

    val seoul = AdminRegion.create("11", AdminRegionLevel.SIDO, "서울특별시")
    val gyeonggi = AdminRegion.create("41", AdminRegionLevel.SIDO, "경기도")
    val jongno = AdminRegion.create("11110", AdminRegionLevel.SIGUNGU, "종로구", parentCode = "11")
    val junggu = AdminRegion.create("11140", AdminRegionLevel.SIGUNGU, "중구", parentCode = "11")

    fun counts() = listOf(
        AttractionRepositoryPort.LdongCount("11", "110", 30),
        AttractionRepositoryPort.LdongCount("11", "140", 12),
        AttractionRepositoryPort.LdongCount("41", "110", 7),
    )

    given("건수 없이 조회하면") {
        `when`("lang 을 주지 않으면") {
            then("집계를 하지 않고 count 는 null 이어야 한다 — 0(관광지 없음)과 다른 뜻이다") {
                every { adminRegionRepository.findByLevel(AdminRegionLevel.SIDO) } returns listOf(seoul)

                val views = service.find(AdminRegionLevel.SIDO, null, null)

                views.single().attractionCount shouldBe null
                verify(exactly = 0) { attractionRepository.countByLdong(any(), any()) }
            }
        }
    }

    given("건수와 함께 조회하면") {
        `when`("시도 목록이면") {
            then("그 아래 시군구 건수의 합이어야 한다 — 레벨마다 따로 세면 합이 안 맞는다") {
                every { adminRegionRepository.findByLevel(AdminRegionLevel.SIDO) } returns
                    listOf(seoul, gyeonggi)
                every { attractionRepository.countByLdong("ko", any()) } returns counts()

                val views = service.find(AdminRegionLevel.SIDO, null, "ko").associateBy { it.code }

                views.getValue("11").attractionCount shouldBe 42
                views.getValue("41").attractionCount shouldBe 7
            }
        }

        `when`("시군구 목록이면") {
            then("시도코드+시군구코드로 맞춰야 한다") {
                every { adminRegionRepository.findChildren("11") } returns listOf(jongno, junggu)
                every { attractionRepository.countByLdong("ko", any()) } returns counts()

                val views = service.find(AdminRegionLevel.SIGUNGU, "11", "ko").associateBy { it.code }

                views.getValue("11110").attractionCount shouldBe 30
                views.getValue("11140").attractionCount shouldBe 12
            }
        }

        `when`("관광지가 없는 시군구면") {
            then("null 이 아니라 0 이어야 한다 — 세어봤고 없는 것이다") {
                val nowon = AdminRegion.create("11350", AdminRegionLevel.SIGUNGU, "노원구", parentCode = "11")
                every { adminRegionRepository.findChildren("11") } returns listOf(nowon)
                every { attractionRepository.countByLdong("ko", any()) } returns counts()

                service.find(AdminRegionLevel.SIGUNGU, "11", "ko").single().attractionCount shouldBe 0
            }
        }

        `when`("건수를 셀 때") {
            then("관광 분류만 센다 — 음식·쇼핑까지 세면 기대와 어긋난다") {
                every { adminRegionRepository.findByLevel(AdminRegionLevel.SIDO) } returns listOf(seoul)
                every { attractionRepository.countByLdong("ko", any()) } returns counts()

                service.find(AdminRegionLevel.SIDO, null, "ko")

                verify {
                    attractionRepository.countByLdong(
                        "ko",
                        match { it.toSet() == setOf("nature", "history", "culture", "leisure") },
                    )
                }
            }
        }
    }
})
