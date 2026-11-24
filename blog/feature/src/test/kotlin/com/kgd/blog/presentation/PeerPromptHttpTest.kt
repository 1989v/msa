package com.kgd.blog.presentation

import com.kgd.blog.application.post.port.BlogPostRepositoryPort
import com.kgd.blog.application.profile.port.BlogProfileRepositoryPort
import com.kgd.blog.application.profile.service.BlogProfileService
import com.kgd.blog.application.prompt.dto.PeerPromptDetail
import com.kgd.blog.application.prompt.dto.PeerPromptRecord
import com.kgd.blog.application.prompt.dto.PeerPromptSummary
import com.kgd.blog.application.prompt.port.PeerPromptRepositoryPort
import com.kgd.blog.application.prompt.service.PeerPromptService
import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.PeerPromptContent
import com.kgd.blog.domain.model.PeerReviewContent
import com.kgd.blog.presentation.controller.PeerPromptController
import com.kgd.common.exception.GlobalExceptionHandler
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.MediaType
import org.springframework.http.HttpHeaders
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.LocalDateTime

class PeerPromptHttpTest : BehaviorSpec({
    val repo = mockk<PeerPromptRepositoryPort>(relaxUnitFun = true)
    val profiles = mockk<BlogProfileRepositoryPort>()
    val service = PeerPromptService(repo, BlogProfileService(profiles, mockk<BlogPostRepositoryPort>()))
    val mapper = jacksonMapperBuilder().build()
    val mvc = MockMvcBuilders.standaloneSetup(PeerPromptController(service))
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(mapper)).build()
    val content = PeerPromptContent("SOFTWARE", "Code review", "Find defects", "Model A", "Review this code")
    val detail = PeerPromptDetail(PeerPromptSummary(7, "SOFTWARE", "Code review", "Find defects", "Alice",
        LocalDateTime.of(2026, 11, 25, 12, 0), 0, null, true), content, emptyList(), null)
    val review = PeerReviewContent("Software", "Engineer", 4, "Clear", "Needs verification", "Model A")
    every { profiles.findByMemberId(10) } returns BlogProfile.newReader(10, "Alice").copy(id = 2)
    Given("the real HTTP transport and application service") {
        Then("public detail has a stable id, literal prompt and null unrated average") {
            every { repo.detail(7, null) } returns detail
            val response = mvc.perform(get("/api/v1/blog/peer-prompts/7")).andReturn().response
            response.status shouldBe 200
            response.getHeader(HttpHeaders.CACHE_CONTROL) shouldBe "private, no-store"
            val body = mapper.readTree(response.contentAsString)["data"]
            body["summary"]["id"].asLong() shouldBe 7L
            body["summary"]["ranked"].asBoolean() shouldBe false
            body["summary"]["ratingAverage"].isNull shouldBe true
            body["content"]["promptText"].asString() shouldBe content.promptText
        }
        Then("viewer-specific list and detail responses forbid shared caching") {
            every { repo.list(null, 0, 20, 10) } returns listOf(detail.summary)
            every { repo.detail(7, 10) } returns detail
            listOf("/api/v1/blog/peer-prompts", "/api/v1/blog/peer-prompts/7").forEach { path ->
                val response = mvc.perform(get(path).header("X-User-Id", "10")).andReturn().response
                response.status shouldBe 200
                response.getHeader(HttpHeaders.CACHE_CONTROL) shouldBe "private, no-store"
            }
        }
        Then("anonymous create is unauthorized and signed-in readers can share without author approval") {
            val body = mapper.writeValueAsString(mapOf("content" to content, "displayName" to "Alice"))
            mvc.perform(post("/api/v1/blog/me/peer-prompts").contentType(MediaType.APPLICATION_JSON).content(body))
                .andReturn().response.status shouldBe 401
            every { repo.create(2, content) } returns 7
            every { repo.detail(7, 10) } returns detail
            mvc.perform(post("/api/v1/blog/me/peer-prompts").header("X-User-Id", "10")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().response.status shouldBe 200
        }
        Then("missing evidence and out-of-range ratings are 400 before persistence") {
            listOf(
                """{"content":{"reviewerDomain":"Software","reviewerRole":"Engineer","score":6,"worked":"Clear","limitations":"Limits","context":"A"},"displayName":"Alice"}""",
                """{"content":{"reviewerDomain":"Software","reviewerRole":"Engineer","score":4,"worked":"Clear","limitations":" ","context":"A"},"displayName":"Alice"}""",
                """{"content":{},"displayName":"Alice"}""",
            ).forEach { body ->
                mvc.perform(put("/api/v1/blog/me/peer-prompts/7/review").header("X-User-Id", "10")
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().response.status shouldBe 400
            }
            verify(exactly = 0) { repo.review(any(), any(), any()) }
        }
        Then("authors cannot rate themselves across the transport boundary") {
            every { repo.find(7, true) } returns PeerPromptRecord(7, 2, content, false)
            val body = mapper.writeValueAsString(mapOf("content" to review, "displayName" to "Alice"))
            mvc.perform(put("/api/v1/blog/me/peer-prompts/7/review").header("X-User-Id", "10")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().response.status shouldBe 403
        }
    }
})
