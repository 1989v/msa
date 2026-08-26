package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPostRequest
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.profile.dto.BlogIdentity

interface CreateBlogPostUseCase {
    fun execute(command: Command): BlogPostSummary

    data class Command(val request: BlogPostRequest, val identity: BlogIdentity)
}
