package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.AdminGameSummaryDto
import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.port.GameAdminQueryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameSearchCriteria
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 어드민 카탈로그 조회 — 공개 조회(GameQueryService)와 달리 상태로 거르지 않는다.
 * 상태 변경/타이틀 수정을 SQL 마이그레이션 없이 운영하려면 DRAFT/REVIEW/SUSPENDED 도 보여야 한다.
 */
@Service
@Transactional(transactionManager = "gameTransactionManager", readOnly = true)
class GameAdminQueryService(
    private val adminQueryPort: GameAdminQueryPort,
    private val gameRepository: GameRepositoryPort,
    private val statsRepository: GameStatsRepositoryPort,
) {

    fun list(
        q: String?,
        status: GameStatus?,
        genre: Genre?,
        tag: String?,
        sort: GameSort,
        page: Int,
        size: Int,
    ): Page<AdminGameSummaryDto> = adminQueryPort.search(
        GameSearchCriteria(
            q = q,
            tag = tag,
            genre = genre,
            statuses = status?.let(::setOf) ?: emptySet(),
            sort = sort,
        ),
        PageRequest.of(page, size),
    )

    /** 편집 폼 프리필용 상세 — 공개 상세와 달리 상태 은닉 없이 그대로 돌려준다 */
    fun detail(slug: String): GameDetailDto {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        val gameId = game.id
        return GameDetailDto.of(game, gameId?.let { statsRepository.findByGameId(it) })
    }
}
