package com.kgd.search.application.attraction.usecase

import com.fasterxml.jackson.annotation.JsonUnwrapped

/**
 * 관광지 상세 응답 — 검색 결과 필드를 그대로 펼치고 `shortUrl` 을 더한다.
 *
 * 단축 주소는 색인 문서가 아니라 응답을 조립할 때 계산한다. 목록 응답에는 싣지 않는다.
 *
 * 상세 API(`/api/search/attractions/{id}` 의 `data`)와 상세 서버 렌더가 HTML 에 싣는 데이터가 이 한 모양이다 —
 * 화면은 렌더가 실어 보낸 것을 API 응답 대신 그대로 쓰므로, 둘이 갈리면 첫 화면과 이동 뒤 화면이 달라진다.
 */
data class AttractionDetailResponse(
    @get:JsonUnwrapped
    val attraction: SearchAttractionUseCase.AttractionSearchResult,
    val shortUrl: String?,
)
