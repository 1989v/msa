package com.kgd.search.application.attraction.usecase

/**
 * 관광지 상세의 서버 렌더 HTML (ADR-0103). portal-fe nginx 가 place 호스트의
 * `/attractions/{id}`·`/en/attractions/{id}` 를 이 렌더로 넘긴다.
 *
 * 없는 관광지도 HTML 을 돌려준다 — 셸 위에 404 본문을 얹어야 SPA 가 그대로 뜬다.
 * 색인 조회가 실패하면 렌더를 포기하고 셸을 그대로 낸다([Page.Fallback]) — 본문이 없어도
 * SPA 가 API 로 다시 그리므로, 5xx 보다 낫다.
 * 문서 언어와 경로 언어가 다르면 렌더하지 않고 문서 언어 경로로 옮기라는 결과([Page.Redirect])를 낸다 —
 * 같은 문서가 두 주소로 200 이 되지 않게.
 */
interface RenderAttractionPageUseCase {
    fun render(query: Query): Page

    /** 경로 언어의 404 — id 형식이 틀려 조회하지 않은 요청도 이 페이지를 받는다. */
    fun notFound(pathLang: String): Page.NotFound

    /**
     * @property id 숫자 1~12자리로 검증된 문서 id
     * @property pathLang 요청 경로의 언어(ko·en). 404 문구와 문서 언어 어긋남 판정에 쓴다 — canonical 은 문서 언어를 따른다
     */
    data class Query(val id: String, val pathLang: String)

    sealed interface Page {
        /** 렌더한 HTML 이 있는 결과 */
        sealed interface Rendered : Page {
            val html: String
        }

        data class Found(override val html: String) : Rendered
        data class NotFound(override val html: String) : Rendered

        /** 색인 조회 실패 — 셸 그대로(셸도 없으면 최소 HTML) */
        data class Fallback(override val html: String) : Rendered

        /**
         * 경로 언어가 문서 언어와 다르다 — 본문 없이 문서 언어 경로로 옮긴다.
         * @property docLang 정규화한 문서 언어(en 외는 ko)
         * @property id 문서 자신의 id. 영문 짝이 있어도 짝으로 보내지 않는다(canonical 과 같은 행선)
         * @property location 옮길 경로(호스트 없음) — canonical 을 만드는 렌더 포트의 같은 함수로 만든다
         */
        data class Redirect(val docLang: String, val id: String, val location: String) : Page
    }
}
