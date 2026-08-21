package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.UpsertAttractionUseCase
import com.kgd.place.domain.attraction.exception.AttractionNotFoundException
import com.kgd.place.domain.attraction.model.Attraction
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot

class AttractionServiceTest : BehaviorSpec({
    val repository = mockk<AttractionRepositoryPort>()
    val service = AttractionService(repository)

    fun command(contentId: String = "126508", lang: String = "ko") = UpsertAttractionUseCase.Command(
        contentId = contentId,
        lang = lang,
        title = "경복궁",
        latitude = 37.5788,
        longitude = 126.9770,
        areaCode = "1",
        category = "역사",
    )

    given("관광지 bulk upsert 시") {
        `when`("유효한 커맨드 목록이 주어지면") {
            then("도메인으로 변환해 upsert 하고 요약을 반환해야 한다") {
                val captured = slot<List<Attraction>>()
                every { repository.upsertAll(capture(captured)) } returns
                    AttractionRepositoryPort.UpsertSummary(created = 2, updated = 1)
                every { repository.count() } returns 3

                val result = service.executeBulk(listOf(command(), command("264337"), command("126508", "en")))

                result.created shouldBe 2
                result.updated shouldBe 1
                result.total shouldBe 3
                captured.captured.size shouldBe 3
                captured.captured.first().contentId shouldBe "126508"
                captured.captured.first().status shouldBe "ACTIVE"
            }
        }
    }

    given("관광지 단건 조회 시") {
        `when`("존재하지 않는 id 면") {
            then("AttractionNotFoundException 이 발생해야 한다") {
                every { repository.findById(999L) } returns null
                shouldThrow<AttractionNotFoundException> { service.findById(999L) }
            }
        }
        `when`("존재하는 id 면") {
            then("뷰로 변환해 반환해야 한다") {
                val attraction = Attraction.restore(
                    id = 1L, contentId = "126508", lang = "ko", title = "경복궁",
                    address = "서울 종로구", areaCode = "1", sigunguCode = null,
                    ldongRegnCd = "11", ldongSignguCd = "110",
                    category = "역사", cat1 = "A02", cat2 = null, cat3 = null,
                    lclsSystm1 = "HS", lclsSystm2 = "HS01", lclsSystm3 = "HS010100",
                    contentTypeId = "12", copyrightDivCd = "Type3", thumbnailUrl = null,
                    mapLevel = 6, zipcode = "03045", sourceCreatedAt = null,
                    latitude = 37.5788, longitude = 126.9770,
                    imageUrl = null, tel = null, overview = null,
                    googlePlaceId = "ChIJod7tSseifDUR9hXHLFNGMIs",
                    sourceModifiedAt = null, status = "ACTIVE",
                    createdAt = java.time.LocalDateTime.now(),
                )
                every { repository.findById(1L) } returns attraction

                val view = service.findById(1L)
                view.title shouldBe "경복궁"
                view.lang shouldBe "ko"
                // 보강 필드도 조회로 되읽혀야 한다 — 못 읽으면 개요 배치 왕복이 지운다 (§0 ③)
                view.googlePlaceId shouldBe "ChIJod7tSseifDUR9hXHLFNGMIs"
            }
        }
    }
})
