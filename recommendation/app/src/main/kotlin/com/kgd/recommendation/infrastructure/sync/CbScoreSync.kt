package com.kgd.recommendation.infrastructure.sync

import com.kgd.common.statistics.Wilson
import com.kgd.recommendation.infrastructure.persistence.CbScoreRow
import com.kgd.recommendation.infrastructure.persistence.ClickHouseScoreReader
import com.kgd.recommendation.infrastructure.persistence.RedisRecommendationAdapter
import com.kgd.recommendation.service.ActionWeightedScore
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration
import kotlin.math.ln

/**
 * Phase 1 일별 batch — ClickHouse 의 `recommendation_score_daily` 에서 행동 카운트를 읽어
 * 행동 가중합 × log(1 + wilson_ctr × 100) 으로 ranking score 를 계산한 뒤
 * Redis ZSET (`reco:cb:{cityId}:{categoryId}`) 으로 atomic swap 한다.
 *
 * Argo CronWorkflow (k8s/base/recommendation/argo-workflow.yaml) 가 매일 02:00 호출.
 * 호출 경로는 [com.kgd.recommendation.infrastructure.sync.InternalSyncController].
 */
@Component
class CbScoreSync(
    private val reader: ClickHouseScoreReader,
    private val redis: StringRedisTemplate,
) {
    private val logger = KotlinLogging.logger {}

    /**
     * 전체 (city × category) 별 Top-100 산출 후 Redis 갱신.
     *
     * @return 처리한 (city, category) partition 수 + 총 item row 수
     */
    fun sync(topPerPartition: Int = 100, ttl: Duration = Duration.ofHours(25)): SyncResult {
        val rows = reader.read30dActionCounts()
        logger.info { "CbScoreSync: read ${rows.size} rows from ClickHouse" }

        if (rows.isEmpty()) return SyncResult(partitionCount = 0, itemCount = 0)

        val byPartition: Map<Pair<Long, Long>, List<CbScoreRow>> = rows.groupBy { it.cityId to it.categoryId }
        var totalItems = 0

        byPartition.forEach { (key, partitionRows) ->
            val (cityId, categoryId) = key
            val scored = partitionRows
                .map { it to computeScore(it) }
                .sortedByDescending { (_, score) -> score }
                .take(topPerPartition)

            if (scored.isEmpty()) return@forEach

            val redisKey = RedisRecommendationAdapter.cbKey(cityId, categoryId)
            val stagingKey = "$redisKey:staging"

            redis.delete(stagingKey)
            scored.forEach { (row, score) ->
                redis.opsForZSet().add(stagingKey, row.itemId.toString(), score)
            }
            // atomic swap: rename staging → live
            redis.rename(stagingKey, redisKey)
            redis.expire(redisKey, ttl)
            totalItems += scored.size
        }

        logger.info { "CbScoreSync: synced ${byPartition.size} partitions / $totalItems items" }
        return SyncResult(partitionCount = byPartition.size, itemCount = totalItems)
    }

    private fun computeScore(row: CbScoreRow): Double {
        val weighted = ActionWeightedScore.compute(
            reservationCount = row.reservationCount,
            clickCount = row.clickCount,
            addwishCount = row.addwishCount,
            pageviewCount = row.pageviewCount,
        )
        // CTR = click / (click + pageview) — 가장 노출-친화 메트릭
        val ctrTotal = row.clickCount + row.pageviewCount
        val wilsonCtr = Wilson.lowerConfidenceBound(row.clickCount, ctrTotal)
        // 인기 + 신뢰 결합. log saturation 으로 popular item bias 완화.
        return weighted * ln(1.0 + wilsonCtr * 100)
    }

    data class SyncResult(val partitionCount: Int, val itemCount: Int)
}
