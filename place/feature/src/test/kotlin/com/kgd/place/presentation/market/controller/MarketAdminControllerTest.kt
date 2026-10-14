package com.kgd.place.presentation.market.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.market.usecase.*
import com.kgd.place.domain.market.model.*
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.*
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

class MarketAdminControllerTest : BehaviorSpec({
    val edit = mockk<EditMarketUseCase>()
    val mvc = MockMvcBuilders.standaloneSetup(MarketAdminController(edit))
        .setControllerAdvice(MarketAdminExceptionHandler(), GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())).build()
    Given("trusted admin identity and ApiResponse contract") {
        Then("requires positive X-User-Id, forwards actor and wraps the paginated name search") {
            every { edit.list(MarketEditorActor(MarketActorKind.ADMIN, 7), "시장", 1, 5) } returns EditMarketUseCase.Page(emptyList(), 0, 1, 5)
            mvc.perform(get("/api/v1/admin/place/markets").header("X-User-Id", "7").param("name", "시장").param("page", "1").param("size", "5"))
                .andExpect(status().isOk).andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data.page").value(1))
            mvc.perform(get("/api/v1/admin/place/markets")).andExpect(status().isBadRequest)
            mvc.perform(get("/api/v1/admin/place/markets").header("X-User-Id", "0")).andExpect(status().isBadRequest)
        }
        Then("maps validation to 400 and stale revert to 409, preserving authenticated actor") {
            every { edit.override(any(), 1, 10, any()) } throws IllegalArgumentException("Unsupported override field")
            mvc.perform(put("/api/v1/admin/place/markets/1/stores/10/override").header("X-User-Id", "7")
                .contentType("application/json").content("""{"values":{"price":"100"},"reason":"확인"}"""))
                .andExpect(status().isBadRequest).andExpect(jsonPath("$.success").value(false))
            every { edit.revert(any(), 1, 5) } throws MarketEditConflict("Newer changes")
            mvc.perform(post("/api/v1/admin/place/markets/1/changes/5/revert").header("X-User-Id", "7"))
                .andExpect(status().isConflict)
            verify { edit.revert(MarketEditorActor(MarketActorKind.ADMIN, 7), 1, 5) }
        }
    }
})
