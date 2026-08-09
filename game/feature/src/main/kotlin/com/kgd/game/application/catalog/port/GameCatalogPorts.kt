package com.kgd.game.application.catalog.port

import com.kgd.game.application.catalog.dto.AdminGameSummaryDto
import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.GameTag
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

/**
 * 카탈로그 목록 조회 조건 — 공개/어드민이 같은 쿼리를 공유하고 상태 노출 범위만 달리한다.
 * `statuses` 가 비면 상태 무관이므로, 공개 경로는 반드시 PUBLISHED 를 명시해 넘긴다.
 */
data class GameSearchCriteria(
    val q: String? = null,
    val tag: String? = null,
    val genre: Genre? = null,
    val statuses: Set<GameStatus> = emptySet(),
    val sort: GameSort = GameSort.TRENDING,
)

interface GameRepositoryPort {
    fun save(game: Game): Game
    fun findBySlug(slug: String): Game?
    fun findByIds(ids: List<Long>): List<Game>
    fun existsBySlug(slug: String): Boolean

    /** 공개 리스트 — PUBLISHED 만 노출 */
    fun search(tag: String?, genre: Genre?, sort: GameSort, pageable: Pageable): Page<Game>

    /** 태그 교집합 수 기준 유사 게임 (PUBLISHED 만) */
    fun findSimilar(gameId: Long, limit: Int): List<Game>
}

/**
 * 어드민 목록 — 상태 무관 조회. 수정일(감사 컬럼)까지 노출해야 해서 도메인 모델이 아니라
 * 읽기 모델을 돌려준다.
 */
interface GameAdminQueryPort {
    fun search(criteria: GameSearchCriteria, pageable: Pageable): Page<AdminGameSummaryDto>
}

interface GameStatsRepositoryPort {
    fun findByGameId(gameId: Long): GameStats?
    fun findByGameIds(gameIds: List<Long>): List<GameStats>
    fun save(stats: GameStats): GameStats
}

interface GameTagRepositoryPort {
    fun findAll(): List<GameTag>
}

interface GameCollectionRepositoryPort {
    fun findActive(): List<GameCollection>

    /** 어드민 편집용 — 비활성 컬렉션도 보여야 다시 켤 수 있다. */
    fun findAll(): List<GameCollection>
    fun findBySlug(slug: String): GameCollection?
    fun save(collection: GameCollection): GameCollection
}
