package com.kgd.blog.application.post.service

import com.kgd.blog.application.category.port.BlogCategoryRepositoryPort
import com.kgd.blog.application.comment.port.BlogCommentRepositoryPort
import com.kgd.blog.application.interaction.port.BlogReactionRepositoryPort
import com.kgd.blog.application.post.dto.BlogPostSummary
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.usecase.ChangeBlogPostStatusUseCase
import com.kgd.blog.application.post.usecase.CreateBlogPostUseCase
import com.kgd.blog.application.post.usecase.DeleteBlogPostUseCase
import com.kgd.blog.application.post.usecase.UpdateBlogPostUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.domain.model.BlogCategory
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.PostStatus
import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.util.UUID

/**
 * 글 쓰기의 단일 경로 (ADR-0072 §7).
 *
 * 어드민 콘솔과 blog 호스트의 작성자 스튜디오가 **같은 서비스를 부른다.** 두 벌로 나누면
 * 슬러그 규칙·상태 전이·소유권 판정이 갈리고, 한쪽만 고치는 순간 다른 쪽이 조용히 틀린다.
 * 권한 차이는 [BlogIdentity.isAdmin] 한 값으로만 표현된다.
 */
@Service
@Transactional
class BlogPostWriteService(
    private val postRepository: BlogPostRepositoryPort,
    private val categoryRepository: BlogCategoryRepositoryPort,
    private val profileRepository: BlogProfileRepositoryPort,
    private val commentRepository: BlogCommentRepositoryPort,
    private val reactionRepository: BlogReactionRepositoryPort,
    private val profileService: BlogProfileService,
    private val assembler: BlogAssembler,
) : CreateBlogPostUseCase, UpdateBlogPostUseCase, ChangeBlogPostStatusUseCase, DeleteBlogPostUseCase {

    override fun execute(command: CreateBlogPostUseCase.Command): BlogPostSummary {
        val (request, identity) = command
        val author = profileService.requireWritableProfile(identity)
        val category = categoryOrThrow(request.categoryId)
        val slug = uniqueSlug(request.slug, request.title)

        // 도메인이 제목·본문·요약 규칙을 판정한다. 여기서 통과하지 못한 값은 저장되지 않는다
        val domain = BlogPost(
            id = null,
            authorProfileId = author.id ?: 0,
            categoryId = category.id ?: 0,
            slug = slug,
            title = request.title.trim(),
            summary = request.summary?.trim()?.takeIf { it.isNotEmpty() },
            body = request.body,
            coverImageUrl = request.coverImageUrl?.trim()?.takeIf { it.isNotEmpty() },
            status = PostStatus.DRAFT,
            publishedAt = null,
        )
        return assembler.summary(postRepository.save(domain), author, category)
    }

    override fun execute(command: UpdateBlogPostUseCase.Command): BlogPostSummary {
        val (postId, request, identity) = command
        val post = editableOrThrow(postId, identity)
        val category = categoryOrThrow(request.categoryId)
        // 슬러그는 바꾸지 않는다 — 발행 뒤 주소가 바뀌면 공유된 링크와 색인이 죽는다
        val updated = postRepository.save(
            post.copy(
                categoryId = category.id ?: 0,
                title = request.title.trim(),
                summary = request.summary?.trim()?.takeIf { it.isNotEmpty() },
                body = request.body,
                coverImageUrl = request.coverImageUrl?.trim()?.takeIf { it.isNotEmpty() },
            ),
        )
        return assembler.summary(updated, profileRepository.findById(updated.authorProfileId), category)
    }

    override fun execute(command: ChangeBlogPostStatusUseCase.Command): BlogPostSummary {
        val (postId, next, identity) = command
        val post = editableOrThrow(postId, identity)
        val changed = postRepository.save(post.transitionTo(next, LocalDateTime.now()))
        return assembler.summary(
            changed,
            profileRepository.findById(changed.authorProfileId),
            categoryRepository.findById(changed.categoryId),
        )
    }

    /**
     * 삭제. 자식 레코드를 먼저 지운다 — FK 제약을 걸지 않았으므로(폴드된 스키마에서
     * 서비스 간 참조를 만들지 않는다는 원칙) 남은 좋아요·댓글은 고아가 된다.
     */
    override fun execute(command: DeleteBlogPostUseCase.Command) {
        val (postId, identity) = command
        editableOrThrow(postId, identity)
        commentRepository.deleteByPostId(postId)
        reactionRepository.deleteByPostId(postId)
        postRepository.deleteById(postId)
    }

    fun editableOrThrow(postId: Long, identity: BlogIdentity): BlogPost {
        val post = postRepository.findById(postId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "글을 찾을 수 없습니다")
        val profile = profileService.find(identity)
        // 정지된 계정은 어드민이 아닌 한 자기 글도 손대지 못한다
        if (!identity.isAdmin) profile?.requireCanWrite()
        post.requireEditableBy(profile?.id, identity.isAdmin)
        return post
    }

    private fun categoryOrThrow(categoryId: Long): BlogCategory =
        categoryRepository.findById(categoryId)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $categoryId")

    /**
     * 슬러그 확정. 도메인이 정한 값이 이미 쓰이고 있으면 뒤에 짧은 시드를 붙인다 —
     * 저장 시점 유니크 위반으로 500 을 내는 대신 여기서 접는다.
     */
    private fun uniqueSlug(requested: String?, title: String): String {
        val now = LocalDateTime.now()
        val base = BlogPost.resolveSlug(requested, title, now, randomSeed())
        if (!postRepository.existsBySlug(base)) return base
        if (requested != null) {
            throw BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 사용 중인 슬러그입니다: $base")
        }
        repeat(MAX_SLUG_ATTEMPTS) {
            val candidate = BlogPost.resolveSlug(null, "", now, randomSeed())
            if (!postRepository.existsBySlug(candidate)) return candidate
        }
        throw BusinessException(ErrorCode.INTERNAL_ERROR, "슬러그를 생성하지 못했습니다")
    }

    private fun randomSeed(): String = UUID.randomUUID().toString().replace("-", "").take(8)

    private companion object {
        const val MAX_SLUG_ATTEMPTS = 5
    }
}
