package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogAuthorSpace

interface GetBlogAuthorSpaceUseCase {
    fun execute(query: Query): BlogAuthorSpace

    data class Query(val handle: String, val page: Int, val size: Int)
}
