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
import io.kotest.matchers.comparables.shouldBeGreaterThan
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
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

/**
 * 목표 원을 따라 그린 궤적 — 사람처럼 간격이 흔들린다.
 *
 * @param off    목표 반지름에서의 이탈(px). 0 이면 완벽히 따라 그린 것
 * @param sweep  실제로 돈 각도. 2π 미만이면 덜 그린 것
 * @param speed  구간별 속도 차이 — 한쪽에 점이 몰리게 만든다
 */
private fun SCtrace(
    n: Int = 120,
    off: Double = 0.0,
    sweep: Double = 2 * Math.PI,
    cx: Double = 500.0,
    cy: Double = 500.0,
    r: Double = 300.0,
    crowdFirstHalf: Boolean = false,
): List<TracePoint> {
    var t = 0L
    return (0 until n).map { i ->
        // 앞 절반에 점을 몰면 속도 편향이 생긴다 — 각도 칸이 그것을 무시해야 한다
        val u = if (crowdFirstHalf) {
            if (i < n * 3 / 4) (i.toDouble() / (n * 3 / 4)) * 0.5 else 0.5 + ((i - n * 3 / 4).toDouble() / (n / 4)) * 0.5
        } else {
            i.toDouble() / n
        }
        val a = u * sweep
        t += 16L + (i % 5) * 3L
        val rr = r + (if (i % 2 == 0) off else -off)
        TracePoint(cx + cos(a) * rr, cy + sin(a) * rr, t)
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
                SubmitPartyPlayUseCase.Command(SCROOM, 0, SCtok(0), Payload.Trace(SCtrace(off = 6.0))),
            )
            v.rejected.isEmpty() shouldBe true
            v.submitted shouldBe 1
        }
        Then("간격이 완벽히 균일한 합성 궤적은 거부되고 사유가 남는다") {
            val synthetic = (0 until 120).map { i ->
                val a = i * 2 * Math.PI / 120
                TracePoint(500 + cos(a) * 300, 500 + sin(a) * 300, i * 16L)
            }
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(SCROOM, 1, SCtok(1), Payload.Trace(synthetic)),
            )
            v.rejected[1] shouldBe "간격이 지나치게 균일"
        }
        Then("표본이 너무 적으면 거부된다") {
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(SCROOM, 2, SCtok(2), Payload.Trace(SCtrace(n = 5))),
            )
            v.rejected[2] shouldBe "표본 부족"
        }
    }

    // ── T17 — 원자료 상한 ─────────────────────────────────────────────────

    Given("점이 지나치게 많은 궤적") {
        val (svc, _) = fixture()
        start(svc, "circle-trace")

        Then("거부된다 — 채점 서버가 임의 크기 입력을 받지 않는다") {
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(SCROOM, 0, SCtok(0), Payload.Trace(SCtrace(n = 5_000))),
            )
            v.rejected[0] shouldBe "표본 과다"
        }
    }

    // ── OQ-2 채점식 — 목표 이탈을 잰다 ────────────────────────────────────

    Given("원그리기 판") {
        val (svc, _) = fixture()

        Then("서버가 목표 원을 낸다 — 클라이언트가 고르면 쉬운 원을 고른다") {
            val st = start(svc, "circle-trace")
            st.target shouldNotBe null
            st.target!!.r shouldBeGreaterThan 0.0
        }
        Then("7초 판에는 목표가 없다") {
            val (other, _) = fixture()
            start(other).target shouldBe null
        }
    }

    Given("목표를 잘 따라 그린 사람과 벗어난 사람") {
        val (svc, _) = fixture()
        val target = start(svc, "circle-trace").target!!

        Then("목표에 가까운 쪽이 이긴다") {
            fun send(seat: Int, off: Double) = svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, seat, SCtok(seat),
                    Payload.Trace(SCtrace(off = off, cx = target.cx, cy = target.cy, r = target.r)),
                ),
            )
            send(0, 2.0)
            send(1, 30.0)
            val v = send(2, 10.0)
            v.ranking shouldContainExactly listOf(0, 2, 1)
        }
    }

    Given("목표에서 통째로 벗어난 완벽한 원") {
        val (svc, _) = fixture()
        val target = start(svc, "circle-trace").target!!

        Then("**만점을 못 받는다** — 「내가 그린 게 원인가」가 아니라 「목표를 따라갔나」를 잰다") {
            // 자기 일관성만 재는 식이면 이쪽이 이긴다: 반지름이 완벽히 고르기 때문이다
            svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 0, SCtok(0),
                    Payload.Trace(SCtrace(off = 0.0, cx = target.cx, cy = target.cy, r = target.r * 0.6)),
                ),
            )
            // 목표 위에서 조금 흔들린 쪽
            svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 1, SCtok(1),
                    Payload.Trace(SCtrace(off = 8.0, cx = target.cx, cy = target.cy, r = target.r)),
                ),
            )
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 2, SCtok(2),
                    Payload.Trace(SCtrace(off = 40.0, cx = target.cx, cy = target.cy, r = target.r)),
                ),
            )
            v.ranking.first() shouldBe 1
        }
    }

    Given("반원만 그린 사람") {
        val (svc, _) = fixture()
        val target = start(svc, "circle-trace").target!!

        Then("한 바퀴 그린 사람에게 진다 — 빈 칸이 최대 이탈로 잡힌다") {
            // 반원을 완벽히 그려도 남은 절반이 최대 이탈이라, 한 바퀴를 적당히 그린 쪽이 이긴다.
            // 「짧은 호가 반지름이 고르기 쉬워 이긴다」는 자유 그리기 식의 구멍이 여기서는 안 생긴다.
            svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 0, SCtok(0),
                    Payload.Trace(SCtrace(off = 0.0, sweep = Math.PI, cx = target.cx, cy = target.cy, r = target.r)),
                ),
            )
            val v = svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 1, SCtok(1),
                    Payload.Trace(SCtrace(off = 12.0, cx = target.cx, cy = target.cy, r = target.r)),
                ),
            )
            svc.execute(SCROOM).ranking.first() shouldBe 1
            v.submitted shouldBe 2
        }
    }

    Given("어려운 구간을 건너뛸 유혹") {
        fun scoreOf(sweep: Double, offRatio: Double): Double {
            val (svc, _) = fixture()
            val t = start(svc, "circle-trace").target!!
            svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 0, SCtok(0),
                    Payload.Trace(
                        SCtrace(n = 200, off = offRatio * t.r, sweep = sweep, cx = t.cx, cy = t.cy, r = t.r),
                    ),
                ),
            )
            return svc.execute(SCROOM).scores[0]!!
        }

        Then("**건너뛰는 것이 최악으로 그리는 것보다 낫지 않다** — 빈 칸 벌점이 그릴 수 있는 최악과 같다") {
            // 0.15R 은 한 칸이 0점이 되는 이탈이자 빈 칸의 벌점이다. 그 값으로 한 바퀴 그린 것과
            // 절반을 건너뛴 것이 같은 점수여야 한다 — 건너뛰어서 앞서면 못 그리는 구간을 빼는 것이
            // 전략이 된다.
            // 실측: 0.0 vs 7.8e-14 — 같은 값이다(부동소수 잔차)
            scoreOf(2 * Math.PI, 0.15) shouldBe (scoreOf(Math.PI, 0.15) plusOrMinus 0.001)
        }
        Then("최악보다 나은 정도로라도 그리면 건너뛰는 것보다 낫다") {
            // 실측: 한 바퀴 33.3 vs 절반 15.0 — 그리는 쪽이 두 배 낫다
            (scoreOf(2 * Math.PI, 0.10) > scoreOf(Math.PI, 0.10)) shouldBe true
        }
    }

    Given("표본 밀도가 다른 두 궤적") {
        Then("**점 수가 점수를 안 바꾼다** — 사이를 이어 채우므로 빠르게 지나간 구간도 지나간 것이다") {
            fun scoreOf(n: Int): Double {
                val (svc, _) = fixture()
                val t = start(svc, "circle-trace").target!!
                svc.execute(
                    SubmitPartyPlayUseCase.Command(
                        SCROOM, 0, SCtok(0),
                        Payload.Trace(SCtrace(n = n, off = 0.0, cx = t.cx, cy = t.cy, r = t.r)),
                    ),
                )
                return svc.execute(SCROOM).scores[0]!!
            }
            // 실측: 표본을 3배로 늘려도 같은 값이 나온다. 이어 채우지 않으면 성긴 쪽이
            // 「안 그린 칸」 때문에 손해를 본다 — 속도가 실력처럼 재지는 바로 그 문제다.
            // cos²+sin² 이 정확히 1 이 아니라 완벽한 원도 100.0 이 아니다 — 허용오차로 본다
            scoreOf(120) shouldBe (scoreOf(400) plusOrMinus 0.001)
        }
    }

    Given("점수 스케일") {
        Then("잘 그린 것과 대충 그린 것이 숫자로 구분된다") {
            fun scoreOf(off: Double, sweep: Double = 2 * Math.PI): Double {
                val (svc, _) = fixture()
                val t = start(svc, "circle-trace").target!!
                svc.execute(
                    SubmitPartyPlayUseCase.Command(
                        SCROOM, 0, SCtok(0),
                        Payload.Trace(SCtrace(n = 200, off = off * t.r, sweep = sweep, cx = t.cx, cy = t.cy, r = t.r)),
                    ),
                )
                return svc.execute(SCROOM).scores[0]!!
            }
            // 실측값 — 허용치를 0.08 로 뒀을 때는 이 셋이 전부 92~98 에 뭉쳐 있었다
            scoreOf(0.0) shouldBe (100.0 plusOrMinus 0.001)
            (scoreOf(0.02) > 80.0) shouldBe true
            (scoreOf(0.04) in 65.0..85.0) shouldBe true
            (scoreOf(0.08) in 40.0..60.0) shouldBe true
        }
        Then("목표에서 통째로 벗어나면 0 점이다") {
            val (svc, _) = fixture()
            val t = start(svc, "circle-trace").target!!
            svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 0, SCtok(0),
                    Payload.Trace(SCtrace(n = 200, off = 0.0, cx = t.cx, cy = t.cy, r = t.r * 0.6)),
                ),
            )
            svc.execute(SCROOM).scores[0]!! shouldBe (0.0 plusOrMinus 0.001)
        }
        Then("진행 중에는 점수가 안 보인다 — 남의 점수를 보고 언제 낼지 고르면 안 된다") {
            val (svc, _) = fixture()
            val t = start(svc, "circle-trace").target!!
            val mid = svc.execute(
                SubmitPartyPlayUseCase.Command(
                    SCROOM, 0, SCtok(0),
                    Payload.Trace(SCtrace(off = 5.0, cx = t.cx, cy = t.cy, r = t.r)),
                ),
            )
            mid.open shouldBe true
            mid.scores.isEmpty() shouldBe true
        }
        Then("7초 판은 점수를 안 낸다 — 오차 초를 그대로 보인다") {
            val (svc, clock) = fixture()
            start(svc)
            clock.now = 7_000; stop(svc, 0)
            clock.now = 7_100; stop(svc, 1)
            clock.now = 7_200
            stop(svc, 2).scores.isEmpty() shouldBe true
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
