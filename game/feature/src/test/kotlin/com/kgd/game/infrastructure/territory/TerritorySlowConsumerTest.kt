package com.kgd.game.infrastructure.territory

import com.kgd.game.application.profile.port.GamePlayerProfile
import com.kgd.game.application.territory.usecase.*
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.*
import jakarta.websocket.RemoteEndpoint
import jakarta.websocket.Session
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.adapter.standard.StandardWebSocketSession
import tools.jackson.databind.ObjectMapper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class TerritorySlowConsumerTest : BehaviorSpec({
    given("a container async write that never completes") {
        then("the bounded queue closes the slow peer and releases identity while world ticks continue") {
            val tickets = mockk<TerritoryTicketUseCase>()
            val world = mockk<TerritoryWorldUseCase>(relaxed = true)
            val session = mockk<StandardWebSocketSession>(relaxed = true)
            val native = mockk<Session>(relaxed = true)
            val remote = mockk<RemoteEndpoint.Async>(relaxed = true)
            every { tickets.redeem("valid") } returns GamePlayerProfile("owner", "name")
            every { world.join("owner", "name") } returns 1
            every { world.snapshot(1, any(), any()) } returns TerritoryFrame(mapOf("t" to "state", "owners" to emptyList<Any>()), emptyList(), emptyList(), emptyList(), setOf(1))
            every { session.id } returns "slow"
            every { session.isOpen } returns true
            every { session.nativeSession } returns native
            every { native.asyncRemote } returns remote
            val closed = CountDownLatch(1)
            every { session.close(any()) } answers { closed.countDown(); Unit }
            val runtime = TerritoryWebSocketHandler(tickets, world, ObjectMapper())
            try {
                runtime.afterConnectionEstablished(session)
                runtime.handleMessage(session, TextMessage("""{"t":"join","version":1,"ticket":"valid"}"""))
                runtime.start()
                closed.await(4, TimeUnit.SECONDS) shouldBe true
                verify(exactly = 1) { world.leave(1) }
                verify(atLeast = 10) { world.advance() }
                verify(exactly = 1) { remote.sendText(any(), any<jakarta.websocket.SendHandler>()) }
            } finally { runtime.stop() }
        }
    }
})
