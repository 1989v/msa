package com.kgd.search.application.attraction.usecase

import com.kgd.search.domain.query.model.QueryIntent

/**
 * 쿼리 언더스탠딩이 쓰는 분류 이름 사전 (ADR-0090 개정).
 *
 * 원본은 place 의 `attraction_category_codes` 이고, **그 언어의 attractions 색인에 문서가 1건 이상인 코드만** 담는다 —
 * 코드표에만 있는 코드로 필터를 걸면 결과가 0건이 된다(「템플스테이」 → `EX040100`, 색인 문서 0).
 *
 * 실패 처리: 코드표나 색인 집합을 못 받으면 들고 있던 사전을 쓴다. 처음부터 코드표를 못 받았으면 빈 사전이고,
 * 코드표는 받았는데 색인 집합을 한 번도 못 받았으면 코드표 전체로 만든다. 사전이 없으면 분류 의도어가
 * 검색어로 남을 뿐 검색은 계속 된다 — place 장애가 검색 장애가 되면 안 된다.
 */
interface CategoryLexiconUseCase {
    /** [lang] 이 null 이면 국문(ko) 사전. */
    fun lexicon(lang: String?): QueryIntent.Lexicon
}
