package com.kgd.game.application.catalog.dto

import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
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

data class GameDetailDto(
    val id: Long,
    val slug: String,
    val title: String,
    val description: String,
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
