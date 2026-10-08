package com.kgd.place.presentation.attraction.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.attraction.usecase.FindContentUpdatedAttractionsUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.LocalDateTime

/** IndexNow 제출 잡(place-ingest)이 부르는 모양 그대로 — 쿼리 파라미터가 유스케이스에 닿고 `{items:[{id,lang}], nextAfterId}` 로 나가는지. */
class AttractionContentUpdatedInternalControllerTest : BehaviorSpec({
    val useCase = mockk<FindContentUpdatedAttractionsUseCase>()
    val mockMvc: MockMvc = MockMvcBuilders.standaloneSetup(AttractionContentUpdatedInternalController(useCase))
        .setControllerAdvice(GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
        .build()
    val path = "/internal/attractions/content-updated"

    beforeEach { clearMocks(useCase) }

    Given("수집기가 보낸 변경 목록 조회") {
        Then("ISO 시각·키셋 파라미터를 그대로 넘기고 id·lang 목록과 nextAfterId 를 낸다") {
            val query = FindContentUpdatedAttractionsUseCase.Query(
                since = LocalDateTime.of(2026, 10, 8, 7, 30),
                until = LocalDateTime.of(2026, 10, 9, 7, 30),
                afterId = 0L,
                size = 2,
            )
            every { useCase.find(query) } returns FindContentUpdatedAttractionsUseCase.Result(
                items = listOf(FindContentUpdatedAttractionsUseCase.Item(11L, "ko"), FindContentUpdatedAttractionsUseCase.Item(12L, "en")),
                nextAfterId = 12L,
            )

            mockMvc.perform(get(path).param("since", "2026-10-08T07:30:00").param("until", "2026-10-09T07:30:00").param("afterId", "0").param("size", "2"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.data.items[0].id").value(11))
                .andExpect(jsonPath("$.data.items[0].lang").value("ko"))
                .andExpect(jsonPath("$.data.items[1].lang").value("en"))
                .andExpect(jsonPath("$.data.nextAfterId").value(12))
        }

        Then("마지막 쪽이면 nextAfterId 가 null 로 나간다") {
            every { useCase.find(any()) } returns FindContentUpdatedAttractionsUseCase.Result(emptyList(), null)

            mockMvc.perform(get(path).param("since", "2026-10-08T07:30:00").param("until", "2026-10-09T07:30:00").param("afterId", "0").param("size", "1000"))
                .andExpect(status().isOk)
                .andExpect(jsonPath("$.data.items").isEmpty)
                .andExpect(jsonPath("$.data.nextAfterId").doesNotExist())
        }
    }

    Given("잘못된 요청") {
        Then("파라미터가 빠지면 400 이고 유스케이스를 부르지 않는다") {
            mockMvc.perform(get(path).param("since", "2026-10-08T07:30:00").param("afterId", "0").param("size", "10"))
                .andExpect(status().isBadRequest)
            verify(exactly = 0) { useCase.find(any()) }
        }

        Then("시각 형식이 틀리면 400 이다") {
            mockMvc.perform(get(path).param("since", "20261008").param("until", "2026-10-09T07:30:00").param("afterId", "0").param("size", "10"))
                .andExpect(status().isBadRequest)
            verify(exactly = 0) { useCase.find(any()) }
        }

        Then("숫자 자리에 숫자가 아니면 400 이다") {
            mockMvc.perform(get(path).param("since", "2026-10-08T07:30:00").param("until", "2026-10-09T07:30:00").param("afterId", "x").param("size", "10"))
                .andExpect(status().isBadRequest)
            verify(exactly = 0) { useCase.find(any()) }
        }
    }
})
