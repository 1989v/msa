package com.kgd.game.infrastructure.territory

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.web.socket.*
import org.springframework.web.socket.client.standard.StandardWebSocketClient
import org.springframework.web.socket.handler.TextWebSocketHandler
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.net.URI
import java.net.http.*
import java.util.concurrent.*
import com.kgd.game.application.territory.usecase.TerritoryWorldUseCase
import com.kgd.game.application.territory.service.TerritoryWorldService
import com.kgd.game.domain.territory.model.*

@SpringBootTest(classes = [TerritoryLocalContext::class], webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class TerritoryEndpointTest(@Autowired env: Environment, @Autowired mapper: ObjectMapper, @Autowired runtime: TerritoryWebSocketHandler,
    @Autowired worldService: TerritoryWorldUseCase) : BehaviorSpec({
    val port = env.getRequiredProperty("local.server.port")
    val http = HttpClient.newHttpClient()
    val ws = StandardWebSocketClient(jakarta.websocket.ContainerProvider.getWebSocketContainer().apply { defaultMaxTextMessageBufferSize = 262144 })
    fun ticket(identity: Int): String {
        val request = HttpRequest.newBuilder(URI("http://localhost:$port/api/v1/games/territory/tickets"))
            .header("X-User-Id", identity.toString()).POST(HttpRequest.BodyPublishers.noBody()).build()
        val response = http.send(request, HttpResponse.BodyHandlers.ofString())
        response.statusCode() shouldBe 200
        response.headers().firstValue("cache-control").orElse("") shouldBe "no-store"
        return mapper.readTree(response.body()).path("data").path("ticket").asText()
    }
    fun connect(token: String): TerritoryProbe {
        val probe = TerritoryProbe(mapper)
        probe.session = ws.execute(probe, "ws://localhost:$port/ws/games/territory").get(10, TimeUnit.SECONDS)
        probe.send("""{"t":"join","version":1,"ticket":"$token"}""")
        return probe
    }
    given("real Tomcat exact territory route alongside the wildcard relay") {
        then("one hundred independent clients share the world, receive authoritative identity, terrain and input acknowledgements") {
            val executor = Executors.newFixedThreadPool(12)
            val start = System.nanoTime()
            val clients = (1..100).map { identity -> executor.submit<TerritoryProbe> { connect(ticket(identity)) } }.map { it.get(30, TimeUnit.SECONDS) }
            try {
                val ids = clients.map { it.await("welcome").path("self").asInt() }
                ids.toSet().size shouldBe 100
                val field = TerritoryWorldService::class.java.getDeclaredField("world").apply { isAccessible = true }
                val engine = field.get(worldService) as TerritoryWorld
                synchronized(engine) {
                    ids.forEachIndexed { index, id ->
                        engine.players.getValue(id).apply { x = 1024.23 + index % 10 * 8; y = 1024.23 + index / 10 * 8; started = false }
                    }
                }
                clients.forEachIndexed { index, client ->
                    client.send("""{"t":"input","seq":0,"moving":false}""")
                    val frame = client.await("state") { it.path("ack").asLong() == 0L }
                    frame.path("self").path("name").asText() shouldBe "검증 ${index + 1}"
                    frame.path("population").path("humans").asInt() shouldBe 100
                    frame.path("chunks").size().let { it <= 9 } shouldBe true
                    client.send("""{"t":"input","seq":1,"moving":false}""")
                }
                // Discard initial terrain streaming before measuring three seconds of active steady traffic.
                Thread.sleep(1000); clients.forEach { it.pollBytes() }
                synchronized(engine) {
                    for (id in ids) {
                        val p = engine.players.getValue(id)
                        engine.land.patch((-3..3).flatMap { dy -> (-3..3).map { dx -> cellId(p.x.toInt() + dx, p.y.toInt() + dy) } }, id)
                    }
                }
                var bytes = 0L
                val steadyStart = System.nanoTime()
                repeat(60) { frame ->
                    clients.forEach { it.send("""{"t":"input","seq":${frame + 2},"moving":true,"angle":${frame * (16.0 / 1.5) * .05}}""") }
                    Thread.sleep(50)
                    for (client in clients) bytes += client.pollBytes()
                }
                val seconds = (System.nanoTime() - steadyStart) / 1e9
                synchronized(engine) { ids.count { engine.players[it]?.let { p -> p.alive && p.moving && !p.capturePending } == true } shouldBe 100 }
                println("TERRITORY_REAL_WS scenario=crowded100 clients=100 alive=100 elapsedMs=${(System.nanoTime()-start)/1e6} steadySeconds=$seconds steadyBytes=$bytes bytesPerSecond=${bytes/seconds} port=$port runtime=${System.getProperty("java.version")} pipeline=${runtime.metrics()}")
            } finally { clients.forEach { it.session.close() }; executor.shutdownNow() }
        }
        then("one-use tickets reject replay and old sessions release identity for reconnect") {
            val token = ticket(501); val first = connect(token); first.await("welcome")
            val replay = connect(token); replay.closed.get(5, TimeUnit.SECONDS).reason shouldBe "TICKET_INVALID"
            first.session.close(); first.closed.get(5, TimeUnit.SECONDS)
            val retry = connect(ticket(501)); retry.await("welcome"); retry.session.close()
        }
        then("duplicate identity is explicit and malformed input closes only that client") {
            val a = connect(ticket(502)); a.await("welcome")
            val b = connect(ticket(502)); b.closed.get(5, TimeUnit.SECONDS).reason shouldBe "ALREADY_CONNECTED"
            a.send("""{"t":"input","seq":0,"moving":true,"angle":"bad"}""")
            a.closed.get(5, TimeUnit.SECONDS).reason shouldBe "INPUT_ANGLE"
        }
        then("unapproved browser origins cannot open the exact endpoint") {
            val headers = WebSocketHttpHeaders(); headers.origin = "https://evil.invalid"
            val future = ws.execute(TerritoryProbe(mapper), headers, URI("ws://localhost:$port/ws/games/territory"))
            runCatching { future.get(5, TimeUnit.SECONDS) }.isFailure shouldBe true
        }
        then("input leases stop motion and a late join receives its own terrain baseline") {
            val a = connect(ticket(503)); a.await("welcome")
            a.send("""{"t":"input","seq":0,"moving":true,"angle":0}""")
            val initial = a.await("state") { it.path("ack").asLong() == 0L }.path("tick").asLong()
            val before = a.await("state") { it.path("tick").asLong() >= initial + 24 }.path("self")
            val after = a.await("state") { it.path("tick").asLong() >= initial + 32 }.path("self")
            before.path("x").asDouble() shouldBe after.path("x").asDouble()
            before.path("y").asDouble() shouldBe after.path("y").asDouble()
            val fresh = connect(ticket(504)); fresh.await("welcome")
            val baseline = fresh.await("state")
            baseline.path("chunks").isEmpty shouldBe false
            baseline.path("self").path("area").asInt() shouldBe 49
            a.send("""{"t":"ping","nonce":"lease"}"""); a.await("pong").path("nonce").asText() shouldBe "lease"
            a.session.close(); fresh.session.close()
        }
        then("excessive frames close the sender with a bounded rate policy") {
            val a = connect(ticket(505)); a.await("welcome")
            repeat(65) { sequence -> runCatching { a.send("""{"t":"input","seq":$sequence,"moving":false}""") } }
            a.closed.get(5, TimeUnit.SECONDS).reason shouldBe "RATE_LIMIT"
        }
        then("cosmetics stream as revision deltas and late joiners receive a complete appearance baseline") {
            val a = connect(ticket(506)); val id = a.await("welcome").path("self").asInt()
            val initial = a.await("state")
            initial.path("owners").any { it.path("id").asInt() == id } shouldBe true
            a.send("""{"t":"cosmetics","color":4,"pattern":1,"border":"dashed"}""")
            a.await("state") { frame -> frame.path("owners").any { it.path("id").asInt() == id && it.path("cosmetics").path("color").asInt() == 4 } }
            val stable = a.await("state")
            stable.path("ownerIds").any { it.asInt() == id } shouldBe true
            stable.path("owners").any { it.path("id").asInt() == id } shouldBe false
            a.session.close()
            val late = connect(ticket(507)); val lateId = late.await("welcome").path("self").asInt()
            late.await("state").path("owners").any { it.path("id").asInt() == lateId } shouldBe true
            late.session.close()
        }
        then("a dead session can explicitly respawn with a fresh life and terrain baseline") {
            val a = connect(ticket(508)); val id = a.await("welcome").path("self").asInt()
            val field = TerritoryWorldService::class.java.getDeclaredField("world").apply { isAccessible = true }
            val engine = field.get(worldService) as TerritoryWorld
            synchronized(engine) { engine.players.getValue(id).apply { x = 4095.95; y = 3000.23; started = false } }
            a.send("""{"t":"input","seq":0,"moving":true,"angle":0}""")
            a.await("state") { !it.path("self").path("alive").asBoolean() }
            a.send("""{"t":"respawn"}""")
            val fresh = a.await("state") { it.path("self").path("id").asInt() != id }
            fresh.path("self").path("alive").asBoolean() shouldBe true
            fresh.path("self").path("area").asInt() shouldBe 49
            fresh.path("chunks").isEmpty shouldBe false
            a.session.close()
        }
    }
}) { override fun extensions() = listOf(SpringExtension) }

private class TerritoryProbe(private val mapper: ObjectMapper) : TextWebSocketHandler() {
    lateinit var session: WebSocketSession
    private val messages = LinkedBlockingQueue<String>()
    val closed = CompletableFuture<CloseStatus>()
    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) { messages.offer(message.payload) }
    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) { closed.complete(status) }
    fun send(json: String) = session.sendMessage(TextMessage(json))
    fun await(type: String, predicate: (JsonNode) -> Boolean = { true }): JsonNode {
        val deadline = System.nanoTime() + 10_000_000_000
        while (System.nanoTime() < deadline) {
            val raw = messages.poll(1, TimeUnit.SECONDS) ?: continue
            val frame = mapper.readTree(raw)
            if (frame.path("t").asText() == type && predicate(frame)) return frame
        }
        error("No $type response; closed=${closed.getNow(null)}")
    }
    fun pollBytes(): Long { var bytes = 0L; while (true) bytes += (messages.poll()?.toByteArray()?.size ?: return bytes) }
}
