package com.kgd.game.infrastructure.persistence.catalog.entity

import com.kgd.game.domain.catalog.model.CollectionType
import com.kgd.game.domain.catalog.model.GameCollection
import com.kgd.game.infrastructure.persistence.converter.LongListJsonConverter
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "game_collection")
class GameCollectionJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, unique = true, length = 100)
    val slug: String,
    title: String,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    val type: CollectionType,
    tagSlug: String?,
    displayOrder: Int,
    active: Boolean,
    gameIds: List<Long> = emptyList(),
) {
    @Column(nullable = false, length = 100)
    var title: String = title
        private set

    @Column(name = "tag_slug", length = 50)
    var tagSlug: String? = tagSlug
        private set

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = displayOrder
        private set

    @Column(nullable = false)
    var active: Boolean = active
        private set

    /** MANUAL 큐레이션 게임 목록 — 순서 보존을 위해 json 배열로 저장 */
    @Convert(converter = LongListJsonConverter::class)
    @Column(name = "game_ids", columnDefinition = "json")
    var gameIds: List<Long> = gameIds
        private set

    fun update(collection: GameCollection) {
        title = collection.title
        tagSlug = collection.tagSlug
        displayOrder = collection.displayOrder
        active = collection.active
        gameIds = collection.gameIds
    }

    fun toDomain(): GameCollection = GameCollection.restore(
        id = id,
        slug = slug,
        title = title,
        type = type,
        tagSlug = tagSlug,
        displayOrder = displayOrder,
        active = active,
        gameIds = gameIds,
    )

    companion object {
        fun fromDomain(collection: GameCollection): GameCollectionJpaEntity = GameCollectionJpaEntity(
            id = collection.id,
            slug = collection.slug,
            title = collection.title,
            type = collection.type,
            tagSlug = collection.tagSlug,
            displayOrder = collection.displayOrder,
            active = collection.active,
            gameIds = collection.gameIds,
        )
    }
}
