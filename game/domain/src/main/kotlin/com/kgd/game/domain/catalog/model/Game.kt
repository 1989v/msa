package com.kgd.game.domain.catalog.model

import com.kgd.game.domain.catalog.exception.InvalidGameStatusException
import java.time.Instant

/**
 * 게임 카탈로그 aggregate root (ADR-0059).
 * 상태 전이: DRAFT → REVIEW → BETA → PUBLISHED ⇄ SUSPENDED.
 * 광고/수익화는 PUBLISHED + sdkIntegrated 일 때만 허용 (CrazyGames 모델).
 */
class Game private constructor(
    val id: Long? = null,
    val slug: String,
    var title: String,
    var description: String,
    var titleEn: String?,
    var descriptionEn: String?,
    var thumbnailUrl: String,
    var coverUrl: String?,
    val engineType: EngineType,
    val loadType: LoadType,
    var entryUrl: String,
    var orientation: Orientation,
    var supportsMobile: Boolean,
    var developerName: String,
    var sdkIntegrated: Boolean,
    var status: GameStatus,
    var genre: Genre,
    var tags: List<String>,
    /** 게임이 나눈 랭킹 보드. 비어 있으면 보드가 하나뿐이라는 뜻이다 (V59) */
    var scoreBoards: List<ScoreBoardDef>,
    var releasedAt: Instant?,
    var contentUpdatedAt: Instant?
) {
    companion object {
        private val SLUG_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

        fun create(
            slug: String,
            title: String,
            description: String,
            titleEn: String? = null,
            descriptionEn: String? = null,
            thumbnailUrl: String,
            coverUrl: String? = null,
            engineType: EngineType,
            loadType: LoadType,
            entryUrl: String,
            orientation: Orientation = Orientation.BOTH,
            supportsMobile: Boolean = true,
            developerName: String,
            sdkIntegrated: Boolean = false,
            genre: Genre = Genre.CASUAL,
            tags: List<String> = emptyList()
        ): Game {
            require(SLUG_PATTERN.matches(slug)) { "slug는 소문자/숫자/하이픈 형식이어야 합니다: $slug" }
            require(title.isNotBlank()) { "title은 비어있을 수 없습니다" }
            require(entryUrl.isNotBlank()) { "entryUrl은 비어있을 수 없습니다" }
            require(developerName.isNotBlank()) { "developerName은 비어있을 수 없습니다" }
            return Game(
                slug = slug,
                title = title,
                description = description,
                titleEn = titleEn,
                descriptionEn = descriptionEn,
                thumbnailUrl = thumbnailUrl,
                coverUrl = coverUrl,
                engineType = engineType,
                loadType = loadType,
                entryUrl = entryUrl,
                orientation = orientation,
                supportsMobile = supportsMobile,
                developerName = developerName,
                sdkIntegrated = sdkIntegrated,
                status = GameStatus.DRAFT,
                genre = genre,
                tags = tags,
                scoreBoards = emptyList(),
                releasedAt = null,
                contentUpdatedAt = null
            )
        }

        fun restore(
            id: Long?,
            slug: String,
            title: String,
            description: String,
            titleEn: String? = null,
            descriptionEn: String? = null,
            thumbnailUrl: String,
            coverUrl: String?,
            engineType: EngineType,
            loadType: LoadType,
            entryUrl: String,
            orientation: Orientation,
            supportsMobile: Boolean,
            developerName: String,
            sdkIntegrated: Boolean,
            status: GameStatus,
            genre: Genre,
            tags: List<String>,
            scoreBoards: List<ScoreBoardDef> = emptyList(),
            releasedAt: Instant?,
            contentUpdatedAt: Instant?
        ): Game = Game(
            id = id,
            slug = slug,
            title = title,
            description = description,
            titleEn = titleEn,
            descriptionEn = descriptionEn,
            thumbnailUrl = thumbnailUrl,
            coverUrl = coverUrl,
            engineType = engineType,
            loadType = loadType,
            entryUrl = entryUrl,
            orientation = orientation,
            supportsMobile = supportsMobile,
            developerName = developerName,
            sdkIntegrated = sdkIntegrated,
            status = status,
            genre = genre,
            tags = tags,
            scoreBoards = scoreBoards,
            releasedAt = releasedAt,
            contentUpdatedAt = contentUpdatedAt
        )
    }

    fun submitForReview() = transition(from = setOf(GameStatus.DRAFT), to = GameStatus.REVIEW)

    fun launchBeta() = transition(from = setOf(GameStatus.REVIEW), to = GameStatus.BETA)

    fun publish(now: Instant) {
        transition(from = setOf(GameStatus.BETA), to = GameStatus.PUBLISHED)
        if (releasedAt == null) releasedAt = now
    }

    fun suspend() = transition(from = setOf(GameStatus.BETA, GameStatus.PUBLISHED), to = GameStatus.SUSPENDED)

    fun resume() = transition(from = setOf(GameStatus.SUSPENDED), to = GameStatus.PUBLISHED)

    /** 플레이 가능 여부 — BETA(제한 노출) 또는 PUBLISHED */
    fun isPlayable(): Boolean = status == GameStatus.BETA || status == GameStatus.PUBLISHED

    /** 광고/수익화 허용 여부 — PUBLISHED + SDK 통합 (ADR-0059 §3) */
    fun isMonetizable(): Boolean = status == GameStatus.PUBLISHED && sdkIntegrated

    fun updateMetadata(
        title: String? = null,
        description: String? = null,
        titleEn: String? = null,
        descriptionEn: String? = null,
        thumbnailUrl: String? = null,
        coverUrl: String? = null,
        orientation: Orientation? = null,
        supportsMobile: Boolean? = null,
        developerName: String? = null,
        genre: Genre? = null
    ) {
        title?.let {
            require(it.isNotBlank()) { "title은 비어있을 수 없습니다" }
            this.title = it
        }
        description?.let { this.description = it }
        // 영문 필드는 SEO 색인/소셜 카드 입력이다. 공백 문자열을 그대로 두면 빈 메타가 찍히므로 null 로 눕힌다.
        titleEn?.let { this.titleEn = it.ifBlank { null } }
        descriptionEn?.let { this.descriptionEn = it.ifBlank { null } }
        thumbnailUrl?.let { this.thumbnailUrl = it }
        coverUrl?.let { this.coverUrl = it }
        orientation?.let { this.orientation = it }
        supportsMobile?.let { this.supportsMobile = it }
        genre?.let { this.genre = it }
        developerName?.let {
            require(it.isNotBlank()) { "developerName은 비어있을 수 없습니다" }
            this.developerName = it
        }
    }

    fun updateContent(entryUrl: String, sdkIntegrated: Boolean, now: Instant) {
        require(entryUrl.isNotBlank()) { "entryUrl은 비어있을 수 없습니다" }
        this.entryUrl = entryUrl
        this.sdkIntegrated = sdkIntegrated
        this.contentUpdatedAt = now
    }

    fun updateTags(tags: List<String>) {
        this.tags = tags
    }

    private fun transition(from: Set<GameStatus>, to: GameStatus) {
        if (status !in from) {
            throw InvalidGameStatusException(slug = slug, current = status, target = to)
        }
        status = to
    }
}
