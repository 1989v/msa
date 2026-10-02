package com.kgd.search.presentation.render.controller

import com.kgd.search.application.attraction.usecase.RenderEventSitemapUseCase
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 행사 sitemap (ADR-0103). portal-fe nginx 가 place 호스트의 `/sitemap-places-events.xml` 을 이 경로로 넘긴다.
 * `/internal` 하위라 공개 게이트웨이 라우트에 없다([AttractionPageController] 와 같은 이유).
 *
 * 조회 실패는 503 이다 — 빈 200 은 크롤러에게 「URL 이 전부 사라졌다」로 읽힌다. 503 에는 `no-store` 를 달아
 * 앞단 캐시가 오류를 붙잡지 않게 한다. 200 의 캐시 헤더는 nginx 가 단다.
 */
@RestController
class EventSitemapController(
    private val renderSitemap: RenderEventSitemapUseCase,
) {

    @GetMapping("/internal/render/sitemap/events.xml")
    fun events(): ResponseEntity<String> = when (val sitemap = renderSitemap.render()) {
        is RenderEventSitemapUseCase.Sitemap.Ok -> ResponseEntity.ok()
            .contentType(XML_UTF8)
            .body(sitemap.xml)
        RenderEventSitemapUseCase.Sitemap.Unavailable -> ResponseEntity.status(503)
            .contentType(MediaType.TEXT_PLAIN)
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body("event sitemap unavailable")
    }

    private companion object {
        val XML_UTF8: MediaType = MediaType("application", "xml", Charsets.UTF_8)
    }
}
