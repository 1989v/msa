package com.kgd.search.domain.attraction.model

import java.time.LocalDate

/**
 * 다른 시도의 비슷한 곳 한 건 — 같은 언어·같은 유형에서 문서 벡터가 가까운 곳. 거리는 뜻이 없어 싣지 않는다.
 * 목록은 place `attraction_similar` 가 원본이고 재색인이 활성 문서만 남겨 싣는다.
 * [eventEndEffective] 는 항목이 행사일 때의 유효 종료일 — 재색인 뒤 끝난 항목을 렌더·화면이 오늘 기준으로 거른다.
 */
data class SimilarPlace(val id: String, val title: String, val sidoName: String?, val eventEndEffective: LocalDate?)
