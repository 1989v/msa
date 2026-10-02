package com.kgd.search.application.attraction.usecase

/**
 * place 호스트의 `sitemap-places-events.xml` (ADR-0103). portal-fe nginx 가 요청마다 이 렌더로 넘긴다.
 *
 * 행사는 빌드 사이에 끝나므로 정적 sitemap 에 싣지 않고 요청 시점의 오늘(KST)로 만든다.
 * 색인 조회가 실패하면 [Sitemap.Unavailable] 이다 — 빈 urlset 을 내면 크롤러가 행사 URL 이 모두 사라졌다고 읽는다.
 */
interface RenderEventSitemapUseCase {
    fun render(): Sitemap

    sealed interface Sitemap {
        data class Ok(val xml: String) : Sitemap
        data object Unavailable : Sitemap
    }
}
