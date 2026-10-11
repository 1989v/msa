package com.kgd.search.presentation.search.dto

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonUnwrapped
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase

/**
 * 관광지 목록 응답 — 검색 결과 필드를 그대로 펼치고, 해석한 조건을 API 이름(`param`·`value`)으로 바꿔 싣는다.
 * 결과의 도메인 조건(`interpreted`)은 응답에 내보내지 않는다.
 */
data class AttractionSearchResponse(
    @get:JsonUnwrapped
    @get:JsonIgnoreProperties("interpreted")
    val result: SearchAttractionUseCase.Result,
    val interpretedConditions: List<AttractionConditionParams.InterpretedCondition>,
) {
    companion object {
        fun of(result: SearchAttractionUseCase.Result) = AttractionSearchResponse(
            result = result,
            interpretedConditions = result.interpreted.map(AttractionConditionParams::toResponse),
        )
    }
}
