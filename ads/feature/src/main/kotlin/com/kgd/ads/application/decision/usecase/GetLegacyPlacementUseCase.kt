package com.kgd.ads.application.decision.usecase

/**
 * 전환 릴리스 동안만 있는 옛 지면 조회(`GET /api/v1/ads/placements/{key}`) — 결정 API 로 넘어가기 전의 화면이
 * 그 지면의 승인된 HOUSE 소재 목록을 받는다. 후보 인덱스에서 읽고 DB 를 부르지 않는다.
 * 호환 경로 제거 릴리스에서 함께 지운다.
 */
interface GetLegacyPlacementUseCase {
    /** 등록되지 않았거나 비활성인 지면이면 null. 인덱스를 아직 한 번도 못 읽었으면 소재 없는 지면으로 준다(화면은 배너를 숨긴다). */
    fun execute(placementKey: String): LegacyPlacement?

    data class LegacyPlacement(val placementKey: String, val creatives: List<LegacyHouseCreative>)

    data class LegacyHouseCreative(val title: String, val body: String, val link: String, val emoji: String?)
}
