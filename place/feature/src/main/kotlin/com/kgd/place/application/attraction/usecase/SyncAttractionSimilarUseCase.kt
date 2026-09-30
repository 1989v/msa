package com.kgd.place.application.attraction.usecase

/**
 * 비슷한 곳 적재 — `tools/embed similar` 가 쓰는 경로. 서버는 계산하지 않고 앞뒤만 검사해 저장한다.
 */
interface SyncAttractionSimilarUseCase {
    /** 요청 단위 all-or-nothing. 문서마다 그 스탬프의 목록을 통째로 바꾼다(빈 목록 = 지움). */
    fun replace(modelRef: String, documents: List<Document>): Applied

    /** [similar] 의 순서가 순위다. */
    data class Document(val attractionId: Long, val similar: List<Similar>)

    data class Similar(val id: Long, val score: Double)

    data class Applied(val documents: Int, val rows: Int)
}
