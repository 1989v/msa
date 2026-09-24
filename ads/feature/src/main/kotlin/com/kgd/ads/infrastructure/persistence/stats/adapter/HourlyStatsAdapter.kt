package com.kgd.ads.infrastructure.persistence.stats.adapter

import com.kgd.ads.application.settlement.dto.HourCounters
import com.kgd.ads.application.settlement.port.HourlyStatsPort
import com.kgd.ads.infrastructure.persistence.placement.repository.PlacementJpaRepository
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.orm.jpa.SharedEntityManagerCreator
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.sql.Timestamp
import java.time.LocalDateTime

/**
 * 시간별 집계 표 쓰기. 카운터 값을 **더하지 않고 덮어쓴다** — 같은 시각을 몇 번 반영해도 값이 Redis 와 같다.
 * 예외는 미등록 지면 요청 수로, 시각 단위 행이 없어 닫을 때 한 번 더한다(닫힘 기록과 한 트랜잭션이라 두 번 더해지지 않는다).
 */
@Component
class HourlyStatsAdapter(
    private val placementRepository: PlacementJpaRepository,
    @Qualifier("adsEntityManagerFactory") emf: EntityManagerFactory,
) : HourlyStatsPort {

    private val em: EntityManager = SharedEntityManagerCreator.createSharedEntityManager(emf)

    override fun registeredPlacementKeys(): List<String> = placementRepository.findAll().map { it.placementKey }

    override fun closedHours(from: LocalDateTime, until: LocalDateTime): Set<LocalDateTime> =
        em.createNativeQuery("SELECT hour_kst FROM ad_aggregation_hour WHERE hour_kst BETWEEN :from AND :until")
            .setParameter("from", from)
            .setParameter("until", until)
            .resultList.map(::toLocalDateTime).toSet()

    override fun unclosedHoursBefore(before: LocalDateTime): Set<LocalDateTime> =
        em.createNativeQuery("SELECT DISTINCT hour_kst FROM ad_creative_hourly WHERE closed_at IS NULL AND hour_kst < :before")
            .setParameter("before", before)
            .resultList.map(::toLocalDateTime).toSet()

    @Transactional("adsTransactionManager")
    override fun save(hour: LocalDateTime, counters: HourCounters, closeAt: LocalDateTime?, now: LocalDateTime) {
        counters.creatives.forEach { c ->
            em.createNativeQuery(
                "INSERT INTO ad_creative_hourly (creative_id, placement_key, hour_kst, campaign_id, advertiser_id, " +
                    "impressions, clicks, spend_micros, closed_at, updated_at) " +
                    "VALUES (:creativeId, :placementKey, :hour, :campaignId, :advertiserId, :impressions, :clicks, :spend, NULL, :now) " +
                    "ON DUPLICATE KEY UPDATE impressions = :impressions, clicks = :clicks, spend_micros = :spend, updated_at = :now",
            )
                .setParameter("creativeId", c.creativeId)
                .setParameter("placementKey", c.placementKey)
                .setParameter("hour", hour)
                .setParameter("campaignId", c.campaignId)
                .setParameter("advertiserId", c.advertiserId)
                .setParameter("impressions", c.impressions)
                .setParameter("clicks", c.clicks)
                .setParameter("spend", c.spendMicros)
                .setParameter("now", now)
                .executeUpdate()
        }
        counters.placements.forEach { p ->
            em.createNativeQuery(
                "INSERT INTO ad_placement_hourly (placement_key, hour_kst, requests, paid_filled, " +
                    "reported_paid, reported_adsense, reported_house, reported_empty, updated_at) " +
                    "VALUES (:placementKey, :hour, :requests, :paidFilled, :rPaid, :rAdsense, :rHouse, :rEmpty, :now) " +
                    "ON DUPLICATE KEY UPDATE requests = :requests, paid_filled = :paidFilled, reported_paid = :rPaid, " +
                    "reported_adsense = :rAdsense, reported_house = :rHouse, reported_empty = :rEmpty, updated_at = :now",
            )
                .setParameter("placementKey", p.placementKey)
                .setParameter("hour", hour)
                .setParameter("requests", p.requests)
                .setParameter("paidFilled", p.paidFilled)
                .setParameter("rPaid", p.reportedPaid)
                .setParameter("rAdsense", p.reportedAdsense)
                .setParameter("rHouse", p.reportedHouse)
                .setParameter("rEmpty", p.reportedEmpty)
                .setParameter("now", now)
                .executeUpdate()
        }
        if (closeAt == null) return

        // 이미 닫힌 시각이면 유일 키 위반으로 트랜잭션 전체가 되돌아간다 — 미등록 요청 수가 두 번 더해지지 않는다
        em.createNativeQuery("INSERT INTO ad_aggregation_hour (hour_kst, closed_at) VALUES (:hour, :closeAt)")
            .setParameter("hour", hour)
            .setParameter("closeAt", closeAt)
            .executeUpdate()
        em.createNativeQuery("UPDATE ad_creative_hourly SET closed_at = :closeAt WHERE hour_kst = :hour AND closed_at IS NULL")
            .setParameter("closeAt", closeAt)
            .setParameter("hour", hour)
            .executeUpdate()
        counters.unregistered.forEach { (placementKey, requests) ->
            em.createNativeQuery(
                "INSERT INTO ad_unregistered_placement (placement_key, requests, first_seen_at, last_seen_at) " +
                    "VALUES (:placementKey, :requests, :hour, :hour) " +
                    "ON DUPLICATE KEY UPDATE requests = requests + :requests, " +
                    "first_seen_at = LEAST(first_seen_at, :hour), last_seen_at = GREATEST(last_seen_at, :hour)",
            )
                .setParameter("placementKey", placementKey)
                .setParameter("requests", requests)
                .setParameter("hour", hour)
                .executeUpdate()
        }
    }

    private fun toLocalDateTime(value: Any?): LocalDateTime = when (value) {
        is LocalDateTime -> value
        is Timestamp -> value.toLocalDateTime()
        else -> error("시각 컬럼 형식이 다르다: ${value?.javaClass}")
    }
}
