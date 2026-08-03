package com.kgd.game.domain.catalog.model

class GameCollection private constructor(
    val id: Long? = null,
    val slug: String,
    var title: String,
    val type: CollectionType,
    var tagSlug: String?,
    var displayOrder: Int,
    var active: Boolean,
    var gameIds: List<Long>
) {
    companion object {
        private val SLUG_PATTERN = Regex("^[a-z0-9]+(-[a-z0-9]+)*$")

        fun create(
            slug: String,
            title: String,
            type: CollectionType,
            tagSlug: String? = null,
            displayOrder: Int = 0,
            gameIds: List<Long> = emptyList()
        ): GameCollection {
            require(SLUG_PATTERN.matches(slug)) { "slug는 소문자/숫자/하이픈 형식이어야 합니다: $slug" }
            require(title.isNotBlank()) { "title은 비어있을 수 없습니다" }
            require(type != CollectionType.TAG_BASED || !tagSlug.isNullOrBlank()) {
                "TAG_BASED 컬렉션은 tagSlug가 필요합니다"
            }
            require(type == CollectionType.MANUAL || gameIds.isEmpty()) {
                "게임 목록은 MANUAL 컬렉션에서만 지정할 수 있습니다"
            }
            return GameCollection(
                slug = slug,
                title = title,
                type = type,
                tagSlug = tagSlug,
                displayOrder = displayOrder,
                active = true,
                gameIds = gameIds
            )
        }

        fun restore(
            id: Long?,
            slug: String,
            title: String,
            type: CollectionType,
            tagSlug: String?,
            displayOrder: Int,
            active: Boolean,
            gameIds: List<Long>
        ): GameCollection = GameCollection(id, slug, title, type, tagSlug, displayOrder, active, gameIds)
    }

    fun replaceGames(gameIds: List<Long>) {
        require(type == CollectionType.MANUAL) { "게임 목록은 MANUAL 컬렉션에서만 지정할 수 있습니다" }
        this.gameIds = gameIds
    }

    fun update(title: String? = null, displayOrder: Int? = null, active: Boolean? = null) {
        title?.let {
            require(it.isNotBlank()) { "title은 비어있을 수 없습니다" }
            this.title = it
        }
        displayOrder?.let { this.displayOrder = it }
        active?.let { this.active = it }
    }
}
