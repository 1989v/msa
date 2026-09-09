package com.kgd.game.application.party

import com.kgd.game.application.party.port.PartyMetricsPort
import com.kgd.game.application.party.port.PartyRoomView
import com.kgd.game.application.party.port.PartySeatQueryPort
import com.kgd.game.application.party.port.SeatClaim
import com.kgd.game.application.party.service.PartyRoundVerdictService
import com.kgd.game.application.party.service.PartyScoringService
import com.kgd.game.application.party.service.PartySeatGuard
import com.kgd.game.application.party.usecase.StartPartyPlayUseCase
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase.Payload
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase.TracePoint
import com.kgd.game.application.party.usecase.SubmitRoundHashUseCase
import com.kgd.game.infrastructure.party.HmacPartySeatTokenService
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import kotlin.math.cos
import kotlin.math.sin

/**
 * ADR-0092 SR-9 — 관측.
 *
 * **「불렀다」가 아니라 「무엇이 몇 번」을 본다.** 그리고 별칭이 어떤 값에도 안 들어가는지를
 * 함께 잰다 — 실명이 들어올 수 있는 자유 텍스트라, 태그로 붙는 순간 그 관측이 원장이 된다.
 */
private const val MKEY = "party-metrics-spec-key-32-bytes!"
private const val MROOM = "METRIC"
private val Msigner = HmacPartySeatTokenService(MKEY)

private class MRooms(private val seats: Map<Int, Int> = mapOf(0 to 1, 1 to 1, 2 to 1)) : PartySeatQueryPort {
    override fun findRoom(code: String, gameSlug: String) =
        PartyRoomView(MROOM, 4, true, seats, 300L)
}

private fun Mtok(seat: Int) = Msigner.issue(SeatClaim(MROOM, 300L, 4, seat, 1))

/** 부른 것을 그대로 모은다 — 값까지 남겨야 「무엇이 몇 번」을 잴 수 있다 */
private class RecordingMetrics : PartyMetricsPort {
    val rejected = mutableListOf<String>()
    var divergedTotal = 0
    var voided = 0
    var settled = 0

    override fun scoringRejected(reason: String) { rejected += reason }
    override fun hashDiverged(count: Int) { divergedTotal += count }
    override fun roundVoided() { voided += 1 }
    override fun roundSettled() { settled += 1 }

    /** 별칭이 새는지 — 태그로 넘어온 문자열 전부를 훑는다 */
    fun allStrings(): List<String> = rejected
}

private fun trace(n: Int, off: Double, cx: Double, cy: Double, r: Double): List<TracePoint> {
    var t = 0L
    return (0 until n).map { i ->
        val a = (i.toDouble() / n) * 2 * Math.PI
        t += 16L + (i % 5) * 3L
        val rr = r + (if (i % 2 == 0) off else -off)
        TracePoint(cx + cos(a) * rr, cy + sin(a) * rr, t)
    }
}

