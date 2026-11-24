package com.kgd.blog.application.prompt.usecase

import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.prompt.dto.*

interface PeerPromptUseCase {
    fun list(domain: String?, page: Int, identity: BlogIdentity): PeerPromptPage
    fun detail(id: Long, identity: BlogIdentity): PeerPromptDetail
    fun create(request: PeerPromptRequest, identity: BlogIdentity): PeerPromptDetail
    fun review(id: Long, request: PeerReviewRequest, identity: BlogIdentity): PeerPromptDetail
    fun remove(id: Long, identity: BlogIdentity)
    fun removeReview(id: Long, reviewId: Long, identity: BlogIdentity)
}
