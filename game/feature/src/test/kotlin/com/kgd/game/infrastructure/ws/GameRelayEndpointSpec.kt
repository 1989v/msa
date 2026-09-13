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

    /**
     * 공개 방 목록 (2026-09-13) — 코드를 주고받지 않고 남이 만든 방에 들어가기 위한 것.
     * **공개로 표시한 방만** 실려야 한다: 코드 방은 원래 아는 사람만 들어오는 자리다.
     */
    Given("파티 방을 여는 /ws/games/room-list") {
        val open = connect("room-list")
        val secret = connect("room-list")
        val looker = connect("room-list")

        When("하나는 공개로, 하나는 비공개로 방을 만들고 다른 사람이 목록을 물으면") {
            open.send("""{"t":"join","room":null,"nick":"open-host","seats":8,"private":true,"manualStart":true,"listed":true}""")
            open.await(objectMapper)
            secret.send("""{"t":"join","room":null,"nick":"secret-host","seats":8,"private":true,"manualStart":true}""")
            secret.await(objectMapper)
            looker.send("""{"t":"join","room":null,"nick":"looker","seats":8,"private":true,"manualStart":true}""")
            looker.await(objectMapper)
            looker.send("""{"t":"rooms"}""")
            val listed = looker.await(objectMapper)

            Then("공개 방 하나만 코드·인원과 함께 온다") {
                listed.path("t").asText() shouldBe "rooms"
                // 비공개 방과 조회한 사람 자신의 방은 빠지고 공개 방 하나만 남는다
                listed.path("rooms").size() shouldBe 1
                val row = listed.path("rooms").first()
                row.path("host").asText() shouldBe "open-host"
                row.path("n").asInt() shouldBe 1
                row.path("cap").asInt() shouldBe 8
                row.path("code").asText().length shouldBe 6
            }

            Then("목록으로 받은 코드로 그 방에 들어갈 수 있다") {
                val code = listed.path("rooms").first().path("code").asText()
                val joiner = connect("room-list")
                joiner.send("""{"t":"join","room":"$code","nick":"joiner","seats":8,"private":true,"manualStart":true}""")
                val j = joiner.await(objectMapper)
                j.path("t").asText() shouldBe "joined"
                j.path("seat").asInt() shouldBe 1 // 이미 한 명 있는 방 = 목록이 준 그 방
                joiner.close()
            }

            Then("정리") {
                open.close(); secret.close(); looker.close()
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
