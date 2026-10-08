package com.kgd.place.application.shortlink.usecase

/**
 * 단축 주소 클릭 1건 적재 — 원장 1행 + 관광지별 누적 수 1 증가.
 *
 * 리퍼러는 호스트만, UA 는 계열만 남긴다(`deal_offer_click` 과 같다). IP 는 받지 않는다.
 * 호출부는 실패를 삼킨다 — 302 가 본질이고 통계는 부수다.
 */
interface RecordAttractionShortLinkClickUseCase {
    fun execute(command: Command)

    data class Command(
        val attractionId: Long,
        val referrer: String?,
        val userAgent: String?,
    )
}
