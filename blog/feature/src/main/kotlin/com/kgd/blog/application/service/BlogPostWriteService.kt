package com.kgd.blog.application.service

import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.dto.BlogPostRequest
import com.kgd.blog.application.dto.BlogPostSummary
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCategoryJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogCommentJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostLikeJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostRatingJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
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
    private val postRepository: BlogPostJpaRepository,
    private val categoryRepository: BlogCategoryJpaRepository,
    private val profileRepository: BlogProfileJpaRepository,
    private val commentRepository: BlogCommentJpaRepository,
    private val likeRepository: BlogPostLikeJpaRepository,
    private val ratingRepository: BlogPostRatingJpaRepository,
    private val profileService: BlogProfileService,
    private val assembler: BlogAssembler,
) {

    fun create(request: BlogPostRequest, identity: BlogIdentity): BlogPostSummary {
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
        val saved = postRepository.save(
            BlogPostJpaEntity(
                authorProfileId = domain.authorProfileId,
                slug = domain.slug,
                categoryId = domain.categoryId,
                title = domain.title,
                summary = domain.summary,
                body = domain.body,
                coverImageUrl = domain.coverImageUrl,
                status = PostStatus.DRAFT,
                readingMinutes = domain.readingMinutes,
            ),
        )
        return assembler.summary(saved, author, category)
    }

    fun update(postId: Long, request: BlogPostRequest, identity: BlogIdentity): BlogPostSummary {
        val post = editableOrThrow(postId, identity)
        val category = categoryOrThrow(request.categoryId)
        // 슬러그는 바꾸지 않는다 — 발행 뒤 주소가 바뀌면 공유된 링크와 색인이 죽는다
        val domain = post.toDomain().copy(
            categoryId = category.id ?: 0,
            title = request.title.trim(),
            summary = request.summary?.trim()?.takeIf { it.isNotEmpty() },
            body = request.body,
            coverImageUrl = request.coverImageUrl?.trim()?.takeIf { it.isNotEmpty() },
        )
        post.update(domain)
        return assembler.summary(post, profileRepository.findById(post.authorProfileId).orElse(null), category)
    }

    fun changeStatus(postId: Long, next: PostStatus, identity: BlogIdentity): BlogPostSummary {
        val post = editableOrThrow(postId, identity)
        post.toDomain().requireTransitionTo(next)
        post.changeStatus(next, LocalDateTime.now())
        return assembler.summary(
            post,
            profileRepository.findById(post.authorProfileId).orElse(null),
            categoryRepository.findById(post.categoryId).orElse(null),
        )
    }

    /**
     * 삭제. 자식 레코드를 먼저 지운다 — FK 제약을 걸지 않았으므로(폴드된 스키마에서
     * 서비스 간 참조를 만들지 않는다는 원칙) 남은 좋아요·댓글은 고아가 된다.
     */
    fun delete(postId: Long, identity: BlogIdentity) {
        val post = editableOrThrow(postId, identity)
        commentRepository.deleteByPostId(postId)
        likeRepository.deleteByPostId(postId)
        ratingRepository.deleteByPostId(postId)
        postRepository.delete(post)
    }

    fun editableOrThrow(postId: Long, identity: BlogIdentity): BlogPostJpaEntity {
        val post = postRepository.findById(postId).orElseThrow {
            BusinessException(ErrorCode.NOT_FOUND, "글을 찾을 수 없습니다")
        }
        val profile = profileService.find(identity)
        // 정지된 계정은 어드민이 아닌 한 자기 글도 손대지 못한다
        if (!identity.isAdmin) profile?.toDomain()?.requireCanWrite()
        post.toDomain().requireEditableBy(profile?.id, identity.isAdmin)
        return post
    }

    private fun categoryOrThrow(categoryId: Long) =
        categoryRepository.findById(categoryId).orElseThrow {
            BusinessException(ErrorCode.NOT_FOUND, "카테고리를 찾을 수 없습니다: $categoryId")
        }

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