class PartyMetricsSpec : BehaviorSpec({

    Given("채점 거부") {
        val m = RecordingMetrics()
        val svc = PartyScoringService(PartySeatGuard(MRooms(), Msigner), System::currentTimeMillis, m)
        val t = svc.execute(StartPartyPlayUseCase.Command(MROOM, 0, Mtok(0), "circle-trace")).target!!

        When("합성 궤적과 표본 부족이 각각 오면") {
            val synthetic = (0 until 120).map { i ->
                val a = i * 2 * Math.PI / 120
                TracePoint(t.cx + cos(a) * t.r, t.cy + sin(a) * t.r, i * 16L)
            }
            svc.execute(SubmitPartyPlayUseCase.Command(MROOM, 0, Mtok(0), Payload.Trace(synthetic)))
            svc.execute(
                SubmitPartyPlayUseCase.Command(
                    MROOM, 1, Mtok(1), Payload.Trace(trace(5, 0.0, t.cx, t.cy, t.r)),
                ),
            )

            Then("**사유별로** 센다 — 「거부 3건」만으로는 무엇을 고쳐야 할지 모른다") {
                m.rejected shouldContainExactly listOf("간격이 지나치게 균일", "표본 부족")
            }
        }
    }

    Given("전원 미제출로 판이 무효가 될 때") {
        val m = RecordingMetrics()
        val svc = PartyScoringService(PartySeatGuard(MRooms(), Msigner), System::currentTimeMillis, m)
        svc.execute(StartPartyPlayUseCase.Command(MROOM, 0, Mtok(0), "seven-seconds"))

        Then("무효가 세어지고 확정은 안 세어진다 — 무효율의 분모가 어긋나면 안 된다") {
            svc.execute(MROOM)
            m.voided shouldBe 1
            m.settled shouldBe 0
        }
    }

    Given("결과 해시가 갈릴 때") {
        val m = RecordingMetrics()
        val svc = PartyRoundVerdictService(PartySeatGuard(MRooms(), Msigner), m)

        When("셋 중 하나가 다른 값을 내면") {
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 0, Mtok(0), "same"))
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 1, Mtok(1), "same"))
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 2, Mtok(2), "other"))

            Then("갈린 좌석 수만큼 센다 — 한 명과 둘은 다른 사건이다") {
                m.divergedTotal shouldBe 1
            }
            Then("다수가 있으므로 확정으로 센다") {
                m.settled shouldBe 1
                m.voided shouldBe 0
            }
        }
    }

    Given("둘이 갈릴 때") {
        val m = RecordingMetrics()
        val svc = PartyRoundVerdictService(
            PartySeatGuard(MRooms(mapOf(0 to 1, 1 to 1, 2 to 1, 3 to 1)), Msigner), m,
        )

        Then("**둘로 센다** — 「한 건」으로 뭉개면 갈림의 크기를 못 본다") {
            // 하나만 갈리는 판으로 재면 size 와 상수 1 이 같아 「좌석 수만큼」이 안 물린다
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 0, Mtok(0), "same"))
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 1, Mtok(1), "same"))
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 2, Mtok(2), "x"))
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 3, Mtok(3), "y"))
            m.divergedTotal shouldBe 2
        }
    }

    Given("2인 방에서 다수가 없을 때") {
        val m = RecordingMetrics()
        val svc = PartyRoundVerdictService(PartySeatGuard(MRooms(mapOf(0 to 1, 1 to 1)), Msigner), m)

        Then("무효로 센다") {
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 0, Mtok(0), "a"))
            svc.execute(SubmitRoundHashUseCase.Command(MROOM, 1, Mtok(1), "b"))
            m.voided shouldBe 1
            m.settled shouldBe 0
        }
    }

    Given("SR-9.9 — 별칭이 관측에 안 들어간다") {
        val m = RecordingMetrics()
        val svc = PartyScoringService(PartySeatGuard(MRooms(), Msigner), System::currentTimeMillis, m)
        val t = svc.execute(StartPartyPlayUseCase.Command(MROOM, 0, Mtok(0), "circle-trace")).target!!

        Then("거부 사유는 고정된 말이라 사람 이름이 섞일 자리가 없다") {
            svc.execute(
                SubmitPartyPlayUseCase.Command(
                    MROOM, 0, Mtok(0), Payload.Trace(trace(5, 0.0, t.cx, t.cy, t.r)),
                ),
            )
            // 사유는 코드가 정한 몇 개뿐이다 — 사용자 입력이 그대로 태그가 되면 카디널리티도
            // 터지고 별칭도 샌다
            val allowed = setOf("표본 부족", "표본 과다", "너무 빠름", "간격이 지나치게 균일")
            m.allStrings().all { it in allowed } shouldBe true
        }
    }

    Given("관측기가 없을 때") {
        Then("판은 그대로 돈다 — 관측이 기능의 전제는 아니다") {
            val svc = PartyScoringService(PartySeatGuard(MRooms(), Msigner))
            svc.execute(StartPartyPlayUseCase.Command(MROOM, 0, Mtok(0), "seven-seconds"))
            svc.execute(MROOM).voided shouldBe true
        }
    }
})
