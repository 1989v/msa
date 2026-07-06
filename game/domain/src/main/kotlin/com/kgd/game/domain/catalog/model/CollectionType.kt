package com.kgd.game.domain.catalog.model

/**
 * 홈 큐레이션 행(row) 타입. MANUAL 은 어드민 큐레이션(item 목록 사용),
 * TRENDING/NEW 는 GameStats/releasedAt 쿼리 기반, TAG_BASED 는 tagSlug 필터.
 */
enum class CollectionType {
    MANUAL,
    TRENDING,
    NEW,
    TAG_BASED
}
