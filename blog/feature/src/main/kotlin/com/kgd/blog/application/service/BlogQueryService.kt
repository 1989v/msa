package com.kgd.blog.application.service

import com.kgd.blog.application.dto.BlogAuthorSpace
import com.kgd.blog.application.dto.BlogCategoryNode
import com.kgd.blog.application.dto.BlogCommentNode
import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogPage
import com.kgd.blog.application.dto.BlogPostDetail
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.domain.model.CategoryStatus
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.infrastructure.persistence.entity.BlogCommentJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCategoryJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogCommentJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostLikeJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostRatingJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 공개 조회. 쓰기가 없으므로 전부 read-only — replica 로 라우팅된다(RoutingDataSource).
 */
@Service
@Transactional(readOnly = true)
class BlogQueryService(
    private val postRepository: BlogPostJpaRepository,
    private val categoryRepository: BlogCategoryJpaRepository,
    private val profileRepository: BlogProfileJpaRepository,
    private val commentRepository: BlogCommentJpaRepository,
    private val likeRepository: BlogPostLikeJpaRepository,
    private val ratingRepository: BlogPostRatingJpaRepository,
    private val assembler: BlogAssembler,
) {

    /** 목록·네비용 카테고리 트리. 숨김(HIDDEN)은 빠진다 */
    fun categoryTree(includeHidden: Boolean = false): List<BlogCategoryNode> {
        val all = categoryRepository.findAllByOrderByPathAsc()
            .filter { includeHidden || it.status == CategoryStatus.OPEN }
        val counts = all.associate { (it.id ?: 0L) to postRepository.countByCategoryId(it.id ?: 0L) }
        val byParent = all.groupBy { it.parentId }

        fun build(parentId: Long?): List<BlogCategoryNode> =
            (byParent[parentId] ?: emptyList())
                .sortedWith(compareBy({ it.orderNo }, { it.id }))
                .map { category ->
                    val children = build(category.id)
                    BlogCategoryNode(
                        id = category.id ?: 0,
                        slug = category.slug,
                        name = category.name,
                        description = category.description,
                        path = category.path,
                        depth = category.depth,
                        // 하위 글까지 합산한다 — 상위 카테고리가 늘 0 이면 트리가 죽어 보인다
                        postCount = counts[category.id] ?: 0L,
                        children = children,
                    ).let { node -> node.copy(postCount = node.postCount + children.sumOf { it.postCount }) }
                }

        return build(null)
    }

    /**
     * 발행글 목록.
     *
     * `categoryPath` 는 서브트리를 통째로 받는다 — `/tech` 를 고르면 `/tech/server/search` 의
     * 글도 나온다. 상위를 골랐을 때 아무것도 안 나오는 화면은 카테고리를 쓸 이유를 없앤다.
     */
    fun posts(categoryPath: String?, handle: String?, page: Int, size: Int): BlogPage<BlogPostSummary> {
        val pageable = PageRequest.of(page.coerceAtLeast(0), size.coerceIn(1, MAX_PAGE_SIZE))
        val categoryIds = categoryPath?.let { path ->
            categoryRepository.findSubtree(path).mapNotNull { it.id }.ifEmpty { return emptyPage(pageable.pageNumber, pageable.pageSize) }
        }
        val authorId = handle?.let { profileRepository.findByHandle(it)?.id ?: return emptyPage(pageable.pageNumber, pageable.pageSize) }

        val result: Page<BlogPostJpaEntity> = when {
            categoryIds != null && authorId != null ->
                postRepository.findAllByStatusAndCategoryIdInAndAuthorProfileIdOrderByPublishedAtDescIdDesc(
                    PostStatus.PUBLISHED, categoryIds, authorId, pageable,
                )
            categoryIds != null ->
                postRepository.findAllByStatusAndCategoryIdInOrderByPublishedAtDescIdDesc(
                    PostStatus.PUBLISHED, categoryIds, pageable,
                )
            authorId != null ->
                postRepository.findAllByStatusAndAuthorProfileIdOrderByPublishedAtDescIdDesc(
                    PostStatus.PUBLISHED, authorId, pageable,
                )
            else -> postRepository.findAllByStatusOrderByPublishedAtDescIdDesc(PostStatus.PUBLISHED, pageable)
        }
        return BlogPage(
            items = assembler.summaries(result.content),
            page = result.number,
            size = result.size,
            totalElements = result.totalElements,
            totalPages = result.totalPages,
        )
    }

    /** 공개 상세. 미발행 슬러그는 존재를 드러내지 않고 404 */
    fun post(slug: String, identity: BlogIdentity): BlogPostDetail {
        val post = publishedOrThrow(slug)
        return detailOf(post, identity)
    }

    /** 소유자·어드민 전용 미리보기 — 초안도 돌려준다 */
    fun preview(post: BlogPostJpaEntity, identity: BlogIdentity): BlogPostDetail = detailOf(post, identity)

    private fun detailOf(post: BlogPostJpaEntity, identity: BlogIdentity): BlogPostDetail {
        val postId = post.id ?: 0
        val author = post.authorProfileId.let { profileRepository.findById(it).orElse(null) }
        val category = categoryRepository.findById(post.categoryId).orElse(null)
        val voter = runCatching { identity.voterKey() }.getOrNull()
        return BlogPostDetail(
            post = assembler.summary(post, author, category),
            body = post.body,
            breadcrumb = assembler.breadcrumb(category),
            liked = voter != null &&
                likeRepository.findByPostIdAndVoterTypeAndVoterKey(postId, voter.voterType, voter.key) != null,
            myScore = voter?.let {
                ratingRepository.findByPostIdAndVoterTypeAndVoterKey(postId, it.voterType, it.key)?.score
            },
        )
    }

    fun authorSpace(handle: String, page: Int, size: Int): BlogAuthorSpace {
        val profile = profileRepository.findByHandle(handle)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "작성자를 찾을 수 없습니다: $handle")
        // 승인 전·정지된 저자의 공간은 존재를 드러내지 않는다
        if (!profile.toDomain().hasPublicSpace()) {
            throw BusinessException(ErrorCode.NOT_FOUND, "작성자를 찾을 수 없습니다: $handle")
        }
        val posts = posts(categoryPath = null, handle = handle, page = page, size = size)
        return BlogAuthorSpace(
            author = assembler.authorSummary(profile),
            postCount = posts.totalElements,
            posts = posts.items,
        )
    }

    /**
     * 댓글 스레드. 삭제·숨김 댓글도 자리를 남긴다 — 빼 버리면 대댓글이 부모를 잃고
     * 대화의 맥락이 끊긴다.
     */
    fun comments(slug: String, identity: BlogIdentity): List<BlogCommentNode> {
        val post = publishedOrThrow(slug)
        val all = commentRepository.findAllByPostIdOrderByIdAsc(post.id ?: 0)
        if (all.isEmpty()) return emptyList()
        val authors = profileRepository.findAllByIdIn(all.map { it.profileId }.toSet()).associateBy { it.id }
        val myProfileId = identity.memberId?.let { profileRepository.findByMemberId(it)?.id }
        val byParent = all.groupBy { it.parentId }

        fun node(entity: BlogCommentJpaEntity): BlogCommentNode = BlogCommentNode(
            id = entity.id ?: 0,
            author = assembler.authorSummary(authors[entity.profileId]),
            body = entity.body,
            status = entity.status,
            mine = myProfileId != null && myProfileId == entity.profileId,
            createdAt = entity.createdAt,
            updatedAt = entity.updatedAt,
            replies = (byParent[entity.id] ?: emptyList()).map(::node),
        )

        return (byParent[null] ?: emptyList()).map(::node)
    }

    fun publishedOrThrow(slug: String): BlogPostJpaEntity {
        val post = postRepository.findBySlug(slug)
        if (post == null || post.status != PostStatus.PUBLISHED) {
            throw BusinessException(ErrorCode.NOT_FOUND, "글을 찾을 수 없습니다: $slug")
        }
        return post
    }

    /** 사이트맵·프리렌더가 쓰는 전체 발행글 */
    fun allPublished(): List<BlogPostSummary> = assembler.summaries(postRepository.findAllPublished())

    private fun emptyPage(page: Int, size: Int) =
        BlogPage<BlogPostSummary>(emptyList(), page, size, 0, 0)

    companion object {
        const val MAX_PAGE_SIZE = 50
    }
}
