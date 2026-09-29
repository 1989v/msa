package com.kgd.search.application.attraction.usecase

/**
 * 관광지 상세의 서버 렌더 HTML (ADR-0103). portal-fe nginx 가 place 호스트의
 * `/attractions/{id}`·`/en/attractions/{id}` 를 이 렌더로 넘긴다.
 *
 * 없는 관광지도 HTML 을 돌려준다 — 셸 위에 404 본문을 얹어야 SPA 가 그대로 뜬다.
 * 색인 조회가 실패하면 렌더를 포기하고 셸을 그대로 낸다([Page.Fallback]) — 본문이 없어도
 * SPA 가 API 로 다시 그리므로, 5xx 보다 낫다.
 */
interface RenderAttractionPageUseCase {
    fun render(query: Query): Page

    /** 경로 언어의 404 — id 형식이 틀려 조회하지 않은 요청도 이 페이지를 받는다. */
    fun notFound(pathLang: String): Page.NotFound

    /**
     * @property id 숫자 1~12자리로 검증된 문서 id
     * @property pathLang 요청 경로의 언어. 404 문구에만 쓴다 — canonical 은 문서 언어를 따른다
     */
    data class Query(val id: String, val pathLang: String)

    sealed interface Page {
        val html: String

        data class Found(override val html: String) : Page
        data class NotFound(override val html: String) : Page

        /** 색인 조회 실패 — 셸 그대로(셸도 없으면 최소 HTML) */
        data class Fallback(override val html: String) : Page
    }
}
