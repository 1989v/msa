package com.kgd.place.application.attraction.service

import com.kgd.common.quota.ExternalApiProvider
import com.kgd.common.quota.ExternalApiQuotaLedger
import com.kgd.place.application.attraction.port.AttractionLinkRepositoryPort
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.CollectAttractionLinksUseCase
import com.kgd.place.application.region.port.AdministrativeRegionRepositoryPort
import com.kgd.place.domain.region.model.AdministrativeRegion
import com.kgd.place.domain.region.model.AdministrativeRegionLevel
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

class AttractionLinkServiceTest : BehaviorSpec({
    val attractionRepository = mockk<AttractionRepositoryPort>()
    val linkRepository = mockk<AttractionLinkRepositoryPort>(relaxed = true)
    val quotaLedger = mockk<ExternalApiQuotaLedger>(relaxed = true)
    val regionRepository = mockk<AdministrativeRegionRepositoryPort>()
    val service = AttractionLinkService(attractionRepository, linkRepository, quotaLedger, regionRepository)
    val youtube = AttractionLinkSource.YOUTUBE

    fun stored(id: Long, title: String, lang: String = "ko", regn: String? = null, signgu: String? = null) = Attraction.restore(
        id = id, contentId = "c$id", lang = lang, title = title,
        address = null, areaCode = null, sigunguCode = null, ldongRegnCd = regn, ldongSignguCd = signgu,
        category = null, cat1 = null, cat2 = null, cat3 = null,
        lclsSystm1 = null, lclsSystm2 = null, lclsSystm3 = null,
        contentTypeId = null, copyrightDivCd = null, thumbnailUrl = null,
        mapLevel = null, zipcode = null, sourceCreatedAt = null,
        latitude = 37.5, longitude = 127.0, imageUrl = null, tel = null, overview = null,
        introRaw = null, useTime = null, restDate = null, useFee = null,
        parking = null, parkingFee = null, infoCenter = null, introSyncedAt = null,
        petAcmpyType = null, petRaw = null, petSyncedAt = null, setting = null,
        imagesRaw = null, infoRaw = null, extraSyncedAt = null,
        eventStartDate = null, eventEndDate = null, listRaw = null, googlePlaceId = null,
        sourceModifiedAt = null, status = "ACTIVE", createdAt = java.time.LocalDateTime.now(),
    )

    beforeContainer { clearMocks(attractionRepository, linkRepository, answers = false) }

    given("재색인이 링크를 묶음으로 읽을 때") {

        `when`("원천 제목에 꼬리 괄호가 붙어 있으면") {
            then("딥링크는 표시명으로 조립되어야 한다 — 원문 그대로면 불가능한 질의가 된다") {
                every { attractionRepository.findAllByIds(listOf(2L)) } returns listOf(stored(2L, "Dosan Park(도산공원)", "en"))
                every { linkRepository.findLinks(2L) } returns emptyList()

                val links = service.findByAttractionIds(listOf(2L)).getValue(2L)

                links.deepLinks.first { it.provider == "YOUTUBE" }.url shouldBe
                    "https://www.youtube.com/results?search_query=Dosan+Park"
                links.deepLinks.first { it.provider == "INSTAGRAM" }.url shouldBe
                    "https://www.instagram.com/explore/tags/dosanpark/"
            }
        }

        `when`("수집된 링크가 있으면") {
            then("수집형과 딥링크를 함께 주고, 수집 큐에는 올리지 않는다 — 6만 곳을 훑을 때마다 큐가 차면 안 된다") {
                every { attractionRepository.findAllByIds(listOf(1L)) } returns listOf(stored(1L, "경복궁"))
                every { linkRepository.findLinks(1L) } returns listOf(
                    AttractionLink.create(1L, youtube, "v1", "경복궁 브이로그", "https://youtu.be/v1"),
                )

                val links = service.findByAttractionIds(listOf(1L)).getValue(1L)

                links.collected shouldHaveSize 1
                links.deepLinks shouldHaveSize 4
                verify(exactly = 0) { linkRepository.saveRequest(any()) }
            }
        }
    }

    given("수집 대상 조회 시") {
        // 예산은 **제공자 단위 장부**가 안다 (ADR-0082) — 자체 테이블 카운터는 없어졌다.
        // 장부는 단위(unit)로 세고 YouTube 는 1콜이 100 units 다.
        `when`("오늘 예산을 다 썼으면") {
            then("빈 목록을 돌려준다 — 실패가 아니라 정상이다") {
                every { quotaLedger.remaining(ExternalApiProvider.YOUTUBE_DATA) } returns 0

                service.findDue(youtube, 50) shouldHaveSize 0

                verify(exactly = 0) { linkRepository.findDueRequests(any(), any(), any()) }
            }
        }

        `when`("예산이 일부 남았으면") {
            then("요청 수가 아니라 남은 예산으로 잘라야 한다") {
                // 300 units = 3콜. 요청을 50 개 달라고 해도 3 으로 잘려야 한다
                every { quotaLedger.remaining(ExternalApiProvider.YOUTUBE_DATA) } returns 300
                val limit = slot<Int>()
                every { linkRepository.findDueRequests(youtube, any(), capture(limit)) } returns emptyList()

                service.findDue(youtube, 50)

                limit.captured shouldBe 3
            }
        }

        `when`("이름이 같은 관광지가 여럿이면") {
            then("영상 검색어에 시군구 이름을 붙이고, 하나뿐인 이름은 표시명 그대로 둔다 — 영문은 영문 시군구") {
                every { quotaLedger.remaining(ExternalApiProvider.YOUTUBE_DATA) } returns null
                every { linkRepository.findDueRequests(youtube, any(), any()) } returns listOf(
                    AttractionLinkRequest.create(1L, youtube), AttractionLinkRequest.create(2L, youtube),
                    AttractionLinkRequest.create(3L, youtube),
                )
                every { attractionRepository.findAllByIds(any()) } returns listOf(
                    stored(1L, "경복궁", regn = "11", signgu = "110"),
                    stored(2L, "중앙공원", regn = "11", signgu = "110"),
                    stored(3L, "Jungang Park(중앙공원)", "en", regn = "11", signgu = "110"),
                )
                every { attractionRepository.countByTitleDisplay(any()) } returns listOf(
                    AttractionRepositoryPort.TitleCount("경복궁", "ko", 1),
                    AttractionRepositoryPort.TitleCount("중앙공원", "ko", 7),
                    AttractionRepositoryPort.TitleCount("Jungang Park", "en", 3),
                )
                every { regionRepository.findByLevel(AdministrativeRegionLevel.SIGUNGU) } returns listOf(
                    AdministrativeRegion.create("11110", AdministrativeRegionLevel.SIGUNGU, "종로구", parentCode = "11", nameEn = "Jongno-gu"),
                )

                service.findDue(youtube, 10).associate { it.attractionId to it.query } shouldBe mapOf(
                    1L to "경복궁",
                    2L to "중앙공원 종로구",
                    3L to "Jungang Park Jongno-gu",
                )
            }
        }

        `when`("한도가 없는 제공자면") {
            then("예산으로 자르지 않는다 — 요청 수가 그대로 상한이다") {
                every { quotaLedger.remaining(ExternalApiProvider.YOUTUBE_DATA) } returns null
                val limit = slot<Int>()
                every { linkRepository.findDueRequests(youtube, any(), capture(limit)) } returns emptyList()

                service.findDue(youtube, 50)

                limit.captured shouldBe 50
            }
        }
    }

    given("수집 결과 적용 시") {
        `when`("원천이 0건을 주면") {
            then("빈 결과로 기록하고 링크를 비운다") {
                every { linkRepository.findRequest(1L, youtube) } returns null

                val applied = service.apply(youtube, listOf(CollectAttractionLinksUseCase.Result(1L)))

                applied.empty shouldBe 1
                applied.failed shouldBe 0
                verify { linkRepository.replaceLinks(1L, youtube, emptyList()) }
            }
        }

        `when`("429·네트워크로 실패했으면") {
            then("빈 결과로 기록하지 않는다 — 섞으면 유효기간만큼 재시도가 막힌다") {
                val saved = slot<AttractionLinkRequest>()
                every { linkRepository.findRequest(1L, youtube) } returns null
                every { linkRepository.saveRequest(capture(saved)) } answers { saved.captured }

                val applied = service.apply(
                    youtube,
                    listOf(CollectAttractionLinksUseCase.Result(1L, failed = true)),
                )

                applied.failed shouldBe 1
                applied.empty shouldBe 0
                // 실패는 하루 뒤 재시도 — 30일(빈 결과)이 아니다
                val next = requireNotNull(saved.captured.nextAttemptAt)
                next.isBefore(LocalDateTime.now().plusDays(2)) shouldBe true
                verify(exactly = 0) { linkRepository.replaceLinks(any(), any(), any()) }
            }
        }

        `when`("YouTube 수집이 성공하면") {
            then("30일 뒤 다시 훑는다 — API 약관이 30일 넘는 보관에 갱신을 요구한다") {
                val saved = slot<AttractionLinkRequest>()
                every { linkRepository.findRequest(1L, youtube) } returns null
                every { linkRepository.saveRequest(capture(saved)) } answers { saved.captured }

                service.apply(
                    youtube,
                    listOf(
                        CollectAttractionLinksUseCase.Result(
                            1L,
                            links = listOf(CollectAttractionLinksUseCase.Link("v1", "제목", "https://youtu.be/v1")),
                        ),
                    ),
                )

                val next = requireNotNull(saved.captured.nextAttemptAt)
                next.isBefore(LocalDateTime.now().plusDays(31)) shouldBe true
                next.isAfter(LocalDateTime.now().plusDays(29)) shouldBe true
            }
        }

        `when`("영상을 받았으면") {
            then("검색 결과 순서를 sortOrder 로 보존해 전체 교체한다") {
                val links = slot<List<AttractionLink>>()
                every { linkRepository.findRequest(1L, youtube) } returns null
                every { linkRepository.replaceLinks(1L, youtube, capture(links)) } returns Unit

                val applied = service.apply(
                    youtube,
                    listOf(
                        CollectAttractionLinksUseCase.Result(
                            1L,
                            links = listOf(
                                CollectAttractionLinksUseCase.Link("v1", "첫번째", "https://youtu.be/v1", viewCount = 9000L),
                                CollectAttractionLinksUseCase.Link("v2", "두번째", "https://youtu.be/v2", viewCount = 120L),
                            ),
                        ),
                    ),
                )

                applied.collected shouldBe 1
                links.captured.map { it.sortOrder } shouldBe listOf(0, 1)
                links.captured.map { it.externalId } shouldBe listOf("v1", "v2")
                // 조회수는 수집기가 정렬해 보내므로 서비스는 순서를 보존하기만 한다
                links.captured.map { it.viewCount } shouldBe listOf(9000L, 120L)
            }
        }
    }
})
