package com.kgd.game.application.party.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.party.port.PartyMetricsPort
import com.kgd.game.application.party.usecase.CircleTarget
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
    /** 없어도 판은 돈다 — 관측이 기능의 전제는 아니다 */
    private val metrics: PartyMetricsPort? = null,
) : StartPartyPlayUseCase, SubmitPartyPlayUseCase, ClosePartyPlayUseCase {

    private val rounds = ConcurrentHashMap<String, PlayRound>()
    private val random = SecureRandom()

    private class PlayRound(
        val game: String,
        val startedMs: Long,
        val eligible: Set<Int>,
        /** 원그리기일 때만. 한 판의 전원이 같은 목표를 받아야 비교가 성립한다 */
        val target: CircleTarget?,
    ) {
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
        val round = PlayRound(
            game = command.game,
            startedMs = clock(),
            eligible = seat.room.occupiedSeats.keys.toSet(),
            target = if (command.game == CIRCLE_GAME) newTarget() else null,
        )
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
                    metrics?.scoringRejected(reason)
                    log.info { "궤적 개연성 위반 — room=${round.game} seat=${seat.seat} reason=$reason" }
                } else {
                    round.scores[seat.seat] = traceError(p.points, round.target ?: newTarget())
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
            metrics?.roundVoided()
            return
        }
        metrics?.roundSettled()
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

    /**
     * 목표 원에서 얼마나 벗어났나 (OQ-2 확정) — **작을수록 정확하다.**
     *
     * ## 왜 「내가 그린 게 원인가」가 아닌가
     * 이 게임은 **주어진 원을 따라 그리는 것**이다. 반지름의 자기 일관성만 재면
     * 목표에서 통째로 벗어난 완벽한 원이 만점을 받는다 — 다른 문제를 푸는 식이다.
     * 중심과 반지름이 둘 다 주어지므로 추정할 것이 없고, 「완벽한 원 그리기」 류가
     * 중심점을 찍어 주는 이유(중심 추정이 가장 큰 불공평 원인)도 여기서는 사라진다.
     *
     * ## 왜 각도 칸으로 나누나
     * 점 개수로 평균 내면 **천천히 그린 구간이 점수를 지배한다** — 거기 점이 몰려서다.
     * 속도는 실력이 아닌데 실력처럼 재게 된다. 한 곳에 멈춰 있으면 그 지점 하나가
     * 수십 표를 갖는 것도 같은 문제다.
     *
     * 각도를 [BINS] 칸으로 나눠 칸마다 한 표씩 주면 셋이 한꺼번에 풀린다 —
     * **속도 무관 · 표본 밀도 무관 · 덜 그린 구간이 저절로 벌점**(빈 칸이 최대 이탈).
     * 따로 「닫힘 벌점」을 곱하는 땜질이 필요 없다.
     */
    private fun traceError(points: List<SubmitPartyPlayUseCase.TracePoint>, target: CircleTarget): Double {
        val worst = target.r * ZERO_SCORE_RATIO
        val filled = DoubleArray(BINS) { -1.0 }

        /** 각도 → 칸 */
        fun binOf(x: Double, y: Double): Int {
            var a = atan2(y - target.cy, x - target.cx)
            if (a < 0) a += FULL_TURN
            return ((a / FULL_TURN) * BINS).toInt().coerceIn(0, BINS - 1)
        }
        fun errOf(p: SubmitPartyPlayUseCase.TracePoint) =
            abs(hypot(p.x - target.cx, p.y - target.cy) - target.r)

        fun mark(bin: Int, e: Double) {
            val v = e.coerceAtMost(worst)
            // 같은 칸을 여러 번 지나면 더 나쁜 쪽을 남긴다 — 한 번 잘 지났다고 덮이면
            // 삐끗한 자국이 사라져 「고르게 그렸나」를 못 재게 된다
            if (filled[bin] < v) filled[bin] = v
        }

        // **연속한 두 점 사이를 이어서 칸을 채운다.** 점만 찍으면 빠르게 지나간 구간이
        // 「안 그린 것」으로 잡혀, 표본이 적을수록 손해를 본다 — 속도가 점수를 바꾸는 바로
        // 그 문제가 커버리지 쪽으로 되살아난다. 사람 손은 이어서 움직이므로 사이도 지나간 것이다.
        points.zipWithNext { a, b ->
            val ba = binOf(a.x, a.y)
            val bb = binOf(b.x, b.y)
            val ea = errOf(a)
            val eb = errOf(b)
            // 짧은 쪽으로 돈다 — 반 바퀴를 넘게 벌어졌으면 표본이 끊긴 것이라 잇지 않는다
            var step = bb - ba
            if (step > BINS / 2) step -= BINS
            if (step < -BINS / 2) step += BINS
            val n = abs(step)
            if (n > BINS / 4) {
                mark(ba, ea); mark(bb, eb)
            } else {
                for (k in 0..n) {
                    val bin = ((ba + (if (step >= 0) k else -k)) % BINS + BINS) % BINS
                    val t = if (n == 0) 0.0 else k.toDouble() / n
                    mark(bin, ea + (eb - ea) * t)
                }
            }
        }
        if (points.size == 1) mark(binOf(points[0].x, points[0].y), errOf(points[0]))

        var squared = 0.0
        for (i in 0 until BINS) {
            // **안 지나간 칸은 최대 이탈이다.** 반원만 그리면 절반이 최대치라 점수가 크게 깎인다 —
            // 짧은 호가 이기는 것을 막는 장치가 이 한 줄이고, 벌점이 「그릴 수 있는 최악」과
            // 같으므로 **어려운 구간을 건너뛰는 것이 엉망으로 그리는 것보다 낫지 않다.**
            val e = if (filled[i] < 0) worst else filled[i]
            squared += e * e
        }
        return kotlin.math.sqrt(squared / BINS) / target.r
    }

    /**
     * 목표 원 — 정규 공간(1000×1000) 안에서 서버가 뽑는다.
     *
     * 중심과 반지름을 조금씩 흔드는 이유는 **판마다 같은 그림이면 손에 익기 때문**이다.
     * 흔드는 폭은 좁게 둔다 — 크게 흔들면 어떤 판은 쉽고 어떤 판은 어려워져
     * 판끼리 비교가 안 된다(한 판 안에서는 전원이 같은 목표라 항상 공평하다).
     */
    private fun newTarget(): CircleTarget = CircleTarget(
        cx = 500.0 + random.nextInt(-40, 41),
        cy = 500.0 + random.nextInt(-40, 41),
        r = (300 + random.nextInt(-30, 31)).toDouble(),
    )

    /** 오차 → 0~100 점. 화면이 자기 식으로 바꾸면 서버와 다른 숫자를 보이게 된다 */
    private fun toScore(error: Double): Double =
        ((1 - error / ZERO_SCORE_RATIO) * 100).coerceIn(0.0, 100.0)

    private fun view(r: PlayRound) = RoundStanding(
        game = r.game,
        target = r.target,
        open = !r.closed,
        submitted = r.scores.size + r.rejected.size,
        eligible = r.eligible.size,
        ranking = r.ranking,
        // 마감 뒤에만 낸다 — 진행 중에 남의 점수가 보이면 그것을 보고 언제 낼지 고른다
        scores = if (!r.closed) emptyMap()
                 else if (r.game == CIRCLE_GAME) r.scores.mapValues { toScore(it.value) }
                 else emptyMap(),
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

        /** 원그리기 게임 슬러그 — 이 게임일 때만 목표 원이 나간다 */
        const val CIRCLE_GAME = "circle-trace"

        /**
         * 각도 칸 수 — 3° 씩. 손가락 폭보다 잘게 나눌 이유가 없고, 잘게 나눌수록
         * 표본 사이를 잇는 보간에 기대게 된다.
         */
        const val BINS = 120

        /**
         * 한 칸이 0점이 되는 이탈 — 반지름의 이 비율.
         *
         * 실측으로 정했다. 사람이 화면의 원을 손가락으로 따라 그리면 보통 반지름의 2~5%를
         * 벗어난다. 0.08 로 잡았더니 그 범위가 전부 92~98점에 뭉쳐 순위는 갈려도 **점수가
         * 아무것도 말하지 않았다.** 0.15 면 2% 이탈이 87점, 4% 가 75점, 8% 가 49점으로
         * 펴진다 — 잘 그린 것과 대충 그린 것이 숫자로 구분된다.
         *
         * 이 값은 **빈 칸의 벌점이기도 하다.** 그리는 최악과 안 그린 것이 같아야
         * 어려운 구간을 건너뛰는 것이 전략이 되지 않는다.
         */
        const val ZERO_SCORE_RATIO = 0.15
    }
}
