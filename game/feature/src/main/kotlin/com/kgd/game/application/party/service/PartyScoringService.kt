package com.kgd.game.application.party.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.party.usecase.ClosePartyPlayUseCase
import com.kgd.game.application.party.usecase.RoundStanding
import com.kgd.game.application.party.usecase.StartPartyPlayUseCase
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot

private val log = KotlinLogging.logger {}

/**
 * 참여형 채점 (ADR-0092 · SR-7).
 *
 * ## 신뢰 경계 — 「서버 채점이므로 위조 불가」가 아니다
 * - **7초**: 서버 시계로 잰다. 클라이언트가 보내는 것은 「지금 멈췄다」는 사실뿐이고 시각이 아니다
 * - **원그리기**: 궤적을 서버가 재현할 수 없다. 얻는 것은 위조 방지가 아니라 **개연성 검사**다 —
 *   표본 간격 분포 · 손 떨림 분산 · 총 소요 시간. 합성 궤적은 대개 여기서 걸리고,
 *   **완전한 방어는 없다**
 *
 * 상태는 메모리에만 든다. 판이 끝나면 남기지 않는다 (SR-9).
 */
@Service
class PartyScoringService(
    private val guard: PartySeatGuard,
    private val clock: () -> Long = System::currentTimeMillis,
) : StartPartyPlayUseCase, SubmitPartyPlayUseCase, ClosePartyPlayUseCase {

    private val rounds = ConcurrentHashMap<String, PlayRound>()
    private val random = SecureRandom()

    private class PlayRound(val game: String, val startedMs: Long, val eligible: Set<Int>) {
        /** 좌석 → 점수(작을수록 좋다). **클라이언트가 보낸 값이 아니라 서버가 계산한 값** */
        val scores = ConcurrentHashMap<Int, Double>()
        val rejected = ConcurrentHashMap<Int, String>()
        var closed = false
        var voided = false
        var ranking: List<Int> = emptyList()
    }

    override fun execute(command: StartPartyPlayUseCase.Command): RoundStanding {
        val seat = guard.verify(command.roomCode, command.seat, command.token)
        if (seat.seat != seat.room.occupiedSeats.keys.minOrNull()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "방장만 판을 열 수 있습니다")
        }
        val round = PlayRound(command.game, clock(), seat.room.occupiedSeats.keys.toSet())
        rounds[seat.room.code] = round
        return view(round)
    }

    override fun execute(command: SubmitPartyPlayUseCase.Command): RoundStanding {
        val seat = guard.verify(command.roomCode, command.seat, command.token)
        val round = rounds[seat.room.code]
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "진행 중인 판이 없습니다")
        if (round.closed) throw BusinessException(ErrorCode.INVALID_INPUT, "이미 마감된 판입니다")

        // 멱등 — 재제출은 첫 값을 유지하고 **성공으로 응답한다**. 거부로 구현하면
        // 네트워크 재시도가 실패로 보이고, 덮어쓰기로 구현하면 재시도가 점수를 바꾼다.
        if (round.scores.containsKey(seat.seat) || round.rejected.containsKey(seat.seat)) {
            return view(round)
        }

        when (val p = command.payload) {
            is SubmitPartyPlayUseCase.Payload.StopNow -> {
                val elapsed = clock() - round.startedMs
                round.scores[seat.seat] = abs(elapsed - TARGET_MS).toDouble()
            }
            is SubmitPartyPlayUseCase.Payload.Trace -> {
                val reason = implausible(p.points)
                if (reason != null) {
                    round.rejected[seat.seat] = reason
                    log.info { "궤적 개연성 위반 — room=${round.game} seat=${seat.seat} reason=$reason" }
                } else {
                    round.scores[seat.seat] = circleError(p.points)
                }
            }
        }
        if (round.scores.size + round.rejected.size >= round.eligible.size) close(round)
        return view(round)
    }

    override fun execute(roomCode: String): RoundStanding {
        val round = rounds[roomCode] ?: throw BusinessException(ErrorCode.NOT_FOUND, "진행 중인 판이 없습니다")
        if (!round.closed) close(round)
        return view(round)
    }

    /**
     * 마감 — **항상 결과를 만든다.**
     * - 미제출·거부는 최하위이고, 둘 이상이면 그들 사이는 무작위로 갈린다.
     *   정하지 않으면 걸린 사람이 안 정해져 자리가 멈춘다.
     * - **전원 미제출이면 판 무효**다. 다시 한다.
     */
    private fun close(round: PlayRound) {
        round.closed = true
        if (round.scores.isEmpty()) {
            round.voided = true
            round.ranking = emptyList()
            return
        }
        val scored = round.scores.entries.sortedBy { it.value }.map { it.key }
        val rest = (round.eligible - round.scores.keys).shuffled(java.util.Random(random.nextLong()))
        round.ranking = scored + rest
    }

    /** 채점이 아예 불가능해졌다 — 클라이언트 점수로 폴백하지 않고 판을 버린다 */
    fun void(roomCode: String): RoundStanding {
        val round = rounds[roomCode] ?: throw BusinessException(ErrorCode.NOT_FOUND, "진행 중인 판이 없습니다")
        round.closed = true
        round.voided = true
        round.ranking = emptyList()
        return view(round)
    }

    /**
     * 개연성 검사 — 사람 손이 만들 수 없는 궤적을 거른다.
     * **막는 것은 캐주얼 조작이지 작정한 위조가 아니다.**
     */
    private fun implausible(points: List<SubmitPartyPlayUseCase.TracePoint>): String? {
        if (points.size < MIN_POINTS) return "표본 부족"
        if (points.size > MAX_POINTS) return "표본 과다"
        val span = points.last().atMs - points.first().atMs
        if (span < MIN_SPAN_MS) return "너무 빠름"

        val gaps = points.zipWithNext { a, b -> (b.atMs - a.atMs).toDouble() }
        val mean = gaps.average()
        // 사람 손은 표본 간격이 흔들린다. 완전히 균일하면 합성이다.
        val jitter = kotlin.math.sqrt(gaps.sumOf { (it - mean) * (it - mean) } / gaps.size)
        if (mean > 0 && jitter / mean < MIN_JITTER_RATIO) return "간격이 지나치게 균일"
        return null
    }

    /** 반지름 표준편차 / 평균 반지름 — 작을수록 정확한 원 */
    private fun circleError(points: List<SubmitPartyPlayUseCase.TracePoint>): Double {
        val cx = points.map { it.x }.average()
        val cy = points.map { it.y }.average()
        val radii = points.map { hypot(it.x - cx, it.y - cy) }
        val mean = radii.average()
        if (mean <= 0.0) return Double.MAX_VALUE
        val sd = kotlin.math.sqrt(radii.sumOf { (it - mean) * (it - mean) } / radii.size)
        // 한 바퀴를 안 돌았으면 그만큼 벌점 — 짧은 호는 반지름이 고르기 쉽다
        val sweep = sweepRadians(points, cx, cy)
        val closure = (FULL_TURN / sweep.coerceAtLeast(0.1)).coerceAtLeast(1.0)
        return sd / mean * closure
    }

    private fun sweepRadians(points: List<SubmitPartyPlayUseCase.TracePoint>, cx: Double, cy: Double): Double {
        var total = 0.0
        points.zipWithNext { a, b ->
            var d = atan2(b.y - cy, b.x - cx) - atan2(a.y - cy, a.x - cx)
            while (d > Math.PI) d -= FULL_TURN
            while (d < -Math.PI) d += FULL_TURN
            total += abs(d)
        }
        return total
    }

    private fun view(r: PlayRound) = RoundStanding(
        game = r.game,
        open = !r.closed,
        submitted = r.scores.size + r.rejected.size,
        eligible = r.eligible.size,
        ranking = r.ranking,
        rejected = r.rejected.toMap(),
        voided = r.voided,
    )

    private companion object {
        const val TARGET_MS = 7_000L
        const val MIN_POINTS = 12
        const val MAX_POINTS = 4_000
        const val MIN_SPAN_MS = 300L
        const val MIN_JITTER_RATIO = 0.05
        const val FULL_TURN = 2 * Math.PI
    }
}
