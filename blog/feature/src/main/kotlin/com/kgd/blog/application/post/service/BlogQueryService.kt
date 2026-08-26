package com.kgd.blog.application.post.service

import com.kgd.blog.application.category.dto.BlogCategoryNode
import com.kgd.blog.application.category.port.BlogCategoryRepositoryPort
import com.kgd.blog.application.category.usecase.GetBlogCategoryTreeUseCase
import com.kgd.blog.application.comment.dto.BlogCommentNode
import com.kgd.blog.application.comment.port.BlogCommentRepositoryPort
import com.kgd.blog.application.comment.usecase.GetBlogCommentsUseCase
import com.kgd.blog.application.interaction.port.BlogReactionRepositoryPort
import com.kgd.blog.application.post.dto.BlogAuthorSpace
import com.kgd.blog.application.post.dto.BlogPage
import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.usecase.GetBlogAuthorSpaceUseCase
import com.kgd.blog.application.post.usecase.GetBlogPostUseCase
import com.kgd.blog.application.post.usecase.GetBlogPostsUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.domain.model.BlogComment
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.CategoryStatus
import com.kgd.blog.domain.model.Paged
import com.kgd.blog.domain.model.Paging
import com.kgd.blog.domain.model.PostStatus
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 공개 조회. 쓰기가 없으므로 전부 read-only — replica 로 라우팅된다(RoutingDataSource).
 */
@Service
@Transactional(readOnly = true)
class BlogQueryService(
    private val postRepository: BlogPostRepositoryPort,
    private val categoryRepository: BlogCategoryRepositoryPort,
    private val profileRepository: BlogProfileRepositoryPort,
    private val commentRepository: BlogCommentRepositoryPort,
    private val reactionRepository: BlogReactionRepositoryPort,
    private val assembler: BlogAssembler,
) : GetBlogCategoryTreeUseCase, GetBlogPostsUseCase, GetBlogPostUseCase, GetBlogAuthorSpaceUseCase, GetBlogCommentsUseCase {

    /** 목록·네비용 카테고리 트리. 숨김(HIDDEN)은 빠진다 */
    override fun execute(query: GetBlogCategoryTreeUseCase.Query): List<BlogCategoryNode> {
        val all = categoryRepository.findAllOrderByPath()
            .filter { query.includeHidden || it.status == CategoryStatus.OPEN }
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
                        orderNo = category.orderNo,
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
    override fun execute(query: GetBlogPostsUseCase.Query): BlogPage<BlogPostSummary> =
        BlogPage.of(posts(query.categoryPath, query.handle, Paging.of(query.page, query.size, MAX_PAGE_SIZE)))

    /** 공개 상세. 미발행 슬러그는 존재를 드러내지 않고 404 */
    override fun execute(query: GetBlogPostUseCase.Query): BlogPostDetail =
        detailOf(publishedOrThrow(query.slug), query.identity)

    override fun execute(query: GetBlogAuthorSpaceUseCase.Query): BlogAuthorSpace {
        val profile = profileRepository.findByHandle(query.handle)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "작성자를 찾을 수 없습니다: ${query.handle}")
        // 승인 전·정지된 저자의 공간은 존재를 드러내지 않는다
        if (!profile.hasPublicSpace()) {
            throw BusinessException(ErrorCode.NOT_FOUND, "작성자를 찾을 수 없습니다: ${query.handle}")
        }
        val posts = posts(categoryPath = null, handle = query.handle, paging = Paging.of(query.page, query.size, MAX_PAGE_SIZE))
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
    override fun execute(query: GetBlogCommentsUseCase.Query): List<BlogCommentNode> {
        val post = publishedOrThrow(query.slug)
        return commentsOf(post, query.identity)
    }

    /** 소유자·어드민 전용 미리보기 — 초안도 돌려준다 */
    fun preview(post: BlogPost, identity: BlogIdentity): BlogPostDetail = detailOf(post, identity)

    fun publishedOrThrow(slug: String): BlogPost {
        val post = postRepository.findBySlug(slug)
        if (post == null || post.status != PostStatus.PUBLISHED) {
            throw BusinessException(ErrorCode.NOT_FOUND, "글을 찾을 수 없습니다: $slug")
        }
        return post
    }

    fun commentsOf(post: BlogPost, identity: BlogIdentity): List<BlogCommentNode> {
        val all = commentRepository.findAllByPostId(post.id ?: 0)
        if (all.isEmpty()) return emptyList()
        val authors = profileRepository.findAllByIdIn(all.map { it.profileId }.toSet()).associateBy { it.id }
        val myProfileId = identity.memberId?.let { profileRepository.findByMemberId(it)?.id }
        val byParent = all.groupBy { it.parentId }

        fun node(comment: BlogComment): BlogCommentNode = BlogCommentNode(
            id = comment.id ?: 0,
            author = assembler.authorSummary(authors[comment.profileId]),
            body = comment.body,
            status = comment.status,
            mine = myProfileId != null && myProfileId == comment.profileId,
            createdAt = comment.createdAt,
            updatedAt = comment.updatedAt,
            replies = (byParent[comment.id] ?: emptyList()).map(::node),
        )

        return (byParent[null] ?: emptyList()).map(::node)
    }

    private fun posts(categoryPath: String?, handle: String?, paging: Paging): Paged<BlogPostSummary> {
        val categoryIds = categoryPath?.let { path ->
            categoryRepository.findSubtree(path).mapNotNull { it.id }.ifEmpty { return Paged.empty(paging) }
        }
        val authorId = handle?.let { profileRepository.findByHandle(it)?.id ?: return Paged.empty(paging) }
        val result = postRepository.findPublished(categoryIds, authorId, paging)
        return Paged(assembler.summaries(result.items), result.page, result.size, result.totalElements, result.totalPages)
    }

    private fun detailOf(post: BlogPost, identity: BlogIdentity): BlogPostDetail {
        val postId = post.id ?: 0
        val author = profileRepository.findById(post.authorProfileId)
        val category = categoryRepository.findById(post.categoryId)
        val voter = runCatching { identity.voterKey() }.getOrNull()
        return BlogPostDetail(
            post = assembler.summary(post, author, category),
            body = post.body,
            breadcrumb = assembler.breadcrumb(category),
            liked = voter != null && reactionRepository.hasLike(postId, voter),
            myScore = voter?.let { reactionRepository.findRating(postId, it) },
        )
    }

    companion object {
        const val MAX_PAGE_SIZE = 50
    }
}
