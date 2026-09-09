package com.kgd.game.application.party

import com.kgd.common.exception.BusinessException
import com.kgd.game.application.party.port.PartyRoomView
import com.kgd.game.application.party.port.PartySeatQueryPort
import com.kgd.game.application.party.port.SeatClaim
import com.kgd.game.application.party.service.PartySeatGuard
import com.kgd.game.application.party.service.PartyScoringService
import com.kgd.game.application.party.usecase.StartPartyPlayUseCase
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase.Payload
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase.TracePoint
import com.kgd.game.infrastructure.party.HmacPartySeatTokenService
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import kotlin.math.cos
import kotlin.math.sin

/** ADR-0092 SR-7 — 참여형 채점. 실제 서명 컴포넌트를 배선한 채로 돈다. */
private const val SCKEY = "party-scoring-spec-signing-key32"
private const val SCROOM = "SCORE1"
private const val SCCREATED = 500L
private val SCsigner = HmacPartySeatTokenService(SCKEY)

private class SCRooms(seats: Map<Int, Int> = mapOf(0 to 1, 1 to 1, 2 to 1)) : PartySeatQueryPort {
    val map = seats
    override fun findRoom(code: String, gameSlug: String) =
        if (code == SCROOM) PartyRoomView(SCROOM, 2, false, map, SCCREATED) else null
}

private fun SCtok(seat: Int) = SCsigner.issue(SeatClaim(SCROOM, SCCREATED, 2, seat, 1))

/** 시계를 손으로 돌린다 — 7초를 실제로 기다리지 않는다 */
private class SCClock(var now: Long = 0L) : () -> Long {
    override fun invoke() = now
}

/** 사람이 그린 것처럼 간격이 흔들리는 원 */
private fun SCcircle(n: Int = 60, radius: Double = 100.0, wobble: Double = 0.0): List<TracePoint> {
    var t = 0L
    return (0 until n).map { i ->
        val a = i * 2 * Math.PI / n
        t += 16L + (i % 5) * 3L
        TracePoint(cos(a) * (radius + if (i % 2 == 0) wobble else -wobble), sin(a) * radius, t)
    }
}

