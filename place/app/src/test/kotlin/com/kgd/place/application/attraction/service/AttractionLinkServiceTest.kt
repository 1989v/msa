package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionLinkRepositoryPort
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.CollectAttractionLinksUseCase
import com.kgd.place.domain.attraction.exception.AttractionNotFoundException
import com.kgd.place.domain.attraction.model.Attraction
import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkRequest
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import io.kotest.assertions.throwables.shouldThrow
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
    val service = AttractionLinkService(attractionRepository, linkRepository)
    val youtube = AttractionLinkSource.YOUTUBE

    fun gyeongbokgung() = Attraction.create(
        contentId = "126508", lang = "ko", title = "경복궁",
        latitude = 37.5788, longitude = 126.9770,
    )

    beforeContainer { clearMocks(attractionRepository, linkRepository, answers = false) }

    given("관광지 링크 조회 시") {
        `when`("관광지가 없으면") {
            then("AttractionNotFoundException 이어야 한다") {
                every { attractionRepository.findById(9L) } returns null
                shouldThrow<AttractionNotFoundException> { service.findByAttractionId(9L) }
            }
        }

        `when`("수집된 링크가 아직 없으면") {
            then("딥링크는 즉시 나가고 pending 으로 수집 대기를 알려야 한다") {
                every { attractionRepository.findById(1L) } returns gyeongbokgung()
                every { linkRepository.findLinks(1L) } returns emptyList()
                every { linkRepository.findRequest(1L, youtube) } returns null

                val links = service.findByAttractionId(1L)

                links.collected shouldHaveSize 0
                links.deepLinks shouldHaveSize 4
                links.pending shouldBe true
                verify { linkRepository.saveRequest(any()) }
            }
        }

        `when`("최근에 수집을 마쳤으면") {
            then("다시 큐에 올리지 않고 pending 도 아니어야 한다") {
                val request = AttractionLinkRequest.create(1L, youtube).apply { markCollected() }
                every { attractionRepository.findById(1L) } returns gyeongbokgung()
                every { linkRepository.findLinks(1L) } returns listOf(
                    AttractionLink.create(1L, youtube, "v1", "경복궁 브이로그", "https://youtu.be/v1"),
                )
                every { linkRepository.findRequest(1L, youtube) } returns request

                val links = service.findByAttractionId(1L)

                links.collected shouldHaveSize 1
                links.pending shouldBe false
            }
        }

        `when`("큐 적재가 실패하면") {
            then("조회는 그대로 성공해야 한다 — 링크는 부수 정보고 상세가 본질이다") {
                every { attractionRepository.findById(1L) } returns gyeongbokgung()
                every { linkRepository.findLinks(1L) } returns emptyList()
                every { linkRepository.findRequest(1L, youtube) } throws RuntimeException("DB 장애")

                val links = service.findByAttractionId(1L)

                links.deepLinks shouldHaveSize 4
                links.pending shouldBe false
            }
        }
    }

    given("수집 대상 조회 시") {
        `when`("오늘 예산을 다 썼으면") {
            then("빈 목록을 돌려준다 — 실패가 아니라 정상이다") {
                every { linkRepository.countAttemptsSince(youtube, any()) } returns 100

                service.findDue(youtube, 50) shouldHaveSize 0

                verify(exactly = 0) { linkRepository.findDueRequests(any(), any(), any()) }
            }
        }

        `when`("예산이 일부 남았으면") {
            then("요청 수가 아니라 남은 예산으로 잘라야 한다") {
                every { linkRepository.countAttemptsSince(youtube, any()) } returns 97
                val limit = slot<Int>()
                every { linkRepository.findDueRequests(youtube, any(), capture(limit)) } returns emptyList()

                service.findDue(youtube, 50)

                limit.captured shouldBe 3
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
