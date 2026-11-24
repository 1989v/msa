package com.kgd.blog

import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.application.prompt.dto.*
import com.kgd.blog.application.prompt.port.PeerPromptRepositoryPort
import com.kgd.blog.application.prompt.service.PeerPromptService
import com.kgd.blog.domain.model.*
import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*

class PeerPromptServiceTest : BehaviorSpec({
    val content = PeerPromptContent("SOFTWARE", "Title", "Purpose", "Model", "Prompt")
    val review = PeerReviewRequest(PeerReviewContent("Software", "Engineer", 4, "Worked", "Limits", "Context"), "Alice")
    val identity = BlogIdentity(10, false, null)
    fun profile(id: Long = 1) = BlogProfile.newReader(10, "Alice").copy(id = id)

    Given("a public review submission") {
        Then("an author cannot add a self rating") {
            val repo = mockk<PeerPromptRepositoryPort>()
            val profiles = mockk<BlogProfileService>()
            every { profiles.requireInteractiveProfile(identity, "Alice") } returns profile()
            every { repo.find(7, true) } returns PeerPromptRecord(7, 1, content, false)
            shouldThrow<BusinessException> { PeerPromptService(repo, profiles).review(7, review, identity) }
            verify(exactly = 0) { repo.review(any(), any(), any()) }
        }
        Then("a different member writes one review under the prompt row lock") {
            val repo = mockk<PeerPromptRepositoryPort>(relaxUnitFun = true)
            val profiles = mockk<BlogProfileService>()
            val detail = mockk<PeerPromptDetail>()
            every { profiles.requireInteractiveProfile(identity, "Alice") } returns profile(2)
            every { repo.find(7, true) } returns PeerPromptRecord(7, 1, content, false)
            every { repo.detail(7, 10) } returns detail
            PeerPromptService(repo, profiles).review(7, review, identity) shouldBe detail
            verifyOrder { repo.find(7, true); repo.review(7, 2, review.content); repo.detail(7, 10) }
        }
        Then("removed prompts and anonymous or suspended identities cannot receive reviews") {
            val repo = mockk<PeerPromptRepositoryPort>()
            val profiles = mockk<BlogProfileService>()
            every { profiles.requireInteractiveProfile(identity, "Alice") } throws BusinessException(com.kgd.common.exception.ErrorCode.FORBIDDEN, "restricted")
            shouldThrow<BusinessException> { PeerPromptService(repo, profiles).review(7, review, identity) }
            verify(exactly = 0) { repo.review(any(), any(), any()) }
            every { profiles.requireInteractiveProfile(identity, "Alice") } returns profile(2)
            every { repo.find(7, true) } returns PeerPromptRecord(7, 1, content, true)
            shouldThrow<BusinessException> { PeerPromptService(repo, profiles).review(7, review, identity) }
        }
    }
    Given("content removal") {
        Then("anonymous and suspended members cannot publish") {
            val profileRepo = mockk<com.kgd.blog.application.profile.port.BlogProfileRepositoryPort>()
            val profiles = BlogProfileService(profileRepo, mockk())
            val repo = mockk<PeerPromptRepositoryPort>()
            val service = PeerPromptService(repo, profiles)
            shouldThrow<BusinessException> {
                service.create(PeerPromptRequest(content, "Alice"), BlogIdentity(null, false, null))
            }
            every { profileRepo.findByMemberId(10) } returns profile().withStatus(ProfileStatus.SUSPENDED)
            shouldThrow<BusinessException> { service.create(PeerPromptRequest(content, "Alice"), identity) }
            verify(exactly = 0) { repo.create(any(), any()) }
        }
        Then("another member cannot delete the prompt or someone else's review") {
            val repo = mockk<PeerPromptRepositoryPort>(relaxUnitFun = true)
            val profiles = mockk<BlogProfileService>()
            every { profiles.requireMemberId(identity) } returns 10
            every { profiles.find(identity) } returns profile(2)
            every { repo.find(7, true) } returns PeerPromptRecord(7, 1, content, false)
            every { repo.reviewOwner(7, 9) } returns 3
            val service = PeerPromptService(repo, profiles)
            shouldThrow<BusinessException> { service.remove(7, identity) }
            shouldThrow<BusinessException> { service.removeReview(7, 9, identity) }
            verify(exactly = 0) { repo.remove(any()); repo.removeReview(any(), any()) }
        }
        Then("an administrator can remove a reported prompt and review") {
            val admin = identity.copy(isAdmin = true)
            val repo = mockk<PeerPromptRepositoryPort>(relaxUnitFun = true)
            val profiles = mockk<BlogProfileService>()
            every { profiles.requireMemberId(admin) } returns 10
            every { profiles.find(admin) } returns null
            every { repo.find(7, true) } returns PeerPromptRecord(7, 1, content, false)
            every { repo.reviewOwner(7, 9) } returns 3
            val service = PeerPromptService(repo, profiles)
            service.removeReview(7, 9, admin)
            service.remove(7, admin)
            verify { repo.removeReview(7, 9); repo.remove(7) }
        }
    }
    Given("browse input") {
        Then("invalid domains and unbounded pagination are rejected") {
            val service = PeerPromptService(mockk(), mockk())
            shouldThrow<BusinessException> { service.list("invented", 0, identity) }
            shouldThrow<BusinessException> { service.list(null, -1, identity) }
            shouldThrow<BusinessException> { service.list(null, Int.MAX_VALUE, identity) }
        }
    }
})
