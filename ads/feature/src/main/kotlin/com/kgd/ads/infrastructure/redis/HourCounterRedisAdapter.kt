package com.kgd.ads.infrastructure.redis

import com.kgd.ads.application.settlement.dto.CreativeHourCount
import com.kgd.ads.application.settlement.dto.HourCounters
import com.kgd.ads.application.settlement.dto.PlacementHourCount
import com.kgd.ads.application.settlement.port.HourCounterPort
import com.kgd.ads.domain.placement.model.FillSource
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Component
import java.time.LocalDateTime

/**
 * 집계 작업의 카운터 읽기 — 한 시각의 소재×지면 해시, 지면별 해시, 미등록 지면 해시.
 * 결정·이벤트와 같은 키 이름([AdsRedisKeys])을 읽는다. 실패는 삼키지 않는다 — 그 시각을 닫지 않게 호출자가 안다.
 */
@Component
class HourCounterRedisAdapter(
    private val redis: AdsRedisConnection,
) : HourCounterPort {

    private val log = KotlinLogging.logger {}

    override fun read(hour: LocalDateTime, placementKeys: Collection<String>): HourCounters {
        val hash = redis.template.opsForHash<String, String>()
        val creatives = creativeCounts(hash.entries(AdsRedisKeys.creativeHour(hour)), hour)
        val placements = placementKeys.mapNotNull { key ->
            val fields = hash.entries(AdsRedisKeys.placementHour(key, hour))
            if (fields.isEmpty()) return@mapNotNull null
            fun count(field: String) = fields[field]?.toLong() ?: 0L
            PlacementHourCount(
                placementKey = key,
                requests = count(AdsRedisKeys.FIELD_REQUESTS),
                paidFilled = count(AdsRedisKeys.FIELD_PAID_FILLED),
                reportedPaid = count(AdsRedisKeys.reportedFillField(FillSource.PAID)),
                reportedAdsense = count(AdsRedisKeys.reportedFillField(FillSource.ADSENSE)),
                reportedHouse = count(AdsRedisKeys.reportedFillField(FillSource.HOUSE)),
                reportedEmpty = count(AdsRedisKeys.reportedFillField(FillSource.EMPTY)),
            )
        }
        val unregistered = hash.entries(AdsRedisKeys.unregisteredHour(hour)).mapValues { (_, value) -> value.toLong() }
        return HourCounters(creatives, placements, unregistered)
    }

    /** 필드 `{소재}:{캠페인}:{광고주}:{지면}:{imp|clk|spend}` 를 소재×지면 한 줄로 모은다. 모양이 다른 필드는 건너뛴다. */
    private fun creativeCounts(fields: Map<String, String>, hour: LocalDateTime): List<CreativeHourCount> {
        data class Row(val creativeId: Long, val campaignId: Long, val advertiserId: Long, val placementKey: String)
        val metrics = mutableMapOf<Row, MutableMap<String, Long>>()
        fields.forEach { (field, value) ->
            val parts = field.split(':')
            val ids = parts.take(3).map { it.toLongOrNull() }
            if (parts.size != 5 || ids.any { it == null }) {
                log.warn { "소재 카운터 필드 모양이 다르다 — 건너뜀: hour=$hour field=$field" }
                return@forEach
            }
            val row = Row(ids[0]!!, ids[1]!!, ids[2]!!, parts[3])
            metrics.getOrPut(row) { mutableMapOf() }[parts[4]] = value.toLong()
        }
        return metrics.map { (row, values) ->
            CreativeHourCount(
                creativeId = row.creativeId,
                campaignId = row.campaignId,
                advertiserId = row.advertiserId,
                placementKey = row.placementKey,
                impressions = values[AdsRedisKeys.METRIC_IMPRESSIONS] ?: 0,
                clicks = values[AdsRedisKeys.METRIC_CLICKS] ?: 0,
                spendMicros = values[AdsRedisKeys.METRIC_SPEND] ?: 0,
            )
        }
    }
}
