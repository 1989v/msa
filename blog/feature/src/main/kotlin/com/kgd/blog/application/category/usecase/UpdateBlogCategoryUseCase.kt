package com.kgd.blog.application.category.usecase

import com.kgd.blog.application.category.dto.BlogCategoryNode
import com.kgd.blog.application.category.dto.BlogCategoryRequest

/** 부모나 슬러그가 바뀌면 하위 전체의 경로를 다시 쓴다 */
interface UpdateBlogCategoryUseCase {
    fun execute(command: Command): BlogCategoryNode

    data class Command(val id: Long, val request: BlogCategoryRequest)
}
