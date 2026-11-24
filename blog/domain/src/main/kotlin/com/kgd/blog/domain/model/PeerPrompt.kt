package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

enum class PeerPromptDomain { SOFTWARE, DATA, DESIGN, MARKETING, BUSINESS, EDUCATION, OTHER }

private fun text(value: String, max: Int, label: String) {
    if (value.isBlank() || value.length > max) {
        throw BusinessException(ErrorCode.INVALID_INPUT, "$label: 1~${max}자 입력이 필요합니다")
    }
}

data class PeerPromptContent(
    val domain: String,
    val title: String,
    val purpose: String,
    val modelContext: String,
    val promptText: String,
) {
    init {
        if (PeerPromptDomain.entries.none { it.name == domain }) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "지원하지 않는 분야입니다")
        }
        text(title, 160, "제목")
        text(purpose, 1000, "목적")
        text(modelContext, 2000, "모델·사용 맥락")
        text(promptText, 30000, "프롬프트")
    }
}

data class PeerReviewContent(
    val reviewerDomain: String,
    val reviewerRole: String,
    val score: Int,
    val worked: String,
    val limitations: String,
    val context: String,
) {
    init {
        text(reviewerDomain, 80, "리뷰어 분야")
        text(reviewerRole, 80, "리뷰어 역할")
        text(worked, 2000, "유용했던 점")
        text(limitations, 2000, "한계")
        text(context, 2000, "테스트 맥락")
        if (score !in 1..5) throw BusinessException(ErrorCode.INVALID_INPUT, "평점은 1~5점입니다")
    }
}

object PeerPromptPolicy {
    const val MIN_RANK_REVIEWS = 3L
    fun ranked(count: Long): Boolean = count >= MIN_RANK_REVIEWS
    fun requireReviewer(authorProfileId: Long, reviewerProfileId: Long) {
        if (authorProfileId == reviewerProfileId) {
            throw BusinessException(ErrorCode.FORBIDDEN, "자신의 프롬프트는 평가할 수 없습니다")
        }
    }
    fun requireOwner(ownerProfileId: Long, profileId: Long?, admin: Boolean) {
        if (!admin && ownerProfileId != profileId) throw BusinessException(ErrorCode.FORBIDDEN, "작성자만 삭제할 수 있습니다")
    }
}
