package com.kgd.game.application.party

import com.kgd.common.exception.BusinessException
import com.kgd.game.application.party.port.PartyRoomView
import com.kgd.game.application.party.port.PartySeatQueryPort
import com.kgd.game.application.party.service.PartySeatGuard
import com.kgd.game.application.party.service.PartyVoteService
import com.kgd.game.application.party.usecase.CastBallotUseCase
import com.kgd.game.application.party.usecase.OpenVoteUseCase
import com.kgd.game.application.party.usecase.ViewVoteUseCase
import com.kgd.game.infrastructure.party.HmacPartySeatTokenService
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.maps.shouldBeEmpty as mapShouldBeEmpty
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

/**
 * ADR-0092 SR-5 — 익명 투표.
 *
 * **실제 서명 컴포넌트를 배선한 채로 돈다.** 관문을 흉내 내면 「토큰 없이도 통과한다」는
 * 회귀를 못 잡는다.
 */
private const val KEY = "party-vote-spec-signing-key-32b!"
private const val ROOM = "ABC123"
private const val CREATED = 1_000L

private val signer = HmacPartySeatTokenService(KEY)

/** 좌석 셋이 앉은 방. 세대는 전부 1 */
private class FakeRooms(private val seats: Map<Int, Int> = mapOf(0 to 1, 1 to 1, 2 to 1)) : PartySeatQueryPort {
    var roundNo = 3
    override fun findRoom(code: String, gameSlug: String): PartyRoomView? =
        if (code == ROOM) PartyRoomView(ROOM, roundNo, false, seats, CREATED) else null
}

private fun tokenFor(seat: Int, round: Int = 3, epoch: Int = 1) =
    signer.issue(com.kgd.game.application.party.port.SeatClaim(ROOM, CREATED, round, seat, epoch))

private val GAMES = listOf("seven-seconds", "circle-trace")

