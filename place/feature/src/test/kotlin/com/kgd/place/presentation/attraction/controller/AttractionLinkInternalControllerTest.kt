package com.kgd.place.presentation.attraction.controller

import com.kgd.place.application.attraction.usecase.CollectAttractionLinksUseCase
import com.kgd.place.application.attraction.usecase.GetAttractionLinksUseCase
import com.kgd.place.domain.attraction.model.AttractionDeepLinks
import com.kgd.place.domain.attraction.model.AttractionLink
import com.kgd.place.domain.attraction.model.AttractionLinkSource
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import com.kgd.place.domain.attraction.model.VideoDetails
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import tools.jackson.module.kotlin.readValue
import java.time.LocalDateTime

/**
 * 색인용 벌크 조회 응답. 관광지 상세의 링크는 이 응답이 색인 문서에 실려 그대로 화면까지 간다 —
 * 여기서 빠진 필드는 화면에서 조용히 사라진다(영상 카드의 조회수가 그렇게 빠져 있었다).
 * 응답을 운영과 같은 날짜 설정의 매퍼로 직렬화해 **선 위의 모양**을 본다.
 */
class AttractionLinkInternalControllerTest : BehaviorSpec({
    val collect = mockk<CollectAttractionLinksUseCase>()
    val get = mockk<GetAttractionLinksUseCase>()
    val controller = AttractionLinkInternalController(collect, get)
    val mapper = jacksonMapperBuilder().disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS).build()

    given("색인용 링크 벌크 조회") {
        `when`("수집된 영상과 딥링크가 있으면") {
            val video = AttractionLink.create(
                attractionId = 1L, source = AttractionLinkSource.YOUTUBE, externalId = "dQw4w9WgXcQ",
                title = "경복궁 야간개장", url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                thumbnailUrl = "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", author = "서울여행",
                publishedAt = LocalDateTime.of(2026, 9, 1, 12, 30), viewCount = 123_456L,
                duration = "PT45S", embedWidth = 360, embedHeight = 640,
            )
            every { get.findByAttractionIds(listOf(1L)) } returns mapOf(
                1L to GetAttractionLinksUseCase.Links(
                    collected = listOf(video),
                    deepLinks = AttractionDeepLinks.of("경복궁", "12").take(1),
                ),
            )

            val wire: Map<String, Any?> = mapper.readValue(
                mapper.writeValueAsString(controller.lookup(LookupLinksRequest(listOf(1L))).data!!),
            )

            then("수집 링크는 화면이 그리는 필드(조회수·게시일·형태 포함)와 원천 식별자를 모두 싣는다") {
                @Suppress("UNCHECKED_CAST")
                val item = (wire["items"] as List<Map<String, Any?>>).single()
                item["attractionId"] shouldBe 1
                @Suppress("UNCHECKED_CAST")
                (item["collected"] as List<Map<String, Any?>>).single() shouldBe mapOf(
                    "source" to "YOUTUBE",
                    "externalId" to "dQw4w9WgXcQ",
                    "title" to "경복궁 야간개장",
                    "url" to "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "thumbnailUrl" to "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                    "author" to "서울여행",
                    "publishedAt" to "2026-09-01T12:30:00",
                    "viewCount" to 123456,
                    "duration" to "PT45S",
                    "format" to "SHORT",
                )
                @Suppress("UNCHECKED_CAST")
                (item["deepLinks"] as List<Map<String, Any?>>).single().keys shouldBe
                    setOf("provider", "kind", "url", "revenueType")
            }
        }
    }

    given("영상 길이·비율 채우기") {
        `when`("수집기가 videos.list 로 받은 값을 돌려주면") {
            val sent = slot<List<VideoDetails>>()
            every { collect.applyVideoDetails(capture(sent)) } returns 3
            val res = controller.applyVideoDetails(
                VideoDetailsRequest(listOf(VideoDetailsRequest.Item("v1", "PT30S", 360, 640))),
            ).data!!
            then("원천 값 그대로 넘기고 바뀐 행 수를 돌려준다") {
                sent.captured shouldBe listOf(VideoDetails("v1", "PT30S", 360, 640))
                res.updated shouldBe 3
            }
        }
        `when`("채울 영상을 물으면") {
            every { collect.findVideosMissingDetails(5000) } returns listOf("v1", "v2")
            then("상한을 넘는 limit 은 5000 으로 자른다") {
                controller.findVideosMissingDetails(100_000).data!!.externalIds shouldBe listOf("v1", "v2")
            }
        }
    }
})
