package com.kgd.search.domain.attraction.model

/**
 * 다른 시도의 비슷한 곳 한 건 — 같은 언어·같은 유형에서 문서 벡터가 가까운 곳. 거리는 뜻이 없어 싣지 않는다.
 * 목록은 place `attraction_similar` 가 원본이고 재색인이 활성 문서만 남겨 싣는다.
 */
data class SimilarPlace(val id: String, val title: String, val sidoName: String?)
