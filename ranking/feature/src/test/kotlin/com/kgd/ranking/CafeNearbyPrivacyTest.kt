package com.kgd.ranking

import com.kgd.ranking.application.cafe.usecase.*
import com.kgd.ranking.presentation.controller.CafeNearbyController
import com.kgd.ranking.presentation.controller.CafeNearbyErrors
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder

class CafeNearbyPrivacyTest : BehaviorSpec({
    val useCase = mockk<GetCafeNearbyUseCase>()
    val mvc = MockMvcBuilders.standaloneSetup(CafeNearbyController(useCase))
        .setControllerAdvice(CafeNearbyErrors())
        .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build())).build()
    val path = "/api/v1/ranking/cafe/nearby-search"
    Given("a position canary in a request body") {
        Then("parser errors do not echo rejected values and are never cacheable") {
            val response = mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content("""{"location":{"kind":"CURRENT","lat":"37.51234567-invalid","lng":127},"group":"라떼"}""")).andReturn().response
            response.status shouldBe 400
            response.getHeader("Cache-Control") shouldBe "no-store"
            response.contentAsString.contains("37.51234567") shouldBe false
            verify(exactly = 0) { useCase.search(any()) }
        }
        Then("unexpected request-scoped failures become generic errors without a stacktrace or body value") {
            every { useCase.search(any()) } throws IllegalStateException("canary 37.51234567")
            val response = mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content("""{"location":{"kind":"CURRENT","lat":37.51234567,"lng":127},"group":"라떼"}""")).andReturn().response
            response.status shouldBe 503
            response.getHeader("Cache-Control") shouldBe "no-store"
            response.contentAsString.contains("37.51234567") shouldBe false
        }
    }
})
