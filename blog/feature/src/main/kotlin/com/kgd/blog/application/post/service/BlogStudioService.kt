package com.kgd.blog.application.post.service

import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.post.dto.BlogStudioOverview
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.usecase.GetBlogStudioOverviewUseCase
import com.kgd.blog.application.post.usecase.GetMyBlogPostUseCase
import com.kgd.blog.application.post.usecase.ListMyBlogPostsUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.Paging
import com.kgd.blog.domain.model.PostStatus
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
    private val postRepository: BlogPostRepositoryPort,
    private val profileService: BlogProfileService,
    private val queryService: BlogQueryService,
    private val writeService: BlogPostWriteService,
    private val assembler: BlogAssembler,
) : GetBlogStudioOverviewUseCase, ListMyBlogPostsUseCase, GetMyBlogPostUseCase {

    override fun execute(identity: BlogIdentity): BlogStudioOverview {
        val profile = profileService.find(identity)
        val profileId = profile?.id
        return BlogStudioOverview(
            profile = profile?.let { profileService.response(it) },
            canWrite = profile?.canWrite() ?: false,
            draftCount = profileId?.let { postRepository.countByAuthor(it, PostStatus.DRAFT) } ?: 0,
            publishedCount = profileId?.let { postRepository.countByAuthor(it, PostStatus.PUBLISHED) } ?: 0,
            totalViews = profileId?.let { postRepository.sumViewCountByAuthor(it) } ?: 0,
        )
    }

    override fun execute(query: ListMyBlogPostsUseCase.Query): BlogPage<BlogPostSummary> {
        val profileId = profileService.find(query.identity)?.id
            ?: return BlogPage(emptyList(), query.page, query.size, 0, 0)
        val paging = Paging.of(query.page, query.size, BlogQueryService.MAX_PAGE_SIZE)
        val result = postRepository.findByAuthor(profileId, query.status, paging)
        return BlogPage.of(Paged(assembler.summaries(result.items), result.page, result.size, result.totalElements, result.totalPages))
    }

    /** 초안 미리보기 — 소유자·어드민에게만 열린다. 공개 상세는 발행글만 본다 */
    override fun execute(query: GetMyBlogPostUseCase.Query): BlogPostDetail =
        queryService.preview(writeService.editableOrThrow(query.postId, query.identity), query.identity)
}
