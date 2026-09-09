package com.kgd.game.infrastructure.ws

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.Runs
import io.mockk.every
import io.mockk.just
import io.mockk.mockk

/**
 * ADR-0092 — 파티 방. 릴레이는 규칙을 계속 모른다: 새로 아는 것은 좌석 번호 · 메시지 종류 ·
 * 시각뿐이고, 설정은 열어보지 않고 나르기만 한다.
 *
 * 시간을 인자로 받으므로 로비 30초 · 유휴 90초를 **실제로 기다리지 않는다**.
 */
private val PM = ObjectMapper()

private class PartyClient(id: String) {
    val sent = mutableListOf<String>()
    val closed = mutableListOf<RelayCloseReason>()
    val peer: RelayPeer = mockk(relaxed = true)

    init {
        every { peer.id } returns id
        every { peer.send(capture(sent)) } just Runs
        every { peer.close(capture(closed)) } just Runs
    }

    val id: String get() = peer.id
    fun nodes(): List<JsonNode> = sent.map { PM.readTree(it) }
    fun types(): List<String> = nodes().map { it.path("t").asText() }
    fun first(type: String): JsonNode? = nodes().firstOrNull { it.path("t").asText() == type }
    fun all(type: String): List<JsonNode> = nodes().filter { it.path("t").asText() == type }
}

/** 파티 방 만들기 — 코드 없이 붙고, 대기열을 우회하며, 마감·잠금을 면제받는다 */
private fun create(seats: Int = 6, nick: String = "host") =
    """{"t":"join","room":null,"nick":"$nick","seats":$seats,"private":true,"manualStart":true}"""

/** 초대 링크로 들어오기 — 아는 코드로만 */
private fun enter(code: String, nick: String = "guest", spectate: Boolean = false) =
    """{"t":"join","room":"$code","nick":"$nick","private":true""" +
        (if (spectate) ""","spectate":true""" else "") + "}"

private fun startCmd(cfg: String = """{"course":"pinball","pick":1}""") =
    """{"t":"start","cfg":$cfg}"""

