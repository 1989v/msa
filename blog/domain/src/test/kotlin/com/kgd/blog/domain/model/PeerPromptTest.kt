package com.kgd.blog.domain.model

import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class PeerPromptTest : BehaviorSpec({
    Given("public peer prompt content") {
        Then("legacy prompts have no tags and controlled tags are distinct with a maximum of three") {
            val content = PeerPromptContent("SOFTWARE", "Title", "Purpose", "Model", "Prompt")
            content.tags shouldBe emptyList()
            content.copy(tags = listOf("ANALYSIS", "REVIEW", "SUMMARY")).tags.size shouldBe 3
            shouldThrow<BusinessException> { content.copy(tags = listOf("ANALYSIS", "WRITING", "REVIEW", "SUMMARY")) }
            shouldThrow<BusinessException> { content.copy(tags = listOf("ANALYSIS", "ANALYSIS")) }
            shouldThrow<BusinessException> { content.copy(tags = listOf("invented")) }
        }
        Then("blank purpose and oversized prompt cannot be published") {
            shouldThrow<BusinessException> { PeerPromptContent("SOFTWARE", "Title", " ", "Model", "Prompt") }
            shouldThrow<BusinessException> { PeerPromptContent("SOFTWARE", "Title", "Purpose", "Model", "x".repeat(30001)) }
            shouldThrow<BusinessException> { PeerPromptContent("invented", "Title", "Purpose", "Model", "Prompt") }
        }
    }
    Given("a member's written review") {
        Then("all evidence fields and a 1 to 5 score are required") {
            shouldThrow<BusinessException> { PeerReviewContent("Software", "Engineer", 6, "Worked", "Limits", "Context") }
            shouldThrow<BusinessException> { PeerReviewContent("Software", "Engineer", 5, "Worked", " ", "Context") }
        }
        Then("authors cannot review their own prompt and low counts never qualify for ranking") {
            shouldThrow<BusinessException> { PeerPromptPolicy.requireReviewer(1, 1) }
            PeerPromptPolicy.ranked(0) shouldBe false
            PeerPromptPolicy.ranked(2) shouldBe false
            PeerPromptPolicy.ranked(3) shouldBe true
        }
    }
})
