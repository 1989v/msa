package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.port.EventSitemapRenderPort
import com.kgd.search.application.attraction.usecase.RenderEventSitemapUseCase
import com.kgd.search.domain.attraction.model.EventDateRange
import com.kgd.search.domain.attraction.model.EventPeriod
import com.kgd.search.domain.attraction.model.EventSitemapEntry
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * 서비스가 포트에 넘긴 범위와 렌더 포트에 넘긴 항목을 본다. 렌더 포트는 받은 항목 id 를 그대로 돌려주는 대역이다.
 */
class EventSitemapServiceTest : BehaviorSpec({
    val searchPort = mockk<AttractionSearchPort>()
    val rendered = slot<List<EventSitemapEntry>>()
    val renderPort = mockk<EventSitemapRenderPort>()
    // UTC 로는 10월 1일 15:30 — KST 로는 10월 2일 00:30. UTC 날짜로 세면 범위가 하루 늦다
    val clock = Clock.fixed(Instant.parse("2026-10-01T15:30:00Z"), ZoneOffset.UTC)
    val today = LocalDate.of(2026, 10, 2)
    val service = EventSitemapService(searchPort, renderPort, clock)

    fun entry(id: String, period: EventPeriod?, hasOverview: Boolean = true, lang: String = "ko") =
        EventSitemapEntry(id = id, lang = lang, period = period, hasOverview = hasOverview, modifiedAt = null)

    fun endedOn(end: LocalDate) = EventPeriod(end.minusDays(3), end)

    beforeTest {
        clearMocks(searchPort, renderPort)
        rendered.clear()
        every { renderPort.eventSitemap(capture(rendered)) } answers { rendered.captured.joinToString(",") { it.id } }
    }

    given("고정 시계 2026-10-02 00:30 KST") {
        then("포트에 「유효 종료일 ≥ KST 오늘 − 30일」 범위를 넘긴다") {
            val range = slot<EventDateRange>()
            every { searchPort.findEvents(capture(range)) } returns emptyList()

            service.render()

            range.captured shouldBe EventDateRange(startGte = null, startLte = null, endGte = LocalDate.of(2026, 9, 2))
        }
    }

    given("포트가 돌려준 후보") {
        then("종료 + 30일은 싣고 + 31일은 뺀다 · 개요 없는 행사와 날짜 없는 행사(UNKNOWN)는 뺀다") {
            every { searchPort.findEvents(any()) } returns listOf(
                entry("30", endedOn(today.minusDays(30))),
                entry("31", endedOn(today.minusDays(31))),
                entry("40", EventPeriod(today, today.plusDays(3)), hasOverview = false),
                entry("50", null),
                entry("60", EventPeriod(today.plusDays(10), today.plusDays(12))),
            )

            val sitemap = service.render()

            sitemap shouldBe RenderEventSitemapUseCase.Sitemap.Ok("30,60")
        }

        then("언어 → id 숫자 순으로 싣는다 — 응답이 요청마다 같은 순서다") {
            val ongoing = EventPeriod(today, today)
            every { searchPort.findEvents(any()) } returns listOf(
                entry("100", ongoing, lang = "en"), entry("20", ongoing), entry("3", ongoing), entry("9", ongoing, lang = "en"),
            )

            service.render() shouldBe RenderEventSitemapUseCase.Sitemap.Ok("9,100,3,20")
        }
    }

    given("색인 조회 실패") {
        then("Unavailable 이고 렌더하지 않는다 — 빈 urlset 을 만들지 않는다") {
            every { searchPort.findEvents(any()) } throws IOException("opensearch down")

            service.render() shouldBe RenderEventSitemapUseCase.Sitemap.Unavailable
            verify(exactly = 0) { renderPort.eventSitemap(any()) }
        }
    }
})
