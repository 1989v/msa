package com.kgd.blog.application.prompt.port

import com.kgd.blog.application.prompt.dto.*
import com.kgd.blog.domain.model.PeerPromptContent
import com.kgd.blog.domain.model.PeerReviewContent

interface PeerPromptRepositoryPort {
    fun list(domain: String?, page: Int, size: Int, memberId: Long?): List<PeerPromptSummary>
    fun find(id: Long, lock: Boolean = false): PeerPromptRecord?
    fun detail(id: Long, memberId: Long?): PeerPromptDetail?
    fun create(authorProfileId: Long, content: PeerPromptContent): Long
    fun review(promptId: Long, profileId: Long, content: PeerReviewContent)
    fun reviewOwner(promptId: Long, reviewId: Long): Long?
    fun removeReview(promptId: Long, reviewId: Long)
    fun remove(id: Long)
}
