package com.kgd.search.presentation.render.controller

import com.kgd.search.application.attraction.usecase.RenderAttractionFeedUseCase
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

/**
 * 최근 갱신 피드. portal-fe nginx 가 place 호스트의 `/feed.xml` · `/en/feed.xml` 을 이 경로로 넘긴다.
 * `/internal` 하위라 공개 게이트웨이 라우트에 없다([AttractionPageController] 와 같은 이유).
 *
 * 캐시 헤더는 여기서 단다 — 성공은 10분, 조회 실패(503)는 `no-store`. nginx 는 헤더를 덧붙이지 않고 그대로 내보낸다
 * (nginx 가 성공 헤더를 따로 달면 한 응답에 Cache-Control 이 두 벌 나간다).
 */
@RestController
class AttractionFeedController(
    private val renderFeed: RenderAttractionFeedUseCase,
) {

    @GetMapping("/internal/render/feed/{lang}.xml")
    fun feed(@PathVariable lang: String): ResponseEntity<String> {
        if (lang !in RenderAttractionFeedUseCase.LANGS) return ResponseEntity.notFound().build()
        return when (val feed = renderFeed.render(lang)) {
            is RenderAttractionFeedUseCase.Feed.Ok -> ResponseEntity.ok()
                .contentType(RSS_UTF8)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=600")
                .body(feed.xml)
            RenderAttractionFeedUseCase.Feed.Unavailable -> ResponseEntity.status(503)
                .contentType(MediaType.TEXT_PLAIN)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body("feed unavailable")
        }
    }

    private companion object {
        val RSS_UTF8: MediaType = MediaType("application", "rss+xml", Charsets.UTF_8)
    }
}
