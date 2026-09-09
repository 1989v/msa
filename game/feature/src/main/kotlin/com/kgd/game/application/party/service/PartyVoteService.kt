package com.kgd.game.application.party.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.party.usecase.CastBallotUseCase
import com.kgd.game.application.party.usecase.OpenVoteUseCase
import com.kgd.game.application.party.usecase.ViewVoteUseCase
import com.kgd.game.application.party.usecase.VoteView
import org.springframework.stereotype.Service
import java.security.SecureRandom
import java.util.concurrent.ConcurrentHashMap

/**
 * 익명 투표 집계 (ADR-0092 · SR-5).
 *
 * **메모리에만 든다.** 판이 끝나면 남기지 않는다 — 남기면 「누가 무엇을 골랐나」가 원장이 된다.
 * 방이 죽으면 투표도 함께 사라지는데, 그것이 옳다(방보다 오래 살 이유가 없다).
 */
@Service
class PartyVoteService(
    private val guard: PartySeatGuard,
) : OpenVoteUseCase, CastBallotUseCase, ViewVoteUseCase {

    /** roomCode → 진행 중인 투표. 방마다 하나 */
    private val votes = ConcurrentHashMap<String, Ballot>()
    private val random = SecureRandom()

    private class Ballot(val candidates: List<String>, val eligible: Int) {
        /** 좌석 → 선택. **이 맵은 밖으로 나가지 않는다** */
        val choices = ConcurrentHashMap<Int, String>()
        var closed: Boolean = false
        var winner: String? = null
    }

    override fun execute(command: OpenVoteUseCase.Command): VoteView {
        val seat = guard.verify(command.roomCode, command.seat, command.token)
        // 진행 권한은 방장에게 있다. 좌석 번호는 릴레이가 아는 사실이라 이 검사가
        // 릴레이에 게임 규칙을 넣지 않는다.
        if (seat.seat != seat.room.occupiedSeats.keys.minOrNull()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "방장만 투표를 열 수 있습니다")
        }
        if (command.candidates.size < 2) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "후보는 둘 이상이어야 합니다")
        }
        val ballot = Ballot(command.candidates.distinct(), seat.room.occupiedSeats.size)
        votes[seat.room.code] = ballot
        return view(ballot)
    }

    override fun execute(command: CastBallotUseCase.Command): VoteView {
        val seat = guard.verify(command.roomCode, command.seat, command.token)
        val ballot = votes[seat.room.code]
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "진행 중인 투표가 없습니다")
        if (ballot.closed) throw BusinessException(ErrorCode.INVALID_INPUT, "이미 마감된 투표입니다")
        if (command.choice !in ballot.candidates) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "후보에 없는 선택입니다")
        }
        // 한 좌석 한 표 — 덮어쓰기가 아니라 첫 표를 지킨다. 바꿔치기를 허용하면
        // 마감 직전에 남의 표를 보고 뒤집는 흐름이 생긴다(집계는 안 보이지만 제출 수는 보인다).
        ballot.choices.putIfAbsent(seat.seat, command.choice)
        if (ballot.choices.size >= ballot.eligible) close(ballot)
        return view(ballot)
    }

    override fun execute(command: ViewVoteUseCase.Command): VoteView {
        val seat = guard.verify(command.roomCode, command.seat, command.token)
        val ballot = votes[seat.room.code]
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "진행 중인 투표가 없습니다")
        return view(ballot)
    }

    /**
     * 마감 — 최다득표. 동표는 무작위로 갈리고, **전원 기권이면 후보 중 무작위**다.
     * 정하지 않으면 자리가 멈춘다.
     */
    private fun close(ballot: Ballot) {
        ballot.closed = true
        val tally = ballot.choices.values.groupingBy { it }.eachCount()
        val top = tally.values.maxOrNull()
        ballot.winner = if (top == null) {
            ballot.candidates[random.nextInt(ballot.candidates.size)]
        } else {
            val tied = tally.filterValues { it == top }.keys.toList()
            tied[random.nextInt(tied.size)]
        }
    }

    /** 방장이 기다리다 마감할 수 있다 — 안 낸 사람은 기권이다 */
    fun closeNow(roomCode: String): VoteView {
        val ballot = votes[roomCode] ?: throw BusinessException(ErrorCode.NOT_FOUND, "진행 중인 투표가 없습니다")
        if (!ballot.closed) close(ballot)
        return view(ballot)
    }

    private fun view(b: Ballot) = VoteView(
        open = !b.closed,
        candidates = b.candidates,
        submitted = b.choices.size,
        eligible = b.eligible,
        // **진행 중에는 비어 있다.** 실시간 카운트는 증분으로 역산된다.
        tally = if (b.closed) b.choices.values.groupingBy { it }.eachCount() else emptyMap(),
        winner = b.winner,
    )
}
