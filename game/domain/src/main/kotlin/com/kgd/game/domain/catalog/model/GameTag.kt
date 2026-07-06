package com.kgd.game.domain.catalog.model

class GameTag private constructor(
    val id: Long? = null,
    val slug: String,
    var name: String,
    var displayOrder: Int
) {
    companion object {
        private val SLUG_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

        fun create(slug: String, name: String, displayOrder: Int = 0): GameTag {
            require(SLUG_PATTERN.matches(slug)) { "slug는 소문자/숫자/하이픈 형식이어야 합니다: $slug" }
            require(name.isNotBlank()) { "name은 비어있을 수 없습니다" }
            return GameTag(slug = slug, name = name, displayOrder = displayOrder)
        }

        fun restore(id: Long?, slug: String, name: String, displayOrder: Int): GameTag =
            GameTag(id = id, slug = slug, name = name, displayOrder = displayOrder)
    }

    fun update(name: String? = null, displayOrder: Int? = null) {
        name?.let {
            require(it.isNotBlank()) { "name은 비어있을 수 없습니다" }
            this.name = it
        }
        displayOrder?.let { this.displayOrder = it }
    }
}
