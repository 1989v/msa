package com.kgd.game

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.game.sim.InputCommand
import com.kgd.game.sim.InputEvent
import com.kgd.game.sim.ReplayLog
import com.kgd.game.sim.SimRunner
import com.kgd.game.sim.games.SnakeGame
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.DockerClientFactory
import org.testcontainers.containers.GenericContainer
import org.testcontainers.utility.DockerImageName
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

private val dockerUp: Boolean =
    runCatching { DockerClientFactory.instance().isDockerAvailable }.getOrDefault(false)

@Suppress("unused")
fun gameDockerAvailable(): Boolean = dockerUp

/**
 * 라이브 E2E — 실제 Redis + 실제 HTTP(JDK HttpClient) 로 전체 흐름 검증:
 *   세션 시작(서버 seed/토큰) → 결정적 플레이 → 제출(Tier A→잠정→상위N Tier B) → 리더보드.
 * 정직한 제출은 CONFIRMED, 같은 리플레이에 점수만 부풀린 위조는 Tier B 가 REJECTED.
 */
@SpringBootTest(
    classes = [GameItTestApp::class],
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = ["management.health.redis.enabled=false"],
)
@org.junit.jupiter.api.condition.EnabledIf("com.kgd.game.GameLiveE2ETestKt#gameDockerAvailable")
class GameLiveE2ETest(
    @Autowired private val env: Environment,
    @Autowired private val mapper: ObjectMapper,
) : BehaviorSpec({

    // ticks*30ms < Tier A grace(2000) 이도록 작게 잡아 테스트 wall-clock 과 무관하게 시간정합 통과.
    val ticks = 50
    val http = HttpClient.newHttpClient()
    val base = "http://localhost:${env.getProperty("local.server.port")}"

    fun post(path: String, body: Any): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(base + path))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
            .build()
        return mapper.readTree(http.send(req, HttpResponse.BodyHandlers.ofString()).body())
    }

    fun get(path: String): JsonNode {
        val req = HttpRequest.newBuilder(URI.create(base + path)).GET().build()
        return mapper.readTree(http.send(req, HttpResponse.BodyHandlers.ofString()).body())
    }

    fun honestPlay(seed: Int): Pair<Int, List<InputEvent>> {
        val inputs = listOf(
            InputEvent(3, InputCommand.DOWN),
            InputEvent(9, InputCommand.RIGHT),
            InputEvent(15, InputCommand.UP),
        )
        val score = SimRunner.run(SnakeGame(), ReplayLog("snake", seed, ticks, inputs)).score
        return score to inputs
    }

    fun submitBody(sid: String, token: String, seed: Int, inputs: List<InputEvent>, claimed: Int, nick: String) =
        mapOf(
            "sessionId" to sid, "token" to token, "claimedScore" to claimed,
            "replay" to mapOf(
                "gameId" to "snake", "seed" to seed, "totalTicks" to ticks,
                "inputs" to inputs.map { mapOf("tick" to it.tick, "command" to it.command.name) },
            ),
            "clientDurationMs" to 1000, "nickname" to nick,
        )

    Given("a real Redis-backed game server over HTTP") {

        When("an honest run is played and submitted") {
            Then("accepted, Tier B CONFIRMED, ranked #1, and on the live leaderboard") {
                val start = post("/api/v1/game/sessions", mapOf("gameId" to "snake", "daily" to false)).get("data")
                val seed = start.get("seed").asInt()
                val (honest, inputs) = honestPlay(seed)
                val res = post(
                    "/api/v1/game/scores",
                    submitBody(start.get("sessionId").asText(), start.get("token").asText(), seed, inputs, honest, "kgd-e2e"),
                ).get("data")
                res.get("accepted").asBoolean() shouldBe true
                res.get("verification").asText() shouldBe "CONFIRMED"
                res.get("allTimeRank").asInt() shouldBe 1

                val lb = get("/api/v1/game/leaderboard?gameId=snake&period=ALL_TIME").get("data")
                lb.isArray shouldBe true
                lb.any { it.get("nickname").asText() == "kgd-e2e" } shouldBe true
            }
        }

        When("a plausible but forged score is submitted for the same replay") {
            Then("Tier B rejects it (server replay recompute != claim)") {
                val start = post("/api/v1/game/sessions", mapOf("gameId" to "snake", "daily" to false)).get("data")
                val seed = start.get("seed").asInt()
                val (honest, inputs) = honestPlay(seed)
                val res = post(
                    "/api/v1/game/scores",
                    submitBody(start.get("sessionId").asText(), start.get("token").asText(), seed, inputs, honest + 1, "cheater-e2e"),
                ).get("data")
                res.get("accepted").asBoolean() shouldBe true
                res.get("verification").asText() shouldBe "REJECTED"
            }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        private val redis: GenericContainer<*>? = if (dockerUp) {
            GenericContainer(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379).also { it.start() }
        } else {
            null
        }

        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) {
            val c = redis ?: return
            registry.add("spring.data.redis.host") { c.host }
            registry.add("spring.data.redis.port") { c.getMappedPort(6379) }
        }
    }
}
