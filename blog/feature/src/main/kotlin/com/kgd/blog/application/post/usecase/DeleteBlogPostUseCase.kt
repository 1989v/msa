package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.profile.dto.BlogIdentity

interface DeleteBlogPostUseCase {
    fun execute(command: Command)

    data class Command(val postId: Long, val identity: BlogIdentity)
}
