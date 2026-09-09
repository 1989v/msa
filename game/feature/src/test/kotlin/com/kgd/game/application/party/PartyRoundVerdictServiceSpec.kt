package com.kgd.game.application.party

import com.kgd.common.exception.BusinessException
import com.kgd.game.application.party.port.PartyRoomView
import com.kgd.game.application.party.port.PartySeatQueryPort
import com.kgd.game.application.party.port.SeatClaim
import com.kgd.game.application.party.service.PartyRoundVerdictService
import com.kgd.game.application.party.service.PartySeatGuard
import com.kgd.game.application.party.usecase.SubmitRoundHashUseCase
import com.kgd.game.infrastructure.party.HmacPartySeatTokenService
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe

/** ADR-0092 SR-6 — 결과 해시 다수결. 실제 서명 컴포넌트를 배선한 채로 돈다. */
private const val VDKEY = "party-verdict-spec-signing-key32"
private const val VDROOM = "HASH01"
private const val VDCREATED = 900L
private val VDsigner = HmacPartySeatTokenService(VDKEY)

private class VDRooms(var seats: Map<Int, Int> = mapOf(0 to 1, 1 to 1, 2 to 1)) : PartySeatQueryPort {
    var roundNo = 5
    override fun findRoom(code: String, gameSlug: String) =
        if (code == VDROOM) PartyRoomView(VDROOM, roundNo, true, seats, VDCREATED) else null
}

private fun VDtok(seat: Int, round: Int = 5, epoch: Int = 1) =
    VDsigner.issue(SeatClaim(VDROOM, VDCREATED, round, seat, epoch))

class PartyRoundVerdictServiceSpec : BehaviorSpec({

    fun fixture(rooms: VDRooms = VDRooms()) =
        PartyRoundVerdictService(PartySeatGuard(rooms, VDsigner)) to rooms

    fun send(svc: PartyRoundVerdictService, seat: Int, hash: String) =
        svc.execute(SubmitRoundHashUseCase.Command(VDROOM, seat, VDtok(seat), hash))

    // ── T66 — 해시 제출의 관문 (T60 이 서 있는 바닥) ───────────────────────

    Given("좌석 토큰 없이 해시를 보낼 때") {
        val (svc, _) = fixture()

        Then("거부된다 — 관문이 없으면 외부인이 다수를 쥐고 결과를 고른다") {
            shouldThrow<BusinessException> {
                svc.execute(SubmitRoundHashUseCase.Command(VDROOM, 1, "", "aaa"))
            }
        }
        Then("남의 좌석 토큰으로도 거부된다") {
            shouldThrow<BusinessException> {
                svc.execute(SubmitRoundHashUseCase.Command(VDROOM, 1, VDtok(2), "aaa"))
            }
        }
        Then("좌석 없는 사람(관전자)은 보낼 수 없다") {
            shouldThrow<BusinessException> {
                svc.execute(SubmitRoundHashUseCase.Command(VDROOM, 7, VDtok(7), "aaa"))
            }
        }
    }

    Given("한 좌석이 두 번 보낼 때") {
        val (svc, _) = fixture()

        When("같은 좌석이 다른 해시를 또 내면") {
            send(svc, 0, "aaa")
            val v = send(svc, 0, "bbb")

            Then("한 건만 센다 — 두 번째를 함께 세면 한 사람이 다수를 만든다") {
                v.submitted shouldBe 1
            }
            Then("**첫 값이 유지된다** — 바꿔치기를 허용하면 남의 해시를 보고 다수를 뒤집는다") {
                send(svc, 1, "aaa")
                val settled = send(svc, 2, "aaa")
                settled.agreed shouldBe "aaa"
                // 좌석 0 의 "bbb" 가 채택됐다면 그 좌석이 이탈로 잡혔을 것이다
                settled.diverged shouldContainExactly emptyList()
            }
        }
    }

    // ── T60 — 거짓 해시 하나로는 무효가 안 된다 ───────────────────────────

    Given("한 명이 다른 해시를 낼 때") {
        val (svc, _) = fixture()
        send(svc, 0, "same")
        send(svc, 1, "same")
        val v = send(svc, 2, "different")

        Then("판이 무효가 되지 **않는다**") {
            v.voided shouldBe false
            v.settled shouldBe true
        }
        Then("다수 해시가 방의 결과다") {
            v.agreed shouldBe "same"
        }
        Then("소수는 이탈로 표시된다 — 「내 화면이 방과 달라졌다」") {
            v.diverged shouldContainExactly listOf(2)
        }
        Then("연속 무효가 쌓이지 않는다") {
            v.consecutiveVoids shouldBe 0
            v.gameLocked shouldBe false
        }
    }

    // ── T25 — 다수가 없으면 무효, 2회 연속이면 게임 잠금 ──────────────────

    Given("2인 방에서 둘이 갈릴 때") {
        val rooms = VDRooms(seats = mapOf(0 to 1, 1 to 1))
        val (svc, _) = fixture(rooms)
        send(svc, 0, "aaa")
        val v = send(svc, 1, "bbb")

        Then("다수가 없어 무효가 된다") {
            v.voided shouldBe true
            v.agreed shouldBe null
            v.consecutiveVoids shouldBe 1
            v.gameLocked shouldBe false
        }

        When("다음 판에서도 갈리면") {
            rooms.roundNo = 6
            svc.execute(SubmitRoundHashUseCase.Command(VDROOM, 0, VDtok(0, round = 6), "ccc"))
            val again = svc.execute(SubmitRoundHashUseCase.Command(VDROOM, 1, VDtok(1, round = 6), "ddd"))

            Then("2회 연속이라 그 게임이 방에서 잠긴다") {
                again.voided shouldBe true
                again.consecutiveVoids shouldBe 2
                again.gameLocked shouldBe true
            }
        }
    }

    Given("무효 뒤에 정상 판이 오면") {
        val rooms = VDRooms(seats = mapOf(0 to 1, 1 to 1))
        val (svc, _) = fixture(rooms)
        send(svc, 0, "aaa")
        send(svc, 1, "bbb")

        When("다음 판에서 일치하면") {
            rooms.roundNo = 6
            svc.execute(SubmitRoundHashUseCase.Command(VDROOM, 0, VDtok(0, round = 6), "ok"))
            val v = svc.execute(SubmitRoundHashUseCase.Command(VDROOM, 1, VDtok(1, round = 6), "ok"))

            Then("연속 무효가 초기화된다") {
                v.voided shouldBe false
                v.agreed shouldBe "ok"
                v.consecutiveVoids shouldBe 0
            }
        }
    }

    // ── 제한 시간 마감 ─────────────────────────────────────────────────────

    Given("일부만 보낸 채 제한 시간이 지났을 때") {
        val (svc, _) = fixture()
        send(svc, 0, "aaa")
        send(svc, 1, "aaa")

        When("온 것만으로 판정하면") {
            val v = svc.settleNow(VDROOM)

            Then("다수가 있으면 결과가 선다") {
                v.settled shouldBe true
                v.agreed shouldBe "aaa"
                v.voided shouldBe false
            }
        }
    }

    Given("형식이 어긋난 해시") {
        val (svc, _) = fixture()

        Then("빈 값은 거부된다") {
            shouldThrow<BusinessException> { send(svc, 0, "") }
        }
        Then("지나치게 긴 값은 거부된다") {
            shouldThrow<BusinessException> { send(svc, 0, "x".repeat(200)) }
        }
    }
})
