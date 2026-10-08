package com.kgd.search.application.attraction.port

/**
 * place 의 관광지 분류 코드표(`attraction_category_codes`) — 서비스 간 DB 를 공유하지 않으므로 API 로 받는다.
 * 사전으로 만드는 일은 [com.kgd.search.application.attraction.usecase.CategoryLexiconUseCase] 가 한다.
 */
interface CategoryCodePort {
    /** 언어별 행 전부. 받지 못했거나 기능이 꺼져 있으면 빈 목록이다. */
    fun codes(): List<CategoryCode>
}

/** 코드표 한 행 — 같은 코드가 언어마다 한 행씩 있고, [depth] 가 걸릴 색인 필드(`lclsSystm1~3`)를 정한다. */
data class CategoryCode(val lang: String, val code: String, val depth: Int, val name: String)
