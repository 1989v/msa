package com.kgd.search.presentation.search.dto

import com.fasterxml.jackson.annotation.JsonUnwrapped
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase

/**
 * 관광지 상세 응답 — 검색 결과 필드를 그대로 펼치고 `shortUrl` 을 더한다.
 *
 * 단축 주소는 색인 문서가 아니라 응답을 조립할 때 계산한다. 목록 응답에는 싣지 않는다.
 */
data class AttractionDetailResponse(
    @get:JsonUnwrapped
    val attraction: SearchAttractionUseCase.AttractionSearchResult,
    val shortUrl: String?,
)
