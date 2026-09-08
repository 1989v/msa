package com.kgd.place.application.attraction.port

import com.kgd.place.domain.attraction.model.AttractionCategoryCode

interface AttractionCategoryCodeRepositoryPort {
    /** (lang, code) 자연키 기준 멱등 upsert. 원천이 이름을 고치면 그것만 갱신된다. */
    fun upsertAll(codes: List<AttractionCategoryCode>): Int

    /** lang 미지정 시 전체. 표가 작아(수백 행) 페이징을 두지 않는다. */
    fun findAll(lang: String?): List<AttractionCategoryCode>
}
