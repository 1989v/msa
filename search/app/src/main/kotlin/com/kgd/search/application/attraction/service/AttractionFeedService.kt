package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.port.AttractionFeedRenderPort
import com.kgd.search.application.attraction.usecase.RenderAttractionFeedUseCase
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service

/**
 * 언어별 본문 변경 시각 최근 [FEED_SIZE] 건. 메모리 캐시는 두지 않는다 — 요청당 색인 조회 한 번이고
 * 반복은 응답의 캐시 헤더(10분)가 줄인다.
 */
@Service
class AttractionFeedService(
    private val searchPort: AttractionSearchPort,
    private val renderPort: AttractionFeedRenderPort,
) : RenderAttractionFeedUseCase {
    private val log = KotlinLogging.logger {}

    override fun render(lang: String): RenderAttractionFeedUseCase.Feed {
        require(lang in RenderAttractionFeedUseCase.LANGS) { "피드 언어가 아니다: $lang" }
        val started = System.nanoTime()
        val entries = try {
            searchPort.findRecentlyUpdated(lang, FEED_SIZE)
        } catch (e: Exception) {
            log.warn(e) { "최근 갱신 피드 조회 실패 — 503: lang=$lang, elapsedMs=${elapsedMs(started)}" }
            return RenderAttractionFeedUseCase.Feed.Unavailable
        }
        val xml = renderPort.feed(lang, entries)
        log.info { "최근 갱신 피드: lang=$lang, items=${entries.size}, elapsedMs=${elapsedMs(started)}" }
        return RenderAttractionFeedUseCase.Feed.Ok(xml)
    }

    private fun elapsedMs(started: Long) = (System.nanoTime() - started) / 1_000_000

    private companion object {
        const val FEED_SIZE = 50
    }
}
