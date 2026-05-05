package com.kgd.codedictionary.presentation.concept.controller

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.codedictionary.application.concept.service.ConceptService
import com.kgd.codedictionary.application.graph.dto.CategoryStatsFilter
import com.kgd.codedictionary.application.graph.dto.TreemapCategoryDto
import com.kgd.codedictionary.application.graph.dto.TreemapConceptDto
import com.kgd.codedictionary.application.graph.dto.TreemapDataDto
import com.kgd.codedictionary.application.graph.dto.TreemapTotalsDto
import com.kgd.codedictionary.application.graph.service.GraphService
import com.kgd.common.exception.GlobalExceptionHandler
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.ints.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.springframework.http.MediaType
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

/**
 * ConceptController.getTreemapStats() 통합 테스트.
 *
 * - **Strategy**: `MockMvcBuilders.standaloneSetup` 사용 — Flyway/MySQL bootstrap 회피.
 *   (project convention: ProductApplicationTest 주석 — 운영 MySQL DataSource 와 Flyway 동시 부팅 회피)
 * - GraphService / ConceptService 는 MockK Mock 으로 주입.
 * - GlobalExceptionHandler 등록 → BusinessException → 400 변환 검증.
 * - ApiResponse 래퍼 + JSON shape + payload size sanity check 검증.
 */
class ConceptStatsControllerTest : BehaviorSpec({

    val graphService = mockk<GraphService>()
    val conceptService = mockk<ConceptService>(relaxed = true)
    val controller = ConceptController(conceptService, graphService)
    val objectMapper = ObjectMapper()

    val mockMvc: MockMvc = MockMvcBuilders.standaloneSetup(controller)
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(MappingJackson2HttpMessageConverter(objectMapper))
        .build()

    beforeEach { clearMocks(graphService, conceptService) }

    given("ConceptController GET /api/v1/concepts/stats/treemap") {
        `when`("필터 없이 호출하면") {
            then("200 + ApiResponse(success=true, data 에 categories+totals) shape 으로 응답한다") {
                val sample = TreemapDataDto(
                    categories = listOf(
                        TreemapCategoryDto(
                            name = "ARCHITECTURE",
                            totalConcepts = 1,
                            totalIndexCount = 5,
                            concepts = listOf(
                                TreemapConceptDto(
                                    conceptId = "clean-architecture",
                                    name = "Clean Architecture",
                                    level = "INTERMEDIATE",
                                    indexCount = 5,
                                ),
                            ),
                        ),
                    ),
                    totals = TreemapTotalsDto(
                        byLevel = mapOf("INTERMEDIATE" to 1),
                        byCategory = mapOf("ARCHITECTURE" to 1),
                        totalConcepts = 1,
                        totalIndexCount = 5,
                    ),
                )
                every { graphService.getCategoryStats(any()) } returns sample

                mockMvc.perform(get("/api/v1/concepts/stats/treemap"))
                    .andExpect(status().isOk)
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.categories[0].name").value("ARCHITECTURE"))
                    .andExpect(jsonPath("$.data.categories[0].totalIndexCount").value(5))
                    .andExpect(jsonPath("$.data.categories[0].concepts[0].conceptId").value("clean-architecture"))
                    .andExpect(jsonPath("$.data.totals.totalConcepts").value(1))
                    .andExpect(jsonPath("$.data.totals.totalIndexCount").value(5))
            }
        }

        `when`("?categories=ARCHITECTURE 로 호출하면") {
            then("uppercase 정규화된 set 이 GraphService 필터로 전달된다") {
                val captured = slot<CategoryStatsFilter>()
                every { graphService.getCategoryStats(capture(captured)) } returns TreemapDataDto(
                    categories = emptyList(),
                    totals = TreemapTotalsDto(emptyMap(), emptyMap(), 0, 0),
                )

                mockMvc.perform(get("/api/v1/concepts/stats/treemap").param("categories", "architecture"))
                    .andExpect(status().isOk)

                captured.captured.categories shouldBe setOf("ARCHITECTURE")
                captured.captured.includeZeroIndex shouldBe false
                verify(exactly = 1) { graphService.getCategoryStats(any()) }
            }
        }

        `when`("?includeZeroIndex=true 로 호출하면") {
            then("filter.includeZeroIndex = true 로 전달된다") {
                val captured = slot<CategoryStatsFilter>()
                every { graphService.getCategoryStats(capture(captured)) } returns TreemapDataDto(
                    categories = emptyList(),
                    totals = TreemapTotalsDto(emptyMap(), emptyMap(), 0, 0),
                )

                mockMvc.perform(get("/api/v1/concepts/stats/treemap").param("includeZeroIndex", "true"))
                    .andExpect(status().isOk)

                captured.captured.includeZeroIndex shouldBe true
            }
        }

        `when`("?categories=UNKNOWN_CATEGORY 인 경우") {
            then("400 Bad Request + ApiResponse.error 로 응답한다 (INVALID_INPUT)") {
                mockMvc.perform(get("/api/v1/concepts/stats/treemap").param("categories", "UNKNOWN_CATEGORY"))
                    .andExpect(status().isBadRequest)
                    .andExpect(jsonPath("$.success").value(false))
                    .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"))

                verify(exactly = 0) { graphService.getCategoryStats(any()) }
            }
        }

        `when`("정상 응답을 직렬화한 payload size 를 측정하면") {
            then("100KB 미만이어야 한다 (NFR2 sanity check, 작은 표본)") {
                val sample = TreemapDataDto(
                    categories = listOf(
                        TreemapCategoryDto(
                            name = "ARCHITECTURE",
                            totalConcepts = 2,
                            totalIndexCount = 7,
                            concepts = listOf(
                                TreemapConceptDto("clean-arch", "Clean Architecture", "INTERMEDIATE", 5),
                                TreemapConceptDto("hex-arch", "Hexagonal Architecture", "ADVANCED", 2),
                            ),
                        ),
                    ),
                    totals = TreemapTotalsDto(
                        byLevel = mapOf("INTERMEDIATE" to 1, "ADVANCED" to 1),
                        byCategory = mapOf("ARCHITECTURE" to 2),
                        totalConcepts = 2,
                        totalIndexCount = 7,
                    ),
                )
                every { graphService.getCategoryStats(any()) } returns sample

                val result = mockMvc.perform(get("/api/v1/concepts/stats/treemap"))
                    .andExpect(status().isOk)
                    .andReturn()

                val bytes = result.response.contentAsByteArray
                bytes.size shouldBeLessThan 100_000
            }
        }
    }
})
