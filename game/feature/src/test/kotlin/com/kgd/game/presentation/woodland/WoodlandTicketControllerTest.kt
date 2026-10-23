package com.kgd.game.presentation.woodland

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.game.application.profile.port.GamePlayerProfile
import com.kgd.game.application.woodland.usecase.WoodlandTicketUseCase
import com.kgd.game.presentation.profile.controller.GamePlayerIdentityResolver
import com.kgd.game.presentation.woodland.controller.WoodlandTicketController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.assertions.throwables.shouldThrow
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class WoodlandTicketControllerTest : BehaviorSpec({
    given("private Woodland redemption bridge") {
        val tickets = mockk<WoodlandTicketUseCase>()
        val identity = GamePlayerIdentityResolver()
        val secret = "test-only-bridge-secret-at-least-32-bytes"
        val token = "a".repeat(43)
        val controller = WoodlandTicketController(tickets, identity, secret)
        val mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(GlobalExceptionHandler()).build()
        then("missing startup secret is rejected") {
            shouldThrow<IllegalArgumentException> { WoodlandTicketController(tickets, identity, "") }
        }
        then("wrong or missing bridge credentials never consume a ticket") {
            for (value in listOf("", "wrong")) {
                mvc.perform(post("/internal/games/woodland/tickets/redeem")
                    .header("X-Woodland-Bridge", value).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"ticket\":\"$token\"}"))
                    .andExpect(status().isUnauthorized)
            }
            verify(exactly = 0) { tickets.redeem(any()) }
        }
        then("valid private caller gets profile; consumed/expired and foreign game tickets get 401") {
            every { tickets.redeem(token) } returnsMany listOf(GamePlayerProfile("00000000-0000-4000-8000-000000000001", "닉네임"), null)
            repeat(2) { i ->
                mvc.perform(post("/internal/games/woodland/tickets/redeem")
                    .header("X-Woodland-Bridge", secret).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"ticket\":\"$token\"}"))
                    .andExpect(if (i == 0) status().isOk else status().isUnauthorized)
            }
        }
    }
})
