package com.kgd.place.infrastructure.persistence.attraction.adapter

import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.infrastructure.persistence.attraction.entity.AttractionJpaEntity
import com.kgd.place.infrastructure.persistence.attraction.repository.AttractionJpaRepository
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 저장 경로 둘이 행사 날짜·목록 행 원문을 지우지 않는지 — 저장소 대역에 실제로 넘어간 엔티티를 본다.
 * ① 구글 place_id 보강: 읽고(`findAllByIds`) 고치고(`enrichGooglePlaceId`) `saveAll` — `syncFrom` 을 타지 않는다.
 * ② bulk upsert: 날짜 없는 보강 레코드가 기존 행에 `syncFrom` 으로 합쳐진다.
 */
class AttractionRepositoryAdapterTest : BehaviorSpec({
    val jpaRepository = mockk<AttractionJpaRepository>()
    val adapter = AttractionRepositoryAdapter(jpaRepository)

    beforeEach { clearMocks(jpaRepository) }

    // searchFestival2 운영 표본(2026-10-02) 첫 행
    val start = LocalDate.of(2026, 11, 7)
    val end = LocalDate.of(2026, 11, 8)
    val raw = """{"contentid":"4116982","contenttypeid":"15","eventstartdate":"20261107","eventenddate":"20261108"}"""
    fun storedFestival() = AttractionJpaEntity(
        id = 41L,
        contentId = "4116982",
        lang = "ko",
        title = "산북AI김장문화축제",
        titleDisplay = "산북AI김장문화축제",
        contentTypeId = "15",
        latitude = 37.4008741346,
        longitude = 127.4451502631,
        eventStartDate = start,
        eventEndDate = end,
        listRaw = raw,
        status = "ACTIVE",
        createdAt = LocalDateTime.of(2026, 10, 2, 3, 10),
    )

    Given("행사 날짜가 있는 행을 구글 보강이 고칠 때") {
        When("읽어서 place_id 를 붙이고 saveAll 하면") {
            val saved = slot<List<AttractionJpaEntity>>()
            every { jpaRepository.findAllById(listOf(41L)) } returns listOf(storedFestival())
            every { jpaRepository.saveAll(capture(saved)) } answers { saved.captured }

            val rows = adapter.findAllByIds(listOf(41L))
            rows.forEach { it.enrichGooglePlaceId("ChIJod7tSseifDUR9hXHLFNGMIs") }
            adapter.saveAll(rows)

            Then("place_id 는 붙고 행사 날짜·원문은 남는다") {
                val row = saved.captured.single()
                row.googlePlaceId shouldBe "ChIJod7tSseifDUR9hXHLFNGMIs"
                row.eventStartDate shouldBe start
                row.eventEndDate shouldBe end
                row.listRaw shouldBe raw
            }
        }
    }

    Given("행사 날짜가 있는 행에 개요 수집 왕복이 들어올 때") {
        When("날짜·원문 없이 개요만 실린 레코드를 upsert 하면") {
            val saved = slot<List<AttractionJpaEntity>>()
            every { jpaRepository.findByContentIdIn(setOf("4116982")) } returns listOf(storedFestival())
            every { jpaRepository.saveAll(capture(saved)) } answers { saved.captured }

            val summary = adapter.upsertAll(
                listOf(
                    Attraction.create(
                        contentId = "4116982", lang = "ko", title = "산북AI김장문화축제",
                        latitude = 37.4008741346, longitude = 127.4451502631, contentTypeId = "15",
                        overview = "김장 문화 축제",
                    ),
                ),
            )

            Then("갱신 1건이고 개요는 들어가며 날짜·원문은 남는다") {
                summary.updated shouldBe 1
                val row = saved.captured.single()
                row.id shouldBe 41L
                row.overview shouldBe "김장 문화 축제"
                row.eventStartDate shouldBe start
                row.eventEndDate shouldBe end
                row.listRaw shouldBe raw
            }
        }
    }
})