class PartyVoteServiceSpec : BehaviorSpec({

    fun fixture(rooms: FakeRooms = FakeRooms()): PartyVoteService =
        PartyVoteService(PartySeatGuard(rooms, signer))

    fun open(svc: PartyVoteService) =
        svc.execute(OpenVoteUseCase.Command(ROOM, 0, tokenFor(0), GAMES))

    fun cast(svc: PartyVoteService, seat: Int, choice: String) =
        svc.execute(CastBallotUseCase.Command(ROOM, seat, tokenFor(seat), choice))

    // ── T20 — 관문 ─────────────────────────────────────────────────────────

    Given("좌석 토큰 없이 투표하려 할 때") {
        val svc = fixture()
        open(svc)

        Then("거부된다") {
            shouldThrow<BusinessException> {
                svc.execute(CastBallotUseCase.Command(ROOM, 1, "", GAMES[0]))
            }
        }
        Then("남의 좌석 토큰으로도 거부된다") {
            shouldThrow<BusinessException> {
                svc.execute(CastBallotUseCase.Command(ROOM, 1, tokenFor(2), GAMES[0]))
            }
        }
        Then("좌석에 아무도 없으면 거부된다") {
            shouldThrow<BusinessException> {
                svc.execute(CastBallotUseCase.Command(ROOM, 9, tokenFor(9), GAMES[0]))
            }
        }
    }

    Given("한 좌석이 두 번 던질 때") {
        val svc = fixture()
        open(svc)

        When("같은 좌석이 두 번 내면") {
            cast(svc, 1, GAMES[0])
            val v = cast(svc, 1, GAMES[1])

            Then("한 표만 센다") {
                v.submitted shouldBe 1
            }
            Then("**첫 표가 유지된다** — 바꿔치기를 허용하면 제출 수를 보고 뒤집는 흐름이 생긴다") {
                cast(svc, 0, GAMES[0])
                val closed = cast(svc, 2, GAMES[0])
                // 좌석 1 이 두 번째로 낸 GAMES[1] 이 세어졌다면 집계가 2:1 이 아니라 3:0 이 안 된다
                closed.tally shouldBe mapOf(GAMES[0] to 3)
            }
        }
    }

    // ── T18 · T19 — 익명성과 진행 중 비공개 ────────────────────────────────

    Given("투표가 진행 중일 때") {
        val svc = fixture()
        open(svc)
        cast(svc, 0, GAMES[0])

        Then("제출 수만 보이고 득표 수는 안 보인다") {
            val v = svc.execute(ViewVoteUseCase.Command(ROOM, 0, tokenFor(0)))
            v.submitted shouldBe 1
            v.eligible shouldBe 3
            v.tally.mapShouldBeEmpty()
            v.winner shouldBe null
        }
        Then("**방장이 봐도 같다** — (좌석 → 선택)이 응답 타입에 없다") {
            // 방장 응답과 참가자 응답이 같은 타입이라 「방장에게만 상세」가 구현 불가다.
            val host = svc.execute(ViewVoteUseCase.Command(ROOM, 0, tokenFor(0)))
            val guest = svc.execute(ViewVoteUseCase.Command(ROOM, 1, tokenFor(1)))
            host shouldBe guest
        }
        Then("응답 어디에도 좌석 번호가 없다") {
            val v = svc.execute(ViewVoteUseCase.Command(ROOM, 0, tokenFor(0)))
            val fields = listOf(v.open, v.candidates, v.submitted, v.eligible, v.tally, v.winner)
            // 좌석은 Int 라 값으로는 구분이 안 되므로, 구조로 본다 —
            // 응답에 좌석을 담을 수 있는 자리(Map<Int,*> 나 List<Int>)가 아예 없다.
            fields.none { it is Map<*, *> && it.keys.any { k -> k is Int } } shouldBe true
            fields.none { it is List<*> && it.any { e -> e is Int } } shouldBe true
        }
    }

    // ── T50 — 마감 판정 ────────────────────────────────────────────────────

    Given("전원이 투표했을 때") {
        val svc = fixture()
        open(svc)
        cast(svc, 0, GAMES[0])
        cast(svc, 1, GAMES[0])
        val last = cast(svc, 2, GAMES[1])

        Then("자동 마감되고 최다득표가 이긴다") {
            last.open shouldBe false
            last.winner shouldBe GAMES[0]
            last.tally shouldBe mapOf(GAMES[0] to 2, GAMES[1] to 1)
        }
    }

    Given("아무도 투표하지 않고 마감할 때") {
        val svc = fixture()
        open(svc)

        When("방장이 마감하면") {
            val v = svc.closeNow(ROOM)

            Then("후보 중 하나가 무작위로 정해진다 — 자리가 멈추지 않는다") {
                v.open shouldBe false
                v.winner shouldNotBe null
                (v.winner in GAMES) shouldBe true
                v.tally.mapShouldBeEmpty()
            }
        }
    }

    Given("동표로 끝났을 때") {
        Then("무작위로 갈리고 항상 후보 안에서 나온다") {
            val winners = (1..40).map {
                val svc = fixture()
                open(svc)
                cast(svc, 0, GAMES[0])
                cast(svc, 1, GAMES[1])
                svc.closeNow(ROOM).winner
            }
            winners.all { it in GAMES } shouldBe true
            // 40판이면 한쪽만 나올 확률이 2^-39 다 — 무작위가 실제로 도는지 본다
            winners.distinct().size shouldBe 2
        }
    }

    // ── 진행 권한 ──────────────────────────────────────────────────────────

    Given("방장이 아닌 사람이 투표를 열려 할 때") {
        val svc = fixture()

        Then("거부된다") {
            shouldThrow<BusinessException> {
                svc.execute(OpenVoteUseCase.Command(ROOM, 1, tokenFor(1), GAMES))
            }
        }
    }

    Given("후보가 하나뿐일 때") {
        val svc = fixture()

        Then("열리지 않는다 — 고를 것이 없는 투표는 투표가 아니다") {
            shouldThrow<BusinessException> {
                svc.execute(OpenVoteUseCase.Command(ROOM, 0, tokenFor(0), listOf(GAMES[0])))
            }
        }
    }

    Given("후보에 없는 선택") {
        val svc = fixture()
        open(svc)

        Then("거부된다") {
            shouldThrow<BusinessException> { cast(svc, 1, "not-a-candidate") }
        }
    }

    Given("판이 넘어간 뒤의 옛 토큰") {
        val rooms = FakeRooms()
        val svc = fixture(rooms)
        val old = tokenFor(0, round = 3)
        rooms.roundNo = 4

        Then("거부된다 — 토큰에 판 번호가 들어 있다") {
            shouldThrow<BusinessException> {
                svc.execute(OpenVoteUseCase.Command(ROOM, 0, old, GAMES))
            }
        }
    }
})
