package com.kgd.blog.application.comment.usecase

import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.profile.dto.BlogIdentity

/** 댓글 스레드. 삭제·숨김 댓글도 자리를 남긴다 */
interface GetBlogCommentsUseCase {
    fun execute(query: Query): List<BlogCommentNode>

    data class Query(val slug: String, val identity: BlogIdentity)
}
