package com.kgd.ranking.application.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.ranking.application.dto.MovementResponse
import com.kgd.ranking.application.dto.RankingBoardDetail
import com.kgd.ranking.application.dto.RankingBoardSummary
import com.kgd.ranking.application.dto.RankingEntryResponse
import com.kgd.ranking.application.dto.RankingScopeResponse
import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.Movement
import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.infrastructure.persistence.entity.RankingBoardJpaEntity
import com.kgd.ranking.infrastructure.persistence.entity.RankingEntryJpaEntity
import com.kgd.ranking.infrastructure.persistence.repository.RankingBoardJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.RankingEntryJpaRepository
import com.kgd.ranking.infrastructure.persistence.repository.RankingSnapshotJpaRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.Instant

/**
 * 리더보드 조회 (ADR-0081).
 *
 * 외부 호출이 없다 — 전부 우리 DB 읽기라 Tier 1 이다. 오피넷은 수집 CronJob 만 부른다.
 */
@Service
@Transactional(readOnly = true)
class RankingQueryService(
    private val boardRepository: RankingBoardJpaRepository,
    private val snapshotRepository: RankingSnapshotJpaRepository,
    private val entryRepository: RankingEntryJpaRepository,
    private val objectMapper: ObjectMapper,
) {

    fun boards(domain: RankingDomain?, scopeKey: String?): List<RankingBoardSummary> {
        val boards = when {
            domain != null && scopeKey != null -> boardRepository.findByDomainAndScopeKey(domain, scopeKey)
            else -> boardRepository.findByStatusOrderByScopeKeyAsc(BoardStatus.OPEN)
        }.filter { it.status.displayed && (scopeKey == null || it.scopeKey == scopeKey) }

        return boards.map { board ->
            val top = board.latestSnapshotId?.let { entryRepository.findBySnapshotIdOrderByRankNoAsc(it) }
                .orEmpty()
                .firstOrNull()
            RankingBoardSummary(
                slug = board.slug,
                title = board.title,
                subtitle = board.subtitle,
                scopeKey = board.scopeKey,
                scopeName = board.scopeName,
                unit = board.unit,
                sourceLabel = board.sourceLabel,
                capturedAt = board.capturedAt(),
                entryCount = board.latestSnapshotId?.let { entryRepository.countBySnapshotId(it).toInt() } ?: 0,
                topName = top?.subjectName,
                topScore = top?.score,
            )
        }
    }

    fun board(slug: String): RankingBoardDetail {
        val board = boardRepository.findBySlug(slug)
            ?.takeIf { it.status.displayed }
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "랭킹을 찾을 수 없습니다: $slug")

        val entries = board.latestSnapshotId
            ?.let { entryRepository.findBySnapshotIdOrderByRankNoAsc(it) }
            .orEmpty()

        return RankingBoardDetail(
            slug = board.slug,
            title = board.title,
            subtitle = board.subtitle,
            scopeKey = board.scopeKey,
            scopeName = board.scopeName,
            unit = board.unit,
            sourceLabel = board.sourceLabel,
            capturedAt = board.capturedAt(),
            entries = entries.map { it.toResponse() },
        )
    }

    /** 고를 수 있는 지역 — 보드가 있는 곳만. 데이터 없는 지역을 고르게 하면 빈 화면이 된다. */
    fun scopes(domain: RankingDomain): List<RankingScopeResponse> =
        boardRepository.findByStatusOrderByScopeKeyAsc(BoardStatus.OPEN)
            .filter { it.domain == domain }
            .distinctBy { it.scopeKey }
            .map { RankingScopeResponse(it.scopeKey, it.scopeName) }

    private fun RankingBoardJpaEntity.capturedAt(): Instant? =
        latestSnapshotId?.let { snapshotRepository.findById(it).orElse(null)?.capturedAt }

    private fun RankingEntryJpaEntity.toResponse() = RankingEntryResponse(
        rank = rankNo,
        subjectKey = subjectKey,
        subjectName = subjectName,
        score = score,
        movement = MovementResponse.of(Movement.of(rankNo, prevRank)),
        payload = payload?.let {
            @Suppress("UNCHECKED_CAST")
            objectMapper.readValue(it, Map::class.java) as Map<String, Any?>
        } ?: emptyMap(),
    )
}
