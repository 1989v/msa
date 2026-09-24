package com.kgd.ads.application.report.usecase

import java.time.LocalDate

/**
 * 퍼블리셔(1989v) 리포트 — 지면별 일별(KST) 요청·유료 채움률(서버가 센 값)·최종 채움 출처 분포(화면이 보고한 참고치)·
 * 유료 노출·클릭·퍼블리셔 몫·RPM.
 *
 * 지면별 퍼블리셔 몫은 정산 거래의 퍼블리셔 미지급 분개를 그 (캠페인, 시각)의 지면별 지출 비율로 나눈 참고치다(내림) —
 * 정산이 캠페인 단위라 지면 몫은 배분으로만 나오고, 내림 때문에 지면 몫의 합은 원장보다 작을 수 있다.
 * 확정 금액은 [LedgerTotal] 이 원장에서 따로 준다.
 */
interface GetPublisherReportUseCase {
    fun execute(from: LocalDate, to: LocalDate): PublisherReport

    /** @param placements 지면×일 행 — 퍼블리셔 몫은 참고치 */
    data class PublisherReport(val placements: List<PlacementDay>, val ledgerTotal: LedgerTotal)

    /**
     * 기간의 퍼블리셔 몫 원장 총액 행.
     *
     * @param publisherPayableMicros 기간 안 정산 시각의 정산 거래가 퍼블리셔 미지급 원장 계정에 넣은 분개 합 — 확정 금액
     * @param allocatedMicros 지면별 몫(참고치)의 합. 내림 배분이라 [publisherPayableMicros] 이하다
     */
    data class LedgerTotal(val publisherPayableMicros: Long, val allocatedMicros: Long)

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
