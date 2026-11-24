package com.kgd.blog.application.prompt.dto

import com.kgd.blog.domain.model.PeerPromptContent
import com.kgd.blog.domain.model.PeerPromptPolicy
import com.kgd.blog.domain.model.PeerReviewContent
import java.time.LocalDateTime

data class PeerPromptRequest(val content: PeerPromptContent, val displayName: String)
data class PeerReviewRequest(val content: PeerReviewContent, val displayName: String)

data class PeerPromptSummary(
    val id: Long,
    val domain: String,
    val title: String,
    val purpose: String,
    val authorName: String,
    val createdAt: LocalDateTime,
    val reviewCount: Long,
    val ratingAverage: Double?,
    val mine: Boolean,
) {
    val ranked: Boolean get() = PeerPromptPolicy.ranked(reviewCount)
}

data class PeerReviewResponse(
    val id: Long,
    val reviewerName: String,
    val content: PeerReviewContent,
    val createdAt: LocalDateTime,
    val mine: Boolean,
)

data class PeerPromptDetail(
    val summary: PeerPromptSummary,
    val content: PeerPromptContent,
    val reviews: List<PeerReviewResponse>,
    val myReview: PeerReviewResponse?,
)

data class PeerPromptPage(val items: List<PeerPromptSummary>, val page: Int, val size: Int, val hasMore: Boolean)
data class PeerPromptRecord(val id: Long, val authorProfileId: Long, val content: PeerPromptContent, val removed: Boolean)
