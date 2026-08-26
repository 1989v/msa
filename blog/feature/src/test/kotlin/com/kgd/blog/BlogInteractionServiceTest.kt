package com.kgd.blog

import com.kgd.blog.application.comment.dto.BlogCommentRequest
import com.kgd.blog.application.comment.port.BlogCommentRepositoryPort
import com.kgd.blog.application.comment.service.BlogCommentService
import com.kgd.blog.application.comment.usecase.CreateBlogCommentUseCase
import com.kgd.blog.application.comment.usecase.DeleteBlogCommentUseCase
import com.kgd.blog.application.interaction.port.BlogPostViewRepositoryPort
import com.kgd.blog.application.interaction.port.BlogReactionRepositoryPort
import com.kgd.blog.application.interaction.service.BlogReactionService
import com.kgd.blog.application.interaction.service.BlogViewService
import com.kgd.blog.application.interaction.usecase.RateBlogPostUseCase
import com.kgd.blog.application.interaction.usecase.RecordBlogViewUseCase
import com.kgd.blog.application.interaction.usecase.ToggleBlogLikeUseCase
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.service.BlogQueryService
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.domain.model.BlogComment
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.CommentStatus
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.blog.domain.model.VoterKey
import com.kgd.blog.domain.model.VoterType
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDate
import java.time.LocalDateTime