class PartyScoringServiceSpec : BehaviorSpec({

    fun fixture(clock: SCClock = SCClock(), rooms: SCRooms = SCRooms()): Pair<PartyScoringService, SCClock> =
        PartyScoringService(PartySeatGuard(rooms, SCsigner), clock) to clock

    fun start(svc: PartyScoringService, game: String = "seven-seconds") =
        svc.execute(StartPartyPlayUseCase.Command(SCROOM, 0, SCtok(0), game))

    fun stop(svc: PartyScoringService, seat: Int) =
        svc.execute(SubmitPartyPlayUseCase.Command(SCROOM, seat, SCtok(seat), Payload.StopNow))

    // ── T52 — 제출 DTO 에 점수 필드가 없다 ────────────────────────────────

    Given("제출 payload 의 모양") {
        Then("점수를 담을 자리가 아예 없다 — 폴백할 값이 없으면 폴백하는 코드를 쓸 수 없다") {
            val fields = Payload.Trace::class.java.declaredFields.map { it.name } +
                Payload.StopNow::class.java.declaredFields.map { it.name }
            fields.none { it.contains("score", ignoreCase = true) } shouldBe true
            // 7초는 클라이언트 시각조차 안 받는다
            Payload.StopNow::class.java.declaredFields.none {
                it.name.contains("time", ignoreCase = true) || it.name.contains("at", ignoreCase = true)
            } shouldBe true
        }
    }

    // ── 7초 — 서버 시계로 잰다 ─────────────────────────────────────────────

    Given("7초 맞추기") {
        val (svc, clock) = fixture()
        start(svc)

        When("세 사람이 각각 다른 시점에 멈추면") {
            clock.now = 7_050; stop(svc, 0)   // 오차 50
            clock.now = 6_900; stop(svc, 1)   // 오차 100
            clock.now = 7_010
            val last = stop(svc, 2)           // 오차 10

            Then("7초에 가까운 순서가 된다 — 클라이언트가 보낸 값이 아니라 서버 시계다") {
                last.open shouldBe false
                last.ranking shouldContainExactly listOf(2, 0, 1)
            }
        }
    }

    // ── T13 — 멱등 ─────────────────────────────────────────────────────────

    Given("같은 좌석이 두 번 제출할 때") {
        val (svc, clock) = fixture()
        start(svc)
        clock.now = 7_000
        stop(svc, 0)

        When("한참 뒤에 다시 내면") {
            clock.now = 9_000
            val again = stop(svc, 0)

            Then("**첫 값이 유지되고 성공으로 응답한다**") {
                again.submitted shouldBe 1
                clock.now = 7_500; stop(svc, 1)
                clock.now = 7_600
                val done = stop(svc, 2)
                // 좌석 0 이 9초가 아니라 7초로 남아 있어야 1등이다
                done.ranking.first() shouldBe 0
            }
        }
    }

    // ── T15 — 마감은 항상 결과를 만든다 ────────────────────────────────────

    Given("두 사람이 미제출인 채로 마감할 때") {
        val (svc, clock) = fixture()
        start(svc)
        clock.now = 7_000
        stop(svc, 0)

        When("방장이 마감하면") {
            val v = svc.execute(SCROOM)

            Then("제출자가 앞, 미제출자가 뒤에 온다 — 자리가 멈추지 않는다") {
                v.open shouldBe false
                v.voided shouldBe false
                v.ranking.first() shouldBe 0
                v.ranking.size shouldBe 3
                v.ranking.drop(1).toSet() shouldBe setOf(1, 2)
            }
        }
    }

    Given("전원이 미제출인 채로 마감할 때") {
        val (svc, _) = fixture()
        start(svc)

        Then("판이 무효가 된다") {
            val v = svc.execute(SCROOM)
            v.voided shouldBe true
            v.ranking.size shouldBe 0
        }
    }

    // ── T14 — 채점 실패 시 폴백 없음 ──────────────────────────────────────

    Given("채점을 이어갈 수 없을 때") {
        val (svc, clock) = fixture()
        start(svc)
        clock.now = 7_000
        stop(svc, 0)

        Then("판을 무효로 하고 순위를 비운다 — 클라이언트 값으로 채우지 않는다") {
            val v = svc.void(SCROOM)
            v.voided shouldBe true
            v.ranking.size shouldBe 0
        }
    }

    // ── T16 — 개연성 검사 ─────────────────────────────────────────────────

    Given("원그리기 궤적") {
        val (svc, _) = fixture()
        start(svc, "circle-trace")

        Then("사람이 그린 듯한 궤적은 채점된다") {
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(SCROOM, 0, SCtok(0), Payload.Trace(SCcircle(wobble = 3.0))),
            )
            v.rejected.isEmpty() shouldBe true
            v.submitted shouldBe 1
        }
        Then("간격이 완벽히 균일한 합성 궤적은 거부되고 사유가 남는다") {
            val synthetic = (0 until 60).map { i ->
                val a = i * 2 * Math.PI / 60
                TracePoint(cos(a) * 100, sin(a) * 100, i * 16L)
            }
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(SCROOM, 1, SCtok(1), Payload.Trace(synthetic)),
            )
            v.rejected[1] shouldBe "간격이 지나치게 균일"
        }
        Then("표본이 너무 적으면 거부된다") {
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(SCROOM, 2, SCtok(2), Payload.Trace(SCcircle(n = 5))),
            )
            v.rejected[2] shouldBe "표본 부족"
        }
    }

    // ── T17 — 원자료 상한 ─────────────────────────────────────────────────

    Given("점이 지나치게 많은 궤적") {
        val (svc, _) = fixture()
        start(svc, "circle-trace")

        Then("거부된다 — 채점 서버가 임의 크기 입력을 받지 않는다") {
            val huge = SCcircle(n = 5_000)
            val v = svc.execute(SubmitPartyPlayUseCase.Command(SCROOM, 0, SCtok(0), Payload.Trace(huge)))
            v.rejected[0] shouldBe "표본 과다"
        }
    }

    // ── 정확도 판정 ────────────────────────────────────────────────────────

    Given("정확한 원과 찌그러진 원") {
        val (svc, _) = fixture()
        start(svc, "circle-trace")

        Then("정확한 쪽이 이긴다") {
            svc.execute(SubmitPartyPlayUseCase.Command(SCROOM, 0, SCtok(0), Payload.Trace(SCcircle(wobble = 1.0))))
            svc.execute(SubmitPartyPlayUseCase.Command(SCROOM, 1, SCtok(1), Payload.Trace(SCcircle(wobble = 25.0))))
            val v = svc.execute(SubmitPartyPlayUseCase.Command(SCROOM, 2, SCtok(2), Payload.Trace(SCcircle(wobble = 8.0))))
            v.ranking shouldContainExactly listOf(0, 2, 1)
        }
    }

    // ── 관문 ───────────────────────────────────────────────────────────────

    Given("토큰 없는 제출") {
        val (svc, _) = fixture()
        start(svc)

        Then("거부된다") {
            shouldThrow<BusinessException> {
                svc.execute(SubmitPartyPlayUseCase.Command(SCROOM, 1, "", Payload.StopNow))
            }
        }
    }

    Given("방장이 아닌 사람이 판을 열려 할 때") {
        val (svc, _) = fixture()

        Then("거부된다") {
            shouldThrow<BusinessException> {
                svc.execute(StartPartyPlayUseCase.Command(SCROOM, 1, SCtok(1), "seven-seconds"))
            }
        }
    }
})
