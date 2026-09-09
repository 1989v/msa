package com.kgd.game.presentation.party.controller

import com.kgd.common.response.ApiResponse
import com.kgd.game.application.party.usecase.CastBallotUseCase
import com.kgd.game.application.party.usecase.OpenVoteUseCase
import com.kgd.game.application.party.usecase.RoundStanding
import com.kgd.game.application.party.usecase.RoundVerdict
import com.kgd.game.application.party.usecase.StartPartyPlayUseCase
import com.kgd.game.application.party.usecase.SubmitPartyPlayUseCase
import com.kgd.game.application.party.usecase.SubmitRoundHashUseCase
import com.kgd.game.application.party.usecase.ViewVoteUseCase
import com.kgd.game.application.party.usecase.VoteView
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 파티 판 진행 (ADR-0092) — 투표 · 채점 · 결과 해시.
 *
 * **좌석 토큰이 신원이다.** 로그인은 요구하지 않는다 — 초대 링크로 들어온 게스트가 참가자이고,
 * 회원 여부는 이 경로의 판정과 무관하다. 토큰은 릴레이가 좌석을 줄 때 발급한 것이라
 * HTTP 로는 위조할 수 없다.
 *
 * 컨트롤러는 UseCase 인터페이스만 주입한다 (ADR-0083).
 */
@RestController
@RequestMapping("/api/v1/games/party/rooms/{roomCode}")
class PartyController(
    private val openVote: OpenVoteUseCase,
    private val castBallot: CastBallotUseCase,
    private val viewVote: ViewVoteUseCase,
    private val startPlay: StartPartyPlayUseCase,
    private val submitPlay: SubmitPartyPlayUseCase,
    private val submitHash: SubmitRoundHashUseCase,
) {

    @PostMapping("/votes")
    fun open(
        @PathVariable roomCode: String,
        @RequestHeader(SEAT) seat: Int,
        @RequestHeader(TOKEN) token: String,
        @RequestBody request: OpenVoteRequest,
    ): ApiResponse<VoteView> =
        ApiResponse.success(openVote.execute(OpenVoteUseCase.Command(roomCode, seat, token, request.candidates)))

    @PostMapping("/votes/ballots")
    fun cast(
        @PathVariable roomCode: String,
        @RequestHeader(SEAT) seat: Int,
        @RequestHeader(TOKEN) token: String,
        @RequestBody request: BallotRequest,
    ): ApiResponse<VoteView> =
        ApiResponse.success(castBallot.execute(CastBallotUseCase.Command(roomCode, seat, token, request.choice)))

    @GetMapping("/votes")
    fun vote(
        @PathVariable roomCode: String,
        @RequestHeader(SEAT) seat: Int,
        @RequestHeader(TOKEN) token: String,
    ): ApiResponse<VoteView> =
        ApiResponse.success(viewVote.execute(ViewVoteUseCase.Command(roomCode, seat, token)))

    @PostMapping("/plays")
    fun start(
        @PathVariable roomCode: String,
        @RequestHeader(SEAT) seat: Int,
        @RequestHeader(TOKEN) token: String,
        @RequestBody request: StartPlayRequest,
    ): ApiResponse<RoundStanding> =
        ApiResponse.success(startPlay.execute(StartPartyPlayUseCase.Command(roomCode, seat, token, request.game)))

    /**
     * 참여형 제출. **요청 본문에 점수가 없다** — 7초는 「지금 멈췄다」는 사실만 보내고 시각은
     * 서버가 재며, 원그리기는 궤적을 보내고 서버가 채점한다.
     */
    @PostMapping("/plays/submissions")
    fun submit(
        @PathVariable roomCode: String,
        @RequestHeader(SEAT) seat: Int,
        @RequestHeader(TOKEN) token: String,
        @RequestBody request: SubmitPlayRequest,
    ): ApiResponse<RoundStanding> =
        ApiResponse.success(submitPlay.execute(request.toCommand(roomCode, seat, token)))

    /** 비참여형 결과 해시 — 좌석당 한 건. 다수결이 방의 결과를 정한다 */
    @PostMapping("/rounds/hashes")
    fun hash(
        @PathVariable roomCode: String,
        @RequestHeader(SEAT) seat: Int,
        @RequestHeader(TOKEN) token: String,
        @RequestBody request: HashRequest,
    ): ApiResponse<RoundVerdict> =
        ApiResponse.success(submitHash.execute(SubmitRoundHashUseCase.Command(roomCode, seat, token, request.hash)))

    private companion object {
        const val SEAT = "X-Party-Seat"
        const val TOKEN = "X-Party-Token"
    }
}

data class OpenVoteRequest(val candidates: List<String>)

data class BallotRequest(val choice: String)

data class StartPlayRequest(val game: String)

data class HashRequest(val hash: String)

/**
 * 제출 본문. **점수 필드가 없다** — 있으면 폴백하는 코드를 쓸 수 있게 된다.
 *
 * @param trace 원그리기 궤적. 없으면 7초의 「지금 멈췄다」로 읽는다
 */
data class SubmitPlayRequest(val trace: List<TracePointRequest>? = null) {
    fun toCommand(roomCode: String, seat: Int, token: String) = SubmitPartyPlayUseCase.Command(
        roomCode = roomCode,
        seat = seat,
        token = token,
        payload = trace
            ?.let { SubmitPartyPlayUseCase.Payload.Trace(it.map(TracePointRequest::toDomain)) }
            ?: SubmitPartyPlayUseCase.Payload.StopNow,
    )
}

data class TracePointRequest(val x: Double, val y: Double, val atMs: Long) {
    fun toDomain() = SubmitPartyPlayUseCase.TracePoint(x, y, atMs)
}
