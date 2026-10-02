package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.port.EventSitemapRenderPort
import com.kgd.search.application.attraction.usecase.RenderEventSitemapUseCase
import com.kgd.search.domain.attraction.model.EventDateRange
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.EventSitemapEntry
import com.kgd.search.domain.attraction.model.EventStatus
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Clock

/**
 * 싣는 조건: 행사 ∧ 개요 있음 ∧ 상태 ≠ UNKNOWN ∧ 유효 종료일 + 30일 ≥ 오늘(KST).
 * 만료 판정은 서버 렌더의 noindex 와 같은 [EventSchedule.indexExpired] 다 — sitemap 에 있는 URL 이 noindex 로 나가지 않게.
 * 메모리 캐시는 두지 않는다. 요청당 색인 조회 한 번이고 반복은 nginx 의 캐시 헤더가 줄인다.
 */
@Service
class EventSitemapService(
    private val searchPort: AttractionSearchPort,
    private val renderPort: EventSitemapRenderPort,
    private val clock: Clock = Clock.systemUTC(),
) : RenderEventSitemapUseCase {
    private val log = KotlinLogging.logger {}

    override fun render(): RenderEventSitemapUseCase.Sitemap {
        val started = System.nanoTime()
        val today = EventSchedule.todayKst(clock.instant())
        val range = EventDateRange(startGte = null, startLte = null, endGte = today.minusDays(EventSchedule.INDEX_GRACE_DAYS))
        val candidates = try {
            searchPort.findEvents(range)
        } catch (e: Exception) {
            log.warn(e) { "행사 sitemap 조회 실패 — 503: elapsedMs=${elapsedMs(started)}" }
            return RenderEventSitemapUseCase.Sitemap.Unavailable
        }
        val listed = candidates
            .filter { it.hasOverview && EventSchedule.status(it.period, today) != EventStatus.UNKNOWN && !EventSchedule.indexExpired(it.period, today) }
            .sortedWith(compareBy<EventSitemapEntry> { it.lang }.thenBy { it.id.toLongOrNull() ?: Long.MAX_VALUE }.thenBy { it.id })
        val xml = renderPort.eventSitemap(listed)
        log.info { "행사 sitemap: urls=${listed.size}, candidates=${candidates.size}, today=$today, elapsedMs=${elapsedMs(started)}" }
        return RenderEventSitemapUseCase.Sitemap.Ok(xml)
    }

    private fun elapsedMs(started: Long) = (System.nanoTime() - started) / 1_000_000
}
