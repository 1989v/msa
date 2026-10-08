package com.kgd.search.application.attraction.usecase

/**
 * place 호스트의 최근 갱신 피드 `/feed.xml`(국문) · `/en/feed.xml`(영문). portal-fe nginx 가 요청마다 이 렌더로 넘긴다.
 *
 * 색인 조회가 실패하면 [Feed.Unavailable] 이다 — 빈 channel 을 내면 구독기가 항목이 모두 사라졌다고 읽는다.
 */
interface RenderAttractionFeedUseCase {
    /** [lang] 은 [LANGS] 중 하나여야 한다 — 그 밖의 값은 호출자가 404 로 끝낸다 */
    fun render(lang: String): Feed

    sealed interface Feed {
        data class Ok(val xml: String) : Feed
        data object Unavailable : Feed
    }

    companion object {
        val LANGS = setOf("ko", "en")
    }
}
