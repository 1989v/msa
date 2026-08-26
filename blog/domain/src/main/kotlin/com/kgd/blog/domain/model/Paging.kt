package com.kgd.blog.domain.model

/** 페이지 요청 — 프레임워크 타입(Pageable)이 포트를 넘지 않게 하는 값 */
data class Paging(val page: Int, val size: Int) {
    companion object {
        fun of(page: Int, size: Int, maxSize: Int) = Paging(page.coerceAtLeast(0), size.coerceIn(1, maxSize))
    }
}

data class Paged<T>(
    val items: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
) {
    fun <R> map(transform: (T) -> R): Paged<R> = Paged(items.map(transform), page, size, totalElements, totalPages)

    companion object {
        fun <T> empty(paging: Paging) = Paged<T>(emptyList(), paging.page, paging.size, 0, 0)
    }
}
