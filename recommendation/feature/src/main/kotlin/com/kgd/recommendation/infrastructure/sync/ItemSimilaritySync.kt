package com.kgd.recommendation.infrastructure.sync

import com.kgd.recommendation.infrastructure.persistence.ClickHouseItemSimilarityComputer
import com.kgd.recommendation.infrastructure.persistence.RedisItemSimilarityAdapter
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import java.time.Duration
import javax.sql.DataSource

/**
 * Phase 2 weekly batch.
 *
 * 단계:
 * 1. ClickHouse 에서 PPMI 재계산 → analytics.item_similarity 전체 갱신
 * 2. ClickHouse 의 결과를 item_a 별 그룹핑 → Redis ZSET (reco:similar:{itemId}) 적재
 *
 * Argo CronWorkflow (k8s/base/recommendation/argo-workflow-similarity.yaml) 가
 * weekly 일요일 03:00 호출. 호출 경로는 InternalSyncController.
 */
@Component
class ItemSimilaritySync(
    private val computer: ClickHouseItemSimilarityComputer,
    @Qualifier("clickHouseDataSource") private val dataSource: DataSource,
    private val redis: StringRedisTemplate,
) {
    private val logger = KotlinLogging.logger {}

    fun sync(ttl: Duration = Duration.ofDays(8)): SyncResult {
        // 1. ClickHouse 에서 PPMI 재계산
        val totalRows = computer.computeAndStore()
        if (totalRows == 0L) {
            logger.warn { "ItemSimilaritySync: ClickHouse 결과가 비어있음 (학습 데이터 부족 추정)" }
            return SyncResult(itemCount = 0, pairCount = 0)
        }

        // 2. Redis 적재 — item_a 별 GROUP BY ORDER BY similarity DESC
        val sql = """
            SELECT item_a, item_b, similarity
            FROM analytics.item_similarity
            FINAL
            ORDER BY item_a, similarity DESC
        """.trimIndent()

        var lastItem: Long? = null
        var stagingKey: String? = null
        var liveKey: String? = null
        var processedItems = 0
        var processedPairs = 0

        dataSource.connection.use { conn ->
            conn.prepareStatement(sql).use { ps ->
                val rs = ps.executeQuery()
                while (rs.next()) {
                    val itemA = rs.getLong(1)
                    val itemB = rs.getLong(2)
                    val similarity = rs.getFloat(3).toDouble()

                    if (itemA != lastItem) {
                        // commit previous batch
                        if (lastItem != null && stagingKey != null && liveKey != null) {
                            commit(stagingKey!!, liveKey!!, ttl)
                            processedItems++
                        }
                        lastItem = itemA
                        liveKey = RedisItemSimilarityAdapter.similarKey(itemA)
                        stagingKey = "$liveKey:staging"
                        redis.delete(stagingKey!!)
                    }

                    redis.opsForZSet().add(stagingKey!!, itemB.toString(), similarity)
                    processedPairs++
                }
                // last group
                if (lastItem != null && stagingKey != null && liveKey != null) {
                    commit(stagingKey!!, liveKey!!, ttl)
                    processedItems++
                }
            }
        }

        logger.info { "ItemSimilaritySync: synced $processedItems items / $processedPairs pairs" }
        return SyncResult(itemCount = processedItems, pairCount = processedPairs)
    }

    private fun commit(stagingKey: String, liveKey: String, ttl: Duration) {
        redis.rename(stagingKey, liveKey)
        redis.expire(liveKey, ttl)
    }

    data class SyncResult(val itemCount: Int, val pairCount: Int)
}
