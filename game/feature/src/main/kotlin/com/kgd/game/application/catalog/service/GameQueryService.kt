package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.GameCollectionDto
import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.application.catalog.dto.GameSort
import com.kgd.game.application.catalog.dto.GameSummaryDto
import com.kgd.game.application.catalog.port.GameCollectionRepositoryPort
import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.catalog.port.GameStatsRepositoryPort
import com.kgd.game.application.catalog.usecase.GetGameCollectionsUseCase
import com.kgd.game.application.catalog.usecase.GetGameDetailUseCase
import com.kgd.game.application.catalog.usecase.GetSimilarGamesUseCase
import com.kgd.game.application.catalog.usecase.ListGamesUseCase
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.domain.catalog.model.Genre
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(transactionManager = "gameTransactionManager", readOnly = true)
class GameQueryService(
    private val gameRepository: GameRepositoryPort,
    private val statsRepository: GameStatsRepositoryPort,
    private val collectionRepository: GameCollectionRepositoryPort,
    private val records: com.kgd.game.application.play.port.MemberGameRecordPort,
) : ListGamesUseCase, GetGameDetailUseCase, GetSimilarGamesUseCase, GetGameCollectionsUseCase {
    companion object {
        private const val COLLECTION_SIZE = 10

        /** 예상 플레이타임 표본. 최근 것만 본다 — 게임이 바뀌면 옛 기록은 다른 게임의 값이다 */
        private const val DURATION_SAMPLE = 200

        /** 표본이 이보다 적으면 값을 내지 않는다. 두세 판으로 낸 중앙값은 숫자일 뿐이다 */
        private const val DURATION_MIN_SAMPLE = 5

        /** 중복 제거로 걷혀 나가는 몫을 미리 더 받아 둔다 — 걷어낸 뒤에도 행이 가득 차야 한다 */
        private const val COLLECTION_OVERFETCH = COLLECTION_SIZE * 2
        private const val SIMILAR_LIMIT = 8

        /**
         * 행 간 중복 제거의 배정 우선순위 — 노출 순서(display_order)와 별개다.
         *
         * 노출 순서대로 앞 행이 먼저 가져가게 하면 '지금 인기'가 신작을 집어가
         * '새로 나온 게임'에 남은 옛 게임이 실린다(행 제목이 거짓말을 하게 된다).
         * MANUAL(운영자 지정)이 가장 먼저 갖고, TRENDING 은 다음 인기 게임으로
         * 뒤를 채울 수 있는 유일한 행이라 가장 나중에 고른다.
         */
        private val DEDUPE_PRIORITY = mapOf(
            CollectionType.MANUAL to 0,
            CollectionType.NEW to 1,
            CollectionType.TAG_BASED to 2,
            CollectionType.TRENDING to 3,
        )
    }

    override fun execute(query: ListGamesUseCase.Query): Page<GameSummaryDto> {
        val games = gameRepository.search(query.tag, query.genre, query.sort, PageRequest.of(query.page, query.size))
        val statsByGameId = statsOf(games.content)
        return games.map { GameSummaryDto.of(it, statsByGameId[it.id]) }
    }

    override fun execute(query: GetGameDetailUseCase.Query): GameDetailDto {
        val game = findVisibleGame(query.slug)
        val gameId = game.id
        val base = GameDetailDto.of(game, gameId?.let { statsRepository.findByGameId(it) })
        return base.copy(
            estimatedMinutes = gameId?.let { estimateMinutes(it) },
            playerMode = if (base.tags.any { it.equals("multiplayer", ignoreCase = true) }) "MULTI" else "SINGLE",
        )
    }

    /**
     * 예상 플레이타임 — 실제 세션 길이의 **중앙값**을 분으로 올린다.
     *
     * 평균이 아니라 중앙값인 것은, 열어 두고 자리를 비운 세션 하나가 평균을 몇 시간으로
     * 밀어 올리기 때문이다. 손으로 입력하지 않는 것은 74종에 값을 채우면 그 순간부터 낡고
     * 게임이 길어져도 아무도 안 고치기 때문이다.
     */
    private fun estimateMinutes(gameId: Long): Int? {
        val samples = records.recentDurations(gameId, DURATION_SAMPLE)
        if (samples.size < DURATION_MIN_SAMPLE) return null
        val sorted = samples.sorted()
        val median = sorted[sorted.size / 2]
        return (median / 60.0).let { if (it < 1.0) 1 else Math.round(it).toInt() }
    }

    override fun execute(query: GetSimilarGamesUseCase.Query): List<GameSummaryDto> {
        val game = findVisibleGame(query.slug)
        val gameId = game.id ?: return emptyList()
        val similar = gameRepository.findSimilar(gameId, SIMILAR_LIMIT)
        val statsByGameId = statsOf(similar)
        return similar.map { GameSummaryDto.of(it, statsByGameId[it.id]) }
    }

    /** 노출 순서는 display_order 그대로 — 중복 제거만 [DEDUPE_PRIORITY] 순서로 돈다. 빈 행은 뺀다. */
    override fun execute(): List<GameCollectionDto> {
        val active = collectionRepository.findActive()
        val gamesBySlug = dedupedGames(active)
        return active.mapNotNull { collection ->
            val games = gamesBySlug[collection.slug].orEmpty()
            if (games.isEmpty()) return@mapNotNull null
            val statsByGameId = statsOf(games)
            GameCollectionDto(
                slug = collection.slug,
                title = collection.title,
                type = collection.type,
                games = games.map { GameSummaryDto.of(it, statsByGameId[it.id]) },
            )
        }
    }

    private fun dedupedGames(collections: List<GameCollection>): Map<String, List<Game>> {
        val seen = mutableSetOf<Long>()
        val result = mutableMapOf<String, List<Game>>()
        // sortedBy 는 안정 정렬 — 같은 타입끼리는 display_order 순서가 유지된다
        for (collection in collections.sortedBy { DEDUPE_PRIORITY.getValue(it.type) }) {
            // 운영자가 직접 놓은 게임(MANUAL 전체, 자동 행의 상단 고정)은 어느 행에서도 걷어내지 않는다
            val pinned = pickedGames(collection.gameIds)
            val games = when (collection.type) {
                CollectionType.MANUAL -> pinned
                CollectionType.TRENDING -> fillAfter(pinned, seen, pageOf(sort = GameSort.TRENDING))
                CollectionType.NEW -> fillAfter(pinned, seen, pageOf(sort = GameSort.NEW))
                CollectionType.TAG_BASED ->
                    fillAfter(pinned, seen, pageOf(sort = GameSort.TRENDING, tag = collection.tagSlug))
            }
            seen += games.mapNotNull { it.id }
            result[collection.slug] = games
        }
        return result
    }

    /**
     * 고정분 뒤를 산출 목록으로 채운다 — 이미 다른 행에 배정된 게임은 건너뛰고 정원까지만.
     * 자동 산출 컬렉션에서 `gameIds` 는 **맨 앞에 고정할 게임** 목록이다: 순위는 통계가 정하되
     * 운영자가 특정 게임을 앞세울 수 있어야 해서, 컬럼을 새로 만들지 않고 MANUAL 이 쓰던
     * 자리를 이 의미로 재사용한다.
     */
    private fun fillAfter(pinned: List<Game>, seen: Set<Long>, computed: List<Game>): List<Game> {
        val pinnedIds = pinned.mapNotNull { it.id }.toSet()
        val rest = computed.filterNot { game ->
            val id = game.id
            id != null && (id in pinnedIds || id in seen)
        }
        return (pinned + rest).take(COLLECTION_SIZE)
    }

    private fun pageOf(sort: GameSort, tag: String? = null): List<Game> =
        gameRepository.search(tag, null, sort, PageRequest.of(0, COLLECTION_OVERFETCH)).content

    /**
     * 어드민이 고른 순서 그대로. `findByIds` 는 상태를 거르지 않으므로 여기서 공개 가능 여부를 확인한다 —
     * 확인하지 않으면 DRAFT/SUSPENDED 게임이 공개 컬렉션에 실린다.
     */
    private fun pickedGames(gameIds: List<Long>): List<Game> {
        if (gameIds.isEmpty()) return emptyList()
        val byId = gameRepository.findByIds(gameIds).filter { it.isPlayable() }.associateBy { it.id }
        return gameIds.mapNotNull { byId[it] }
    }

    /** DRAFT/REVIEW/SUSPENDED 는 존재 여부 은닉 — NOT_FOUND */
    private fun findVisibleGame(slug: String): Game {
        val game = gameRepository.findBySlug(slug) ?: throw GameNotFoundException(slug)
        if (!game.isPlayable()) throw GameNotFoundException(slug)
        return game
    }

    private fun statsOf(games: List<Game>) =
        statsRepository.findByGameIds(games.mapNotNull { it.id }).associateBy { it.gameId }
}
