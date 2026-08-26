package com.kgd.blog.application.category.usecase

import com.kgd.blog.application.category.dto.BlogCategoryNode

/** 목록·네비용 카테고리 트리. 공개는 숨김(HIDDEN)을 뺀다 */
interface GetBlogCategoryTreeUseCase {
    fun execute(query: Query): List<BlogCategoryNode>

    data class Query(val includeHidden: Boolean = false)
}
