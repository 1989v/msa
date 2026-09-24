package com.kgd.blog

import com.kgd.blog.application.category.port.BlogCategoryRepositoryPort
import com.kgd.blog.application.comment.port.BlogCommentRepositoryPort
import com.kgd.blog.application.interaction.port.BlogReactionRepositoryPort
import com.kgd.blog.application.post.dto.BlogPostRequest
import com.kgd.blog.application.post.port.BlogPostConceptRepositoryPort
import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.post.service.BlogAssembler
import com.kgd.blog.application.post.service.BlogPostWriteService
import com.kgd.blog.application.post.usecase.CreateBlogPostUseCase
import com.kgd.blog.application.post.usecase.DeleteBlogPostUseCase
import com.kgd.blog.application.post.usecase.UpdateBlogPostUseCase
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.domain.model.BlogPost
import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.PostStatus
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDateTime

/**
 * 요구의 핵심 — "작성 권한이 있는 사람만 쓰고, 자기 글만 수정한다"를 고정한다.
 */
class BlogPostWriteServiceTest : BehaviorSpec({

    fun profile(id: Long, role: ProfileRole = ProfileRole.AUTHOR, status: ProfileStatus = ProfileStatus.ACTIVE) =
        BlogProfile(
            id = id, memberId = id * 10, handle = "author$id", displayName = "저자$id", bio = null, avatarUrl = null,
            role = role, status = status,
        )

    fun post(id: Long, authorProfileId: Long) = BlogPost(
        id = id, authorProfileId = authorProfileId, categoryId = 1, slug = "post-$id",
        title = "제목", summary = null, body = "본문", coverImageUrl = null,
        status = PostStatus.PUBLISHED, publishedAt = LocalDateTime.now(),
    )

    val conceptRepository = mockk<BlogPostConceptRepositoryPort>(relaxed = true)

    fun fixture(): Triple<BlogPostWriteService, BlogPostRepositoryPort, BlogProfileRepositoryPort> {
        val postRepository = mockk<BlogPostRepositoryPort>(relaxed = true)
        val categoryRepository = mockk<BlogCategoryRepositoryPort>(relaxed = true)
        val profileRepository = mockk<BlogProfileRepositoryPort>(relaxed = true)
        val commentRepository = mockk<BlogCommentRepositoryPort>(relaxed = true)
        val reactionRepository = mockk<BlogReactionRepositoryPort>(relaxed = true)
        val profileService = BlogProfileService(profileRepository, postRepository)
        val assembler = BlogAssembler(profileRepository, categoryRepository)
        val service = BlogPostWriteService(
            postRepository, categoryRepository, profileRepository, commentRepository, reactionRepository,
            profileService, assembler, conceptRepository,
        )
        return Triple(service, postRepository, profileRepository)
    }

    given("남의 글을 수정하려 할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns post(1, authorProfileId = 100)
        every { profileRepository.findByMemberId(20L) } returns profile(2)

        then("403 으로 막는다") {
            shouldThrow<BusinessException> {
                service.editableOrThrow(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null))
            }
        }

        then("삭제도 막는다 — 조회 경로만 막으면 우회로가 남는다") {
            shouldThrow<BusinessException> {
                service.execute(DeleteBlogPostUseCase.Command(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null)))
            }
            verify(exactly = 0) { postRepository.deleteById(any()) }
        }
    }

    given("자기 글을 수정할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns post(1, authorProfileId = 2)
        every { profileRepository.findByMemberId(20L) } returns profile(2)

        then("통과한다") {
            val found = service.editableOrThrow(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null))
            found.id shouldBe 1L
        }
    }

    given("승인 대기 중인 저자가 자기 글을 수정하려 할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns post(1, authorProfileId = 2)
        every { profileRepository.findByMemberId(20L) } returns profile(2, status = ProfileStatus.PENDING)

        then("막는다 — 소유권이 있어도 권한이 없으면 못 쓴다") {
            shouldThrow<BusinessException> {
                service.editableOrThrow(1L, BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null))
            }
        }
    }

    given("어드민이 남의 글을 수정할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns post(1, authorProfileId = 100)
        every { profileRepository.findByMemberId(1L) } returns profile(9)

        then("통과한다") {
            service.editableOrThrow(1L, BlogIdentity(memberId = 1L, isAdmin = true, visitorId = null)).id shouldBe 1L
        }
    }

    given("글에 개념을 매핑할 때") {
        val (service, postRepository, profileRepository) = fixture()
        every { postRepository.findById(1L) } returns post(1, authorProfileId = 2)
        every { profileRepository.findByMemberId(20L) } returns profile(2)
        val me = BlogIdentity(memberId = 20L, isAdmin = false, visitorId = null)
        fun request(conceptIds: List<String>?) = BlogPostRequest(
            title = "제목", slug = null, categoryId = 1, summary = null, body = "본문", coverImageUrl = null,
            conceptIds = conceptIds,
        )

        then("수정은 매핑을 고른 순서대로 통째로 바꾸고 중복·공백은 접는다") {
            service.execute(UpdateBlogPostUseCase.Command(1L, request(listOf(" bm25 ", "inverted-index", "bm25")), me))
            verify { conceptRepository.replace(1L, listOf("bm25", "inverted-index")) }
        }

        then("conceptIds 가 null 이면 기존 매핑을 건드리지 않는다") {
            io.mockk.clearMocks(conceptRepository)
            service.execute(UpdateBlogPostUseCase.Command(1L, request(null), me))
            verify(exactly = 0) { conceptRepository.replace(any(), any()) }
        }

        then("형식이 틀린 id 는 글을 저장하기 전에 거절한다") {
            // 앞 then 들이 남긴 호출 기록만 지운다 — 스텁은 남긴다
            io.mockk.clearMocks(conceptRepository, postRepository, answers = false)
            shouldThrow<BusinessException> {
                service.execute(UpdateBlogPostUseCase.Command(1L, request(listOf("BM25!")), me))
            }
            verify(exactly = 0) { postRepository.save(any()) }
            verify(exactly = 0) { conceptRepository.replace(any(), any()) }
        }

        then("글을 지우면 매핑도 지운다") {
            service.execute(DeleteBlogPostUseCase.Command(1L, me))
            verify { conceptRepository.deleteByPostId(1L) }
        }
    }

    given("권한 없는 회원이 글을 쓰려 할 때") {
        val (service, _, profileRepository) = fixture()
        every { profileRepository.findByMemberId(30L) } returns profile(3, role = ProfileRole.READER)

        then("403 으로 막는다") {
            shouldThrow<BusinessException> {
                service.execute(
                    CreateBlogPostUseCase.Command(
                        BlogPostRequest(title = "제목", slug = null, categoryId = 1, summary = null, body = "본문", coverImageUrl = null),
                        BlogIdentity(memberId = 30L, isAdmin = false, visitorId = null),
                    ),
                )
            }
        }
    }
})
