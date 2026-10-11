package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.port.AttractionPageRenderPort
import com.kgd.search.application.attraction.port.AttractionShellPort
import com.kgd.search.application.attraction.usecase.RenderAttractionPageUseCase
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.time.Clock

@Service
class AttractionPageService(
    private val searchPort: AttractionSearchPort,
    private val shellPort: AttractionShellPort,
    private val renderPort: AttractionPageRenderPort,
    private val clock: Clock = Clock.systemUTC(),
) : RenderAttractionPageUseCase {
    private val log = KotlinLogging.logger {}

    /**
     * 색인 조회는 한 번이다 — 크롤러가 5만 URL 을 훑는 경로라 조회 수가 곧 OpenSearch 부하다.
     * 실패해도 다시 부르지 않고 셸로 떨어진다.
     */
    override fun render(query: RenderAttractionPageUseCase.Query): RenderAttractionPageUseCase.Page {
        val shell = shellPort.shell()
        val started = System.nanoTime()
        val doc = try {
            searchPort.findById(query.id)
        } catch (e: Exception) {
            val elapsedMs = (System.nanoTime() - started) / 1_000_000
            log.warn(e) { "관광지 조회 실패 — 셸로 대체: id=${query.id}, elapsedMs=$elapsedMs" }
            return RenderAttractionPageUseCase.Page.Fallback(renderPort.fallbackPage(shell))
        } ?: return RenderAttractionPageUseCase.Page.NotFound(renderPort.notFoundPage(shell, query.pathLang))
        // 렌더러와 같이 en 외는 ko 로 본다 — 정규화 없이 비교하면 lang 이 ko·en 이 아닌 문서는 어느 경로에서도 어긋나 이동이 돈다
        val docLang = if (doc.lang == EN) EN else KO
        if (docLang != query.pathLang) {
            return RenderAttractionPageUseCase.Page.Redirect(docLang, doc.id, renderPort.canonicalPath(docLang, doc.id))
        }
        val today = EventSchedule.todayKst(clock.instant())
        return RenderAttractionPageUseCase.Page.Found(renderPort.attractionPage(shell, doc, today))
    }

    override fun notFound(pathLang: String): RenderAttractionPageUseCase.Page.NotFound =
        RenderAttractionPageUseCase.Page.NotFound(renderPort.notFoundPage(shellPort.shell(), pathLang))

    private companion object {
        const val KO = "ko"
        const val EN = "en"
    }
}
