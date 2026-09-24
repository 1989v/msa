package com.kgd.codedictionary.presentation.concept.controller

import com.kgd.codedictionary.application.concept.usecase.ConceptCatalogUseCase
import com.kgd.codedictionary.application.graph.usecase.ConceptGraphUseCase
import com.kgd.codedictionary.domain.concept.exception.ManagedConceptException
import com.kgd.common.exception.GlobalExceptionHandler
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

/** 관리 개념 쓰기는 공통 처리기의 400 이 아니라 409 로 나간다 */
class ManagedConceptControllerTest : BehaviorSpec({

    val catalog = mockk<ConceptCatalogUseCase>()
    val graph = mockk<ConceptGraphUseCase>()
    val mockMvc = MockMvcBuilders.standaloneSetup(ConceptController(catalog, graph))
        .setControllerAdvice(ManagedConceptExceptionHandler(), GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()

    given("온톨로지 파일이 관리하는 개념") {
        every { catalog.update(7, any()) } throws ManagedConceptException("bm25", "search")
        every { catalog.delete(7) } throws ManagedConceptException("bm25", "search")

        `when`("PUT 하면") {
            then("409 CONFLICT") {
                mockMvc.perform(put("/api/v1/concepts/7").contentType(MediaType.APPLICATION_JSON).content("""{"name":"x"}"""))
                    .andExpect(status().isConflict)
                    .andExpect(jsonPath("$.success").value(false))
            }
        }
        `when`("DELETE 하면") {
            then("409 CONFLICT") {
                mockMvc.perform(delete("/api/v1/concepts/7")).andExpect(status().isConflict)
            }
        }
    }
})