class BlogInteractionServiceTest : BehaviorSpec({

    fun post(id: Long = 1L) = BlogPost(
        id = id, authorProfileId = 1, categoryId = 1, slug = "post-$id",
        title = "제목", summary = null, body = "본문", coverImageUrl = null,
        status = PostStatus.PUBLISHED, publishedAt = LocalDateTime.now(),
    )

    val visitor = BlogIdentity(memberId = null, isAdmin = false, visitorId = "visitor-1")
    val visitorKey = VoterKey(VoterType.VISITOR, "visitor-1")

    given("좋아요를 누를 때") {
        val postRepository = mockk<BlogPostRepositoryPort>(relaxUnitFun = true)
        val reactionRepository = mockk<BlogReactionRepositoryPort>(relaxUnitFun = true)
        val queryService = mockk<BlogQueryService>()
        val service = BlogReactionService(postRepository, reactionRepository, queryService)

        every { queryService.publishedOrThrow("post-1") } returns post()
        every { postRepository.findById(1L) } returns post()
        every { reactionRepository.findRating(1L, any()) } returns null

        `when`("처음이면") {
            every { reactionRepository.hasLike(1L, visitorKey) } returns false

            then("표를 만들고 카운터를 올린다") {
                service.execute(ToggleBlogLikeUseCase.Command("post-1", visitor)).liked shouldBe true
                verify { reactionRepository.addLike(1L, visitorKey) }
                verify { postRepository.addLikeCount(1L, 1) }
            }
        }

        `when`("이미 눌렀으면") {
            every { reactionRepository.hasLike(1L, visitorKey) } returns true

            then("표를 지우고 카운터를 내린다 — 토글이라 두 번 눌러도 2표가 되지 않는다") {
                service.execute(ToggleBlogLikeUseCase.Command("post-1", visitor)).liked shouldBe false
                verify { reactionRepository.removeLike(1L, visitorKey) }
                verify { postRepository.addLikeCount(1L, -1) }
            }
        }
    }

    given("평점을 다시 매길 때") {
        val postRepository = mockk<BlogPostRepositoryPort>(relaxUnitFun = true)
        val reactionRepository = mockk<BlogReactionRepositoryPort>(relaxUnitFun = true)
        val queryService = mockk<BlogQueryService>()
        val service = BlogReactionService(postRepository, reactionRepository, queryService)

        every { queryService.publishedOrThrow("post-1") } returns post()
        every { postRepository.findById(1L) } returns post()
        every { reactionRepository.hasLike(1L, any()) } returns false
        every { reactionRepository.findRating(1L, visitorKey) } returns 2

        then("기존 표를 고친다 — 새 행을 만들면 1인 1표가 깨진다") {
            service.execute(RateBlogPostUseCase.Command("post-1", visitor, 5))
            verify { reactionRepository.saveRating(1L, visitorKey, 5) }
            verify { postRepository.addRating(1L, 3, 0) }
        }

        then("범위를 벗어난 점수는 거부한다") {
            shouldThrow<BusinessException> { service.execute(RateBlogPostUseCase.Command("post-1", visitor, 6)) }
        }
    }

    given("조회수를 셀 때") {
        val viewRepository = mockk<BlogPostViewRepositoryPort>(relaxed = true)
        val postRepository = mockk<BlogPostRepositoryPort>(relaxUnitFun = true)
        val service = BlogViewService(viewRepository, postRepository)

        // 같은 given 안의 mock 을 공유하므로 케이스마다 방문자 키를 달리해 호출을 구분한다
        every { viewRepository.recordIfAbsent(1L, any(), any<LocalDate>()) } returns false

        `when`("같은 방문자가 같은 날 다시 보면") {
            then("카운터가 오르지 않는다") {
                service.execute(RecordBlogViewUseCase.Command(1L, "repeat-visitor", "Mozilla/5.0"))
                verify(exactly = 0) { postRepository.increaseViewCount(any()) }
            }
        }

        `when`("봇이면") {
            then("아예 세지 않는다 — 봇을 세면 조회수가 사람이 읽은 횟수가 아니게 된다") {
                service.execute(RecordBlogViewUseCase.Command(1L, "bot-visitor", "Googlebot/2.1"))
                verify(exactly = 0) { viewRepository.recordIfAbsent(1L, "bot-visitor", any<LocalDate>()) }
            }
        }

        `when`("집계가 실패하면") {
            every { viewRepository.recordIfAbsent(1L, "boom-visitor", any<LocalDate>()) } throws RuntimeException("db down")

            then("예외를 삼킨다 — 통계가 글을 죽이면 안 된다") {
                service.execute(RecordBlogViewUseCase.Command(1L, "boom-visitor", "Mozilla/5.0"))
            }
        }
    }

    given("정지된 계정이 댓글을 달려 할 때") {
        val commentRepository = mockk<BlogCommentRepositoryPort>(relaxed = true)
        val postRepository = mockk<BlogPostRepositoryPort>(relaxUnitFun = true)
        val profileRepository = mockk<BlogProfileRepositoryPort>(relaxed = true)
        val queryService = mockk<BlogQueryService>()
        val profileService = BlogProfileService(profileRepository, postRepository)
        val service = BlogCommentService(commentRepository, postRepository, profileService, queryService)

        every { queryService.publishedOrThrow("post-1") } returns post()
        every { profileRepository.findByMemberId(7L) } returns BlogProfile(
            id = 3, memberId = 7, handle = null, displayName = "독자", bio = null, avatarUrl = null,
            role = ProfileRole.READER, status = ProfileStatus.SUSPENDED,
        )

        then("막는다 — 글만 막고 댓글을 열어 두면 정지 처분이 무력해진다") {
            shouldThrow<BusinessException> {
                service.execute(
                    CreateBlogCommentUseCase.Command(
                        BlogCommentRequest(postSlug = "post-1", parentId = null, body = "안녕", displayName = null),
                        BlogIdentity(memberId = 7L, isAdmin = false, visitorId = null),
                    ),
                )
            }
            verify(exactly = 0) { commentRepository.save(any()) }
        }
    }

    given("댓글을 지울 때") {
        val commentRepository = mockk<BlogCommentRepositoryPort>(relaxed = true)
        val postRepository = mockk<BlogPostRepositoryPort>(relaxUnitFun = true)
        val profileRepository = mockk<BlogProfileRepositoryPort>(relaxed = true)
        val queryService = mockk<BlogQueryService>()
        val profileService = BlogProfileService(profileRepository, postRepository)
        val service = BlogCommentService(commentRepository, postRepository, profileService, queryService)

        val comment = BlogComment(id = 5, postId = 1, profileId = 3, parentId = null, body = "안녕", status = CommentStatus.VISIBLE)
        every { commentRepository.findById(5L) } returns comment
        every { profileRepository.findByMemberId(7L) } returns BlogProfile(
            id = 3, memberId = 7, handle = null, displayName = "독자", bio = null, avatarUrl = null,
            role = ProfileRole.READER, status = ProfileStatus.ACTIVE,
        )
        every { postRepository.findById(1L) } returns post()
        every { queryService.commentsOf(any(), any()) } returns emptyList()

        then("행은 남기고 본문만 비운다 — 지우면 대댓글이 부모를 잃는다") {
            val saved = slot<BlogComment>()
            every { commentRepository.save(capture(saved)) } answers { firstArg() }
            service.execute(DeleteBlogCommentUseCase.Command(5L, BlogIdentity(memberId = 7L, isAdmin = false, visitorId = null)))
            saved.captured.status shouldBe CommentStatus.DELETED
            saved.captured.body shouldBe BlogComment.DELETED_PLACEHOLDER
            verify { postRepository.addCommentCount(1L, -1) }
        }
    }
})
