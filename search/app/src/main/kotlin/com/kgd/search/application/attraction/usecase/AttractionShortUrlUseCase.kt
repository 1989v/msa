package com.kgd.search.application.attraction.usecase

/**
 * 관광지 상세 응답에 실을 단축 주소 `1989v.com/p/{code}` (ADR-0103).
 *
 * search 문서 id 와 place 관광지 id 가 같다는 전제를 쓴다. 노출 설정이 꺼져 있거나 id 를 코드로 바꿀 수 없으면 null.
 */
interface AttractionShortUrlUseCase {
    fun shortUrlOf(attractionId: String): String?
}
