package com.kgd.ads.application.advertiser.usecase

import com.kgd.ads.domain.advertiser.model.AdvertiserStatus

/**
 * 광고주 대시보드 — 잔액과 오늘(KST) 지출·청구액. 정지된 광고주도 조회는 된다.
 * 지출은 시간별 집계에 반영된 만큼이라 최대 집계 주기(5분)만큼 늦다.
 */
interface GetAdvertiserDashboardUseCase {
    fun execute(memberId: Long): Dashboard

    data class Dashboard(
        val advertiserId: Long,
        val displayName: String,
        val status: AdvertiserStatus,
        val suspendReason: String?,
        val balanceMicros: Long,
        val todaySpendMicros: Long,
        val todayChargedMicros: Long,
    )
}
