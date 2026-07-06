package com.kgd.game.infrastructure.persistence.catalog.entity

import com.kgd.game.domain.catalog.model.GameTag
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "game_tag")
class GameTagJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false, unique = true, length = 50)
    val slug: String,
    name: String,
    displayOrder: Int,
) {
    @Column(nullable = false, length = 50)
    var name: String = name
        private set

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = displayOrder
        private set

    fun update(tag: GameTag) {
        name = tag.name
        displayOrder = tag.displayOrder
    }

    fun toDomain(): GameTag = GameTag.restore(id = id, slug = slug, name = name, displayOrder = displayOrder)

    companion object {
        fun fromDomain(tag: GameTag): GameTagJpaEntity =
            GameTagJpaEntity(id = tag.id, slug = tag.slug, name = tag.name, displayOrder = tag.displayOrder)
    }
}
