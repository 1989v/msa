package com.kgd.blog

import com.kgd.blog.application.dto.BlogCommentRequest
import com.kgd.blog.application.dto.BlogIdentity
import com.kgd.blog.application.service.BlogCommentService
import com.kgd.blog.application.service.BlogProfileService
import com.kgd.blog.application.service.BlogQueryService
import com.kgd.blog.application.service.BlogReactionService
import com.kgd.blog.application.service.BlogViewService
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.blog.domain.model.VoterType
import com.kgd.blog.infrastructure.persistence.entity.BlogPostJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostLikeJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogPostRatingJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogProfileJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogCommentJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostLikeJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostRatingJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogPostViewJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogProfileJpaRepository
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Optional

class BlogInteractionServiceTest : BehaviorSpec({

    fun post(id: Long = 1L) = BlogPostJpaEntity(
        id = id, authorProfileId = 1, slug = "post-$id", categoryId = 1,
        title = "제목", body = "본문", status = PostStatus.PUBLISHED, publishedAt = LocalDateTime.now(),
    )

    val visitor = BlogIdentity(memberId = null, isAdmin = false, visitorId = "visitor-1")

    given("좋아요를 누를 때") {
        val postRepository = mockk<BlogPostJpaRepository>(relaxed = true)
        val likeRepository = mockk<BlogPostLikeJpaRepository>(relaxed = true)
        val ratingRepository = mockk<BlogPostRatingJpaRepository>(relaxed = true)
        val queryService = mockk<BlogQueryService>()
        val service = BlogReactionService(postRepository, likeRepository, ratingRepository, queryService)

        every { queryService.publishedOrThrow("post-1") } returns post()
        every { postRepository.findById(1L) } returns Optional.of(post())
        every { ratingRepository.findByPostIdAndVoterTypeAndVoterKey(1L, any(), any()) } returns null
        // relaxed mock 의 save 는 Object 를 돌려줘 반환 타입 캐스팅에서 깨진다
        every { likeRepository.save(any()) } answers { firstArg() }

        `when`("처음이면") {
            every { likeRepository.findByPostIdAndVoterTypeAndVoterKey(1L, VoterType.VISITOR, "visitor-1") } returns null

            then("표를 만들고 카운터를 올린다") {
                service.toggleLike("post-1", visitor).liked shouldBe true
                verify { postRepository.addLikeCount(1L, 1) }
            }
        }

        `when`("이미 눌렀으면") {
            val existing = BlogPostLikeJpaEntity(1L, visitor.voterKey())
            every { likeRepository.findByPostIdAndVoterTypeAndVoterKey(1L, VoterType.VISITOR, "visitor-1") } returns existing

            then("표를 지우고 카운터를 내린다 — 토글이라 두 번 눌러도 2표가 되지 않는다") {
                service.toggleLike("post-1", visitor).liked shouldBe false
                verify { likeRepository.delete(existing) }
                verify { postRepository.addLikeCount(1L, -1) }
            }
        }
    }

    given("평점을 다시 매길 때") {
        val postRepository = mockk<BlogPostJpaRepository>(relaxed = true)
        val likeRepository = mockk<BlogPostLikeJpaRepository>(relaxed = true)
        val ratingRepository = mockk<BlogPostRatingJpaRepository>(relaxed = true)
        val queryService = mockk<BlogQueryService>()
        val service = BlogReactionService(postRepository, likeRepository, ratingRepository, queryService)

        val existing = BlogPostRatingJpaEntity(1L, visitor.voterKey(), 2)
        every { queryService.publishedOrThrow("post-1") } returns post()
        every { postRepository.findById(1L) } returns Optional.of(post())
        every { likeRepository.findByPostIdAndVoterTypeAndVoterKey(1L, any(), any()) } returns null
        every { ratingRepository.findByPostIdAndVoterTypeAndVoterKey(1L, VoterType.VISITOR, "visitor-1") } returns existing

        then("기존 표를 고친다 — 새 행을 만들면 1인 1표가 깨진다") {
            service.rate("post-1", visitor, 5)
            existing.score shouldBe 5
            verify { postRepository.addRating(1L, 3, 0) }
            verify(exactly = 0) { ratingRepository.save(any()) }
        }

        then("범위를 벗어난 점수는 거부한다") {
            shouldThrow<BusinessException> { service.rate("post-1", visitor, 6) }
        }
    }

    given("조회수를 셀 때") {
        val viewRepository = mockk<BlogPostViewJpaRepository>(relaxed = true)
        val postRepository = mockk<BlogPostJpaRepository>(relaxed = true)
        val service = BlogViewService(viewRepository, postRepository)

        // 같은 given 안의 mock 을 공유하므로 케이스마다 방문자 키를 달리해 호출을 구분한다
        every { viewRepository.insertIfAbsent(1L, any(), any<LocalDate>()) } returns 0

        `when`("같은 방문자가 같은 날 다시 보면") {
            then("카운터가 오르지 않는다") {
                service.record(1L, "repeat-visitor", "Mozilla/5.0")
                verify(exactly = 0) { postRepository.increaseViewCount(any()) }
            }
        }

        `when`("봇이면") {
            then("아예 세지 않는다 — 봇을 세면 조회수가 사람이 읽은 횟수가 아니게 된다") {
                service.record(1L, "bot-visitor", "Googlebot/2.1")
                verify(exactly = 0) { viewRepository.insertIfAbsent(1L, "bot-visitor", any<LocalDate>()) }
            }
        }

        `when`("집계가 실패하면") {
            every { viewRepository.insertIfAbsent(1L, "boom-visitor", any<LocalDate>()) } throws RuntimeException("db down")

            then("예외를 삼킨다 — 통계가 글을 죽이면 안 된다") {
                service.record(1L, "boom-visitor", "Mozilla/5.0")
            }
        }
    }

    given("정지된 계정이 댓글을 달려 할 때") {
        val commentRepository = mockk<BlogCommentJpaRepository>(relaxed = true)
        val postRepository = mockk<BlogPostJpaRepository>(relaxed = true)
        val profileRepository = mockk<BlogProfileJpaRepository>(relaxed = true)
        val queryService = mockk<BlogQueryService>()
        val profileService = BlogProfileService(profileRepository, postRepository)
        val service = BlogCommentService(commentRepository, postRepository, profileService, queryService)

        every { queryService.publishedOrThrow("post-1") } returns post()
        every { profileRepository.findByMemberId(7L) } returns BlogProfileJpaEntity(
            id = 3, memberId = 7, handle = null, displayName = "독자",
            role = ProfileRole.READER, status = ProfileStatus.SUSPENDED,
        )

        then("막는다 — 글만 막고 댓글을 열어 두면 정지 처분이 무력해진다") {
            shouldThrow<BusinessException> {
                service.create(
                    BlogCommentRequest(postSlug = "post-1", parentId = null, body = "안녕", displayName = null),
                    BlogIdentity(memberId = 7L, isAdmin = false, visitorId = null),
                )
            }
            verify(exactly = 0) { commentRepository.save(any()) }
        }
    }

    given("댓글을 지울 때") {
        val commentRepository = mockk<BlogCommentJpaRepository>(relaxed = true)
        val postRepository = mockk<BlogPostJpaRepository>(relaxed = true)
        val profileRepository = mockk<BlogProfileJpaRepository>(relaxed = true)
        val queryService = mockk<BlogQueryService>()
        val profileService = BlogProfileService(profileRepository, postRepository)
        val service = BlogCommentService(commentRepository, postRepository, profileService, queryService)

        val comment = com.kgd.blog.infrastructure.persistence.entity.BlogCommentJpaEntity(
            id = 5, postId = 1, profileId = 3, parentId = null, body = "안녕",
        )
        every { commentRepository.findById(5L) } returns Optional.of(comment)
        every { profileRepository.findByMemberId(7L) } returns BlogProfileJpaEntity(
            id = 3, memberId = 7, handle = null, displayName = "독자",
        )
        every { postRepository.findById(1L) } returns Optional.of(post())
        every { queryService.comments(any(), any()) } returns emptyList()

        then("행은 남기고 본문만 비운다 — 지우면 대댓글이 부모를 잃는다") {
            service.delete(5L, BlogIdentity(memberId = 7L, isAdmin = false, visitorId = null))
            comment.status shouldBe CommentStatus.DELETED
            verify(exactly = 0) { commentRepository.delete(any()) }
            verify { postRepository.addCommentCount(1L, -1) }
        }
    }
})
