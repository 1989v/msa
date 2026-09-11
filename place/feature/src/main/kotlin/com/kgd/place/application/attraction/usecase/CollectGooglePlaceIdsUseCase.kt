package com.kgd.place.application.attraction.usecase

/**
 * 구글 place_id 보강 — 수집기(place-ingest)가 쓰는 경로 (AttractionLinkInternalController 와
 * 같은 `/internal` 패턴). 일일 예산은 수집기 쪽 환경변수가 관리한다 — Text Search ID-only 는
 * 무과금 SKU 라 place 가 호출 원장을 들 필요까지는 없다 (유튜브 100 units/콜과 다르다).
 */
interface CollectGooglePlaceIdsUseCase {
    /**
     * place_id 가 빈 관광지를 id 순으로 돌려준다. 원천에 없는 장소(검색 0건)는 null 로 남아
     * 다음 실행에 다시 시도된다 — ID-only 호출은 무과금이고 구글 색인은 자라므로 재시도가 맞다.
     */
    fun findPending(lang: String?, limit: Int): List<PendingItem>

    fun apply(results: List<Result>): Int

    data class PendingItem(
        /** 검색어는 표시명이다 — 원천 제목의 꼬리 괄호 표기를 실으면 질의가 무너진다. */
        val attractionId: Long,
        val title: String,
        val lang: String,
        val address: String?,
    )

    data class Result(val attractionId: Long, val googlePlaceId: String)
}
