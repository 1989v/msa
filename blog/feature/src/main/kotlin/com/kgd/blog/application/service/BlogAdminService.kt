package com.kgd.blog.application.service

import com.kgd.blog.application.dto.BlogCategoryNode
import com.kgd.blog.application.dto.BlogCategoryRequest
import com.kgd.blog.application.dto.BlogCommentAdminResponse
import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogPage
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.application.dto.BlogProfileAdminResponse
import com.kgd.blog.application.dto.BlogViewDaily
import com.kgd.blog.domain.model.BlogCategory
import com.kgd.blog.domain.model.CategoryStatus
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.blog.infrastructure.persistence.entity.BlogCategoryJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCategoryJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogCommentJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostViewJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.sql.Date as SqlDate
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 블로그 백오피스 (ADR-0072 §7 — 어드민 콘솔).
 *
 * 인증은 게이트웨이의 admin 경로 ROLE_ADMIN 필터가 담당한다 (display·deal 어드민과 동일).
 */
@Service
@Transactional(readOnly = true)
class BlogAdminService(
    private val categoryRepository: BlogCategoryJpaRepository,
    private val profileRepository: BlogProfileJpaRepository,
    private val postRepository: BlogPostJpaRepository,
    private val commentRepository: BlogCommentJpaRepository,
    private val viewRepository: BlogPostViewJpaRepository,
    private val profileService: BlogProfileService,
    private val queryService: BlogQueryService,
    private val assembler: BlogAssembler,
) {

    // ─── 카테고리 ───────────────────────────────────────────────────────────

    fun categories(): List<BlogCategoryNode> = queryService.categoryTree(includeHidden = true)

    @Transactional
    fun createCategory(request: BlogCategoryRequest): BlogCategoryNode {
        val parent = request.parentId?.let { categoryOrThrow(it) }
        val slug = request.slug.trim().lowercase()
        if (categoryRepository.existsByParentIdAndSlug(parent?.id, slug)) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "같은 위치에 이미 있는 슬러그입니다: $slug")
        }
        // 깊이 상한(3단)은 도메인이 판정한다
        val domain = if (parent == null) {
            BlogCategory.newRoot(slug, request.name.trim(), request.description, request.orderNo)
        } else {
            BlogCategory.newChild(parent.toDomain(), slug, request.name.trim(), request.description, request.orderNo)
        }
        val saved = categoryRepository.save(BlogCategoryJpaEntity()).apply {
            update(if (request.hidden) domain.copy(status = CategoryStatus.HIDDEN) else domain)
        }
        return node(saved)
    }

    /**
     * 카테고리 수정. 부모나 슬러그가 바뀌면 **하위 전체의 경로를 다시 쓴다** —
     * 물질화 경로를 쓰는 대가가 여기 한 곳에 모여 있다. 빠뜨리면 하위 카테고리의 글이
     * 조회에서 통째로 사라지고, 원인은 화면 어디에도 드러나지 않는다.
     */
    @Transactional
    fun updateCategory(id: Long, request: BlogCategoryRequest): BlogCategoryNode {
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
            BlogCategory.newChild(parent.toDomain(), slug, request.name.trim(), request.description, request.orderNo)
        }
        val next = if (request.hidden) domain.copy(status = CategoryStatus.HIDDEN) else domain
        val descendants = categoryRepository.findSubtree(oldPath).filter { it.id != id }
        category.update(next)
        relocateDescendants(descendants, oldPath, next.path)
        return node(category)
    }

    private fun relocateDescendants(
        descendants: List<BlogCategoryJpaEntity>,
        oldPath: String,
        newPath: String,
    ) {
        descendants.forEach { child ->
            val suffix = child.path.removePrefix(oldPath)
            val movedPath = newPath + suffix
            val movedDepth = movedPath.trim('/').split('/').size
            if (movedDepth > BlogCategory.MAX_DEPTH) {
                throw BusinessException(
                    ErrorCode.INVALID_INPUT,
                    "이동하면 하위 카테고리가 ${BlogCategory.MAX_DEPTH}단을 넘습니다",
                )
            }
            child.relocate(child.parentId, movedDepth, movedPath)
        }
    }

    /** 삭제는 비어 있을 때만. 글이나 하위가 남은 채 지우면 그 글들이 조회에서 사라진다 */
    @Transactional
    fun deleteCategory(id: Long) {
        val category = categoryOrThrow(id)
        if (categoryRepository.countByParentId(id) > 0) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "하위 카테고리가 있어 삭제할 수 없습니다")
        }
        if (postRepository.countByCategoryId(id) > 0) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "글이 있어 삭제할 수 없습니다. 숨김 처리를 쓰세요")
        }
        categoryRepository.delete(category)
    }

    // ─── 저자 ──────────────────────────────────────────────────────────────

    fun profiles(role: ProfileRole?, status: ProfileStatus?): List<BlogProfileAdminResponse> {
        val all = when {
            role != null && status != null -> profileRepository.findAllByRoleAndStatusOrderByIdDesc(role, status)
            role != null -> profileRepository.findAllByRoleOrderByIdDesc(role)
            else -> profileRepository.findAll().sortedByDescending { it.id }
        }
        return all.filter { status == null || it.status == status }.map(profileService::response)
    }

    @Transactional
    fun changeProfileStatus(id: Long, status: ProfileStatus, identity: BlogIdentity): BlogProfileAdminResponse {
        val profile = profileRepository.findById(id).orElseThrow {
            BusinessException(ErrorCode.NOT_FOUND, "프로필을 찾을 수 없습니다")
        }
        if (status == ProfileStatus.ACTIVE && profile.role == ProfileRole.AUTHOR) {
            // 승인 — 누가 언제 승인했는지 남긴다. 정지·복구 판단의 근거가 된다
            profile.approve(identity.memberId ?: 0, LocalDateTime.now())
        } else {
            profile.changeStatus(status)
        }
        return profileService.response(profile)
    }

    // ─── 글 ────────────────────────────────────────────────────────────────

    fun posts(status: PostStatus?, page: Int, size: Int): BlogPage<BlogPostSummary> {
        val pageable = PageRequest.of(page.coerceAtLeast(0), size.coerceIn(1, BlogQueryService.MAX_PAGE_SIZE))
        val result = if (status == null) {
            postRepository.findAll(pageable)
        } else {
            postRepository.findAllByStatusOrderByPublishedAtDescIdDesc(status, pageable)
        }
        return BlogPage(
            items = assembler.summaries(result.content),
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    fun viewsDaily(postId: Long, from: LocalDate, to: LocalDate): List<BlogViewDaily> =
        viewRepository.countDailyByPost(postId, from, to).map { row ->
            val day = when (val raw = row[0]) {
                is LocalDate -> raw
                is SqlDate -> raw.toLocalDate()
                else -> LocalDate.parse(raw.toString())
            }
            BlogViewDaily(day, (row[1] as Number).toLong())
        }

    // ─── 댓글 ──────────────────────────────────────────────────────────────

    fun comments(status: CommentStatus?, page: Int, size: Int): BlogPage<BlogCommentAdminResponse> {
        val pageable = PageRequest.of(page.coerceAtLeast(0), size.coerceIn(1, BlogQueryService.MAX_PAGE_SIZE))
        val result = if (status == null) {
            commentRepository.findAllByOrderByIdDesc(pageable)
        } else {
            commentRepository.findAllByStatusOrderByIdDesc(status, pageable)
        }
        val authors = profileRepository.findAllByIdIn(result.content.map { it.profileId }.toSet())
            .associateBy { it.id }
        val posts = postRepository.findAllById(result.content.map { it.postId }.toSet()).associateBy { it.id }
        return BlogPage(
            items = result.content.map { comment ->
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
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    private fun categoryOrThrow(id: Long) = categoryRepository.findById(id).orElseThrow {
        BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $id")
    }

    private fun node(category: BlogCategoryJpaEntity) = BlogCategoryNode(
        id = category.id ?: 0,
        slug = category.slug,
        name = category.name,
        description = category.description,
        path = category.path,
        depth = category.depth,
        postCount = postRepository.countByCategoryId(category.id ?: 0),
        children = emptyList(),
    )
}
