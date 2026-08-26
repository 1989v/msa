package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.domain.model.PostStatus

interface ChangeBlogPostStatusUseCase {
    fun execute(command: Command): BlogPostSummary

    data class Command(val postId: Long, val status: PostStatus, val identity: BlogIdentity)
}
