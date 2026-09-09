package com.kgd.game.application.party.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.game.application.party.port.PartyRoomView
import com.kgd.game.application.party.port.PartySeatQueryPort
import com.kgd.game.application.party.port.PartySeatTokenPort
import com.kgd.game.application.party.port.SeatClaim
import org.springframework.stereotype.Component

/**
 * 좌석 관문 (ADR-0092) — **투표 · 채점 · 결과 해시 셋이 공유한다.**
 *
 * 셋을 각자 검증하게 두면 한 곳만 느슨해져도 그 경로로 다 들어온다. 실제로 결과 해시에
 * 관문이 없으면 「거짓 해시 하나로 재추첨」을 막으려던 다수결이 뒤집힌다 — 외부인이 해시를
 * 채워 다수를 쥐면 결과를 무르는 정도가 아니라 **어느 결과를 방의 결과로 만들지 고른다.**
 *
 * 방·좌석의 진실은 릴레이만 알고, 방장이 선언한 명단은 받지 않는다.
 */
@Component
class PartySeatGuard(
    private val rooms: PartySeatQueryPort,
    private val tokens: PartySeatTokenPort,
) {

    /** 토큰이 이 방 이 좌석의 것인지 확인하고 방·좌석을 돌려준다 */
    fun verify(roomCode: String, seat: Int, token: String): VerifiedSeat {
        val room = rooms.findRoom(roomCode)
            ?: throw BusinessException(ErrorCode.NOT_FOUND, "방을 찾을 수 없습니다")
        val epoch = room.occupiedSeats[seat]
            ?: throw BusinessException(ErrorCode.INVALID_INPUT, "그 좌석에 앉은 사람이 없습니다")

        val ok = tokens.verify(token, SeatClaim(room.code, room.createdMs, room.roundNo, seat, epoch))
        if (!ok) throw BusinessException(ErrorCode.INVALID_INPUT, "좌석 토큰이 올바르지 않습니다")
        return VerifiedSeat(room, seat)
    }
}

data class VerifiedSeat(val room: PartyRoomView, val seat: Int)
