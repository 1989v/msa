package com.kgd.search.presentation

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.search.application.unified.usecase.*
import com.kgd.search.presentation.search.controller.UnifiedSearchController
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

class UnifiedLauncherControllerTest : BehaviorSpec({
    val full = mockk<SearchUnifiedUseCase>()
    val suggest = mockk<SuggestUnifiedUseCase>()
    val mvc = MockMvcBuilders.standaloneSetup(UnifiedSearchController(full, suggest)).setControllerAdvice(GlobalExceptionHandler()).build()
    given("compatible unified HTTP routes") {
        then("new suggest has flat destination envelope") {
            every { suggest.execute("garden", null, 8) } returns SuggestUnifiedUseCase.Result(listOf(SuggestUnifiedUseCase.Hit("game:1", "game", "Garden", "Play", "garden")), 1, size = 8)
            mvc.perform(get("/api/search/unified/suggest").param("q", "garden")).andExpect(status().isOk).andExpect(jsonPath("$.data.hits[0].sourceId").value("garden"))
        }
        then("grouped full contract survives and appended page reaches usecase") {
            every { full.execute(match { it.page == 2 && it.q == "garden" }) } returns SearchUnifiedUseCase.Result("garden", SearchUnifiedUseCase.Understood(null, null), emptyList())
            mvc.perform(get("/api/search/unified").param("q", "garden").param("page", "2")).andExpect(status().isOk).andExpect(jsonPath("$.data.groups").isArray)
        }
        then("bad input is 400; failed suggest is 503 not a zero-result200") {
            every { suggest.execute(" ", null, 8) } throws IllegalArgumentException("blank")
            mvc.perform(get("/api/search/unified/suggest").param("q", " ")).andExpect(status().isBadRequest).andExpect(jsonPath("$.success").value(false))
            every { suggest.execute("garden", null, 8) } throws IllegalStateException("engine down")
            mvc.perform(get("/api/search/unified/suggest").param("q", "garden")).andExpect(status().isServiceUnavailable).andExpect(jsonPath("$.success").value(false))
        }
    }
})
