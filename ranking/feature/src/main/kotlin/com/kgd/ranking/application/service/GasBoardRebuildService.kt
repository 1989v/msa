package com.kgd.ranking.application.service

import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.domain.model.RankingMetric
import com.kgd.ranking.domain.model.Ranker
import com.kgd.ranking.domain.model.ScoredSubject
import com.kgd.ranking.domain.model.SortDirection
import com.kgd.ranking.infrastructure.persistence.entity.GasStationJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingBoardJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingEntryJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingSnapshotJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.GasStationJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.GasStationPriceJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.RankingBoardJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.RankingEntryJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.RankingSnapshotJpaRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal
import java.time.Instant
import java.time.temporal.ChronoUnit

private val logger = KotlinLogging.logger {}

/** 유종 코드 → 화면 이름. 수집기의 `opinet.PRODUCTS` 와 짝이다. */
private val PRODUCT_NAMES = mapOf("B027" to "휘발유", "D047" to "경유")

/**
 * 적재된 주유소로 시군구 × 유종 리더보드 스냅샷을 만든다 (ADR-0081 §1).
 *
 * **보관량이 설계 입력이다.** 시군구 약 250곳 × 유종 2종 = 보드 약 500개이고, 보드당
 * [TOP_N] 줄을 [RETENTION_DAYS] 일 남기면 약 30만 행(≈45MB)에서 평형을 이룬다. 전량을
 * 무기한 쌓으면 free tier 디스크가 먼저 찬다.
 */
