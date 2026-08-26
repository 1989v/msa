package com.kgd.deal.application.offer.usecase

/**
 * 클릭 1건 적재. 호출부는 이 실패를 삼킨다 — 리다이렉트가 본질이고 통계는 부수다.
 */
interface RecordDealClickUseCase {
    fun execute(command: Command)

    data class Command(val offerId: Long, val referrer: String?, val userAgent: String?)
}
