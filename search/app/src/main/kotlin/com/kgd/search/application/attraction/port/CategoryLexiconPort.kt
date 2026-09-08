package com.kgd.search.application.attraction.port

import com.kgd.search.domain.attraction.model.QueryIntent

/**
 * 질의 이해가 쓰는 분류 이름 사전의 공급원 (ADR-0090 개정).
 *
 * 원본은 place 의 `attraction_category_codes` 다 — 서비스 간 DB 를 공유하지 않으므로 API 로 받는다.
 * **못 받으면 빈 사전을 준다.** 사전이 없으면 분류 의도어가 검색어로 남을 뿐 검색은 계속 된다 —
 * place 장애가 검색 장애가 되면 안 된다.
 */
interface CategoryLexiconPort {
    fun lexicon(lang: String?): QueryIntent.Lexicon
}
