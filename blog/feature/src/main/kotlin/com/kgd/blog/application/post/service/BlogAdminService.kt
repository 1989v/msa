package com.kgd.blog.application.post.service

import com.kgd.blog.application.category.dto.BlogCategoryNode
import com.kgd.blog.application.category.dto.BlogCategoryRequest
import com.kgd.blog.application.category.port.BlogCategoryRepositoryPort
import com.kgd.blog.application.category.usecase.CreateBlogCategoryUseCase
import com.kgd.blog.application.category.usecase.DeleteBlogCategoryUseCase
import com.kgd.blog.application.category.usecase.UpdateBlogCategoryUseCase
import com.kgd.blog.application.comment.dto.BlogCommentAdminResponse
import com.kgd.blog.application.comment.port.BlogCommentRepositoryPort
import com.kgd.blog.application.comment.usecase.ListBlogCommentsAdminUseCase
import com.kgd.blog.application.interaction.port.BlogPostViewRepositoryPort
import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.post.dto.BlogViewDaily
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.usecase.GetBlogViewsDailyUseCase
import com.kgd.blog.application.post.usecase.ListBlogPostsAdminUseCase
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.application.profile.usecase.ChangeBlogProfileStatusUseCase
import com.kgd.blog.application.profile.usecase.ListBlogProfilesAdminUseCase
import com.kgd.blog.domain.model.BlogCategory
import com.kgd.blog.domain.model.CategoryStatus
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.Paging
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 블로그 백오피스 (ADR-0072 §7 — 어드민 콘솔).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다 (display·deal 어드민과 동일).
 */
