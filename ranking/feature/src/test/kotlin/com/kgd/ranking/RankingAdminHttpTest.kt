package com.kgd.ranking

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.ranking.application.admin.dto.*
import com.kgd.ranking.application.admin.usecase.RankingAdminUseCase
import com.kgd.ranking.presentation.controller.RankingAdminController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class RankingAdminHttpTest : BehaviorSpec({
    val useCase = mockk<RankingAdminUseCase>()
    val mapper = jacksonMapperBuilder().build()
    val mvc = MockMvcBuilders.standaloneSetup(RankingAdminController(useCase)).setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(mapper)).build()
    val op = AdminOperation(UUID.randomUUID().toString(), "hash", 27, Instant.now(), 1, emptyList(), emptyMap(), emptyMap())
    val evidence = LocalDate.of(2026, 10, 20)
    val correction = CorrectionRequest(op.operationId, 0, 1, mapOf("sugarG" to FieldChange("SET", "1")), "대조", "https://official.example/menu", evidence)
    val writes = listOf(
        Triple(HttpMethod.PATCH, "cafe/drinks/key/corrections", correction),
        Triple(HttpMethod.POST, "cafe/group-corrections/preview", PreviewRequest(listOf("key"), "티", "대조", correction.evidenceUrl, evidence)),
        Triple(HttpMethod.POST, "cafe/group-corrections", ApplyPreviewRequest("preview", op.operationId)),
        Triple(HttpMethod.PATCH, "cafe/brands/a/verification", VerificationRequest(op.operationId, 0, listOf(correction.evidenceUrl), evidence, "메모", "대조")),
        Triple(HttpMethod.POST, "conflicts/id/resolve", ResolveRequest(op.operationId, "ADOPT_SOURCE", expectedRevision = 0, sourceGeneration = 1, reason = "대조", evidenceUrl = correction.evidenceUrl, evidenceCheckedAt = evidence)),
        Triple(HttpMethod.POST, "operations/id/revert", RevertRequest(op.operationId, emptyMap(), emptyMap(), "대조", correction.evidenceUrl, evidence)),
    )
    val reads = listOf("cafe/drinks", "cafe/drinks/key", "cafe/groups", "cafe/brands", "ingest-runs", "ingest-runs/id", "conflicts", "audit-events", "operations/id", "operations/id/revert-preview", "gas/boards", "gas/boards/1/snapshots", "gas/snapshots/1")
    fun status(method: HttpMethod, path: String, body: Any? = null, role: String? = null): Int {
        val req = request(method, "/api/v1/admin/ranking/$path").contentType(MediaType.APPLICATION_JSON)
        body?.let { req.content(mapper.writeValueAsString(it)) }
        role?.let { req.header("X-User-Id", "27").header("X-User-Roles", it) }
        return mvc.perform(req).andReturn().response.status
    }
    Given("actual controller HTTP mappings, body conversion and identity guard") {
        Then("every read and write is 401 without identity and 403 for USER/SELLER") {
            reads.forEach { path ->
                status(HttpMethod.GET, path) shouldBe 401
                listOf("ROLE_USER", "ROLE_SELLER").forEach { status(HttpMethod.GET, path, role = it) shouldBe 403 }
            }
            writes.forEach { (method, path, body) ->
                status(method, path, body) shouldBe 401
                listOf("ROLE_USER", "ROLE_SELLER").forEach { status(method, path, body, it) shouldBe 403 }
            }
            verify { useCase wasNot Called }
        }
        Then("admin reaches every mapped UseCase and server actor is forwarded") {
            every { useCase.read(any(), any()) } returns emptyMap<String, Any>()
            every { useCase.correct(any(), any(), 27) } returns op
            every { useCase.preview(any(), 27) } returns GroupPreview("p", 27, Instant.now(), writes[1].third as PreviewRequest, emptyMap(), emptyMap(), emptyList(), emptyList(), emptyList())
            every { useCase.apply(any(), 27) } returns op; every { useCase.verify(any(), any(), 27) } returns op
            every { useCase.resolve(any(), any(), 27) } returns op; every { useCase.revert(any(), any(), 27) } returns op
            reads.forEach { status(HttpMethod.GET, it, role = "ROLE_ADMIN") shouldBe 200 }
            writes.forEach { (method, path, body) -> status(method, path, body, "ROLE_ADMIN") shouldBe 200 }
            verify { useCase.correct("key", correction, 27) }
        }
        Then("field400 survives the transport boundary as structured field code without rejected body") {
            every { useCase.correct(any(), any(), 27) } throws AdminValidation("sugarG", "0 이상 값을 입력하세요")
            val response = mvc.perform(request(HttpMethod.PATCH, "/api/v1/admin/ranking/cafe/drinks/key/corrections")
                .header("X-User-Id", "27").header("X-User-Roles", "ROLE_ADMIN").contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(correction))).andReturn().response
            response.status shouldBe 400
            mapper.readTree(response.contentAsString).path("error").path("code").asText() shouldBe "INVALID_FIELD_sugarG"
        }
    }
})
