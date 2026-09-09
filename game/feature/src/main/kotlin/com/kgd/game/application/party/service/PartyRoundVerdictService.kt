package com.kgd.game.application.party.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.party.usecase.RoundVerdict
import com.kgd.game.application.party.usecase.SubmitRoundHashUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import java.util.concurrent.ConcurrentHashMap

private val log = KotlinLogging.logger {}

/**
 * 결과 해시 다수결 (ADR-0092 · SR-6).
 *
 * 릴레이는 해시가 **몇 개 도착했는지**만 세고(형식), 값을 비교해 **불일치를 판정하는 것**은
 * 여기가 한다(의미). 그 구분이 없으면 릴레이가 페이로드의 뜻을 알게 되어 무권위가 깨진다.
 */
@Service
class PartyRoundVerdictService(
    private val guard: PartySeatGuard,
) : SubmitRoundHashUseCase {

    private val rounds = ConcurrentHashMap<String, HashRound>()

    /** 방마다 연속 무효 횟수 — 2회면 그 게임을 이 방에서 잠근다 */
    private val consecutiveVoids = ConcurrentHashMap<String, Int>()

    private class HashRound(val roundNo: Int, val eligible: Set<Int>) {
        val hashes = ConcurrentHashMap<Int, String>()
        var settled = false
        var agreed: String? = null
        var voided = false
    }

    override fun execute(command: SubmitRoundHashUseCase.Command): RoundVerdict {
        // **관문이 먼저다.** 좌석 없는 사람이 해시를 채우면 다수를 쥘 수 있고,
        // 그러면 결과를 무르는 정도가 아니라 어느 결과를 방의 결과로 만들지 고르게 된다.
        val seat = guard.verify(command.roomCode, command.seat, command.token)
        if (command.hash.isBlank() || command.hash.length > MAX_HASH_CHARS) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "결과 해시 형식이 올바르지 않습니다")
        }
        val round = rounds.compute(seat.room.code) { _, cur ->
            if (cur != null && cur.roundNo == seat.room.roundNo) cur
            else HashRound(seat.room.roundNo, seat.room.occupiedSeats.keys.toSet())
        }!!
        if (round.settled) return view(seat.room.code, round)

        // 좌석당 한 건. 두 번째 해시를 함께 세면 한 사람이 다수를 만들 수 있다.
        round.hashes.putIfAbsent(seat.seat, command.hash)
        if (round.hashes.size >= round.eligible.size) settle(seat.room.code, round)
        return view(seat.room.code, round)
    }

    /** 제한 시간이 지났다 — 온 것만으로 판정한다 */
    fun settleNow(roomCode: String): RoundVerdict {
        val round = rounds[roomCode] ?: throw BusinessException(ErrorCode.NOT_FOUND, "진행 중인 판이 없습니다")
        if (!round.settled) settle(roomCode, round)
        return view(roomCode, round)
    }

    private fun settle(roomCode: String, round: HashRound) {
        round.settled = true
        val counts = round.hashes.values.groupingBy { it }.eachCount()
        val top = counts.values.maxOrNull()
        val leaders = counts.filterValues { it == top }.keys

        // 다수가 하나여야 방의 결과가 된다. 동수면 무효 — 2인 방에서 갈리면 여기 온다.
        if (top == null || leaders.size != 1) {
            round.voided = true
            val n = consecutiveVoids.merge(roomCode, 1, Int::plus)!!
            log.warn { "결과 해시 다수 없음 — room=$roomCode round=${round.roundNo} 연속무효=$n" }
            return
        }
        round.agreed = leaders.first()
        consecutiveVoids.remove(roomCode)
        val diverged = round.hashes.filterValues { it != round.agreed }.keys
        if (diverged.isNotEmpty()) {
            log.warn { "결과 해시 불일치 — room=$roomCode round=${round.roundNo} 이탈좌석=${diverged.size}" }
        }
    }

    private fun view(roomCode: String, r: HashRound): RoundVerdict {
        val voids = consecutiveVoids[roomCode] ?: 0
        return RoundVerdict(
            settled = r.settled,
            submitted = r.hashes.size,
            eligible = r.eligible.size,
            agreed = r.agreed,
            diverged = if (r.agreed == null) emptyList() else r.hashes.filterValues { it != r.agreed }.keys.sorted(),
            voided = r.voided,
            consecutiveVoids = voids,
            gameLocked = voids >= VOIDS_BEFORE_LOCK,
        )
    }

    private companion object {
        const val MAX_HASH_CHARS = 128
        const val VOIDS_BEFORE_LOCK = 2
    }
}
