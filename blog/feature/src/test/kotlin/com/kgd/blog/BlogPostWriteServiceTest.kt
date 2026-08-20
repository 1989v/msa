package com.kgd.blog

import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.service.BlogAssembler
import com.kgd.blog.application.service.BlogPostWriteService
import com.kgd.blog.application.service.BlogProfileService
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogProfileJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCategoryJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogCommentJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostLikeJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostRatingJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.util.Optional

/**
 * 요구의 핵심 — "작성 권한이 있는 사람만 쓰고, 자기 글만 수정한다"를 고정한다.
 */
class BlogPostWriteServiceTest : BehaviorSpec({

    fun profile(id: Long, role: ProfileRole = ProfileRole.AUTHOR, status: ProfileStatus = ProfileStatus.ACTIVE) =
        BlogProfileJpaEntity(
            id = id, memberId = id * 10, handle = "author$id", displayName = "저자$id",
            role = role, status = status,
        )

    fun post(id: Long, authorProfileId: Long) = BlogPostJpaEntity(
        id = id, authorProfileId = authorProfileId, slug = "post-$id", categoryId = 1,
        title = "제목", body = "본문", status = PostStatus.PUBLISHED,
        publishedAt = java.time.LocalDateTime.now(),
    )

    fun fixture(): Triple<BlogPostWriteService, BlogPostJpaRepository, BlogProfileJpaRepository> {
        val postRepository = mockk<BlogPostJpaRepository>(relaxed = true)
        val categoryRepository = mockk<BlogCategoryJpaRepository>(relaxed = true)
        val profileRepository = mockk<BlogProfileJpaRepository>(relaxed = true)
        val commentRepository = mockk<BlogCommentJpaRepository>(relaxed = true)
        val likeRepository = mockk<BlogPostLikeJpaRepository>(relaxed = true)
        val ratingRepository = mockk<BlogPostRatingJpaRepository>(relaxed = true)
        val profileService = BlogProfileService(profileRepository, postRepository)
        val assembler = BlogAssembler(profileRepository, categoryRepository)
        val service = BlogPostWriteService(
            postRepository, categoryRepository, profileRepository, commentRepository,
            likeRepository, ratingRepository, profileService, assembler,
        )
        return Triple(service, postRepository, profileRepository)
    }

    given("남의 글을 수정하려 할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns Optional.of(post(1, authorProfileId = 100))
        every { profileRepository.findByMemberId(20L) } returns profile(2)

        then("403 으로 막는다") {
            shouldThrow<BusinessException> {
                service.editableOrThrow(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null))
            }
        }

        then("삭제도 막는다 — 조회 경로만 막으면 우회로가 남는다") {
            shouldThrow<BusinessException> {
                service.delete(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null))
            }
            verify(exactly = 0) { postRepository.delete(any()) }
        }
    }

    given("자기 글을 수정할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns Optional.of(post(1, authorProfileId = 2))
        every { profileRepository.findByMemberId(20L) } returns profile(2)

        then("통과한다") {
            val found = service.editableOrThrow(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null))
            found.id shouldBe 1L
        }
    }

    given("승인 대기 중인 저자가 자기 글을 수정하려 할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns Optional.of(post(1, authorProfileId = 2))
        every { profileRepository.findByMemberId(20L) } returns
            profile(2, status = ProfileStatus.PENDING)

        then("막는다 — 소유권이 있어도 권한이 없으면 못 쓴다") {
            shouldThrow<BusinessException> {
                service.editableOrThrow(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null))
            }
        }
    }

    given("어드민이 남의 글을 수정할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns Optional.of(post(1, authorProfileId = 100))
        every { profileRepository.findByMemberId(1L) } returns profile(9)

        then("통과한다") {
            service.editableOrThrow(1L, BlogIdentity(memberId = 1L, isAdmin = true, visitorId = null)).id shouldBe 1L
        }
    }

    given("권한 없는 회원이 글을 쓰려 할 때") {
        val (service, _, profileRepository) = fixture()
        every { profileRepository.findByMemberId(30L) } returns profile(3, role = ProfileRole.READER)

        then("403 으로 막는다") {
            shouldThrow<BusinessException> {
                service.create(
                    com.kgd.blog.application.dto.BlogPostRequest(
                        title = "제목", slug = null, categoryId = 1,
                        summary = null, body = "본문", coverImageUrl = null,
                    ),
                    BlogIdentity(memberId = 30L, isAdmin = false, visitorId = null),
                )
            }
        }
    }
})
