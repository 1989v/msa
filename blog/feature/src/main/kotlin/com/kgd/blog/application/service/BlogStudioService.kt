package com.kgd.blog.application.service

import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogPage
import com.kgd.blog.application.dto.BlogPostDetail
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.application.dto.BlogStudioOverview
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 작성자 스튜디오 (blog 호스트 `/studio`).
 *
 * 어드민 콘솔과 달리 **자기 것만 보인다.** 목록 쿼리 자체가 `authorProfileId` 로 좁혀져 있어
 * 화면이 거르는 게 아니다 — 화면에서 거르면 페이지네이션이 어긋나고 언젠가 남의 글이 샌다.
 */
@Service
@Transactional(readOnly = true)
class BlogStudioService(
    private val postRepository: BlogPostJpaRepository,
    private val profileService: BlogProfileService,
    private val queryService: BlogQueryService,
    private val writeService: BlogPostWriteService,
    private val assembler: BlogAssembler,
) {

    fun overview(identity: BlogIdentity): BlogStudioOverview {
        val profile = profileService.find(identity)
        val profileId = profile?.id
        val published = profileId?.let { countOf(it, PostStatus.PUBLISHED) } ?: 0
        val drafts = profileId?.let { countOf(it, PostStatus.DRAFT) } ?: 0
        val views = profileId?.let { id ->
            postRepository.findAllByAuthorProfileIdOrderByIdDesc(id, ALL_PROBE).content.sumOf { it.viewCount }
        } ?: 0
        return BlogStudioOverview(
            profile = profile?.let { profileService.response(it) },
            canWrite = profile?.toDomain()?.canWrite() ?: false,
            draftCount = drafts,
            publishedCount = published,
            totalViews = views,
        )
    }

    fun myPosts(identity: BlogIdentity, status: PostStatus?, page: Int, size: Int): BlogPage<BlogPostSummary> {
        val profileId = profileService.find(identity)?.id
            ?: return BlogPage(emptyList(), page, size, 0, 0)
        val pageable = PageRequest.of(page.coerceAtLeast(0), size.coerceIn(1, BlogQueryService.MAX_PAGE_SIZE))
        val result = if (status == null) {
            postRepository.findAllByAuthorProfileIdOrderByIdDesc(profileId, pageable)
        } else {
            postRepository.findAllByAuthorProfileIdAndStatusOrderByIdDesc(profileId, status, pageable)
        }
        return BlogPage(
            items = assembler.summaries(result.content),
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    /** 초안 미리보기 — 소유자·어드민에게만 열린다. 공개 상세는 발행글만 본다 */
    fun myPost(postId: Long, identity: BlogIdentity): BlogPostDetail {
        val post = writeService.editableOrThrow(postId, identity)
        return queryService.preview(post, identity)
    }

    private fun countOf(profileId: Long, status: PostStatus): Long =
        postRepository.findAllByAuthorProfileIdAndStatusOrderByIdDesc(profileId, status, COUNT_PROBE).totalElements

    private companion object {
        val COUNT_PROBE = PageRequest.of(0, 1)

        /**
         * 총 조회수 합계용. 스튜디오는 개인 글 목록이라 상한이 현실적인 최대치를 넘지 않는다 —
         * 넘어가면 합계 컬럼을 따로 두어야 한다는 신호다.
         */
        val ALL_PROBE = PageRequest.of(0, 500)
    }
}
