package com.kgd.game.infrastructure.persistence.catalog.entity

import com.kgd.game.domain.catalog.model.EngineType
import com.kgd.game.domain.catalog.model.Game
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.domain.catalog.model.LoadType
import com.kgd.game.domain.catalog.model.Orientation
import com.kgd.game.infrastructure.persistence.converter.StringListJsonConverter
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.Instant
import java.time.LocalDateTime

@Entity
@Table(name = "game")
class GameJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, unique = true, length = 100)
    val slug: String,
    title: String,
    description: String,
    thumbnailUrl: String,
    coverUrl: String?,
    @Enumerated(EnumType.STRING)
    @Column(name = "engine_type", nullable = false, length = 20)
    val engineType: EngineType,
    @Enumerated(EnumType.STRING)
    @Column(name = "load_type", nullable = false, length = 20)
    val loadType: LoadType,
    entryUrl: String,
    orientation: Orientation,
    supportsMobile: Boolean,
    developerName: String,
    sdkIntegrated: Boolean,
    status: GameStatus,
    tags: List<String> = emptyList(),
    releasedAt: Instant?,
    contentUpdatedAt: Instant?,
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(),
) {
    @Column(nullable = false, length = 200)
    var title: String = title
        private set

    @Column(nullable = false, columnDefinition = "TEXT")
    var description: String = description
        private set

    @Column(name = "thumbnail_url", nullable = false, length = 500)
    var thumbnailUrl: String = thumbnailUrl
        private set

    @Column(name = "cover_url", length = 500)
    var coverUrl: String? = coverUrl
        private set

    @Column(name = "entry_url", nullable = false, length = 500)
    var entryUrl: String = entryUrl
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var orientation: Orientation = orientation
        private set

    @Column(name = "supports_mobile", nullable = false)
    var supportsMobile: Boolean = supportsMobile
        private set

    @Column(name = "developer_name", nullable = false, length = 100)
    var developerName: String = developerName
        private set

    @Column(name = "sdk_integrated", nullable = false)
    var sdkIntegrated: Boolean = sdkIntegrated
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: GameStatus = status
        private set

    @Convert(converter = StringListJsonConverter::class)
    @Column(columnDefinition = "json")
    var tags: List<String> = tags
        private set

    @Column(name = "released_at")
    var releasedAt: Instant? = releasedAt
        private set

    @Column(name = "content_updated_at")
    var contentUpdatedAt: Instant? = contentUpdatedAt
        private set

    /** 전체 동기화 — 도메인 모델 기준으로 영속 상태를 덮어쓴다 (entity-mutation.md) */
    fun update(game: Game) {
        title = game.title
        description = game.description
        thumbnailUrl = game.thumbnailUrl
        coverUrl = game.coverUrl
        entryUrl = game.entryUrl
        orientation = game.orientation
        supportsMobile = game.supportsMobile
        developerName = game.developerName
        sdkIntegrated = game.sdkIntegrated
        status = game.status
        tags = game.tags
        releasedAt = game.releasedAt
        contentUpdatedAt = game.contentUpdatedAt
    }

    fun toDomain(): Game = Game.restore(
        id = id,
        slug = slug,
        title = title,
        description = description,
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
        tags = tags,
        releasedAt = releasedAt,
        contentUpdatedAt = contentUpdatedAt,
    )

    companion object {
        fun fromDomain(game: Game): GameJpaEntity = GameJpaEntity(
            id = game.id,
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
            tags = game.tags,
            releasedAt = game.releasedAt,
            contentUpdatedAt = game.contentUpdatedAt,
        )
    }
}
