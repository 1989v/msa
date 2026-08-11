package com.kgd.game.infrastructure.ws

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.Runs

private val M = ObjectMapper()

/** MockK 로 만든 접속자 — 보낸 payload 와 close 사유를 캡처한다. */
private class Client(id: String) {
    val sent = mutableListOf<String>()
    val closed = mutableListOf<RelayCloseReason>()
    val peer: RelayPeer = mockk(relaxed = true)

    init {
        every { peer.id } returns id
        every { peer.send(capture(sent)) } just Runs
        every { peer.close(capture(closed)) } just Runs
    }

    val id: String get() = peer.id
    fun nodes(): List<JsonNode> = sent.map { M.readTree(it) }
    fun types(): List<String> = nodes().map { it.path("t").asText() }
    fun last(): JsonNode = M.readTree(sent.last())
    fun first(type: String): JsonNode? = nodes().firstOrNull { it.path("t").asText() == type }
}

private fun join(room: String? = null, nick: String = "kgd") =
    """{"t":"join","room":${room?.let { "\"$it\"" } ?: "null"},"nick":"$nick"}"""

class GameRelayRegistryTest : BehaviorSpec({

    fun registry() = GameRelayRegistry(M)

    Given("빈 대기열의 자동 매칭") {
        val r = registry()
        val a = Client("a")
        val b = Client("b")
        r.onOpen(a.peer, "echo-duel", 0)
        r.onOpen(b.peer, "echo-duel", 0)

        When("두 명이 방 코드 없이 join 하면") {
            r.onMessage(a.id, join(), 10)
            r.onMessage(b.id, join(nick = "rival"), 20)

            Then("같은 방에 0/1 좌석으로 배정된다") {
                a.first("joined")!!.path("seat").asInt() shouldBe 0
                b.first("joined")!!.path("seat").asInt() shouldBe 1
                a.first("joined")!!.path("room").asText() shouldBe b.first("joined")!!.path("room").asText()
                r.roomCount() shouldBe 1
            }
            Then("양쪽이 같은 시드의 start 를 받는다") {
                val sa = a.first("start")!!
                val sb = b.first("start")!!
                sa.path("seed").asInt() shouldBe sb.path("seed").asInt()
                sa.path("players").values().map { it.asString() } shouldBe listOf("kgd", "rival")
            }
            Then("방이 차면 대기열에서 빠져 세 번째는 새 방을 얻는다") {
                val c = Client("c")
                r.onOpen(c.peer, "echo-duel", 30)
                r.onMessage(c.id, join(), 30)
                c.first("joined")!!.path("seat").asInt() shouldBe 0
                c.first("joined")!!.path("room").asText() shouldNotBe a.first("joined")!!.path("room").asText()
                r.roomCount() shouldBe 2
            }
        }
    }

    Given("친구 초대용 방 코드") {
        val r = registry()
        val a = Client("a")
        val b = Client("b")
        val c = Client("c")
        listOf(a, b, c).forEach { r.onOpen(it.peer, "echo-duel", 0) }

        When("같은 코드로 두 명이 들어오면") {
            r.onMessage(a.id, join("ABC123"), 10)
            r.onMessage(b.id, join("abc-123"), 20) // 소문자/구분자는 정규화된다

            Then("코드 그대로의 방에서 매칭된다") {
                a.first("joined")!!.path("room").asText() shouldBe "ABC123"
                b.first("joined")!!.path("seat").asInt() shouldBe 1
                a.first("start") shouldNotBe null
                r.roomCount() shouldBe 1
            }
            Then("세 번째는 ROOM_FULL 로 거절된다") {
                r.onMessage(c.id, join("ABC123"), 30)
                c.last().path("t").asText() shouldBe "error"
                c.last().path("code").asText() shouldBe "ROOM_FULL"
            }
        }

        When("형식이 깨진 코드로 join 하면") {
            val d = Client("d")
            r.onOpen(d.peer, "echo-duel", 40)
            r.onMessage(d.id, join("!!"), 40)

            Then("BAD_ROOM 을 돌려준다") {
                d.last().path("code").asText() shouldBe "BAD_ROOM"
            }
        }
    }

    Given("게임 슬러그가 다른 두 접속") {
        val r = registry()
        val a = Client("a")
        val b = Client("b")
        r.onOpen(a.peer, "echo-duel", 0)
        r.onOpen(b.peer, "rune-merge", 0)

        When("둘 다 같은 코드로 join 하면") {
            r.onMessage(a.id, join("ZZZZ99"), 10)
            r.onMessage(b.id, join("ZZZZ99"), 10)

            Then("게임별로 방이 분리되어 매칭되지 않는다") {
                r.roomCount() shouldBe 2
                a.first("start") shouldBe null
                b.first("start") shouldBe null
            }
        }
    }

    Given("매칭이 끝난 방") {
        val r = registry()
        val a = Client("a")
        val b = Client("b")
        r.onOpen(a.peer, "echo-duel", 0)
        r.onOpen(b.peer, "echo-duel", 0)
        r.onMessage(a.id, join(), 10)
        r.onMessage(b.id, join(), 10)

        When("한쪽이 move 를 보내면") {
            r.onMessage(a.id, """{"t":"move","d":{"k":"add","dir":2}}""", 20)

            Then("상대에게만 좌석 번호와 함께 원문 그대로 전달된다") {
                val relayed = b.last()
                relayed.path("t").asText() shouldBe "move"
                relayed.path("seat").asInt() shouldBe 0
                relayed.path("d").path("k").asText() shouldBe "add"
                relayed.path("d").path("dir").asInt() shouldBe 2
                a.types().contains("move") shouldBe false
            }
        }

        When("한쪽이 끊기면") {
            r.onClose(a.id)

            Then("남은 쪽이 opponentLeft 를 받는다") {
                b.last().path("t").asText() shouldBe "opponentLeft"
            }
            Then("방은 아직 살아 있고, 둘 다 나가면 즉시 파기된다") {
                r.roomCount() shouldBe 1
                r.onClose(b.id)
                r.roomCount() shouldBe 0
                r.peerCount() shouldBe 0
            }
        }
    }

    Given("방에 들어가지 않은 접속") {
        val r = registry()
        val a = Client("a")
        r.onOpen(a.peer, "echo-duel", 0)

        When("move 를 보내면") {
            r.onMessage(a.id, """{"t":"move","d":{}}""", 10)
            Then("NOT_JOINED") { a.last().path("code").asText() shouldBe "NOT_JOINED" }
        }
        When("두 번 join 하면") {
            r.onMessage(a.id, join(), 20)
            r.onMessage(a.id, join(), 30)
            Then("ALREADY_JOINED") { a.last().path("code").asText() shouldBe "ALREADY_JOINED" }
        }
        When("ping 을 보내면") {
            r.onMessage(a.id, """{"t":"ping"}""", 40)
            Then("pong 이 온다") { a.last().path("t").asText() shouldBe "pong" }
        }
        When("JSON 이 아닌 것을 보내면") {
            r.onMessage(a.id, "not json", 50)
            Then("BAD_MESSAGE") { a.last().path("code").asText() shouldBe "BAD_MESSAGE" }
        }
    }

    Given("초당 20건 제한") {
        val r = registry()
        val a = Client("a")
        r.onOpen(a.peer, "echo-duel", 1_000)

        When("같은 1초 창에서 21건을 보내면") {
            repeat(21) { r.onMessage(a.id, """{"t":"ping"}""", 1_000) }

            Then("21번째에서 RATE_LIMIT 으로 끊는다") {
                a.closed shouldBe listOf(RelayCloseReason.RATE_LIMIT)
                a.last().path("code").asText() shouldBe "RATE_LIMIT"
                r.peerCount() shouldBe 0
            }
        }

        When("창이 넘어간 뒤 다시 보내면") {
            val b = Client("b")
            r.onOpen(b.peer, "echo-duel", 1_000)
            repeat(20) { r.onMessage(b.id, """{"t":"ping"}""", 1_000) }
            r.onMessage(b.id, """{"t":"ping"}""", 2_000)

            Then("허용된다") {
                b.closed.isEmpty() shouldBe true
                b.types().count { it == "pong" } shouldBe 21
            }
        }
    }

    Given("4KB 메시지 상한") {
        val r = registry()
        val a = Client("a")
        r.onOpen(a.peer, "echo-duel", 0)

        When("4096자를 넘는 메시지를 보내면") {
            r.onMessage(a.id, """{"t":"move","d":"${"x".repeat(4100)}"}""", 10)

            Then("TOO_LARGE 로 끊는다") {
                a.last().path("code").asText() shouldBe "TOO_LARGE"
                a.closed shouldBe listOf(RelayCloseReason.TOO_LARGE)
            }
        }
    }

    Given("유휴 세션") {
        val r = registry()
        val a = Client("a")
        r.onOpen(a.peer, "echo-duel", 0)
        r.onMessage(a.id, join(), 0)

        When("60초 동안 아무 메시지가 없으면") {
            r.sweepIdle(60_000)

            Then("ping 을 한 번만 요구한다") {
                a.types().count { it == "ping" } shouldBe 1
                r.sweepIdle(61_000)
                a.types().count { it == "ping" } shouldBe 1
            }
        }

        When("90초까지 무응답이면") {
            r.sweepIdle(90_000)

            Then("세션을 닫고 방을 정리한다") {
                a.closed shouldBe listOf(RelayCloseReason.IDLE)
                r.peerCount() shouldBe 0
                r.roomCount() shouldBe 0
            }
        }
    }

    Given("동시 방 200개 상한") {
        val r = registry()
        repeat(200) { i ->
            val c = Client("host-$i")
            r.onOpen(c.peer, "echo-duel", 0)
            r.onMessage(c.id, join("R${i.toString().padStart(5, '0')}"), 0)
        }

        When("201번째 방을 열려고 하면") {
            val over = Client("over")
            r.onOpen(over.peer, "echo-duel", 0)
            r.onMessage(over.id, join("XYZ999"), 0)

            Then("ROOM_LIMIT 으로 거절된다") {
                r.roomCount() shouldBe 200
                over.last().path("code").asText() shouldBe "ROOM_LIMIT"
            }
        }
    }
})
