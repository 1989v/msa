package com.kgd.ranking.application.ranking.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.ranking.application.ranking.dto.MovementResponse
import com.kgd.ranking.application.ranking.dto.RankingBoardDetail
import com.kgd.ranking.application.ranking.dto.RankingBoardSummary
import com.kgd.ranking.application.ranking.dto.RankingEntryResponse
import com.kgd.ranking.application.ranking.dto.RankingScopeResponse
import com.kgd.ranking.application.ranking.port.RankingBoardRepositoryPort
import com.kgd.ranking.application.ranking.port.RankingEntryRepositoryPort
import com.kgd.ranking.application.ranking.port.RankingSnapshotRepositoryPort
import com.kgd.ranking.application.ranking.usecase.GetRankingBoardUseCase
import com.kgd.ranking.application.ranking.usecase.GetRankingBoardsUseCase
import com.kgd.ranking.application.ranking.usecase.GetRankingScopesUseCase
import com.kgd.ranking.domain.model.BoardStatus
import com.kgd.ranking.domain.model.RankingBoard
import com.kgd.ranking.domain.model.RankingDomain
import com.kgd.ranking.domain.model.RankingEntry
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/**
 * 리더보드 조회 (ADR-0081).
 *
 * 외부 호출이 없다 — 전부 우리 DB 읽기라 Tier 1 이다. 오피넷은 수집 CronJob 만 부른다.
 */
@Service
@Transactional(readOnly = true)
class RankingQueryService(
    private val boardRepository: RankingBoardRepositoryPort,
    private val snapshotRepository: RankingSnapshotRepositoryPort,
    private val entryRepository: RankingEntryRepositoryPort,
) : GetRankingBoardsUseCase, GetRankingBoardUseCase, GetRankingScopesUseCase {

    override fun execute(query: GetRankingBoardsUseCase.Query): List<RankingBoardSummary> {
        val (domain, scopeKey) = query
        val boards = when {
            domain != null && scopeKey != null -> boardRepository.findByDomainAndScopeKey(domain, scopeKey)
            else -> boardRepository.findByStatus(BoardStatus.OPEN)
        }.filter { it.status.displayed && (scopeKey == null || it.scopeKey == scopeKey) }

        return boards.map { board ->
            val top = board.latestSnapshotId?.let { entryRepository.findBySnapshotId(it) }
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
                entryCount = board.latestSnapshotId?.let { entryRepository.countBySnapshotId(it) } ?: 0,
                topName = top?.subjectName,
                topScore = top?.score,
            )
        }
    }

    override fun execute(slug: String): RankingBoardDetail {
        val board = boardRepository.findBySlug(slug)
            ?.takeIf { it.status.displayed }
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "랭킹을 찾을 수 없습니다: $slug")

        val entries = board.latestSnapshotId
            ?.let { entryRepository.findBySnapshotId(it) }
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

    override fun execute(domain: RankingDomain): List<RankingScopeResponse> =
        boardRepository.findByStatus(BoardStatus.OPEN)
            .filter { it.domain == domain }
            .distinctBy { it.scopeKey }
            .map { RankingScopeResponse(it.scopeKey, it.scopeName) }

    private fun RankingBoard.capturedAt(): Instant? =
        latestSnapshotId?.let { snapshotRepository.findById(it)?.capturedAt }

    private fun RankingEntry.toResponse() = RankingEntryResponse(
        rank = rank,
        subjectKey = subjectKey,
        subjectName = subjectName,
        score = score,
        movement = MovementResponse.of(movement),
        payload = payload,
    )
}
