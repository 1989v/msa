package com.kgd.ads.support

import com.kgd.ads.domain.placement.model.FillSource
import com.kgd.ads.infrastructure.redis.AdsRedisKeys
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.jdbc.core.JdbcTemplate
import java.time.Duration
import java.time.LocalDateTime

/**
 * 집계·정산 스펙의 입력. 카운터는 이벤트 수락 스크립트와 같은 키·필드에 올리고(수명 포함),
 * 「이미 닫힌 시각」은 앞 실행이 닫고 정산 전에 멈춘 상태를 DB 에 직접 만든다.
 *
 * 집계 작업은 DB 전체의 닫힌 미정산 행을 정산하므로, 스펙들은 서로 다른 달(집계 10월 · 정산 11월 · 원장 12월)을 쓴다 —
 * 다른 스펙의 Redis 카운터(2026-09-23)가 카운터 수명 창에 들어오지 않게.
 */
class SettlementFixtures(private val jdbc: JdbcTemplate, private val redis: StringRedisTemplate) {

    fun creativeCounter(
        hour: LocalDateTime,
        creativeId: Long,
        campaignId: Long,
        advertiserId: Long,
        placementKey: String,
        impressions: Long = 0,
        clicks: Long = 0,
        spendMicros: Long = 0,
    ) {
        val key = AdsRedisKeys.creativeHour(hour)
        val prefix = AdsRedisKeys.creativeFieldPrefix(creativeId, campaignId, advertiserId, placementKey)
        val hash = redis.opsForHash<String, String>()
        if (impressions != 0L) hash.increment(key, "$prefix:${AdsRedisKeys.METRIC_IMPRESSIONS}", impressions)
        if (clicks != 0L) hash.increment(key, "$prefix:${AdsRedisKeys.METRIC_CLICKS}", clicks)
        if (spendMicros != 0L) hash.increment(key, "$prefix:${AdsRedisKeys.METRIC_SPEND}", spendMicros)
        redis.expire(key, COUNTER_TTL)
    }

    fun placementCounter(hour: LocalDateTime, placementKey: String, requests: Long, paidFilled: Long, reported: Map<FillSource, Long> = emptyMap()) {
        val key = AdsRedisKeys.placementHour(placementKey, hour)
        val hash = redis.opsForHash<String, String>()
        hash.increment(key, AdsRedisKeys.FIELD_REQUESTS, requests)
        hash.increment(key, AdsRedisKeys.FIELD_PAID_FILLED, paidFilled)
        reported.forEach { (source, count) -> hash.increment(key, AdsRedisKeys.reportedFillField(source), count) }
        redis.expire(key, COUNTER_TTL)
    }

    fun unregisteredCounter(hour: LocalDateTime, placementKey: String, requests: Long) {
        val key = AdsRedisKeys.unregisteredHour(hour)
        redis.opsForHash<String, String>().increment(key, placementKey, requests)
        redis.expire(key, COUNTER_TTL)
    }

    /** 앞 실행이 닫아 두고 정산 전에 멈춘 시각 — 소재×지면 행(closed) + 닫힘 기록. */
    fun closedHourRow(hour: LocalDateTime, creativeId: Long, campaignId: Long, advertiserId: Long, placementKey: String, spendMicros: Long) {
        jdbc.update(
            "INSERT INTO ad_creative_hourly (creative_id, placement_key, hour_kst, campaign_id, advertiser_id, impressions, clicks, " +
                "spend_micros, closed_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)",
            creativeId, placementKey, hour, campaignId, advertiserId, spendMicros, hour.plusHours(2), hour.plusHours(2),
        )
        jdbc.update("INSERT IGNORE INTO ad_aggregation_hour (hour_kst, closed_at) VALUES (?, ?)", hour, hour.plusHours(2))
    }

    data class HourlyRow(val impressions: Long, val clicks: Long, val spendMicros: Long, val closed: Boolean)

    fun creativeHourly(creativeId: Long, placementKey: String, hour: LocalDateTime): HourlyRow? =
        jdbc.query(
            "SELECT impressions, clicks, spend_micros, closed_at FROM ad_creative_hourly WHERE creative_id = ? AND placement_key = ? AND hour_kst = ?",
            { rs, _ -> HourlyRow(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getObject(4) != null) },
            creativeId, placementKey, hour,
        ).singleOrNull()

    /** 정산 기록 — 시각 → (청구액, 거래 id) */
    fun settlements(campaignId: Long): Map<LocalDateTime, Pair<Long, Long?>> =
        jdbc.query(
            "SELECT hour_kst, charged_micros, transaction_id FROM ad_settlement WHERE campaign_id = ? ORDER BY hour_kst",
            { rs, _ -> rs.getObject(1, LocalDateTime::class.java) to (rs.getLong(2) to rs.getObject(3)?.let { (it as Number).toLong() }) },
            campaignId,
        ).toMap()

    fun walletBalance(advertiserId: Long): Long =
        jdbc.queryForObject("SELECT balance_micros FROM ad_ledger_account WHERE advertiser_id = ?", Long::class.java, advertiserId)!!

    fun walletAccountId(advertiserId: Long): Long =
        jdbc.queryForObject("SELECT id FROM ad_ledger_account WHERE advertiser_id = ?", Long::class.java, advertiserId)!!

    /** 지갑 계정의 분개 수와 합. */
    fun walletEntries(advertiserId: Long): Pair<Long, Long> =
        jdbc.queryForObject(
            "SELECT COUNT(*), COALESCE(SUM(amount_micros), 0) FROM ad_ledger_entry WHERE account_id = ?",
            { rs, _ -> rs.getLong(1) to rs.getLong(2) },
            walletAccountId(advertiserId),
        )!!

    fun systemBalance(type: String): Long =
        jdbc.queryForObject("SELECT balance_micros FROM ad_ledger_account WHERE type = ? AND advertiser_id IS NULL", Long::class.java, type)!!

    fun settledThrough(advertiserId: Long): LocalDateTime? =
        jdbc.query(
            "SELECT settled_through_hour_kst FROM ad_advertiser_settled_through WHERE advertiser_id = ?",
            { rs, _ -> rs.getObject(1, LocalDateTime::class.java) },
            advertiserId,
        ).singleOrNull()

    fun isHourClosed(hour: LocalDateTime): Boolean =
        jdbc.queryForObject("SELECT COUNT(*) FROM ad_aggregation_hour WHERE hour_kst = ?", Long::class.java, hour)!! > 0

    companion object {
        private val COUNTER_TTL: Duration = Duration.ofHours(AdsRedisKeys.COUNTER_TTL_HOURS)
    }
}
