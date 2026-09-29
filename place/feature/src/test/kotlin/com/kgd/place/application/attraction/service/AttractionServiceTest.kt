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
                    introRaw = """{"usetime":"09:00~18:00"}""",
                    useTime = "09:00~18:00", restDate = "매주 화요일", useFee = null,
                    parking = "가능", parkingFee = null, infoCenter = "02-3700-3900",
                    introSyncedAt = java.time.LocalDateTime.of(2026, 9, 5, 4, 0),
                    petAcmpyType = "전구역 동반가능", petRaw = null,
                    petSyncedAt = java.time.LocalDateTime.of(2026, 9, 8, 4, 0),
                    setting = "outdoor",
                    imagesRaw = """[{"originimgurl":"https://tong.visitkorea.or.kr/a.jpg"}]""",
                    infoRaw = """[{"infoname":"내국인예약안내","infotext":"가능"}]""",
                    extraSyncedAt = java.time.LocalDateTime.of(2026, 9, 13, 4, 0),
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
                // 부가 사진·반복정보도 되읽혀야 한다 — 안 읽히면 수집 배치가 매일 지운다
                view.imagesRaw shouldBe """[{"originimgurl":"https://tong.visitkorea.or.kr/a.jpg"}]"""
                view.infoRaw shouldBe """[{"infoname":"내국인예약안내","infotext":"가능"}]"""
                view.extraSyncedAt shouldBe java.time.LocalDateTime.of(2026, 9, 13, 4, 0)
                // detailIntro2 보강도 마찬가지 — 원문(introRaw)까지 되읽혀야 파생 규칙을
                // 바꿀 때 원천을 다시 부르지 않는다
                view.useTime shouldBe "09:00~18:00"
                view.restDate shouldBe "매주 화요일"
                view.infoCenter shouldBe "02-3700-3900"
                view.introRaw shouldBe """{"usetime":"09:00~18:00"}"""
            }
        }
    }

    given("id 로 이어 읽을 때 (키셋)") {
        fun stored(id: Long) = Attraction.restore(
            id = id, contentId = "c$id", lang = "ko", title = "관광지$id",
            address = null, areaCode = null, sigunguCode = null, ldongRegnCd = null, ldongSignguCd = null,
            category = null, cat1 = null, cat2 = null, cat3 = null,
            lclsSystm1 = null, lclsSystm2 = null, lclsSystm3 = null,
            contentTypeId = null, copyrightDivCd = null, thumbnailUrl = null,
            mapLevel = null, zipcode = null, sourceCreatedAt = null,
            latitude = 37.5, longitude = 127.0, imageUrl = null, tel = null, overview = null,
            introRaw = null, useTime = null, restDate = null, useFee = null,
            parking = null, parkingFee = null, infoCenter = null, introSyncedAt = null,
            petAcmpyType = null, petRaw = null, petSyncedAt = null, setting = null,
            imagesRaw = null, infoRaw = null, extraSyncedAt = null, googlePlaceId = null,
            sourceModifiedAt = null, status = "ACTIVE", createdAt = java.time.LocalDateTime.now(),
        )

        `when`("size 보다 많이 남아 있으면") {
            then("size 건만 주고 그 마지막 id 를 다음 커서로 줘야 한다") {
                // 한 건 더 읽어 다음이 있는지 본다
                every { repository.findAfter("en", 10L, 3) } returns listOf(stored(11), stored(12), stored(15))

                val slice = service.findAfter("en", 10L, 2)

                slice.items.map { it.id } shouldBe listOf(11L, 12L)
                slice.nextAfterId shouldBe 12L
            }
        }

        `when`("마지막 페이지면 (남은 것이 size 이하)") {
            then("남은 것을 다 주고 다음 커서는 null 이어야 한다") {
                every { repository.findAfter(null, 12L, 3) } returns listOf(stored(15), stored(16))

                val slice = service.findAfter(null, 12L, 2)

                slice.items.map { it.id } shouldBe listOf(15L, 16L)
                slice.nextAfterId shouldBe null
            }
        }
    }
})