class PartyRoomSpec : BehaviorSpec({

    fun registry() = GameRelayRegistry(PM)

    /** 좌석 토큰 배선을 볼 때만 — 실제 서명자를 그대로 쓴다 */
    fun signingRegistry() = GameRelayRegistry(
        PM,
        com.kgd.game.infrastructure.party.HmacPartySeatTokenService("party-relay-token-key-32bytes-ok"),
    )
    fun code(c: PartyClient) = c.first("joined")!!.path("room").asText()

    // ── T6 · T7 · T8 · T43 · T61 ────────────────────────────────────────────

    Given("파티 방을 연 뒤 30초가 지났을 때") {
        val r = registry()
        val host = PartyClient("h")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(), 10)

        When("로비 마감 시각이 지나도록 두면") {
            r.startDueLobbies(60_000)

            Then("판이 시작되지 않는다 — 초대 링크가 살아 있다") {
                host.types() shouldNotContain "start"
            }
            Then("그 뒤에 들어온 사람이 거절되지 않는다") {
                val late = PartyClient("l")
                r.onOpen(late.peer, "party", 61_000)
                r.onMessage(late.id, enter(code(host)), 61_000)
                late.first("joined") shouldNotBe null
                late.types() shouldNotContain "error"
            }
        }
    }

    Given("판이 한 번 끝난 파티 방") {
        val r = registry()
        val host = PartyClient("h")
        val guest = PartyClient("g")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(), 10)
        r.onMessage(guest.id.let { r.onOpen(guest.peer, "party", 20); guest.id }, enter(code(host)), 20)
        r.onMessage(host.id, startCmd(), 30)
        r.onMessage(host.id, """{"t":"done"}""", 40)
        r.onMessage(guest.id, """{"t":"done"}""", 41)

        When("방장이 두 번째 판을 시작하면") {
            r.onMessage(host.id, startCmd(), 50)

            Then("방이 다시 열려 판이 돈다") {
                host.all("start").size shouldBe 2
            }
            Then("판 번호가 올라간다") {
                host.all("start").map { it.path("round").asInt() } shouldBe listOf(1, 2)
            }
            Then("두 판의 시드가 다르다") {
                val seeds = host.all("start").map { it.path("seed").asInt() }
                (seeds[0] == seeds[1]) shouldBe false
            }
        }
    }

    Given("두 사람이 각각 파티 방을 만들 때") {
        val r = registry()
        val a = PartyClient("a")
        val b = PartyClient("b")
        r.onOpen(a.peer, "party", 0)
        r.onOpen(b.peer, "party", 0)

        When("둘 다 코드 없이 방을 만들면") {
            r.onMessage(a.id, create(), 10)
            r.onMessage(b.id, create(), 20)

            Then("서로 다른 방에 들어간다") {
                code(a) shouldNotBe code(b)
                r.roomCount() shouldBe 2
            }
            Then("둘 다 좌석 0 이다 — 각자 자기 방의 방장") {
                a.first("joined")!!.path("seat").asInt() shouldBe 0
                b.first("joined")!!.path("seat").asInt() shouldBe 0
            }
        }
    }

    Given("기존 대전 게임의 빠른 매칭") {
        val r = registry()
        val a = PartyClient("a")
        val b = PartyClient("b")
        r.onOpen(a.peer, "echo-duel", 0)
        r.onOpen(b.peer, "echo-duel", 0)

        When("옵션 없이 코드 없는 join 이 둘 오면") {
            r.onMessage(a.id, """{"t":"join","room":null,"nick":"a"}""", 10)
            r.onMessage(b.id, """{"t":"join","room":null,"nick":"b"}""", 20)

            Then("**여전히 같은 방에 합쳐진다** — 배포된 계약을 안 깬다") {
                code(a) shouldBe code(b)
                r.roomCount() shouldBe 1
            }
        }
    }

    Given("알 수 없는 코드로 파티 방에 붙을 때") {
        val r = registry()
        val stranger = PartyClient("s")
        r.onOpen(stranger.peer, "party", 0)

        When("아무 코드나 대면") {
            r.onMessage(stranger.id, enter("ZZZZZZ"), 10)

            Then("방이 만들어지지 않고 거절된다") {
                stranger.first("error")!!.path("code").asText() shouldBe "ROOM_NOT_FOUND"
                r.roomCount() shouldBe 0
            }
        }

        When("「방 만들기」 경로로 붙으면") {
            val maker = PartyClient("m")
            r.onOpen(maker.peer, "party", 20)
            r.onMessage(maker.id, create(), 20)

            Then("방이 만들어진다 — 전부 거절이 아니다") {
                maker.first("joined") shouldNotBe null
                r.roomCount() shouldBe 1
            }
        }
    }

    Given("좌석 0 이 아닌 사람이 시작을 시도할 때") {
        val r = registry()
        val host = PartyClient("h")
        val guest = PartyClient("g")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(), 10)
        r.onOpen(guest.peer, "party", 20)
        r.onMessage(guest.id, enter(code(host)), 20)

        When("게스트가 시작 명령을 보내면") {
            r.onMessage(guest.id, startCmd(), 30)

            Then("거부된다") {
                guest.first("error")!!.path("code").asText() shouldBe "NOT_HOST"
                host.types() shouldNotContain "start"
            }
        }

        When("방장이 나가고 게스트가 좌석을 이어받은 뒤 시작하면") {
            r.onClose(host.id)
            r.onMessage(guest.id, startCmd(), 40)

            Then("통과한다 — 승계 후 새 방장이 잇는다") {
                guest.types() shouldContain "start"
            }
        }
    }

    // ── 시드·설정의 원자적 발급 (T9 · T63) ──────────────────────────────────

    Given("방장이 시작 명령에 설정을 실어 보낼 때") {
        val r = registry()
        val host = PartyClient("h")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(), 10)

        When("설정과 함께 시작하면") {
            r.onMessage(host.id, """{"t":"start","cfg":{"course":"cascade"},"seed":999}""", 20)
            val start = host.first("start")!!

            Then("시드는 릴레이가 뽑는다 — 방장이 보낸 값은 무시된다") {
                start.path("seed").asInt() shouldNotBe 999
            }
            Then("설정이 시드와 **한 메시지**로 나간다") {
                start.path("cfg").path("course").asText() shouldBe "cascade"
                start.path("seed").isIntegralNumber shouldBe true
            }
        }
    }

    // ── 관전자 (T22 의 릴레이 쪽 · OQ-7) ────────────────────────────────────

    Given("관전자가 붙을 때") {
        val r = registry()
        val host = PartyClient("h")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(seats = 2), 10)
        val watcher = PartyClient("w")
        r.onOpen(watcher.peer, "party", 20)

        When("관전으로 들어오면") {
            r.onMessage(watcher.id, enter(code(host), spectate = true), 20)

            Then("좌석을 받지 않는다") {
                watcher.first("joined")!!.path("seat").asInt() shouldBe -1
            }
            Then("좌석을 먹지 않아 참가자가 들어올 수 있다") {
                val late = PartyClient("l")
                r.onOpen(late.peer, "party", 30)
                r.onMessage(late.id, enter(code(host)), 30)
                late.first("joined")!!.path("seat").asInt() shouldBe 1
            }
            Then("판 시작은 함께 받는다") {
                r.onMessage(host.id, startCmd(), 40)
                watcher.types() shouldContain "start"
            }
            Then("참가자 목록에는 안 들어간다") {
                val players = host.first("start")!!.path("players")
                players.size() shouldBe 2
                players.toList().map { it.asText() } shouldNotContain "watcher"
            }
        }
    }

    // ── 유휴 (T55) ──────────────────────────────────────────────────────────

    Given("판 사이 대기") {
        val r = registry()
        val host = PartyClient("h")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(), 10)

        When("ping 이 계속 오면") {
            r.onMessage(host.id, """{"t":"ping"}""", 80_000)
            r.sweepIdle(91_000)

            Then("방이 살아 있다") {
                host.closed shouldNotContain RelayCloseReason.IDLE
                r.roomCount() shouldBe 1
            }
        }

        When("ping 이 끊기면") {
            r.sweepIdle(200_000)

            Then("정리된다") {
                host.closed shouldContain RelayCloseReason.IDLE
            }
        }
    }

    // ── 좌석 토큰 배선 (TG2) ────────────────────────────────────────────────

    Given("파티 방에 앉을 때") {
        val r = signingRegistry()
        val host = PartyClient("h")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(), 10)

        Then("좌석 배정과 **같은 메시지**로 토큰이 온다") {
            host.first("joined")!!.path("token").asText().isNotEmpty() shouldBe true
        }

        When("판이 두 번 돌면") {
            r.onMessage(host.id, startCmd(), 20)
            r.onMessage(host.id, """{"t":"done"}""", 30)
            r.onMessage(host.id, startCmd(), 40)

            Then("판마다 새 토큰이 나간다 — 지난 판 토큰으로 제출할 수 없다") {
                val tokens = host.all("start").map { it.path("token").asText() }
                tokens.size shouldBe 2
                (tokens[0] == tokens[1]) shouldBe false
            }
        }
    }

    Given("관전자") {
        val r = signingRegistry()
        val host = PartyClient("h")
        r.onOpen(host.peer, "party", 0)
        r.onMessage(host.id, create(), 10)
        val watcher = PartyClient("w")
        r.onOpen(watcher.peer, "party", 20)
        r.onMessage(watcher.id, enter(code(host), spectate = true), 20)

        Then("토큰을 받지 못한다 — 좌석이 없으면 제출할 수단이 없다") {
            watcher.first("joined")!!.path("token").asText() shouldBe ""
            r.onMessage(host.id, startCmd(), 30)
            watcher.first("start")!!.path("token").asText() shouldBe ""
        }
    }
})
