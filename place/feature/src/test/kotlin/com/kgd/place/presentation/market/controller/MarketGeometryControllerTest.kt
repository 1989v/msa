package com.kgd.place.presentation.market.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.place.application.market.usecase.MarketGeometryUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.*
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

class MarketGeometryControllerTest : BehaviorSpec({
    val service=mockk<MarketGeometryUseCase>()
    val mvc=MockMvcBuilders.standaloneSetup(MarketGeometryController(service))
        .setControllerAdvice(MarketAdminExceptionHandler(),GlobalExceptionHandler())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())).build()
    Given("geometry edits require a nonblank reason") {
        Then("missing reason is rejected in the HTTP binding and blank reason in validation") {
            every { service.edit(any(),any(),any(),any(),any(),any()) } answers {
                require(lastArg<String>().isNotBlank()) { "Reason required" }; emptyMap()
            }
            mvc.perform(put("/api/v1/admin/place/markets/1/boundary").header("X-User-Id",7)
                .contentType("application/json").content("""{"polygon":[[37,127],[37,128],[38,127]]}"""))
                .andExpect(status().isBadRequest)
            mvc.perform(put("/api/v1/admin/place/markets/1/boundary").header("X-User-Id",7)
                .contentType("application/json").content("""{"polygon":[[37,127],[37,128],[38,127]],"reason":" "}"""))
                .andExpect(status().isBadRequest)
            mvc.perform(delete("/api/v1/admin/place/markets/1/paths/4").header("X-User-Id",7))
                .andExpect(status().isBadRequest)
            mvc.perform(delete("/api/v1/admin/place/markets/1/paths/4").header("X-User-Id",7).param("reason",""))
                .andExpect(status().isBadRequest)
        }
    }
})
