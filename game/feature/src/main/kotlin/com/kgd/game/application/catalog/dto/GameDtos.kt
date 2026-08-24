package com.kgd.game.application.catalog.dto

import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.ScoreBoardDef
import com.kgd.game.domain.catalog.model.GameStats
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.GameTag
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import java.time.Instant

data class GameSummaryDto(
    val id: Long,
    val slug: String,
    val title: String,
    val titleEn: String?,
    val thumbnailUrl: String,
    val loadType: LoadType,
    val supportsMobile: Boolean,
    val status: GameStatus,
    val genre: Genre,
    val tags: List<String>,
    val playCount: Long,
    val ratingAvg: Double,
    val ratingCount: Long,
) {
    companion object {
        fun of(game: Game, stats: GameStats?): GameSummaryDto = GameSummaryDto(
            id = game.id ?: 0,
            slug = game.slug,
            title = game.title,
            titleEn = game.titleEn,
            thumbnailUrl = game.thumbnailUrl,
            loadType = game.loadType,
            supportsMobile = game.supportsMobile,
            status = game.status,
            genre = game.genre,
            tags = game.tags,
            playCount = stats?.playCount ?: 0,
            ratingAvg = stats?.averageRating() ?: 0.0,
            ratingCount = stats?.ratingCount ?: 0,
        )
    }
}

/**
 * 어드민 목록 행 — 공개 요약과 달리 상태 무관으로 조회되고 수정일을 함께 노출한다
 * (운영자가 "언제 바꿨는지"로 행을 찾는다).
 */
data class AdminGameSummaryDto(
    val id: Long,
    val slug: String,
    val title: String,
    val titleEn: String?,
    val thumbnailUrl: String,
    val status: GameStatus,
    val genre: Genre,
    val tags: List<String>,
    val playCount: Long,
    val ratingAvg: Double,
    val ratingCount: Long,
    val updatedAt: Instant,
)

data class GameDetailDto(
    val id: Long,
    val slug: String,
    val title: String,
    val description: String,
    val titleEn: String?,
    val descriptionEn: String?,
    val thumbnailUrl: String,
    val coverUrl: String?,
    val engineType: EngineType,
    val loadType: LoadType,
    val entryUrl: String,
    val orientation: Orientation,
    val supportsMobile: Boolean,
    val developerName: String,
    val sdkIntegrated: Boolean,
    val status: GameStatus,
    val genre: Genre,
    val tags: List<String>,
    /**
     * 게임이 나눈 랭킹 보드 (V59). 비어 있으면 보드가 하나뿐이라 탭을 그리지 않는다.
     * 상세 DTO 에만 있다 — 목록은 보드를 그리지 않으므로 카드마다 실어 보낼 이유가 없다.
     */
    val scoreBoards: List<ScoreBoardDef>,
    val releasedAt: Instant?,
    val contentUpdatedAt: Instant?,
    val playCount: Long,
    val ratingAvg: Double,
    val ratingCount: Long,
) {
    companion object {
        fun of(game: Game, stats: GameStats?): GameDetailDto = GameDetailDto(
            id = game.id ?: 0,
            slug = game.slug,
            title = game.title,
            description = game.description,
            titleEn = game.titleEn,
            descriptionEn = game.descriptionEn,
            thumbnailUrl = game.thumbnailUrl,
            coverUrl = game.coverUrl,
            engineType = game.engineType,
            loadType = game.loadType,
            entryUrl = game.entryUrl,
            orientation = game.orientation,
            supportsMobile = game.supportsMobile,
            developerName = game.developerName,
            sdkIntegrated = game.sdkIntegrated,
            status = game.status,
            genre = game.genre,
            tags = game.tags,
            scoreBoards = game.scoreBoards,
            releasedAt = game.releasedAt,
            contentUpdatedAt = game.contentUpdatedAt,
            playCount = stats?.playCount ?: 0,
            ratingAvg = stats?.averageRating() ?: 0.0,
            ratingCount = stats?.ratingCount ?: 0,
        )
    }
}

data class GameTagDto(val slug: String, val name: String) {
    companion object {
        fun of(tag: GameTag): GameTagDto = GameTagDto(slug = tag.slug, name = tag.name)
    }
}

data class GameCollectionDto(
    val slug: String,
    val title: String,
    val type: CollectionType,
    val games: List<GameSummaryDto>,
)
