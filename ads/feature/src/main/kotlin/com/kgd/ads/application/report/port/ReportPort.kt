package com.kgd.ads.application.report.port

import com.kgd.ads.application.report.dto.CreativeHourRow
import com.kgd.ads.application.report.dto.PlacementHourRow
import com.kgd.ads.application.report.dto.PublisherShareRow
import com.kgd.ads.application.report.dto.SettlementHourRow
import com.kgd.ads.application.report.dto.SpendTotals
import java.time.LocalDateTime

/** 리포트의 원천 — 시간별 집계 두 표와 정산·원장뿐이다. 모든 범위는 [from, until) KST 시각. */
interface ReportPort {
    fun creativeHours(advertiserId: Long, from: LocalDateTime, until: LocalDateTime): List<CreativeHourRow>

    /** 유료(MEMBER 광고주) 소재의 시간별 집계 전부 — 퍼블리셔 리포트용. */
    fun paidCreativeHours(from: LocalDateTime, until: LocalDateTime): List<CreativeHourRow>

    fun settlements(advertiserId: Long, from: LocalDateTime, until: LocalDateTime): List<SettlementHourRow>
    fun placementHours(from: LocalDateTime, until: LocalDateTime): List<PlacementHourRow>
    fun publisherShares(from: LocalDateTime, until: LocalDateTime): List<PublisherShareRow>

    /** 광고주의 지출(시간별 집계)·청구액(정산) 합. */
    fun advertiserTotals(advertiserId: Long, from: LocalDateTime, until: LocalDateTime): SpendTotals
}