@Service
@Transactional(readOnly = true)
class BlogAdminService(
    private val categoryRepository: BlogCategoryRepositoryPort,
    private val profileRepository: BlogProfileRepositoryPort,
    private val postRepository: BlogPostRepositoryPort,
    private val commentRepository: BlogCommentRepositoryPort,
    private val viewRepository: BlogPostViewRepositoryPort,
    private val profileService: BlogProfileService,
    private val assembler: BlogAssembler,
) : CreateBlogCategoryUseCase, UpdateBlogCategoryUseCase, DeleteBlogCategoryUseCase,
    ListBlogProfilesAdminUseCase, ChangeBlogProfileStatusUseCase,
    ListBlogPostsAdminUseCase, GetBlogViewsDailyUseCase, ListBlogCommentsAdminUseCase {

    // ─── 카테고리 ───────────────────────────────────────────────────────────

    @Transactional
    override fun execute(request: BlogCategoryRequest): BlogCategoryNode {
        val parent = request.parentId?.let { categoryOrThrow(it) }
        val slug = request.slug.trim().lowercase()
        if (categoryRepository.existsByParentIdAndSlug(parent?.id, slug)) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "같은 위치에 이미 있는 슬러그입니다: $slug")
        }
        // 깊이 상한(3단)은 도메인이 판정한다
        val domain = if (parent == null) {
            BlogCategory.newRoot(slug, request.name.trim(), request.description, request.orderNo)
        } else {
            BlogCategory.newChild(parent, slug, request.name.trim(), request.description, request.orderNo)
        }
        val saved = categoryRepository.save(if (request.hidden) domain.copy(status = CategoryStatus.HIDDEN) else domain)
        return node(saved)
    }

    /**
     * 카테고리 수정. 부모나 슬러그가 바뀌면 **하위 전체의 경로를 다시 쓴다** —
     * 물질화 경로를 쓰는 대가가 여기 한 곳에 모여 있다. 빠뜨리면 하위 카테고리의 글이
     * 조회에서 통째로 사라지고, 원인은 화면 어디에도 드러나지 않는다.
     */
    @Transactional
    override fun execute(command: UpdateBlogCategoryUseCase.Command): BlogCategoryNode {
        val (id, request) = command
        val category = categoryOrThrow(id)
        val parent = request.parentId?.let { categoryOrThrow(it) }
        if (parent != null && (parent.id == id || parent.path.startsWith("${category.path}/"))) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리를 자기 하위로 옮길 수 없습니다")
        }
        val slug = request.slug.trim().lowercase()
        if ((parent?.id != category.parentId || slug != category.slug) &&
            categoryRepository.existsByParentIdAndSlug(parent?.id, slug)
        ) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "같은 위치에 이미 있는 슬러그입니다: $slug")
        }

        val oldPath = category.path
        val domain = if (parent == null) {
            BlogCategory.newRoot(slug, request.name.trim(), request.description, request.orderNo)
        } else {
            BlogCategory.newChild(parent, slug, request.name.trim(), request.description, request.orderNo)
        }
        val next = (if (request.hidden) domain.copy(status = CategoryStatus.HIDDEN) else domain).copy(id = id)
        val descendants = categoryRepository.findSubtree(oldPath).filter { it.id != id }
        val saved = categoryRepository.save(next)
        relocateDescendants(descendants, oldPath, next.path)
        return node(saved)
    }

    private fun relocateDescendants(descendants: List<BlogCategory>, oldPath: String, newPath: String) {
        val moved = descendants.map { child ->
            val movedPath = newPath + child.path.removePrefix(oldPath)
            val movedDepth = movedPath.trim('/').split('/').size
            if (movedDepth > BlogCategory.MAX_DEPTH) {
                throw BusinessException(
                    ErrorCode.INVALID_INPUT,
                    "이동하면 하위 카테고리가 ${BlogCategory.MAX_DEPTH}단을 넘습니다",
                )
            }
            child.copy(depth = movedDepth, path = movedPath)
        }
        if (moved.isNotEmpty()) categoryRepository.saveAll(moved)
    }

    /** 삭제는 비어 있을 때만. 글이나 하위가 남은 채 지우면 그 글들이 조회에서 사라진다 */
    @Transactional
    override fun execute(command: DeleteBlogCategoryUseCase.Command) {
        val id = command.id
        categoryOrThrow(id)
        if (categoryRepository.countByParentId(id) > 0) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "하위 카테고리가 있어 삭제할 수 없습니다")
        }
        if (postRepository.countByCategoryId(id) > 0) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "글이 있어 삭제할 수 없습니다. 숨김 처리를 쓰세요")
        }
        categoryRepository.deleteById(id)
    }

    // ─── 저자 ──────────────────────────────────────────────────────────────

    override fun execute(query: ListBlogProfilesAdminUseCase.Query): List<BlogProfileAdminResponse> =
        profileRepository.findAll(query.role, query.status).map(profileService::response)

    @Transactional
    override fun execute(command: ChangeBlogProfileStatusUseCase.Command): BlogProfileAdminResponse {
        val (id, status, identity) = command
        val profile = profileRepository.findById(id)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "프로필을 찾을 수 없습니다")
        val changed = if (status == ProfileStatus.ACTIVE && profile.role == ProfileRole.AUTHOR) {
            // 승인 — 누가 언제 승인했는지 남긴다. 정지·복구 판단의 근거가 된다
            profile.approve(identity.memberId ?: 0, LocalDateTime.now())
        } else {
            profile.withStatus(status)
        }
        return profileService.response(profileRepository.save(changed))
    }

    // ─── 글 ────────────────────────────────────────────────────────────────

    override fun execute(query: ListBlogPostsAdminUseCase.Query): BlogPage<BlogPostSummary> {
        val result = postRepository.findAll(query.status, Paging.of(query.page, query.size, BlogQueryService.MAX_PAGE_SIZE))
        return BlogPage.of(Paged(assembler.summaries(result.items), result.page, result.size, result.totalElements, result.totalPages))
    }

    override fun execute(query: GetBlogViewsDailyUseCase.Query): List<BlogViewDaily> =
        viewRepository.countDailyByPost(query.postId, query.from, query.to).map { BlogViewDaily(it.date, it.count) }

    // ─── 댓글 ──────────────────────────────────────────────────────────────

    override fun execute(query: ListBlogCommentsAdminUseCase.Query): BlogPage<BlogCommentAdminResponse> {
        val result = commentRepository.findAll(query.status, Paging.of(query.page, query.size, BlogQueryService.MAX_PAGE_SIZE))
        val authors = profileRepository.findAllByIdIn(result.items.map { it.profileId }.toSet()).associateBy { it.id }
        val posts = postRepository.findAllByIdIn(result.items.map { it.postId }.toSet()).associateBy { it.id }
        return BlogPage.of(
            result.map { comment ->
                val post = posts[comment.postId]
                BlogCommentAdminResponse(
                    id = comment.id ?: 0,
                    postId = comment.postId,
                    postSlug = post?.slug ?: "",
                    postTitle = post?.title ?: "(삭제된 글)",
                    author = assembler.authorSummary(authors[comment.profileId]),
                    body = comment.body,
                    status = comment.status,
                    createdAt = comment.createdAt,
                )
            },
        )
    }

    private fun categoryOrThrow(id: Long): BlogCategory = categoryRepository.findById(id)
        ?: throw BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $id")

    private fun node(category: BlogCategory) = BlogCategoryNode(
        id = category.id ?: 0,
        slug = category.slug,
        name = category.name,
        description = category.description,
        path = category.path,
        depth = category.depth,
        orderNo = category.orderNo,
        postCount = postRepository.countByCategoryId(category.id ?: 0),
        children = emptyList(),
    )
}
