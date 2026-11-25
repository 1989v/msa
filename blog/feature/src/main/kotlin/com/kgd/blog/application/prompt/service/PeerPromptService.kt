package com.kgd.blog.application.prompt.service

import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.application.prompt.dto.*
import com.kgd.blog.application.prompt.port.PeerPromptRepositoryPort
import com.kgd.blog.application.prompt.usecase.PeerPromptUseCase
import com.kgd.blog.domain.model.PeerPromptDomain
import com.kgd.blog.domain.model.PeerPromptPolicy
import com.kgd.blog.domain.model.PeerPromptTag
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class PeerPromptService(
    private val repository: PeerPromptRepositoryPort,
    private val profiles: BlogProfileService,
) : PeerPromptUseCase {
    override fun list(domain: String?, page: Int, identity: BlogIdentity, tag: String?): PeerPromptPage {
        if (page !in 0..10000 || (domain != null && PeerPromptDomain.entries.none { it.name == domain }) ||
            (tag != null && PeerPromptTag.entries.none { it.name == tag })) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "분야 또는 페이지가 올바르지 않습니다")
        }
        val rows = repository.list(domain, page, 20, identity.memberId, tag)
        return PeerPromptPage(rows.take(20), page, 20, rows.size > 20)
    }

    // Summary, content and reviews must describe one database snapshot.
    @Transactional(transactionManager = "blogTransactionManager", readOnly = true)
    override fun detail(id: Long, identity: BlogIdentity): PeerPromptDetail =
        repository.detail(id, identity.memberId) ?: throw BusinessException(ErrorCode.NOT_FOUND, "프롬프트를 찾을 수 없습니다")

    @Transactional(transactionManager = "blogTransactionManager")
    override fun create(request: PeerPromptRequest, identity: BlogIdentity): PeerPromptDetail {
        val profile = profiles.requireInteractiveProfile(identity, request.displayName)
        val id = repository.create(requireNotNull(profile.id), request.content)
        return detail(id, identity)
    }

    @Transactional(transactionManager = "blogTransactionManager")
    override fun review(id: Long, request: PeerReviewRequest, identity: BlogIdentity): PeerPromptDetail {
        val profile = profiles.requireInteractiveProfile(identity, request.displayName)
        val prompt = active(id, lock = true)
        val reviewerId = requireNotNull(profile.id)
        PeerPromptPolicy.requireReviewer(prompt.authorProfileId, reviewerId)
        repository.review(id, reviewerId, request.content)
        return detail(id, identity)
    }

    @Transactional(transactionManager = "blogTransactionManager")
    override fun remove(id: Long, identity: BlogIdentity) {
        profiles.requireMemberId(identity)
        val prompt = active(id, lock = true)
        PeerPromptPolicy.requireOwner(prompt.authorProfileId, profiles.find(identity)?.id, identity.isAdmin)
        repository.remove(id)
    }

    @Transactional(transactionManager = "blogTransactionManager")
    override fun removeReview(id: Long, reviewId: Long, identity: BlogIdentity) {
        profiles.requireMemberId(identity)
        active(id, lock = true)
        val owner = repository.reviewOwner(id, reviewId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "리뷰를 찾을 수 없습니다")
        PeerPromptPolicy.requireOwner(owner, profiles.find(identity)?.id, identity.isAdmin)
        repository.removeReview(id, reviewId)
    }

    private fun active(id: Long, lock: Boolean): PeerPromptRecord =
        repository.find(id, lock)?.takeUnless { it.removed }
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "프롬프트를 찾을 수 없습니다")
}
