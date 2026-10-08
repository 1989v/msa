package com.kgd.search.presentation.render.controller

import com.kgd.search.application.attraction.usecase.RenderAttractionPageUseCase
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest

/**
 * 관광지 상세 서버 렌더 (ADR-0103). portal-fe nginx 만 부른다.
 *
 * `/internal` 하위는 공개 게이트웨이 라우트 어디에도 없다 — 게이트웨이는 search 로 `/api/search` 하위만
 * 보낸다. 여기를 `/api/search` 밑에 두면 Cloudflare 를 거치지 않는 호스트(rt)로 닿는다.
 */
@RestController
class AttractionPageController(
    private val renderPage: RenderAttractionPageUseCase,
) {

    @GetMapping("/internal/render/attractions/{id}", produces = [MediaType.TEXT_HTML_VALUE])
    fun korean(@PathVariable id: String): ResponseEntity<String> = render(id, "ko")

    @GetMapping("/internal/render/en/attractions/{id}", produces = [MediaType.TEXT_HTML_VALUE])
    fun english(@PathVariable id: String): ResponseEntity<String> = render(id, "en")

    /** 문서 id 는 place PK 숫자다. 형식이 틀리면 조회하지 않고, 404 에 그 값을 되돌려 쓰지 않는다. */
    private fun render(id: String, pathLang: String): ResponseEntity<String> {
        val page = if (ID.matches(id)) {
            renderPage.render(RenderAttractionPageUseCase.Query(id, pathLang))
        } else {
            renderPage.notFound(pathLang)
        }
        val (status, marker) = when (page) {
            is RenderAttractionPageUseCase.Page.Found -> 200 to RENDERED
            is RenderAttractionPageUseCase.Page.NotFound -> 404 to RENDERED
            // 렌더하지 못한 셸이다 — 운영 확인이 이것을 서버 렌더로 세지 않게 표지를 가른다
            is RenderAttractionPageUseCase.Page.Fallback -> 200 to FALLBACK
        }
        val builder = ResponseEntity.status(status)
            .contentType(HTML_UTF8)
            .header(RENDER_HEADER, marker)
            // HTML 은 항상 재검증 — 재색인 뒤에도 CDN 이 옛 메타를 내보내면 서버 렌더를 한 이유가 없다
            .header(HttpHeaders.CACHE_CONTROL, "no-cache, must-revalidate")
        // 재검증이 본문 전송 없이 끝나도록 렌더한 본문에만 ETag 를 단다. 셸 폴백도 200 이라 상태 코드로 가르지 않는다.
        // If-None-Match 비교와 304 는 Spring 이 응답 엔티티를 보고 처리한다.
        if (page is RenderAttractionPageUseCase.Page.Found) builder.eTag(etagOf(page.html))
        return builder.body(page.html)
    }

    private fun etagOf(html: String): String =
        MessageDigest.getInstance("SHA-256").digest(html.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
            .take(ETAG_LENGTH)

    private companion object {
        val ID = Regex("\\d{1,12}")
        val HTML_UTF8: MediaType = MediaType("text", "html", Charsets.UTF_8)
        const val RENDER_HEADER = "X-Render"
        const val RENDERED = "ssr"
        const val FALLBACK = "shell-fallback"
        const val ETAG_LENGTH = 16
    }
}