@Service
class GasBoardRebuildService(
    private val boardRepository: RankingBoardJpaRepository,
    private val snapshotRepository: RankingSnapshotJpaRepository,
    private val entryRepository: RankingEntryJpaRepository,
    private val stationRepository: GasStationJpaRepository,
    private val priceRepository: GasStationPriceJpaRepository,
    private val objectMapper: ObjectMapper,
) {
    companion object {
        const val TOP_N = 20
        const val RETENTION_DAYS = 30L
    }

    /**
     * 전량 재생성.
     *
     * 트랜잭션이 하나인 것은 의도다 — 오늘의 순위는 **전부 갱신되거나 전혀 안 바뀌거나** 둘
     * 중 하나여야 한다. 보드별로 쪼개면 일부만 어제 값인 화면이 생기고, 그 상태는 화면만
     * 봐서는 알 수 없다.
     */
    @Transactional
    fun rebuildAll(sourceLabel: String): Map<String, Int> {
        val stations = stationRepository.findAll().filter { it.areaCode != null }
        if (stations.isEmpty()) {
            logger.info { "[GAS] 적재된 주유소가 없어 보드를 만들지 않는다" }
            return mapOf("boards" to 0, "entries" to 0)
        }

        val pricesByStation = priceRepository.findByStationIdIn(stations.mapNotNull { it.id })
            .groupBy { it.stationId }
        val now = Instant.now()

        var boardCount = 0
        var entryCount = 0

        stations.groupBy { it.areaCode!! }.forEach { (areaCode, areaStations) ->
            val areaName = areaStations.firstNotNullOfOrNull { it.areaName } ?: areaCode
            PRODUCT_NAMES.forEach { (productCode, productName) ->
                val subjects = areaStations.mapNotNull { station ->
                    val price = pricesByStation[station.id].orEmpty()
                        .firstOrNull { it.productCode == productCode } ?: return@mapNotNull null
                    ScoredSubject(
                        subjectKey = "gas:${station.opinetId}",
                        subjectName = station.name,
                        score = BigDecimal(price.price),
                        payload = station.toPayload(),
                    )
                }
                if (subjects.isEmpty()) return@forEach

                val board = upsertBoard(areaCode, areaName, productCode, productName, sourceLabel)
                entryCount += writeSnapshot(board, subjects, now)
                boardCount++
            }
        }

        purgeOldSnapshots(now)
        logger.info { "[GAS] 보드 ${boardCount}개 · 엔트리 ${entryCount}건 스냅샷 생성" }
        return mapOf("boards" to boardCount, "entries" to entryCount)
    }

    private fun upsertBoard(
        areaCode: String,
        areaName: String,
        productCode: String,
        productName: String,
        sourceLabel: String,
    ): RankingBoardJpaEntity {
        val slug = "gas-$areaCode-${productCode.lowercase()}"
        val title = "$areaName $productName 최저가"
        val subtitle = "$areaName 주유소 $productName 판매가 낮은 순"

        val existing = boardRepository.findBySlug(slug)
        if (existing != null) {
            existing.updateDisplay(areaName, title, subtitle, "원/L", sourceLabel)
            return existing
        }
        return boardRepository.save(
            RankingBoardJpaEntity(
                slug = slug,
                domain = RankingDomain.GAS_STATION,
                metric = RankingMetric.FUEL_PRICE,
                direction = SortDirection.ASC,
                scopeKey = areaCode,
                scopeName = areaName,
                title = title,
                subtitle = subtitle,
                unit = "원/L",
                sourceLabel = sourceLabel,
                status = BoardStatus.OPEN,
            ),
        )
    }

    private fun writeSnapshot(
        board: RankingBoardJpaEntity,
        subjects: List<ScoredSubject>,
        now: Instant,
    ): Int {
        val boardId = board.id ?: return 0

        // 직전 순위는 **저장된 상위 N줄**에서만 온다. 21위에 있던 곳이 5위로 올라오면 NEW 로
        // 보이는데, "처음 순위에 들었다"는 뜻이므로 화면에서도 그게 맞다.
        val previousRanks = board.latestSnapshotId
            ?.let { entryRepository.findBySnapshotIdOrderByRankNoAsc(it) }
            .orEmpty()
            .associate { it.subjectKey to it.rankNo }

        val ranked = Ranker.rank(subjects, board.direction, previousRanks).take(TOP_N)

        val snapshot = snapshotRepository.save(
            RankingSnapshotJpaEntity(boardId = boardId, capturedAt = now, entryCount = ranked.size),
        )
        val snapshotId = snapshot.id ?: return 0

        entryRepository.saveAll(
            ranked.map { entry ->
                RankingEntryJpaEntity(
                    snapshotId = snapshotId,
                    rankNo = entry.rank,
                    subjectKey = entry.subjectKey,
                    subjectName = entry.subjectName,
                    score = entry.score,
                    prevRank = entry.prevRank,
                    payload = objectMapper.writeValueAsString(entry.payload),
                )
            },
        )

        // 엔트리를 다 쓴 뒤에 공개한다 — 먼저 걸면 조회가 반쪽 스냅샷을 읽는다
        board.publishSnapshot(snapshotId)
        return ranked.size
    }

    private fun purgeOldSnapshots(now: Instant) {
        val threshold = now.minus(RETENTION_DAYS, ChronoUnit.DAYS)
        val stale = snapshotRepository.findAll()
            .filter { it.capturedAt.isBefore(threshold) }
            .mapNotNull { it.id }
        if (stale.isEmpty()) return

        entryRepository.deleteBySnapshotIdIn(stale)
        snapshotRepository.deleteAllById(stale)
        logger.info { "[GAS] 보관기간(${RETENTION_DAYS}일) 지난 스냅샷 ${stale.size}개 정리" }
    }

    private fun GasStationJpaEntity.toPayload(): Map<String, Any?> = mapOf(
        "opinetId" to opinetId,
        "brandCode" to brandCode,
        "brandName" to brandName,
        "isSelf" to isSelf,
        "latitude" to latitude,
        "longitude" to longitude,
        "roadAddress" to roadAddress,
        "tel" to tel,
        "hasCarWash" to hasCarWash,
        "hasMaintenance" to hasMaintenance,
        "hasCvs" to hasCvs,
    )
}
