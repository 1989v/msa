package com.kgd.game.infrastructure.ws

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
import org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.core.env.Environment
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import java.net.URI
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * 릴레이 엔드포인트의 배선 검증 — 실제 Tomcat 에 붙어 두 클라이언트가 왕복한다.
 * 단위 테스트([GameRelayRegistryTest])가 못 잡는 것만 본다: 와일드카드 경로 매핑,
 * URI 에서 슬러그 추출, 프록시 뒤 Origin 허용, JSON 프레임 왕복.
 *
 * DB 없이 뜨도록 datasource/JPA 자동설정만 끈다 (Docker 불필요).
 */
@SpringBootTest(
    classes = [GameRelayEndpointSpec.Ctx::class],
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
)
class GameRelayEndpointSpec(
    @Autowired private val env: Environment,
    @Autowired private val objectMapper: ObjectMapper,
) : BehaviorSpec({

    val port = env.getRequiredProperty("local.server.port")
    val client = StandardWebSocketClient()

    fun connect(slug: String): Probe {
        val probe = Probe()
        val session = client.execute(probe, "ws://localhost:$port/ws/games/$slug").get(5, TimeUnit.SECONDS)
        probe.session = session
        return probe
    }

    Given("Tomcat 에 올라간 /ws/games/echo-duel") {
        val a = connect("echo-duel")
        val b = connect("echo-duel")

        When("두 클라이언트가 같은 방 코드로 join 하면") {
            a.send("""{"t":"join","room":"WSTEST","nick":"alpha"}""")
            val aJoined = a.await(objectMapper)
            b.send("""{"t":"join","room":"WSTEST","nick":"beta"}""")
            val bJoined = b.await(objectMapper)

            Then("좌석이 배정되고 양쪽에 start 가 온다") {
                aJoined.path("t").asText() shouldBe "joined"
                aJoined.path("room").asText() shouldBe "WSTEST"
                aJoined.path("seat").asInt() shouldBe 0
                bJoined.path("seat").asInt() shouldBe 1
                a.await(objectMapper).path("t").asText() shouldBe "start"
                b.await(objectMapper).path("t").asText() shouldBe "start"
            }
        }

        When("한쪽이 move 를 보내면") {
            a.send("""{"t":"move","d":{"k":"add","dir":3}}""")

            Then("상대에게 좌석 번호와 함께 원문 그대로 도착한다") {
                val relayed = b.await(objectMapper)
                relayed.path("t").asText() shouldBe "move"
                relayed.path("seat").asInt() shouldBe 0
                relayed.path("d").path("dir").asInt() shouldBe 3
            }
        }

        When("한쪽이 접속을 끊으면") {
            a.close()

            Then("남은 쪽이 opponentLeft 를 받는다") {
                b.await(objectMapper).path("t").asText() shouldBe "opponentLeft"
                b.close()
            }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)

    /** 릴레이 3종만 올린 최소 컨텍스트 */
    @EnableAutoConfiguration(
        exclude = [
            DataSourceAutoConfiguration::class,
            DataSourceTransactionManagerAutoConfiguration::class,
            HibernateJpaAutoConfiguration::class,
        ],
    )
    @Import(GameRelayRegistry::class, GameRelayWebSocketHandler::class, GameRelayWebSocketConfig::class)
    class Ctx
}

/** 수신 메시지를 큐에 쌓는 테스트 클라이언트 */
private class Probe : TextWebSocketHandler() {
    lateinit var session: WebSocketSession
    private val inbox = LinkedBlockingQueue<String>()

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        inbox.put(message.payload)
    }

    fun send(json: String) = session.sendMessage(TextMessage(json))

    fun await(mapper: ObjectMapper): JsonNode {
        val raw = inbox.poll(5, TimeUnit.SECONDS) ?: error("릴레이 응답 없음 (5초 초과)")
        return mapper.readTree(raw)
    }

    fun close() = session.close(CloseStatus.NORMAL)
}
