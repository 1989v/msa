package com.kgd.blog.application.category.usecase

import com.kgd.blog.application.category.dto.BlogCategoryNode
import com.kgd.blog.application.category.dto.BlogCategoryRequest

interface CreateBlogCategoryUseCase {
    fun execute(request: BlogCategoryRequest): BlogCategoryNode
}
