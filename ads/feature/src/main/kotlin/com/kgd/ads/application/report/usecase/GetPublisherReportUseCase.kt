package com.kgd.ads.application.report.usecase

import java.time.LocalDate

/**
 * 퍼블리셔(1989v) 리포트 — 지면별 일별(KST) 요청·유료 채움률(서버가 센 값)·최종 채움 출처 분포(화면이 보고한 참고치)·
 * 유료 노출·클릭·퍼블리셔 몫·RPM.
 *
 * 퍼블리셔 몫은 정산 거래의 퍼블리셔 미지급 분개를 그 (캠페인, 시각)의 지면별 지출 비율로 나눈 값이다(내림) —
 * 정산이 캠페인 단위라 지면 몫은 배분으로만 나온다.
 */
interface GetPublisherReportUseCase {
    fun execute(from: LocalDate, to: LocalDate): List<PlacementDay>

    /**
     * @param paidFillRate 유료 채움 ÷ 요청(요청이 0 이면 0)
     * @param rpmMicros 요청 1,000회당 퍼블리셔 몫
     */
    data class PlacementDay(
        val placementKey: String,
        val date: LocalDate,
        val requests: Long,
        val paidFilled: Long,
        val paidFillRate: Double,
        val clientReportedFill: ClientReportedFill,
        val impressions: Long,
        val clicks: Long,
        val publisherRevenueMicros: Long,
        val rpmMicros: Long,
    )

    /** 화면이 보고한 최종 채움 출처 — 과금 근거가 아닌 참고치다. */
    data class ClientReportedFill(val paid: Long, val adsense: Long, val house: Long, val empty: Long)
}
