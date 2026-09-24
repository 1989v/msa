package com.kgd.ads.infrastructure.persistence.report.adapter

import com.kgd.ads.application.report.dto.CreativeHourRow
import com.kgd.ads.application.report.dto.PlacementHourRow
import com.kgd.ads.application.report.dto.PublisherShareRow
import com.kgd.ads.application.report.dto.SettlementHourRow
import com.kgd.ads.application.report.dto.SpendTotals
import com.kgd.ads.application.report.port.ReportPort
import com.kgd.ads.infrastructure.persistence.support.NativeRows.dateTime
import com.kgd.ads.infrastructure.persistence.support.NativeRows.long
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import jakarta.persistence.Query
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.orm.jpa.SharedEntityManagerCreator
import org.springframework.stereotype.Component
import java.time.LocalDateTime

/** 리포트 읽기 — 시간별 집계·정산·원장 표를 그대로 읽는다. 합산은 서비스가 한다. */
@Component
class ReportRepositoryAdapter(
    @Qualifier("adsEntityManagerFactory") emf: EntityManagerFactory,
) : ReportPort {

    private val em: EntityManager = SharedEntityManagerCreator.createSharedEntityManager(emf)

    override fun creativeHours(advertiserId: Long, from: LocalDateTime, until: LocalDateTime): List<CreativeHourRow> =
        rows(
            em.createNativeQuery(
                "SELECT creative_id, campaign_id, placement_key, hour_kst, impressions, clicks, spend_micros FROM ad_creative_hourly " +
                    "WHERE advertiser_id = :advertiserId AND hour_kst >= :from AND hour_kst < :until",
            ).setParameter("advertiserId", advertiserId),
            from, until,
        ).map(::creativeHour)

    override fun paidCreativeHours(from: LocalDateTime, until: LocalDateTime): List<CreativeHourRow> =
        rows(
            em.createNativeQuery(
                "SELECT h.creative_id, h.campaign_id, h.placement_key, h.hour_kst, h.impressions, h.clicks, h.spend_micros " +
                    "FROM ad_creative_hourly h JOIN ad_advertiser a ON a.id = h.advertiser_id " +
                    "WHERE a.kind = 'MEMBER' AND h.hour_kst >= :from AND h.hour_kst < :until",
            ),
            from, until,
        ).map(::creativeHour)

    override fun settlements(advertiserId: Long, from: LocalDateTime, until: LocalDateTime): List<SettlementHourRow> =
        rows(
            em.createNativeQuery(
                "SELECT campaign_id, hour_kst, spend_micros, charged_micros FROM ad_settlement " +
                    "WHERE advertiser_id = :advertiserId AND hour_kst >= :from AND hour_kst < :until",
            ).setParameter("advertiserId", advertiserId),
            from, until,
        ).map { SettlementHourRow(long(it[0]), dateTime(it[1]), long(it[2]), long(it[3])) }

    override fun placementHours(from: LocalDateTime, until: LocalDateTime): List<PlacementHourRow> =
        rows(
            em.createNativeQuery(
                "SELECT placement_key, hour_kst, requests, paid_filled, reported_paid, reported_adsense, reported_house, reported_empty " +
                    "FROM ad_placement_hourly WHERE hour_kst >= :from AND hour_kst < :until",
            ),
            from, until,
        ).map {
            PlacementHourRow(
                it[0] as String, dateTime(it[1]), long(it[2]), long(it[3]), long(it[4]), long(it[5]), long(it[6]), long(it[7]),
            )
        }

    override fun publisherShares(from: LocalDateTime, until: LocalDateTime): List<PublisherShareRow> =
        rows(
            em.createNativeQuery(
                "SELECT s.campaign_id, s.hour_kst, e.amount_micros FROM ad_settlement s " +
                    "JOIN ad_ledger_entry e ON e.transaction_id = s.transaction_id " +
                    "JOIN ad_ledger_account acc ON acc.id = e.account_id AND acc.type = 'PUBLISHER_PAYABLE' " +
                    "WHERE s.hour_kst >= :from AND s.hour_kst < :until",
            ),
            from, until,
        ).map { PublisherShareRow(long(it[0]), dateTime(it[1]), long(it[2])) }

    override fun advertiserTotals(advertiserId: Long, from: LocalDateTime, until: LocalDateTime): SpendTotals {
        fun sum(sql: String): Long =
            long(em.createNativeQuery(sql).setParameter("advertiserId", advertiserId).setParameter("from", from).setParameter("until", until).singleResult)
        return SpendTotals(
            spendMicros = sum(
                "SELECT COALESCE(SUM(spend_micros), 0) FROM ad_creative_hourly WHERE advertiser_id = :advertiserId AND hour_kst >= :from AND hour_kst < :until",
            ),
            chargedMicros = sum(
                "SELECT COALESCE(SUM(charged_micros), 0) FROM ad_settlement WHERE advertiser_id = :advertiserId AND hour_kst >= :from AND hour_kst < :until",
            ),
        )
    }

    private fun rows(query: Query, from: LocalDateTime, until: LocalDateTime): List<Array<*>> =
        query.setParameter("from", from).setParameter("until", until).resultList.map { it as Array<*> }

    private fun creativeHour(r: Array<*>) =
        CreativeHourRow(long(r[0]), long(r[1]), r[2] as String, dateTime(r[3]), long(r[4]), long(r[5]), long(r[6]))
}
