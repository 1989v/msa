package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogPostRequest
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.profile.dto.BlogIdentity

/** 슬러그는 바꾸지 않는다 — 발행 뒤 주소가 바뀌면 공유된 링크와 색인이 죽는다 */
interface UpdateBlogPostUseCase {
    fun execute(command: Command): BlogPostSummary

    data class Command(val postId: Long, val request: BlogPostRequest, val identity: BlogIdentity)
}
